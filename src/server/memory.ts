// JSgame · MemoryStore — RAG (Retrieval-Augmented Generation) pro Mestre IA.
//
// Mestre só vê últimas 5 narrações na conversa direta. Pra ele lembrar de
// NPCs, locais, promessas, eventos de sessões anteriores, salvamos facts
// indexados via FTS5 (full-text search SQLite, BM25 ranking nativo).
//
// Zero custo: tudo roda em Turso/SQLite já presente. Sem embeddings, sem
// LLM extra. Tokenizer unicode61 com remove_diacritics lida com acentos PT-BR.
//
// Trade-off conhecido: keyword-only matching não captura sinônimos semânticos
// ("dragão" vs "wyvern"). Aceito porque 90% das queries em D&D são literais
// (nome NPC, local específico, item). Se faltar recall, evoluímos pra híbrido
// com LLM rerank (custa TPD) ou embeddings via transformers.js (custa RAM).

import { uuid } from './util.js';
import type { Client } from './persistence.js';
import type { MemoryFact, MemoryFactKind } from '../shared/types.js';

// Stopwords PT-BR — palavras frequentes que não devem virar query (geram noise).
// Lista mínima focada em conectores; FTS5 não tem stoplist nativo no SQLite.
const STOPWORDS_PT = new Set([
  'a', 'o', 'e', 'é', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'ao', 'aos', 'à', 'às', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'após',
  'que', 'qual', 'quais', 'quem', 'onde', 'quando', 'como', 'porque',
  'se', 'sim', 'não', 'também', 'já', 'ainda', 'mais', 'menos', 'muito',
  'pra', 'para', 'ter', 'tem', 'tinha', 'foi', 'era', 'ser', 'estar', 'está',
  'estava', 'eu', 'tu', 'ele', 'ela', 'nós', 'eles', 'elas', 'voce', 'você',
  'meu', 'minha', 'seu', 'sua', 'isso', 'isto', 'aquilo', 'esse', 'essa',
  'este', 'esta', 'aquele', 'aquela',
]);

export interface SearchOptions {
  limit?: number;             // top-K (default 5)
  kinds?: MemoryFactKind[];   // filtrar por tipo
  minImportance?: number;     // descarta facts com importance abaixo de X
  focusNames?: string[];      // PJ-aware boost: nomes dos PJs ativos. Facts mencionando-os sobem no rank.
}

export class MemoryStore {
  constructor(private client: Client) {}

  /**
   * Salva fact. Insert dual em memory_facts (metadata) + memory_facts_fts (índice).
   * Atômico via batch — se uma falha, ambas revertem.
   */
  async saveFact(input: {
    campaignId: string;
    kind: MemoryFactKind;
    text: string;
    tags?: string;
    importance?: number;
    sessionN?: number;
  }): Promise<MemoryFact> {
    const fact: MemoryFact = {
      id: uuid(),
      campaignId: input.campaignId,
      kind: input.kind,
      text: input.text.trim(),
      tags: (input.tags ?? '').trim(),
      importance: input.importance ?? 1.0,
      sessionN: input.sessionN ?? 1,
      createdAt: Date.now(),
    };

    if (!fact.text) {
      throw new Error('memory: fact.text vazio');
    }

    await this.client.batch([
      {
        sql: `INSERT INTO memory_facts
              (id, campaign_id, kind, text, tags, importance, session_n, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [fact.id, fact.campaignId, fact.kind, fact.text, fact.tags, fact.importance, fact.sessionN, fact.createdAt],
      },
      {
        sql: `INSERT INTO memory_facts_fts
              (fact_id, campaign_id, kind, text, tags)
              VALUES (?, ?, ?, ?, ?)`,
        args: [fact.id, fact.campaignId, fact.kind, fact.text, fact.tags],
      },
    ], 'write');

    return fact;
  }

  /**
   * Retrieval principal — query FTS5 com BM25, filtra por campanha + tipos.
   * Boost final aplica `importance` aditivamente no score (mais importante = vem antes).
   *
   * Retorna sorted asc por score (best primeiro, porque bm25 retorna ranks negativos).
   */
  async search(
    campaignId: string,
    queryText: string,
    opts: SearchOptions = {},
  ): Promise<MemoryFact[]> {
    const limit = opts.limit ?? 5;
    const minImportance = opts.minImportance ?? 0;
    const keywords = extractKeywords(queryText);

    // Sem keywords úteis → cai pro "recent" (últimos N facts da campanha)
    if (keywords.length === 0) {
      return this.recent(campaignId, { limit, kinds: opts.kinds, minImportance });
    }

    // FTS5 query: OR de keywords stem-reduzidas + prefix wildcard.
    // Stem garante que "goblins" busque por "goblin*" (capta sing+plur). Sem stem,
    // prefix `goblins*` falha em casar "goblin" singular — limitação de FTS5 puro.
    // PJ-aware: nomes dos PJs ativos viram termos extras na OR — facts mencionando
    // o PJ ganham score natural maior via TF-IDF (não precisa boost manual).
    const focusTokens = (opts.focusNames ?? [])
      .flatMap((n) => extractKeywords(n))
      .map((k) => `${escapeFts(stemFtsToken(k))}*`);
    const queryTokens = keywords.map((k) => `${escapeFts(stemFtsToken(k))}*`);
    const allTokens = [...new Set([...queryTokens, ...focusTokens])];
    const ftsQuery = allTokens.join(' OR ');

    const sql = `
      SELECT
        mf.id, mf.campaign_id, mf.kind, mf.text, mf.tags, mf.importance, mf.session_n, mf.created_at,
        bm25(memory_facts_fts) AS score
      FROM memory_facts_fts fts
      JOIN memory_facts mf ON mf.id = fts.fact_id
      WHERE memory_facts_fts MATCH ?
        AND fts.campaign_id = ?
        ${opts.kinds && opts.kinds.length > 0 ? `AND fts.kind IN (${opts.kinds.map(() => '?').join(',')})` : ''}
        AND mf.importance >= ?
      ORDER BY (bm25(memory_facts_fts) - mf.importance * 0.5) ASC
      LIMIT ?
    `;

    const args: (string | number)[] = [ftsQuery, campaignId];
    if (opts.kinds && opts.kinds.length > 0) args.push(...opts.kinds);
    args.push(minImportance, limit);

    const r = await this.client.execute({ sql, args });
    return r.rows.map(rowToFact);
  }

  /**
   * Fallback: últimos N facts da campanha. Útil quando query não traz keywords úteis
   * ou em primeira narração (sem contexto).
   */
  async recent(
    campaignId: string,
    opts: { limit?: number; kinds?: MemoryFactKind[]; minImportance?: number } = {},
  ): Promise<MemoryFact[]> {
    const limit = opts.limit ?? 5;
    const minImportance = opts.minImportance ?? 0;
    const kindFilter = opts.kinds && opts.kinds.length > 0
      ? `AND kind IN (${opts.kinds.map(() => '?').join(',')})`
      : '';

    const args: (string | number)[] = [campaignId, minImportance];
    if (opts.kinds && opts.kinds.length > 0) args.push(...opts.kinds);
    args.push(limit);

    const r = await this.client.execute({
      sql: `SELECT id, campaign_id, kind, text, tags, importance, session_n, created_at
            FROM memory_facts
            WHERE campaign_id = ? AND importance >= ? ${kindFilter}
            ORDER BY created_at DESC
            LIMIT ?`,
      args,
    });
    return r.rows.map(rowToFact);
  }

  /**
   * Conta facts da campanha (debug + UI futura "memória do Mestre").
   */
  async count(campaignId: string): Promise<number> {
    const r = await this.client.execute({
      sql: 'SELECT COUNT(*) AS c FROM memory_facts WHERE campaign_id = ?',
      args: [campaignId],
    });
    return Number((r.rows[0] as any)?.c ?? 0);
  }

  /**
   * Limpa todos os facts de uma campanha (rage-quit ou reset). Atômico em ambas as tables.
   */
  async purge(campaignId: string): Promise<void> {
    await this.client.batch([
      { sql: 'DELETE FROM memory_facts_fts WHERE campaign_id = ?', args: [campaignId] },
      { sql: 'DELETE FROM memory_facts WHERE campaign_id = ?', args: [campaignId] },
    ], 'write');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

function rowToFact(row: any): MemoryFact {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    kind: row.kind as MemoryFactKind,
    text: row.text as string,
    tags: row.tags as string,
    importance: Number(row.importance),
    sessionN: Number(row.session_n),
    createdAt: Number(row.created_at),
  };
}

/**
 * Extrai keywords de busca: lowercase, sem acentos, sem stopwords, sem dup, >2 chars.
 * Preserva nomes próprios (capitalizados originais) como tokens prioritários — mas
 * normaliza tudo pra lowercase pra match com tokenizer FTS5 (remove_diacritics=2).
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  // Normaliza Unicode, remove diacríticos, lowercase
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Remove pontuação preservando hifens (palavras compostas BR)
    .replace(/[^\p{L}\p{N}\-\s]/gu, ' ');

  const tokens = normalized.split(/\s+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!t || t.length < 3) continue;
    if (STOPWORDS_PT.has(t)) continue;
    if (seen.has(t)) continue;
    // Descarta tokens que são só números (datas, IDs) — ruído pra retrieval narrativo
    if (/^\d+$/.test(t)) continue;
    seen.add(t);
    out.push(t);
  }
  // Limita a 12 keywords — query FTS5 mais longa não traz benefício, só ruído
  return out.slice(0, 12);
}

/**
 * Escapa caracteres especiais do FTS5 query syntax. Preserva o token literal —
 * envolver em "" trataria como phrase, que não queremos com prefix wildcard.
 */
function escapeFts(token: string): string {
  // Remove caracteres que FTS5 interpreta como operator
  return token.replace(/["()*:^-]/g, '');
}

/**
 * Stem raso PT-BR — reduz token à raiz comum singular/feminino antes do prefix wildcard.
 * Não é Snowball completo (muito código pra ganho marginal); mira nos sufixos mais comuns:
 * plural simples (-s, -es), advérbios (-mente), feminino plural (-as → -a).
 *
 * "goblins" → "goblin", "ferreiros" → "ferreiro", "rapidamente" → "rapida"
 * Cap em mínimo 3 chars pra não amputar palavras curtas legítimas.
 */
function stemFtsToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('mente') && token.length > 6) return token.slice(0, -5);
  if (token.endsWith('oes') && token.length > 5) return token.slice(0, -3) + 'ao';   // canhoes → canhao
  if (token.endsWith('aes') && token.length > 5) return token.slice(0, -3) + 'ao';   // capitaes → capitao
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2);           // ladroes → ladro (overshoot mas BM25 lida)
  if (token.endsWith('s')) return token.slice(0, -1);                                // goblins → goblin
  return token;
}

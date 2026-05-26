// Testes do MemoryStore (RAG via FTS5/BM25).
// Usa libsql in-memory pra isolar do file system e rodar rápido.

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { MemoryStore, extractKeywords } from '../memory.js';

async function freshClient(): Promise<Client> {
  const client = createClient({ url: ':memory:' });
  await client.batch([
    `CREATE TABLE memory_facts (
      id          TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      kind        TEXT NOT NULL,
      text        TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '',
      importance  REAL NOT NULL DEFAULT 1.0,
      session_n   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_memory_facts_campaign ON memory_facts(campaign_id, created_at DESC)`,
    `CREATE VIRTUAL TABLE memory_facts_fts USING fts5(
      fact_id UNINDEXED,
      campaign_id UNINDEXED,
      kind UNINDEXED,
      text,
      tags,
      tokenize='unicode61 remove_diacritics 2'
    )`,
  ], 'write');
  return client;
}

describe('extractKeywords', () => {
  it('lowercases e remove acentos PT-BR', () => {
    const kw = extractKeywords('TAVERNA DO CERVO VERMELHO');
    expect(kw).toContain('taverna');
    expect(kw).toContain('cervo');
    expect(kw).toContain('vermelho');
  });

  it('descarta stopwords', () => {
    const kw = extractKeywords('o ferreiro do vilarejo');
    expect(kw).not.toContain('o');
    expect(kw).not.toContain('do');
    expect(kw).toContain('ferreiro');
    expect(kw).toContain('vilarejo');
  });

  it('descarta tokens curtos (< 3 chars)', () => {
    const kw = extractKeywords('eu vi a Vó la');
    expect(kw).not.toContain('eu');
    expect(kw).not.toContain('vi');
    expect(kw).not.toContain('la');
  });

  it('descarta tokens só de números', () => {
    const kw = extractKeywords('matou 3 goblins em 2026');
    expect(kw).not.toContain('3');
    expect(kw).not.toContain('2026');
    expect(kw).toContain('matou');
    expect(kw).toContain('goblins');
  });

  it('dedupa', () => {
    const kw = extractKeywords('goblin goblin GOBLIN');
    expect(kw.filter((k) => k === 'goblin').length).toBe(1);
  });

  it('cap em 12 tokens', () => {
    const longText = Array.from({ length: 30 }, (_, i) => `palavra${i}`).join(' ');
    const kw = extractKeywords(longText);
    expect(kw.length).toBeLessThanOrEqual(12);
  });

  it('retorna [] pra texto vazio', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('   ')).toEqual([]);
  });
});

describe('MemoryStore.saveFact + search', () => {
  let client: Client;
  let store: MemoryStore;

  beforeEach(async () => {
    client = await freshClient();
    store = new MemoryStore(client);
  });

  it('salva e recupera fact por keyword exata', async () => {
    await store.saveFact({
      campaignId: 'camp-1',
      kind: 'npc',
      text: 'Borin Barbalonga é o ferreiro mal-humorado da vila',
      tags: 'npc borin ferreiro',
    });
    const results = await store.search('camp-1', 'ferreiro');
    expect(results.length).toBe(1);
    expect(results[0]!.text).toContain('Borin');
  });

  it('match por keyword acentuada (remove_diacritics)', async () => {
    await store.saveFact({
      campaignId: 'camp-1',
      kind: 'location',
      text: 'A masmorra do Lich tem uma poça de água',
    });
    const results = await store.search('camp-1', 'agua');
    expect(results.length).toBe(1);
  });

  it('isola busca por campanha', async () => {
    await store.saveFact({ campaignId: 'camp-A', kind: 'npc', text: 'Berserker furioso na taverna' });
    await store.saveFact({ campaignId: 'camp-B', kind: 'npc', text: 'Berserker furioso na taverna' });
    const ra = await store.search('camp-A', 'berserker');
    const rb = await store.search('camp-B', 'berserker');
    expect(ra.length).toBe(1);
    expect(rb.length).toBe(1);
    expect(ra[0]!.campaignId).toBe('camp-A');
    expect(rb[0]!.campaignId).toBe('camp-B');
  });

  it('ranking BM25 ordena pelo mais relevante', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'lore', text: 'Goblins atacaram a vila ontem' });
    await store.saveFact({ campaignId: 'c', kind: 'lore', text: 'Um único goblin foi visto no escuro' });
    await store.saveFact({ campaignId: 'c', kind: 'lore', text: 'Goblins, goblins, e mais goblins por toda parte' });

    const results = await store.search('c', 'goblins', { limit: 3 });
    expect(results.length).toBe(3);
    // O fact com 3 ocorrências de "goblins" tem o melhor BM25 (score mais negativo).
    expect(results[0]!.text).toContain('por toda parte');
  });

  it('boost de importance afeta ranking', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'O dragão apareceu', importance: 0.5 });
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'O dragão apareceu', importance: 2.0 });
    const results = await store.search('c', 'dragao', { limit: 2 });
    expect(results.length).toBe(2);
    // Fact com importance 2.0 deve vir antes
    expect(results[0]!.importance).toBe(2.0);
  });

  it('filtra por kinds', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'npc', text: 'Borin é o ferreiro' });
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'Borin morreu na batalha' });
    const onlyNpc = await store.search('c', 'borin', { kinds: ['npc'] });
    expect(onlyNpc.length).toBe(1);
    expect(onlyNpc[0]!.kind).toBe('npc');
  });

  it('respeita minImportance', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'detalhe pequeno', importance: 0.3 });
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'detalhe importante', importance: 1.5 });
    const r = await store.search('c', 'detalhe', { minImportance: 1.0 });
    expect(r.length).toBe(1);
    expect(r[0]!.importance).toBe(1.5);
  });

  it('respeita limit', async () => {
    for (let i = 0; i < 10; i++) {
      await store.saveFact({ campaignId: 'c', kind: 'lore', text: `evento numero ${i} aconteceu` });
    }
    const r = await store.search('c', 'evento', { limit: 3 });
    expect(r.length).toBe(3);
  });

  it('rejeita fact com text vazio', async () => {
    await expect(
      store.saveFact({ campaignId: 'c', kind: 'npc', text: '   ' }),
    ).rejects.toThrow(/vazio/);
  });

  it('busca sem keywords úteis cai pro recent()', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'npc', text: 'fato A' });
    await store.saveFact({ campaignId: 'c', kind: 'npc', text: 'fato B' });
    await store.saveFact({ campaignId: 'c', kind: 'npc', text: 'fato C' });
    // Query só com stopword/curtos não gera keywords úteis
    const r = await store.search('c', 'o e a um');
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('MemoryStore.recent', () => {
  let client: Client;
  let store: MemoryStore;

  beforeEach(async () => {
    client = await freshClient();
    store = new MemoryStore(client);
  });

  it('retorna mais recentes primeiro', async () => {
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'primeiro evento da campanha' });
    // Garante ordering temporal estável
    await new Promise((r) => setTimeout(r, 5));
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'segundo evento da campanha' });
    await new Promise((r) => setTimeout(r, 5));
    await store.saveFact({ campaignId: 'c', kind: 'event', text: 'terceiro evento da campanha' });

    const r = await store.recent('c', { limit: 2 });
    expect(r.length).toBe(2);
    expect(r[0]!.text).toContain('terceiro');
    expect(r[1]!.text).toContain('segundo');
  });
});

describe('MemoryStore.count + purge', () => {
  it('count e purge funcionam por campanha', async () => {
    const client = await freshClient();
    const store = new MemoryStore(client);
    await store.saveFact({ campaignId: 'A', kind: 'npc', text: 'um NPC aqui' });
    await store.saveFact({ campaignId: 'A', kind: 'event', text: 'um evento aqui' });
    await store.saveFact({ campaignId: 'B', kind: 'npc', text: 'NPC da outra campanha' });

    expect(await store.count('A')).toBe(2);
    expect(await store.count('B')).toBe(1);

    await store.purge('A');
    expect(await store.count('A')).toBe(0);
    expect(await store.count('B')).toBe(1);

    // FTS5 também limpa — busca não retorna mais
    const r = await store.search('A', 'NPC');
    expect(r.length).toBe(0);
  });
});

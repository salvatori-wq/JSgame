// JSgame · Persistência via Turso/libsql (SQLite distribuído).
//
// Migração: era sql.js (síncrono, in-memory + flush throttle). Agora libsql
// client (async, mas com mesmo SQL embarcado).
//
// LOCAL DEV: TURSO_DATABASE_URL não setado → usa `file:.run-data/jsgame.db`
// (libsql nativamente lê/grava em SQLite local — zero config).
//
// PROD (Render): TURSO_DATABASE_URL=libsql://xxx.turso.io + TURSO_AUTH_TOKEN
// → Turso edge SQLite distribuído. 9GB free / 500 dbs.
//
// API é toda async agora (libsql não tem sync mode no Node).

import { createClient, type Client, type ResultSet } from '@libsql/client';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CharacterSheet, CampaignState } from '../shared/types.js';

export type { Client } from '@libsql/client';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), '.run-data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'jsgame.db');

let client: Client | null = null;

export async function initPersistence(): Promise<void> {
  if (client) return;

  // Decide entre Turso remoto e SQLite local
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    console.log(`[persistence] Turso remoto: ${tursoUrl.replace(/(token=)[^&]+/, '$1***')}`);
    client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
  } else {
    // SQLite local file
    await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => { /* ignore */ });
    const fileUrl = `file:${LOCAL_DB_FILE.replace(/\\/g, '/')}`;
    console.log(`[persistence] SQLite local: ${fileUrl}`);
    client = createClient({ url: fileUrl });
  }

  // Schema — mesmo que antes (compat sqlite/libsql)
  await client.batch([
    `CREATE TABLE IF NOT EXISTS characters (
      id            TEXT PRIMARY KEY,
      ownerName     TEXT NOT NULL,
      characterName TEXT NOT NULL,
      classId       TEXT NOT NULL,
      raceId        TEXT NOT NULL,
      level         INTEGER NOT NULL,
      sheet         TEXT NOT NULL,
      createdAt     INTEGER NOT NULL,
      lastPlayedAt  INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(ownerName, lastPlayedAt DESC)`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      state         TEXT NOT NULL,
      sessionNumber INTEGER NOT NULL,
      lastPlayedAt  INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_recent ON campaigns(lastPlayedAt DESC)`,
    // RAG memory pro Mestre — fatos persistentes cross-session indexados por FTS5.
    // Tabela "fonte" guarda metadata, FTS5 virtual indexa text+tags pra busca BM25.
    // Tokenizer unicode61 com remove_diacritics=2 lida com acentos PT-BR.
    `CREATE TABLE IF NOT EXISTS memory_facts (
      id          TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      kind        TEXT NOT NULL,
      text        TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '',
      importance  REAL NOT NULL DEFAULT 1.0,
      session_n   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memory_facts_campaign ON memory_facts(campaign_id, created_at DESC)`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS memory_facts_fts USING fts5(
      fact_id UNINDEXED,
      campaign_id UNINDEXED,
      kind UNINDEXED,
      text,
      tags,
      tokenize='unicode61 remove_diacritics 2'
    )`,
    // Auth — F15. Magic link passwordless. Opaque tokens via crypto.randomBytes,
    // sem JWT (permite revogar facilmente, sem secret env var).
    `CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
      display_name    TEXT,
      email_verified  INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      last_login_at   INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE TABLE IF NOT EXISTS email_tokens (
      token        TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      kind         TEXT NOT NULL,
      expires_at   INTEGER NOT NULL,
      consumed_at  INTEGER,
      created_at   INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id)`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    // F17 — Achievements unlocked + counters cumulativos por user.
    `CREATE TABLE IF NOT EXISTS achievements_unlocked (
      user_id        TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at    INTEGER NOT NULL,
      context        TEXT,
      PRIMARY KEY (user_id, achievement_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ach_user ON achievements_unlocked(user_id, unlocked_at DESC)`,
    `CREATE TABLE IF NOT EXISTS achievements_counters (
      user_id    TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      value      INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, counter_id)
    )`,
    // F19 — Cemitério persistente. Cada PJ morto vira uma "lápide" com epitáfio.
    // user_id null = morte anônima (PJ legado sem auth). Aparece em home no perfil.
    `CREATE TABLE IF NOT EXISTS tombstones (
      id              TEXT PRIMARY KEY,
      user_id         TEXT,
      character_id    TEXT NOT NULL,
      character_name  TEXT NOT NULL,
      race_id         TEXT NOT NULL,
      class_id        TEXT NOT NULL,
      level           INTEGER NOT NULL,
      campaign_id     TEXT,
      campaign_name   TEXT,
      died_at         INTEGER NOT NULL,
      epitaph         TEXT NOT NULL,
      cause           TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tombstones_user ON tombstones(user_id, died_at DESC)`,
    // F20 — Daily streak (1 row por user)
    `CREATE TABLE IF NOT EXISTS daily_streaks (
      user_id          TEXT PRIMARY KEY,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      longest_streak   INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT NOT NULL,
      total_days       INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL
    )`,
    // F20 — Highlights (momentos marcantes flagados pelo DM via mark_highlight)
    `CREATE TABLE IF NOT EXISTS highlights (
      id            TEXT PRIMARY KEY,
      user_id       TEXT,
      campaign_id   TEXT NOT NULL,
      character_id  TEXT,
      character_name TEXT,
      summary       TEXT NOT NULL,
      kind          TEXT NOT NULL DEFAULT 'moment',
      created_at    INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_highlights_campaign ON highlights(campaign_id, created_at DESC)`,
    // A4 — Friend graph. Par simétrico (sempre user_a < user_b alfabético pra evitar duplicação).
    // status='pending' (pediu mas não aceito) | 'accepted'. Removidos = DELETE row.
    `CREATE TABLE IF NOT EXISTS friendships (
      user_a      TEXT NOT NULL,
      user_b      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      accepted_at INTEGER,
      PRIMARY KEY (user_a, user_b)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_a, status)`,
    `CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_b, status)`,
    // A4 — Invites por email pra users que ainda não existem. Email-keyed.
    // Quando user registra com email match, invite vira friendship automática.
    `CREATE TABLE IF NOT EXISTS friend_invites (
      id           TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_email     TEXT NOT NULL COLLATE NOCASE,
      lobby_code   TEXT,
      created_at   INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL,
      consumed_at  INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_friend_invites_email ON friend_invites(to_email, consumed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_friend_invites_from ON friend_invites(from_user_id, created_at DESC)`,
    // T1 — Telemetria mínima. Eventos genéricos por user/anon + ts.
    `CREATE TABLE IF NOT EXISTS metrics_events (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      session_id TEXT,
      kind       TEXT NOT NULL,
      payload    TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_metrics_kind ON metrics_events(kind, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_metrics_user ON metrics_events(user_id, created_at DESC)`,
    // β.1 — NPC roster persistente por campaign (memória de NPCs entre sessões)
    `CREATE TABLE IF NOT EXISTS npc_roster (
      campaign_id        TEXT NOT NULL,
      id                 TEXT NOT NULL,
      name               TEXT NOT NULL,
      archetype          TEXT NOT NULL,
      attitude           TEXT NOT NULL,
      first_met          INTEGER NOT NULL,
      last_seen          INTEGER NOT NULL,
      last_location      TEXT NOT NULL,
      interaction_count  INTEGER NOT NULL DEFAULT 1,
      notes              TEXT NOT NULL DEFAULT '',
      relationship       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (campaign_id, id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_npc_roster_camp ON npc_roster(campaign_id, last_seen DESC)`,
  ], 'write');

  // Migration leve: adiciona user_id na tabela characters se não existe.
  // ALTER TABLE ADD COLUMN é idempotente via try/catch (SQLite não tem IF NOT EXISTS pra ADD COLUMN).
  try {
    await client.execute('ALTER TABLE characters ADD COLUMN user_id TEXT');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id, lastPlayedAt DESC)');
    console.log('[persistence] migration: added characters.user_id');
  } catch (err) {
    // Já existe (erro "duplicate column"), ignora silenciosamente
    const msg = err instanceof Error ? err.message : String(err);
    if (!/duplicate column|already exists/i.test(msg)) {
      console.warn('[persistence] ALTER characters falhou:', msg);
    }
  }

  console.log('[persistence] schema ready');
}

function requireClient(): Client {
  if (!client) throw new Error('persistence not initialized — call initPersistence() first');
  return client;
}

// Exposto pra MemoryStore (e qualquer outro módulo que precise queries diretas).
export function getDbClient(): Client {
  return requireClient();
}

export async function shutdownPersistence(): Promise<void> {
  client?.close();
  client = null;
}

// ════════════════════════════════════════════════════════════════════════════
// Characters
// ════════════════════════════════════════════════════════════════════════════

export async function saveCharacter(sheet: CharacterSheet): Promise<void> {
  await requireClient().execute({
    sql: 'INSERT OR REPLACE INTO characters (id, ownerName, user_id, characterName, classId, raceId, level, sheet, createdAt, lastPlayedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      sheet.id, sheet.ownerName, sheet.userId ?? null, sheet.characterName, sheet.classId, sheet.raceId,
      sheet.level, JSON.stringify(sheet), sheet.createdAt, sheet.lastPlayedAt,
    ],
  });
}

export async function loadCharacter(id: string): Promise<CharacterSheet | null> {
  const r = await requireClient().execute({
    sql: 'SELECT sheet FROM characters WHERE id = ?',
    args: [id],
  });
  const row = r.rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.sheet as string) as CharacterSheet;
  } catch (err) {
    console.warn('[persistence] corrupted character sheet:', id, err);
    return null;
  }
}

export interface CharacterSummary {
  id: string;
  characterName: string;
  classId: string;
  raceId: string;
  level: number;
  lastPlayedAt: number;
}

export async function listCharactersByOwner(ownerName: string): Promise<CharacterSummary[]> {
  const r = await requireClient().execute({
    sql: 'SELECT id, characterName, classId, raceId, level, lastPlayedAt FROM characters WHERE ownerName = ? ORDER BY lastPlayedAt DESC',
    args: [ownerName],
  });
  return r.rows.map(row => ({
    id: row.id as string,
    characterName: row.characterName as string,
    classId: row.classId as string,
    raceId: row.raceId as string,
    level: Number(row.level),
    lastPlayedAt: Number(row.lastPlayedAt),
  }));
}

/**
 * Lista PJs do user autenticado (F15+). Usado quando user logou via magic link.
 * PJs anônimos legados continuam acessíveis via listCharactersByOwner.
 */
export async function listCharactersByUserId(userId: string): Promise<CharacterSummary[]> {
  const r = await requireClient().execute({
    sql: 'SELECT id, characterName, classId, raceId, level, lastPlayedAt FROM characters WHERE user_id = ? ORDER BY lastPlayedAt DESC',
    args: [userId],
  });
  return r.rows.map(row => ({
    id: row.id as string,
    characterName: row.characterName as string,
    classId: row.classId as string,
    raceId: row.raceId as string,
    level: Number(row.level),
    lastPlayedAt: Number(row.lastPlayedAt),
  }));
}

export async function deleteCharacter(id: string): Promise<void> {
  await requireClient().execute({ sql: 'DELETE FROM characters WHERE id = ?', args: [id] });
}

// ════════════════════════════════════════════════════════════════════════════
// Campaigns
// ════════════════════════════════════════════════════════════════════════════

export async function saveCampaign(state: CampaignState): Promise<void> {
  await requireClient().execute({
    sql: 'INSERT OR REPLACE INTO campaigns (id, name, state, sessionNumber, lastPlayedAt) VALUES (?, ?, ?, ?, ?)',
    args: [state.id, state.name, JSON.stringify(state), state.sessionNumber, state.lastPlayedAt],
  });
}

export async function loadCampaign(id: string): Promise<CampaignState | null> {
  const r = await requireClient().execute({
    sql: 'SELECT state FROM campaigns WHERE id = ?',
    args: [id],
  });
  const row = r.rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.state as string) as CampaignState;
  } catch (err) {
    console.warn('[persistence] corrupted campaign state:', id, err);
    return null;
  }
}

export async function listRecentCampaigns(limit = 20): Promise<Array<{ id: string; name: string; sessionNumber: number; lastPlayedAt: number }>> {
  const r = await requireClient().execute({
    sql: 'SELECT id, name, sessionNumber, lastPlayedAt FROM campaigns ORDER BY lastPlayedAt DESC LIMIT ?',
    args: [limit],
  });
  return r.rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    sessionNumber: Number(row.sessionNumber),
    lastPlayedAt: Number(row.lastPlayedAt),
  }));
}

// QW-3 — Lista APENAS crônicas onde algum PJ do user (autenticado) está na party.
// Schema atual não normaliza partyCharacterIds — está dentro do JSON state.
// Estratégia: fetch top N candidates ordenadas por lastPlayedAt, filter em memória.
// Performance: para N=200 campaigns ativas a custo é ~200 JSON.parse (microssegundos).
export async function listRecentCampaignsByUserId(userId: string, limit = 20): Promise<Array<{ id: string; name: string; sessionNumber: number; lastPlayedAt: number }>> {
  const client = requireClient();
  // 1) Carrega IDs dos PJs do user
  const charRows = await client.execute({
    sql: 'SELECT id FROM characters WHERE user_id = ?',
    args: [userId],
  });
  if (charRows.rows.length === 0) return [];
  const charIds = new Set<string>(charRows.rows.map(r => r.id as string));

  // 2) Pega campaigns mais recentes (até 4× o limit pra cobrir filtros)
  const r = await client.execute({
    sql: 'SELECT id, name, state, sessionNumber, lastPlayedAt FROM campaigns ORDER BY lastPlayedAt DESC LIMIT ?',
    args: [Math.max(limit * 4, 80)],
  });

  const out: Array<{ id: string; name: string; sessionNumber: number; lastPlayedAt: number }> = [];
  for (const row of r.rows) {
    try {
      const state = JSON.parse(row.state as string) as { partyCharacterIds?: string[] };
      const partyIds = state.partyCharacterIds ?? [];
      if (partyIds.some((id) => charIds.has(id))) {
        out.push({
          id: row.id as string,
          name: row.name as string,
          sessionNumber: Number(row.sessionNumber),
          lastPlayedAt: Number(row.lastPlayedAt),
        });
        if (out.length >= limit) break;
      }
    } catch { /* state JSON corrupted — skip silenciosamente */ }
  }
  return out;
}

// Remove crônica + dados ligados (RAG memory + highlights).
// Tombstones e metrics_events ficam — são history do user, não da crônica em si.
export async function deleteCampaign(id: string): Promise<void> {
  const client = requireClient();
  await client.execute({ sql: 'DELETE FROM memory_facts_fts WHERE campaign_id = ?', args: [id] });
  await client.execute({ sql: 'DELETE FROM memory_facts WHERE campaign_id = ?', args: [id] });
  await client.execute({ sql: 'DELETE FROM highlights WHERE campaign_id = ?', args: [id] });
  await client.execute({ sql: 'DELETE FROM npc_roster WHERE campaign_id = ?', args: [id] }); // β.1
  await client.execute({ sql: 'DELETE FROM campaigns WHERE id = ?', args: [id] });
}

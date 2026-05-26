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
  ], 'write');

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
    sql: 'INSERT OR REPLACE INTO characters (id, ownerName, characterName, classId, raceId, level, sheet, createdAt, lastPlayedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      sheet.id, sheet.ownerName, sheet.characterName, sheet.classId, sheet.raceId,
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

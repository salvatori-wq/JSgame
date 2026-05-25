// JSgame · Persistência SQLite via sql.js (pure-JS, zero compile).
// Decisão: better-sqlite3 exige Visual Studio Build Tools no Windows — quebra
// no boot. sql.js é pure JS, roda em qualquer Node, e custo de I/O é trivial
// pro escopo (até ~100 characters + campanhas).
//
// Pattern: in-memory DB, flush serializado pra arquivo num write-throttle de 2s.
// Aprendizado Cave Run: flushDb síncrono em CADA save dobra latência.

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { CharacterSheet, CampaignState } from '../shared/types.js';

// DATA_DIR pode ser override por env (útil pra deploy Render com disco persistente).
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), '.run-data');
const DB_FILE = path.join(DATA_DIR, 'jsgame.db');
const FLUSH_THROTTLE_MS = 2000;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let pendingFlush = false;
let flushTimer: NodeJS.Timeout | undefined;

export async function initPersistence(): Promise<void> {
  if (db) return;
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => { /* ignore */ });
  SQL = await initSqlJs();
  let existing: Buffer | null = null;
  try { existing = await fs.readFile(DB_FILE); } catch { /* primeiro boot */ }
  db = existing ? new SQL.Database(new Uint8Array(existing)) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id            TEXT PRIMARY KEY,
      ownerName     TEXT NOT NULL,
      characterName TEXT NOT NULL,
      classId       TEXT NOT NULL,
      raceId        TEXT NOT NULL,
      level         INTEGER NOT NULL,
      sheet         TEXT NOT NULL,
      createdAt     INTEGER NOT NULL,
      lastPlayedAt  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(ownerName, lastPlayedAt DESC);

    CREATE TABLE IF NOT EXISTS campaigns (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      state         TEXT NOT NULL,
      sessionNumber INTEGER NOT NULL,
      lastPlayedAt  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaigns_recent ON campaigns(lastPlayedAt DESC);
  `);

  console.log('[persistence] SQLite ready at', DB_FILE);
}

function requireDb(): Database {
  if (!db) throw new Error('persistence not initialized — call initPersistence() first');
  return db;
}

// Write-throttle: marca dirty + agenda flush. Múltiplos saves coalescem.
function scheduleFlush(): void {
  if (flushTimer) { pendingFlush = true; return; }
  flushTimer = setTimeout(async () => {
    flushTimer = undefined;
    await flushNow();
    if (pendingFlush) { pendingFlush = false; scheduleFlush(); }
  }, FLUSH_THROTTLE_MS);
}

async function flushNow(): Promise<void> {
  if (!db) return;
  try {
    const data = Buffer.from(db.export());
    await fs.writeFile(DB_FILE, data);
  } catch (err) {
    console.warn('[persistence] flush failed:', err);
  }
}

// Graceful shutdown — server chama no SIGTERM/SIGINT.
export async function shutdownPersistence(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = undefined; }
  await flushNow();
}

// ════════════════════════════════════════════════════════════════════════════
// Characters
// ════════════════════════════════════════════════════════════════════════════

export function saveCharacter(sheet: CharacterSheet): void {
  const stmt = requireDb().prepare(
    'INSERT OR REPLACE INTO characters (id, ownerName, characterName, classId, raceId, level, sheet, createdAt, lastPlayedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run([
    sheet.id, sheet.ownerName, sheet.characterName, sheet.classId, sheet.raceId,
    sheet.level, JSON.stringify(sheet), sheet.createdAt, sheet.lastPlayedAt,
  ]);
  stmt.free();
  scheduleFlush();
}

export function loadCharacter(id: string): CharacterSheet | null {
  const stmt = requireDb().prepare('SELECT sheet FROM characters WHERE id = ?');
  stmt.bind([id]);
  let result: CharacterSheet | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { sheet: string };
    try { result = JSON.parse(row.sheet) as CharacterSheet; }
    catch (err) { console.warn('[persistence] corrupted character sheet:', id, err); }
  }
  stmt.free();
  return result;
}

export interface CharacterSummary {
  id: string;
  characterName: string;
  classId: string;
  raceId: string;
  level: number;
  lastPlayedAt: number;
}

export function listCharactersByOwner(ownerName: string): CharacterSummary[] {
  const stmt = requireDb().prepare(
    'SELECT id, characterName, classId, raceId, level, lastPlayedAt FROM characters WHERE ownerName = ? ORDER BY lastPlayedAt DESC'
  );
  stmt.bind([ownerName]);
  const out: CharacterSummary[] = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject() as unknown as CharacterSummary);
  }
  stmt.free();
  return out;
}

export function deleteCharacter(id: string): void {
  const stmt = requireDb().prepare('DELETE FROM characters WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  scheduleFlush();
}

// ════════════════════════════════════════════════════════════════════════════
// Campaigns
// ════════════════════════════════════════════════════════════════════════════

export function saveCampaign(state: CampaignState): void {
  const stmt = requireDb().prepare(
    'INSERT OR REPLACE INTO campaigns (id, name, state, sessionNumber, lastPlayedAt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run([state.id, state.name, JSON.stringify(state), state.sessionNumber, state.lastPlayedAt]);
  stmt.free();
  scheduleFlush();
}

export function loadCampaign(id: string): CampaignState | null {
  const stmt = requireDb().prepare('SELECT state FROM campaigns WHERE id = ?');
  stmt.bind([id]);
  let result: CampaignState | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { state: string };
    try { result = JSON.parse(row.state) as CampaignState; }
    catch (err) { console.warn('[persistence] corrupted campaign state:', id, err); }
  }
  stmt.free();
  return result;
}

export function listRecentCampaigns(limit = 20): Array<{ id: string; name: string; sessionNumber: number; lastPlayedAt: number }> {
  const stmt = requireDb().prepare(
    'SELECT id, name, sessionNumber, lastPlayedAt FROM campaigns ORDER BY lastPlayedAt DESC LIMIT ?'
  );
  stmt.bind([limit]);
  const out: Array<{ id: string; name: string; sessionNumber: number; lastPlayedAt: number }> = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject() as unknown as { id: string; name: string; sessionNumber: number; lastPlayedAt: number });
  }
  stmt.free();
  return out;
}

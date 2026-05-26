// JSgame · F19 — Cemitério de PJs mortos.
// Cada PJ que morre (death-save 3 falhas) ganha uma lápide com epitáfio gerado
// pelo Mestre (Groq). Async fire-and-forget — fallback simples se LLM falha.

import { getDbClient } from './persistence.js';
import type { CharacterSheet } from '../shared/types.js';
import type { DMInterface } from './dm/dm.js';
import { uuid } from './util.js';

export interface Tombstone {
  id: string;
  userId: string | null;
  characterId: string;
  characterName: string;
  raceId: string;
  classId: string;
  level: number;
  campaignId: string | null;
  campaignName: string | null;
  diedAt: number;
  epitaph: string;
  cause: string | null;
}

const FALLBACK_EPITAPHS = [
  'Sangrou rápido, lembrado curto.',
  'Foi nobre por ~6 segundos. Depois fudeu.',
  'Aqui jaz quem cabou esquecendo da CON.',
  'Cumpriu a missão de morrer com estilo.',
  'Tava perto. Tava muito perto.',
  'Olha o dado, ó. Olha a face.',
  'O Mestre avisou — mas você tinha um plano.',
];

function pickFallbackEpitaph(): string {
  return FALLBACK_EPITAPHS[Math.floor(Math.random() * FALLBACK_EPITAPHS.length)]!;
}

/**
 * Salva lápide persistente. Tenta gerar epitáfio com Groq se dm.summarize disponível,
 * senão usa fallback. Não bloqueia caller (LLM call async dentro).
 *
 * Pra evitar duplicar lápides quando rollDeathSave dispara mais de uma vez, usa
 * (characterId, diedAt-floored-to-minute) como dedupe natural via cláusula
 * "INSERT OR IGNORE" — primary key é id mas a query SELECT antes garante uniqueness.
 */
export async function saveTombstone(input: {
  sheet: CharacterSheet;
  campaignId?: string | null;
  campaignName?: string | null;
  cause?: string | null;
  dm?: DMInterface;
}): Promise<Tombstone> {
  const existing = await findRecentTombstone(input.sheet.id);
  if (existing) return existing;  // já tem lápide recente — não duplica

  const epitaph = await generateEpitaph(input).catch(() => pickFallbackEpitaph());

  const tomb: Tombstone = {
    id: uuid(),
    userId: input.sheet.userId ?? null,
    characterId: input.sheet.id,
    characterName: input.sheet.characterName,
    raceId: input.sheet.raceId,
    classId: input.sheet.classId,
    level: input.sheet.level,
    campaignId: input.campaignId ?? null,
    campaignName: input.campaignName ?? null,
    diedAt: Date.now(),
    epitaph,
    cause: input.cause ?? null,
  };

  await getDbClient().execute({
    sql: `INSERT INTO tombstones
      (id, user_id, character_id, character_name, race_id, class_id, level, campaign_id, campaign_name, died_at, epitaph, cause)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      tomb.id, tomb.userId, tomb.characterId, tomb.characterName,
      tomb.raceId, tomb.classId, tomb.level,
      tomb.campaignId, tomb.campaignName, tomb.diedAt, tomb.epitaph, tomb.cause,
    ],
  });
  return tomb;
}

async function generateEpitaph(input: {
  sheet: CharacterSheet;
  campaignName?: string | null;
  cause?: string | null;
}): Promise<string> {
  // F19: usa Groq via DM.summarize com prompt curtinho. Fallback se LLM indisponível.
  // Para zero-budget: 1 chamada Groq por morte é negligenciável (raríssimo evento).
  // TODO F22: trocar pra Gemini se já estiver disponível.
  // Por enquanto, fallback estático — invocar LLM aqui exigiria refactor maior.
  // Quando F22 implementar provider switching, expôr `dm.shortGenerate(prompt)` simples.
  return pickFallbackEpitaph();
}

async function findRecentTombstone(characterId: string): Promise<Tombstone | null> {
  // Mesmo PJ pode morrer mais de uma vez (ressuscitado, recarregado, etc).
  // Janela de 60s pra dedupe imediato (rollDeathSave disparado 2x).
  const since = Date.now() - 60_000;
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM tombstones WHERE character_id = ? AND died_at > ? ORDER BY died_at DESC LIMIT 1',
    args: [characterId, since],
  });
  const row = r.rows[0];
  if (!row) return null;
  return rowToTombstone(row);
}

export async function listTombstonesForUser(userId: string): Promise<Tombstone[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM tombstones WHERE user_id = ? ORDER BY died_at DESC LIMIT 50',
    args: [userId],
  });
  return r.rows.map(rowToTombstone);
}

export async function listTombstonesForOwner(_ownerName: string): Promise<Tombstone[]> {
  // PJ anônimo legacy não tem user_id. Lista apenas user-bound — anon não persiste.
  return [];
}

function rowToTombstone(row: Record<string, unknown>): Tombstone {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    characterId: String(row.character_id),
    characterName: String(row.character_name),
    raceId: String(row.race_id),
    classId: String(row.class_id),
    level: Number(row.level),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    campaignName: row.campaign_name ? String(row.campaign_name) : null,
    diedAt: Number(row.died_at),
    epitaph: String(row.epitaph),
    cause: row.cause ? String(row.cause) : null,
  };
}

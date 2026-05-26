// JSgame · F20 — Highlight reel. Mestre marca momentos memoráveis via tool.
// Lista persistente por user, mostrada na home/profile como "Melhores momentos".

import { getDbClient } from './persistence.js';
import { uuid } from './util.js';

export type HighlightKind = 'moment' | 'kill' | 'speech' | 'choice' | 'twist';

export interface Highlight {
  id: string;
  userId: string | null;
  campaignId: string;
  characterId: string | null;
  characterName: string | null;
  summary: string;
  kind: HighlightKind;
  createdAt: number;
}

export async function saveHighlight(input: {
  userId?: string | null;
  campaignId: string;
  characterId?: string | null;
  characterName?: string | null;
  summary: string;
  kind?: HighlightKind;
}): Promise<Highlight> {
  const h: Highlight = {
    id: uuid(),
    userId: input.userId ?? null,
    campaignId: input.campaignId,
    characterId: input.characterId ?? null,
    characterName: input.characterName ?? null,
    summary: input.summary,
    kind: input.kind ?? 'moment',
    createdAt: Date.now(),
  };
  await getDbClient().execute({
    sql: `INSERT INTO highlights (id, user_id, campaign_id, character_id, character_name, summary, kind, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [h.id, h.userId, h.campaignId, h.characterId, h.characterName, h.summary, h.kind, h.createdAt],
  });
  return h;
}

export async function listHighlightsForUser(userId: string, limit = 50): Promise<Highlight[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM highlights WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit],
  });
  return r.rows.map(rowToHighlight);
}

export async function listHighlightsForCampaign(campaignId: string, limit = 50): Promise<Highlight[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM highlights WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [campaignId, limit],
  });
  return r.rows.map(rowToHighlight);
}

function rowToHighlight(row: Record<string, unknown>): Highlight {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    campaignId: String(row.campaign_id),
    characterId: row.character_id ? String(row.character_id) : null,
    characterName: row.character_name ? String(row.character_name) : null,
    summary: String(row.summary),
    kind: (row.kind as HighlightKind) ?? 'moment',
    createdAt: Number(row.created_at),
  };
}

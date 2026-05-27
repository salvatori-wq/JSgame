// JSgame · β.1 — NPC Roster persistente (tabela `npc_roster`).
// Diferente de CampaignState.npcsMet (em-memória, volátil), aqui persistimos
// memória do mundo: contadores, notas, relacionamento — DM lê pra continuidade.

import { getDbClient } from './persistence.js';
import type { NpcMemory } from '../shared/types.js';

// Gera ID estável a partir de nome (snake-case ASCII) + sufixo da primeira location.
// Mesmo nome em locais diferentes = NPCs diferentes (PHB best practice).
export function npcId(name: string, firstLocation: string): string {
  const slug = (s: string): string => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const ns = slug(name);
  const ls = slug(firstLocation);
  return ls ? `${ns}--${ls}` : ns;
}

// UPSERT: cria se novo, incrementa interactionCount + atualiza lastSeen/lastLocation.
// Não mexe em attitude/notes/relationship se já existir (esses são atualizados via
// setNpcAttitude/setNpcNotes/adjustRelationship).
export async function upsertNpc(input: {
  campaignId: string;
  name: string;
  archetype: string;
  attitude: 'amigavel' | 'neutro' | 'hostil' | 'misterioso';
  currentLocation: string;
}): Promise<void> {
  const id = npcId(input.name, input.currentLocation);
  const db = getDbClient();
  const now = Date.now();

  const existing = await db.execute({
    sql: 'SELECT id FROM npc_roster WHERE campaign_id = ? AND id = ? LIMIT 1',
    args: [input.campaignId, id],
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO npc_roster
        (campaign_id, id, name, archetype, attitude, first_met, last_seen, last_location, interaction_count, notes, relationship)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', 0)`,
      args: [input.campaignId, id, input.name, input.archetype, input.attitude, now, now, input.currentLocation],
    });
  } else {
    // Atualiza lastSeen + location + atitude (DM pode atualizar perception) + bump counter
    await db.execute({
      sql: `UPDATE npc_roster
        SET last_seen = ?, last_location = ?, attitude = ?, interaction_count = interaction_count + 1
        WHERE campaign_id = ? AND id = ?`,
      args: [now, input.currentLocation, input.attitude, input.campaignId, id],
    });
  }
}

export async function listNpcs(campaignId: string): Promise<NpcMemory[]> {
  const db = getDbClient();
  const r = await db.execute({
    sql: 'SELECT * FROM npc_roster WHERE campaign_id = ? ORDER BY last_seen DESC',
    args: [campaignId],
  });
  return r.rows.map(rowToNpc);
}

// Top-N NPCs mais recentemente vistos. Default 5 — pra injetar em prompt sem inflar tokens.
export async function topRecentNpcs(campaignId: string, limit = 5): Promise<NpcMemory[]> {
  const db = getDbClient();
  const r = await db.execute({
    sql: 'SELECT * FROM npc_roster WHERE campaign_id = ? ORDER BY last_seen DESC LIMIT ?',
    args: [campaignId, limit],
  });
  return r.rows.map(rowToNpc);
}

export async function setNpcNotes(campaignId: string, id: string, notes: string): Promise<void> {
  const db = getDbClient();
  await db.execute({
    sql: 'UPDATE npc_roster SET notes = ? WHERE campaign_id = ? AND id = ?',
    args: [notes.slice(0, 500), campaignId, id],
  });
}

export async function adjustRelationship(campaignId: string, id: string, delta: number): Promise<void> {
  const db = getDbClient();
  // Clamp [-10, 10] em SQL via MAX/MIN
  await db.execute({
    sql: `UPDATE npc_roster
      SET relationship = MAX(-10, MIN(10, relationship + ?))
      WHERE campaign_id = ? AND id = ?`,
    args: [delta, campaignId, id],
  });
}

export async function deleteNpcs(campaignId: string): Promise<void> {
  const db = getDbClient();
  await db.execute({
    sql: 'DELETE FROM npc_roster WHERE campaign_id = ?',
    args: [campaignId],
  });
}

function rowToNpc(row: Record<string, unknown>): NpcMemory {
  return {
    campaignId: String(row.campaign_id),
    id: String(row.id),
    name: String(row.name),
    archetype: String(row.archetype),
    attitude: String(row.attitude) as NpcMemory['attitude'],
    firstMet: Number(row.first_met),
    lastSeen: Number(row.last_seen),
    lastLocation: String(row.last_location),
    interactionCount: Number(row.interaction_count),
    notes: String(row.notes ?? ''),
    relationship: Number(row.relationship ?? 0),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (testable sem DB)
// ════════════════════════════════════════════════════════════════════════════

// Renderiza linha pra injetar no prompt do DM. Curta — 1 linha por NPC.
export function npcPromptLine(n: NpcMemory): string {
  const rel = n.relationship > 0 ? `+${n.relationship}` : String(n.relationship);
  const notesLine = n.notes ? ` · ${n.notes}` : '';
  return `- ${n.name} (${n.archetype}, ${n.attitude}, rel ${rel}, ${n.interactionCount}× em "${n.lastLocation}")${notesLine}`;
}

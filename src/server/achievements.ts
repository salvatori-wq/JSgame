// JSgame · F17 — Tracker server-side de achievements + counters.
// Stateless: cada `trackEvent` checa o evento + dispara unlocks.
// Persiste em SQLite (tabelas achievements_unlocked / achievements_counters).
//
// Coop-safe via DB INSERT OR IGNORE — duplo unlock simultâneo não duplica linha.
// Anon (userId null/undefined) é no-op silencioso — caller pode mostrar toast
// in-memory mas nada persiste.

import { getDbClient } from './persistence.js';
import { ACHIEVEMENTS, getAchievement, type Achievement, type CounterKey } from '../dnd/achievements.js';

// ════════════════════════════════════════════════════════════════════════════
// Tipos de evento — exaustivo. Tracker pattern-matches em event.kind.
// ════════════════════════════════════════════════════════════════════════════

export type AchievementEvent =
  | { kind: 'session_started' }
  | { kind: 'combat_started'; isFirst: boolean }
  | { kind: 'attack_resolved'; hit: boolean; crit: boolean; nat20: boolean; nat1: boolean; killed: boolean; targetIsBoss: boolean; targetName: string }
  | { kind: 'spell_cast'; spellId: string; healed?: boolean }
  | { kind: 'skill_check'; success: boolean; nat20: boolean; nat1: boolean }
  | { kind: 'level_up'; oldLevel: number; newLevel: number }
  | { kind: 'death_save'; success: boolean; nat20: boolean; nat1: boolean; stabilized: boolean; died: boolean }
  | { kind: 'character_died' }
  | { kind: 'item_received' }
  | { kind: 'npc_met'; name: string }
  | { kind: 'location_visited'; location: string }
  | { kind: 'long_rest' }
  | { kind: 'combat_won'; allAlive: boolean }
  | { kind: 'character_created'; multiclass: boolean }
  | { kind: 'gold_changed'; newTotal: number }
  | { kind: 'party_completed_session'; partySize: number };

export interface UnlockResult {
  achievement: Achievement;
  /** Contexto opcional armazenado junto do unlock (location, characterId, etc) */
  context?: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════════════════
// DB helpers
// ════════════════════════════════════════════════════════════════════════════

async function isUnlocked(userId: string, achId: string): Promise<boolean> {
  const r = await getDbClient().execute({
    sql: 'SELECT 1 FROM achievements_unlocked WHERE user_id = ? AND achievement_id = ?',
    args: [userId, achId],
  });
  return r.rows.length > 0;
}

async function unlock(userId: string, achId: string, context?: Record<string, unknown>): Promise<UnlockResult | null> {
  const ach = getAchievement(achId);
  if (!ach) return null;
  if (await isUnlocked(userId, achId)) return null;
  await getDbClient().execute({
    sql: 'INSERT OR IGNORE INTO achievements_unlocked (user_id, achievement_id, unlocked_at, context) VALUES (?, ?, ?, ?)',
    args: [userId, achId, Date.now(), context ? JSON.stringify(context) : null],
  });
  // Re-checa: se INSERT IGNORE pulou (race), não retorna unlock.
  const inserted = await isUnlocked(userId, achId);
  return inserted ? { achievement: ach, context } : null;
}

async function getCounter(userId: string, counter: CounterKey): Promise<number> {
  const r = await getDbClient().execute({
    sql: 'SELECT value FROM achievements_counters WHERE user_id = ? AND counter_id = ?',
    args: [userId, counter],
  });
  const row = r.rows[0];
  return row ? Number(row.value) : 0;
}

async function bumpCounter(userId: string, counter: CounterKey, delta = 1): Promise<number> {
  const now = Date.now();
  // UPSERT idempotente. libsql/SQLite — usa ON CONFLICT.
  await getDbClient().execute({
    sql: `INSERT INTO achievements_counters (user_id, counter_id, value, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, counter_id) DO UPDATE SET value = value + ?, updated_at = ?`,
    args: [userId, counter, delta, now, delta, now],
  });
  return getCounter(userId, counter);
}

async function setCounter(userId: string, counter: CounterKey, value: number): Promise<void> {
  await getDbClient().execute({
    sql: `INSERT INTO achievements_counters (user_id, counter_id, value, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, counter_id) DO UPDATE SET value = ?, updated_at = ?`,
    args: [userId, counter, value, Date.now(), value, Date.now()],
  });
}

// Tracker de uniques (unique_locations, unique_npcs). Usa contexto JSON pra
// guardar set já visto. Simples e suficiente — não vai escalar pra 10k+ mas
// pra 10-50 nomes é OK.
async function trackUniqueAndBump(
  userId: string,
  counter: CounterKey,
  value: string,
): Promise<{ isNew: boolean; total: number }> {
  // Lê set atual de "seen" via tabela KV — usamos counter_id "_set_<counter>"
  const setKey = `__set__${counter}` as CounterKey; // hack: chave fora do enum mas válida pro SQL
  const r = await getDbClient().execute({
    sql: 'SELECT value FROM achievements_counters WHERE user_id = ? AND counter_id = ?',
    args: [userId, setKey],
  });
  let seen: string[] = [];
  const row = r.rows[0];
  if (row && typeof row.value === 'string') {
    try { seen = JSON.parse(row.value); } catch { seen = []; }
  } else if (row) {
    // Migração legacy: value pode ser número. Ignora e re-inicia.
    seen = [];
  }
  const lower = value.toLowerCase();
  if (seen.includes(lower)) {
    return { isNew: false, total: seen.length };
  }
  seen.push(lower);
  // Persist set (string JSON). value column é INTEGER no schema mas SQLite é tipagem dinâmica,
  // armazena string sem problemas — leitura via String(row.value).
  await getDbClient().execute({
    sql: `INSERT INTO achievements_counters (user_id, counter_id, value, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, counter_id) DO UPDATE SET value = ?, updated_at = ?`,
    args: [userId, setKey, JSON.stringify(seen), Date.now(), JSON.stringify(seen), Date.now()],
  });
  // Também bump counter "real" pra threshold rápido
  await setCounter(userId, counter, seen.length);
  return { isNew: true, total: seen.length };
}

// ════════════════════════════════════════════════════════════════════════════
// trackEvent — entry point. Recebe userId + evento, retorna unlocks novos.
// ════════════════════════════════════════════════════════════════════════════

export async function trackEvent(
  userId: string | null | undefined,
  event: AchievementEvent,
): Promise<UnlockResult[]> {
  if (!userId) return [];
  const unlocks: UnlockResult[] = [];

  try {
    switch (event.kind) {
      case 'session_started': {
        const r = await unlock(userId, 'first_session');
        if (r) unlocks.push(r);
        break;
      }

      case 'combat_started': {
        if (event.isFirst) {
          const r = await unlock(userId, 'first_combat');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'attack_resolved': {
        if (event.nat20) {
          const r = await unlock(userId, 'first_nat20');
          if (r) unlocks.push(r);
          // Streak — nat20 reseta se vier nat1 ou miss; aqui só conta consecutivos
          const newStreak = await bumpCounter(userId, 'nat20_streak', 1);
          if (newStreak >= 3) {
            const r2 = await unlock(userId, 'streak_three');
            if (r2) unlocks.push(r2);
          }
        } else if (event.nat1) {
          await setCounter(userId, 'nat20_streak', 0);
          const r = await unlock(userId, 'first_nat1');
          if (r) unlocks.push(r);
        } else {
          // Hit/miss normal não quebra streak por si — só nat1 explicitamente quebra
        }
        if (event.crit) {
          const fc = await unlock(userId, 'first_crit');
          if (fc) unlocks.push(fc);
          const crits = await bumpCounter(userId, 'crits', 1);
          if (crits >= 5) {
            const r = await unlock(userId, 'five_crits');
            if (r) unlocks.push(r);
          }
        }
        if (event.killed) {
          const fk = await unlock(userId, 'first_kill');
          if (fk) unlocks.push(fk);
          const kills = await bumpCounter(userId, 'kills', 1);
          if (kills >= 10) {
            const r = await unlock(userId, 'ten_kills');
            if (r) unlocks.push(r);
          }
          if (kills >= 100) {
            const r = await unlock(userId, 'hundred_kills');
            if (r) unlocks.push(r);
          }
          if (event.targetIsBoss) {
            const r = await unlock(userId, 'boss_kill', { boss: event.targetName });
            if (r) unlocks.push(r);
          }
          // Dragon: detecta por nome (case-insensitive)
          if (/drag/i.test(event.targetName)) {
            const r = await unlock(userId, 'dragon_slayer', { dragon: event.targetName });
            if (r) unlocks.push(r);
          }
        }
        break;
      }

      case 'spell_cast': {
        const fs = await unlock(userId, 'first_spell');
        if (fs) unlocks.push(fs);
        const total = await bumpCounter(userId, 'spells_cast', 1);
        if (total >= 20) {
          const r = await unlock(userId, 'twenty_spells');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'skill_check': {
        if (event.nat20) {
          const r = await unlock(userId, 'first_nat20');
          if (r) unlocks.push(r);
          const streak = await bumpCounter(userId, 'nat20_streak', 1);
          if (streak >= 3) {
            const r2 = await unlock(userId, 'streak_three');
            if (r2) unlocks.push(r2);
          }
        } else if (event.nat1) {
          await setCounter(userId, 'nat20_streak', 0);
          const r = await unlock(userId, 'first_nat1');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'level_up': {
        if (event.newLevel >= 2) {
          const r = await unlock(userId, 'first_levelup');
          if (r) unlocks.push(r);
        }
        if (event.newLevel >= 5) {
          const r = await unlock(userId, 'level_five');
          if (r) unlocks.push(r);
        }
        if (event.newLevel >= 10) {
          const r = await unlock(userId, 'level_ten');
          if (r) unlocks.push(r);
        }
        if (event.newLevel >= 20) {
          const r = await unlock(userId, 'level_twenty');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'death_save': {
        if (event.nat20) {
          const r = await unlock(userId, 'first_nat20');
          if (r) unlocks.push(r);
        } else if (event.nat1) {
          const r = await unlock(userId, 'first_nat1');
          if (r) unlocks.push(r);
        }
        if (event.stabilized) {
          const r = await unlock(userId, 'survivor');
          if (r) unlocks.push(r);
          const total = await bumpCounter(userId, 'stabilizations', 1);
          if (total >= 5) {
            const r2 = await unlock(userId, 'death_dodger');
            if (r2) unlocks.push(r2);
          }
        }
        if (event.died) {
          const r = await unlock(userId, 'first_death');
          if (r) unlocks.push(r);
          const total = await bumpCounter(userId, 'character_deaths', 1);
          if (total >= 3) {
            const r2 = await unlock(userId, 'nine_lives');
            if (r2) unlocks.push(r2);
          }
        }
        break;
      }

      case 'character_died': {
        const r = await unlock(userId, 'first_death');
        if (r) unlocks.push(r);
        const total = await bumpCounter(userId, 'character_deaths', 1);
        if (total >= 3) {
          const r2 = await unlock(userId, 'nine_lives');
          if (r2) unlocks.push(r2);
        }
        break;
      }

      case 'item_received': {
        const r = await unlock(userId, 'first_item');
        if (r) unlocks.push(r);
        break;
      }

      case 'npc_met': {
        const r = await unlock(userId, 'first_npc');
        if (r) unlocks.push(r);
        const { isNew, total } = await trackUniqueAndBump(userId, 'unique_npcs', event.name);
        if (isNew && total >= 10) {
          // Achievement Talker — não está no catálogo atual, deixar pra ampliação
          // (futuro). Mantém counter pra estatística.
        }
        break;
      }

      case 'location_visited': {
        const { isNew, total } = await trackUniqueAndBump(userId, 'unique_locations', event.location);
        if (isNew && total >= 10) {
          const r = await unlock(userId, 'explorer');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'long_rest': {
        const total = await bumpCounter(userId, 'long_rests', 1);
        if (total >= 3) {
          const r = await unlock(userId, 'long_rest_three');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'combat_won': {
        if (event.allAlive) {
          const r = await unlock(userId, 'untouched');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'character_created': {
        if (event.multiclass) {
          const r = await unlock(userId, 'multiclass');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'gold_changed': {
        if (event.newTotal >= 500) {
          const r = await unlock(userId, 'rich_hero');
          if (r) unlocks.push(r);
        }
        break;
      }

      case 'party_completed_session': {
        if (event.partySize >= 2) {
          const r = await unlock(userId, 'coop_session');
          if (r) unlocks.push(r);
        } else if (event.partySize === 1) {
          const r = await unlock(userId, 'lone_wolf');
          if (r) unlocks.push(r);
        }
        break;
      }
    }
  } catch (err) {
    console.warn('[achievements] trackEvent falhou:', err);
  }

  return unlocks;
}

// ════════════════════════════════════════════════════════════════════════════
// Queries — pra UI da página de perfil
// ════════════════════════════════════════════════════════════════════════════

export interface UnlockedEntry {
  achievement: Achievement;
  unlockedAt: number;
  context?: Record<string, unknown>;
}

export async function listUserUnlocks(userId: string): Promise<UnlockedEntry[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT achievement_id, unlocked_at, context FROM achievements_unlocked WHERE user_id = ? ORDER BY unlocked_at DESC',
    args: [userId],
  });
  const list: UnlockedEntry[] = [];
  for (const row of r.rows) {
    const ach = getAchievement(row.achievement_id as string);
    if (!ach) continue;
    let context: Record<string, unknown> | undefined;
    if (row.context && typeof row.context === 'string') {
      try { context = JSON.parse(row.context); } catch { /* ignore */ }
    }
    list.push({ achievement: ach, unlockedAt: Number(row.unlocked_at), context });
  }
  return list;
}

// Lista completa: todos os achievements + status (unlocked? quando?).
// Hidden ainda não unlocked retornam com `hidden: true` no payload — UI decide.
export interface AchievementStatus {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt: number | null;
}

export async function listUserProgress(userId: string): Promise<AchievementStatus[]> {
  const unlocked = await listUserUnlocks(userId);
  const unlockedMap = new Map(unlocked.map((u) => [u.achievement.id, u.unlockedAt] as const));
  return ACHIEVEMENTS.map((ach) => ({
    achievement: ach,
    unlocked: unlockedMap.has(ach.id),
    unlockedAt: unlockedMap.get(ach.id) ?? null,
  }));
}

export async function getUserCounters(userId: string): Promise<Record<string, number>> {
  const r = await getDbClient().execute({
    sql: 'SELECT counter_id, value FROM achievements_counters WHERE user_id = ?',
    args: [userId],
  });
  const out: Record<string, number> = {};
  for (const row of r.rows) {
    const key = row.counter_id as string;
    if (key.startsWith('__set__')) continue; // skip uniques sets (não-numéricos)
    out[key] = Number(row.value);
  }
  return out;
}

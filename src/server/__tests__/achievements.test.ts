// Tests F17 — Achievement tracker server-side.
// Cobre: unlock idempotente, counters cumulativos, threshold triggers, anon no-op.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@libsql/client';

// Mock getDbClient pra usar in-memory libsql
const localClient = createClient({ url: ':memory:' });
vi.mock('../persistence.js', () => ({
  getDbClient: () => localClient,
}));

import { trackEvent, listUserUnlocks, listUserProgress, getUserCounters } from '../achievements.js';

async function resetSchema(): Promise<void> {
  await localClient.execute('DROP TABLE IF EXISTS achievements_unlocked');
  await localClient.execute('DROP TABLE IF EXISTS achievements_counters');
  await localClient.execute(`
    CREATE TABLE achievements_unlocked (
      user_id        TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at    INTEGER NOT NULL,
      context        TEXT,
      PRIMARY KEY (user_id, achievement_id)
    )
  `);
  await localClient.execute(`
    CREATE TABLE achievements_counters (
      user_id    TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      value      ANY,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, counter_id)
    )
  `);
}

describe('F17 — Achievement tracker', () => {
  beforeEach(async () => {
    await resetSchema();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('anon — no-op', () => {
    it('userId null não persiste nem retorna unlocks', async () => {
      const r = await trackEvent(null, { kind: 'session_started' });
      expect(r).toEqual([]);
    });

    it('userId undefined não persiste', async () => {
      const r = await trackEvent(undefined, { kind: 'first_kill' } as never);
      expect(r).toEqual([]);
    });
  });

  describe('one-shot unlocks', () => {
    it('first_session desbloqueia na primeira chamada', async () => {
      const r = await trackEvent('user-a', { kind: 'session_started' });
      expect(r).toHaveLength(1);
      expect(r[0]?.achievement.id).toBe('first_session');
    });

    it('first_session idempotente — segunda chamada não desbloqueia', async () => {
      await trackEvent('user-a', { kind: 'session_started' });
      const r2 = await trackEvent('user-a', { kind: 'session_started' });
      expect(r2).toEqual([]);
    });

    it('users diferentes têm unlocks independentes', async () => {
      const r1 = await trackEvent('user-a', { kind: 'session_started' });
      const r2 = await trackEvent('user-b', { kind: 'session_started' });
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
    });

    it('first_combat só dispara se isFirst=true', async () => {
      const r1 = await trackEvent('user-a', { kind: 'combat_started', isFirst: false });
      expect(r1).toEqual([]);
      const r2 = await trackEvent('user-a', { kind: 'combat_started', isFirst: true });
      expect(r2.map((x) => x.achievement.id)).toContain('first_combat');
    });
  });

  describe('attack_resolved — multi triggers', () => {
    it('crit dispara first_crit no primeiro acerto crítico', async () => {
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'Goblin',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('first_crit');
      expect(ids).toContain('first_nat20');
    });

    it('kill em boss dispara boss_kill + first_kill', async () => {
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: false, nat20: false, nat1: false,
        killed: true, targetIsBoss: true, targetName: 'Troll',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('first_kill');
      expect(ids).toContain('boss_kill');
    });

    it('kill de dragão dispara dragon_slayer', async () => {
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: false, nat20: false, nat1: false,
        killed: true, targetIsBoss: true, targetName: 'Dragão Jovem Vermelho',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('dragon_slayer');
    });

    it('10 kills dispara ten_kills', async () => {
      for (let i = 0; i < 9; i++) {
        await trackEvent('user-a', {
          kind: 'attack_resolved',
          hit: true, crit: false, nat20: false, nat1: false,
          killed: true, targetIsBoss: false, targetName: `Mob ${i}`,
        });
      }
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: false, nat20: false, nat1: false,
        killed: true, targetIsBoss: false, targetName: 'Mob 10',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('ten_kills');
    });

    it('5 crits seguidos dispara five_crits', async () => {
      for (let i = 0; i < 4; i++) {
        await trackEvent('user-a', {
          kind: 'attack_resolved',
          hit: true, crit: true, nat20: false, nat1: false,
          killed: false, targetIsBoss: false, targetName: 'X',
        });
      }
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: false, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('five_crits');
    });

    it('nat20 streak — 3 seguidos desbloqueia streak_three', async () => {
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('streak_three');
    });

    it('nat1 quebra streak', async () => {
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: false, crit: false, nat20: false, nat1: true,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      // Streak resetado, dois nat20 seguidos não desbloqueiam streak_three
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      const r = await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: true, nat20: true, nat1: false,
        killed: false, targetIsBoss: false, targetName: 'X',
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).not.toContain('streak_three');
    });
  });

  describe('death_save', () => {
    it('stabilized dispara survivor', async () => {
      const r = await trackEvent('user-a', {
        kind: 'death_save', success: true, nat20: false, nat1: false,
        stabilized: true, died: false,
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('survivor');
    });

    it('died dispara first_death (hidden)', async () => {
      const r = await trackEvent('user-a', {
        kind: 'death_save', success: false, nat20: false, nat1: false,
        stabilized: false, died: true,
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('first_death');
    });

    it('3 PJs mortos dispara nine_lives', async () => {
      // Cada PJ morrendo
      for (let i = 0; i < 2; i++) {
        await trackEvent('user-a', { kind: 'character_died' });
      }
      const r = await trackEvent('user-a', { kind: 'character_died' });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('nine_lives');
    });

    it('5 estabilizações dispara death_dodger', async () => {
      for (let i = 0; i < 4; i++) {
        await trackEvent('user-a', {
          kind: 'death_save', success: true, nat20: false, nat1: false,
          stabilized: true, died: false,
        });
      }
      const r = await trackEvent('user-a', {
        kind: 'death_save', success: true, nat20: false, nat1: false,
        stabilized: true, died: false,
      });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('death_dodger');
    });
  });

  describe('level_up', () => {
    it('nv 2 dispara first_levelup', async () => {
      const r = await trackEvent('user-a', { kind: 'level_up', oldLevel: 1, newLevel: 2 });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('first_levelup');
    });

    it('nv 5 dispara level_five', async () => {
      const r = await trackEvent('user-a', { kind: 'level_up', oldLevel: 4, newLevel: 5 });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('level_five');
    });

    it('nv 10 dispara level_ten + level_five (catch-up se nunca passou por 5)', async () => {
      const r = await trackEvent('user-a', { kind: 'level_up', oldLevel: 4, newLevel: 10 });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('level_ten');
      expect(ids).toContain('level_five');
    });

    it('nv 20 dispara level_twenty', async () => {
      const r = await trackEvent('user-a', { kind: 'level_up', oldLevel: 19, newLevel: 20 });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('level_twenty');
    });
  });

  describe('location_visited — unique tracking', () => {
    it('mesma location repetida não bumpa counter', async () => {
      await trackEvent('user-a', { kind: 'location_visited', location: 'Taverna' });
      await trackEvent('user-a', { kind: 'location_visited', location: 'taverna' }); // case-insensitive
      const counters = await getUserCounters('user-a');
      expect(counters.unique_locations).toBe(1);
    });

    it('10 locations distintas dispara explorer', async () => {
      const locs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const l of locs) {
        await trackEvent('user-a', { kind: 'location_visited', location: l });
      }
      const r = await trackEvent('user-a', { kind: 'location_visited', location: 'J' });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('explorer');
    });
  });

  describe('combat_won', () => {
    it('allAlive=true dispara untouched', async () => {
      const r = await trackEvent('user-a', { kind: 'combat_won', allAlive: true });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('untouched');
    });

    it('allAlive=false não dispara untouched', async () => {
      const r = await trackEvent('user-a', { kind: 'combat_won', allAlive: false });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).not.toContain('untouched');
    });
  });

  describe('character_created', () => {
    it('multiclass=true dispara multiclass', async () => {
      const r = await trackEvent('user-a', { kind: 'character_created', multiclass: true });
      const ids = r.map((x) => x.achievement.id);
      expect(ids).toContain('multiclass');
    });

    it('multiclass=false não dispara', async () => {
      const r = await trackEvent('user-a', { kind: 'character_created', multiclass: false });
      expect(r).toEqual([]);
    });
  });

  describe('queries', () => {
    it('listUserUnlocks retorna em ordem desc por unlockedAt', async () => {
      await trackEvent('user-a', { kind: 'session_started' });
      await new Promise((r) => setTimeout(r, 5));
      await trackEvent('user-a', { kind: 'first_kill' as never } as never).catch(() => {}); // ignora kind inválido
      await trackEvent('user-a', {
        kind: 'attack_resolved',
        hit: true, crit: false, nat20: false, nat1: false,
        killed: true, targetIsBoss: false, targetName: 'M',
      });
      const list = await listUserUnlocks('user-a');
      expect(list.length).toBeGreaterThanOrEqual(2);
      // Ordem desc por timestamp
      for (let i = 1; i < list.length; i++) {
        expect(list[i - 1]!.unlockedAt).toBeGreaterThanOrEqual(list[i]!.unlockedAt);
      }
    });

    it('listUserProgress retorna TODOS achievements com flag unlocked', async () => {
      await trackEvent('user-a', { kind: 'session_started' });
      const progress = await listUserProgress('user-a');
      expect(progress.length).toBeGreaterThan(20); // catálogo tem 30+
      const firstSession = progress.find((p) => p.achievement.id === 'first_session');
      expect(firstSession?.unlocked).toBe(true);
      const firstKill = progress.find((p) => p.achievement.id === 'first_kill');
      expect(firstKill?.unlocked).toBe(false);
    });
  });
});

// Tests F20 — Daily streak tracker.
// Cobre: primeira marca, no-op no mesmo dia, +1 em dia consecutivo, reset em gap.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@libsql/client';

const localClient = createClient({ url: ':memory:' });
vi.mock('../persistence.js', () => ({
  getDbClient: () => localClient,
}));

import { bumpStreak, getStreak } from '../streaks.js';

async function resetSchema(): Promise<void> {
  await localClient.execute('DROP TABLE IF EXISTS daily_streaks');
  await localClient.execute(`
    CREATE TABLE daily_streaks (
      user_id          TEXT PRIMARY KEY,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      longest_streak   INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT NOT NULL,
      total_days       INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL
    )
  `);
}

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateNDaysAgo(n: number): string {
  const dt = new Date(Date.now() - n * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('F20 — bumpStreak', () => {
  beforeEach(async () => {
    await resetSchema();
  });

  it('anon (null userId) é no-op', async () => {
    const r = await bumpStreak(null);
    expect(r).toBeNull();
  });

  it('primeira chamada cria streak=1', async () => {
    const r = await bumpStreak('user-a');
    expect(r?.currentStreak).toBe(1);
    expect(r?.longestStreak).toBe(1);
    expect(r?.bumped).toBe(true);
    expect(r?.brokeRecord).toBe(true);
  });

  it('segunda chamada no mesmo dia é no-op (não incrementa)', async () => {
    await bumpStreak('user-a');
    const r2 = await bumpStreak('user-a');
    expect(r2?.currentStreak).toBe(1);
    expect(r2?.bumped).toBe(false);
    expect(r2?.brokeRecord).toBe(false);
  });

  it('chamada em dia consecutivo incrementa', async () => {
    // Setup: simula last_active = ontem
    await localClient.execute({
      sql: 'INSERT INTO daily_streaks (user_id, current_streak, longest_streak, last_active_date, total_days, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['user-a', 3, 5, dateNDaysAgo(1), 10, Date.now()],
    });
    const r = await bumpStreak('user-a');
    expect(r?.currentStreak).toBe(4);
    expect(r?.longestStreak).toBe(5); // não passou ainda
  });

  it('chamada com gap >1 dia reseta pra 1', async () => {
    await localClient.execute({
      sql: 'INSERT INTO daily_streaks (user_id, current_streak, longest_streak, last_active_date, total_days, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['user-a', 8, 8, dateNDaysAgo(3), 20, Date.now()],
    });
    const r = await bumpStreak('user-a');
    expect(r?.currentStreak).toBe(1); // reset
    expect(r?.longestStreak).toBe(8); // preservado
    expect(r?.brokeRecord).toBe(false);
  });

  it('bumpa longest quando atinge novo recorde', async () => {
    await localClient.execute({
      sql: 'INSERT INTO daily_streaks (user_id, current_streak, longest_streak, last_active_date, total_days, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['user-a', 5, 5, dateNDaysAgo(1), 10, Date.now()],
    });
    const r = await bumpStreak('user-a');
    expect(r?.currentStreak).toBe(6);
    expect(r?.longestStreak).toBe(6);
    expect(r?.brokeRecord).toBe(true);
  });

  it('total_days incrementa apenas em bumps reais', async () => {
    const r1 = await bumpStreak('user-a');
    expect(r1?.totalDays).toBe(1);
    const r2 = await bumpStreak('user-a'); // no-op
    expect(r2?.totalDays).toBe(1);
  });
});

describe('F20 — getStreak', () => {
  beforeEach(async () => {
    await resetSchema();
  });

  it('retorna null pra user sem streak', async () => {
    const r = await getStreak('user-novo');
    expect(r).toBeNull();
  });

  it('retorna estado atual', async () => {
    await bumpStreak('user-a');
    const r = await getStreak('user-a');
    expect(r?.currentStreak).toBe(1);
    expect(r?.lastActiveDate).toBe(todayUtc());
  });
});

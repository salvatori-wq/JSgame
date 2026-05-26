// Tests pra T1 — Telemetria mínima.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import { trackMetricEvent, getMetricsSummary, getDmErrorRate, getAvgSessionLength } from '../metrics.js';

describe('T1 — Telemetria', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    await getDbClient().execute('DELETE FROM metrics_events');
  });

  it('trackMetricEvent grava no DB', async () => {
    await trackMetricEvent({ userId: 'u1', kind: 'session_started' });
    const r = await getDbClient().execute('SELECT COUNT(*) as c FROM metrics_events');
    expect(Number(r.rows[0]?.c)).toBe(1);
  });

  it('payload é serializado como JSON', async () => {
    await trackMetricEvent({ userId: 'u1', kind: 'combat_started', payload: { difficulty: 'hard', enemies: 3 } });
    const r = await getDbClient().execute('SELECT payload FROM metrics_events');
    const parsed = JSON.parse(r.rows[0]?.payload as string);
    expect(parsed.difficulty).toBe('hard');
    expect(parsed.enemies).toBe(3);
  });

  it('getMetricsSummary conta por kind', async () => {
    await trackMetricEvent({ userId: 'u1', kind: 'session_started' });
    await trackMetricEvent({ userId: 'u1', kind: 'session_started' });
    await trackMetricEvent({ userId: 'u2', kind: 'combat_started' });
    const s = await getMetricsSummary(7);
    expect(s.byKind.session_started).toBe(2);
    expect(s.byKind.combat_started).toBe(1);
    expect(s.totalEvents).toBe(3);
  });

  it('DAU = distinct users nas últimas 24h', async () => {
    await trackMetricEvent({ userId: 'u1', kind: 'session_started' });
    await trackMetricEvent({ userId: 'u2', kind: 'session_started' });
    await trackMetricEvent({ userId: 'u1', kind: 'combat_started' });  // mesmo user
    const s = await getMetricsSummary(7);
    expect(s.dau).toBe(2);
  });

  it('events sem userId não contam pra DAU', async () => {
    await trackMetricEvent({ kind: 'session_started' });
    const s = await getMetricsSummary(7);
    expect(s.dau).toBe(0);
  });

  it('getDmErrorRate calcula proporção', async () => {
    await trackMetricEvent({ kind: 'narration_success' });
    await trackMetricEvent({ kind: 'narration_success' });
    await trackMetricEvent({ kind: 'narration_success' });
    await trackMetricEvent({ kind: 'narration_error' });
    const r = await getDmErrorRate(7);
    expect(r.success).toBe(3);
    expect(r.error).toBe(1);
    expect(r.rate).toBeCloseTo(0.25, 2);
  });

  it('getDmErrorRate sem eventos = rate 0', async () => {
    const r = await getDmErrorRate(7);
    expect(r.rate).toBe(0);
  });

  it('getAvgSessionLength agrupa por session_id', async () => {
    // Simula: session-A com 2 eventos espaçados, session-B com 2 eventos espaçados
    const now = Date.now();
    const db = getDbClient();
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e1', 'sess-a', 'session_started', now - 60_000],
    });
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e2', 'sess-a', 'combat_won', now - 10_000],
    });
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e3', 'sess-b', 'session_started', now - 30_000],
    });
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e4', 'sess-b', 'combat_won', now - 5_000],
    });
    const r = await getAvgSessionLength(7);
    expect(r.sampleCount).toBe(2);
    // (50s + 25s) / 2 = ~37.5s
    expect(r.avgMs).toBeGreaterThan(20_000);
    expect(r.avgMs).toBeLessThan(50_000);
  });

  it('sessions > 8h são descartadas (provavelmente abandonadas)', async () => {
    const now = Date.now();
    const db = getDbClient();
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e1', 'sess-x', 'session_started', now - 10 * 60 * 60 * 1000],
    });
    await db.execute({
      sql: "INSERT INTO metrics_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)",
      args: ['e2', 'sess-x', 'combat_won', now],
    });
    const r = await getAvgSessionLength(30);
    expect(r.sampleCount).toBe(0);
  });
});

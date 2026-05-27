// γ.6 — Tests pro UX funnel.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import { trackMetricEvent } from '../metrics.js';
import { computeUxFunnel } from '../ux-funnel.js';

describe('γ.6 — UX funnel', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    await getDbClient().execute('DELETE FROM metrics_events');
  });

  it('shape do retorno tem todos campos esperados', async () => {
    const f = await computeUxFunnel(7);
    expect(f).toHaveProperty('windowStart');
    expect(f).toHaveProperty('windowEnd');
    expect(f).toHaveProperty('sessions');
    expect(f).toHaveProperty('latency');
    expect(f).toHaveProperty('rolls');
    expect(f).toHaveProperty('silence');
    expect(f).toHaveProperty('blocked');
    expect(f.latency.timeToFirstNarrationMs).toHaveProperty('p50');
    expect(f.latency.timeToFirstRollMs).toHaveProperty('p90');
  });

  it('time_to_first_narration latency é agregado em p50/p90/p99', async () => {
    // 10 samples — p50=500, p90=900, p99=1000
    const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    for (const ms of samples) {
      await trackMetricEvent({
        userId: 'u1',
        sessionId: 's1',
        kind: 'time_to_first_narration',
        payload: { latency_ms: ms },
      });
    }
    const f = await computeUxFunnel(7);
    expect(f.latency.timeToFirstNarrationMs.sample).toBe(10);
    expect(f.latency.timeToFirstNarrationMs.p50).toBeGreaterThanOrEqual(400);
    expect(f.latency.timeToFirstNarrationMs.p50).toBeLessThanOrEqual(600);
    expect(f.latency.timeToFirstNarrationMs.p90).toBeGreaterThanOrEqual(800);
  });

  it('roll_in_session conta avg/median/max por sessão', async () => {
    // Session 1: 5 rolls. Session 2: 10 rolls. Session 3: 3 rolls.
    for (let i = 0; i < 5; i++) {
      await trackMetricEvent({ userId: 'u', sessionId: 's1', kind: 'roll_in_session', payload: { n: i } });
    }
    for (let i = 0; i < 10; i++) {
      await trackMetricEvent({ userId: 'u', sessionId: 's2', kind: 'roll_in_session', payload: { n: i } });
    }
    for (let i = 0; i < 3; i++) {
      await trackMetricEvent({ userId: 'u', sessionId: 's3', kind: 'roll_in_session', payload: { n: i } });
    }
    const f = await computeUxFunnel(7);
    expect(f.rolls.avgPerSession).toBeCloseTo(6, 0);  // (5+10+3)/3 = 6
    expect(f.rolls.maxInSession).toBe(10);
  });

  it('dm_silence média por sessão', async () => {
    // Session 1: silêncio 10s. Session 2: silêncio 20s.
    await trackMetricEvent({ sessionId: 's1', kind: 'dm_silence', payload: { silence_seconds: 10 } });
    await trackMetricEvent({ sessionId: 's2', kind: 'dm_silence', payload: { silence_seconds: 20 } });
    const f = await computeUxFunnel(7);
    expect(f.silence.sampleCount).toBe(2);
    expect(f.silence.avgSecondsPerSession).toBeCloseTo(15, 1);
  });

  it('combat_action_blocked conta total + sessões com blocks', async () => {
    await trackMetricEvent({ sessionId: 's1', kind: 'combat_action_blocked', payload: { kind: 'attack' } });
    await trackMetricEvent({ sessionId: 's1', kind: 'combat_action_blocked', payload: { kind: 'dodge' } });
    await trackMetricEvent({ sessionId: 's2', kind: 'combat_action_blocked', payload: { kind: 'attack' } });
    const f = await computeUxFunnel(7);
    expect(f.blocked.totalCount).toBe(3);
    // 2 sessions tinham blocks; avg per active = 3/2 = 1.5
    expect(f.blocked.bySession).toBeCloseTo(1.5, 1);
  });

  it('payload malformado é ignorado silenciosamente', async () => {
    // Insere diretamente um payload inválido
    await getDbClient().execute({
      sql: `INSERT INTO metrics_events (id, user_id, session_id, kind, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['x1', 'u', 's', 'time_to_first_narration', 'not-json{', Date.now()],
    });
    await trackMetricEvent({
      sessionId: 's',
      kind: 'time_to_first_narration',
      payload: { latency_ms: 500 },
    });
    const f = await computeUxFunnel(7);
    expect(f.latency.timeToFirstNarrationMs.sample).toBe(1); // só o válido
  });

  it('sessions.withFirstNarration conta sessions únicas com first_narration event', async () => {
    await trackMetricEvent({ sessionId: 's1', kind: 'time_to_first_narration', payload: { latency_ms: 200 } });
    await trackMetricEvent({ sessionId: 's2', kind: 'time_to_first_narration', payload: { latency_ms: 300 } });
    await trackMetricEvent({ sessionId: 's1', kind: 'time_to_first_narration', payload: { latency_ms: 250 } }); // duplicado
    const f = await computeUxFunnel(7);
    expect(f.sessions.withFirstNarration).toBe(2);
  });
});

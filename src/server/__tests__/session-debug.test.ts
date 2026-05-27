// POLISH-0 — Tests pro session-debug.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import { trackMetricEvent } from '../metrics.js';
import { computeSessionDebug } from '../session-debug.js';

describe('POLISH-0 — session debug', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    await getDbClient().execute('DELETE FROM metrics_events');
  });

  it('shape do retorno tem campos esperados', async () => {
    const r = await computeSessionDebug(2, 10);
    expect(r).toHaveProperty('windowStart');
    expect(r).toHaveProperty('windowEnd');
    expect(r).toHaveProperty('totalSessions');
    expect(r).toHaveProperty('byStage');
    expect(r).toHaveProperty('sessions');
    expect(Array.isArray(r.sessions)).toBe(true);
  });

  it('classifica stage="started_only" quando só tem session_started', async () => {
    await trackMetricEvent({ sessionId: 's1', kind: 'session_started' });
    const r = await computeSessionDebug(2, 10);
    expect(r.totalSessions).toBe(1);
    expect(r.sessions[0]?.stage).toBe('started_only');
    expect(r.byStage.started_only).toBe(1);
  });

  it('classifica stage="narration_only" quando viu cena mas não interagiu', async () => {
    await trackMetricEvent({ sessionId: 's2', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's2', kind: 'time_to_first_narration', payload: { latency_ms: 50 } });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('narration_only');
    expect(r.byStage.narration_only).toBe(1);
  });

  it('classifica stage="action_no_response" quando agiu mas DM não respondeu', async () => {
    await trackMetricEvent({ sessionId: 's3', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's3', kind: 'time_to_first_narration', payload: { latency_ms: 100 } });
    await trackMetricEvent({ sessionId: 's3', kind: 'action_taken', payload: { action: 'explore' } });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('action_no_response');
  });

  it('classifica stage="engaged_no_roll" quando DM respondeu mas não rolou dado', async () => {
    await trackMetricEvent({ sessionId: 's4', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's4', kind: 'time_to_first_narration', payload: { latency_ms: 100 } });
    await trackMetricEvent({ sessionId: 's4', kind: 'action_taken' });
    await trackMetricEvent({ sessionId: 's4', kind: 'time_to_first_dm_response', payload: { latency_ms: 5000 } });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('engaged_no_roll');
  });

  it('classifica stage="rolled" quando rolou dado', async () => {
    await trackMetricEvent({ sessionId: 's5', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's5', kind: 'roll_in_session', payload: { roll_total: 15 } });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('rolled');
  });

  it('classifica stage="combat" quando entrou em combate', async () => {
    await trackMetricEvent({ sessionId: 's6', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's6', kind: 'combat_started' });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('combat');
  });

  it('classifica stage="unknown" se sem session_started', async () => {
    await trackMetricEvent({ sessionId: 's7', kind: 'time_to_first_narration', payload: { latency_ms: 100 } });
    const r = await computeSessionDebug(2, 10);
    expect(r.sessions[0]?.stage).toBe('unknown');
  });

  it('agrega múltiplas sessões com stages diferentes', async () => {
    // 3 sessões em stages diferentes
    await trackMetricEvent({ sessionId: 'a', kind: 'session_started' });

    await trackMetricEvent({ sessionId: 'b', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 'b', kind: 'time_to_first_narration', payload: { latency_ms: 100 } });

    await trackMetricEvent({ sessionId: 'c', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 'c', kind: 'roll_in_session' });

    const r = await computeSessionDebug(2, 10);
    expect(r.totalSessions).toBe(3);
    expect(r.byStage.started_only).toBe(1);
    expect(r.byStage.narration_only).toBe(1);
    expect(r.byStage.rolled).toBe(1);
  });

  it('limit restringe número de sessões retornadas mas byStage conta todas', async () => {
    for (let i = 0; i < 5; i++) {
      await trackMetricEvent({ sessionId: `s${i}`, kind: 'session_started' });
    }
    const r = await computeSessionDebug(2, 3);
    expect(r.totalSessions).toBe(5);
    expect(r.sessions.length).toBe(3);
    expect(r.byStage.started_only).toBe(5);
  });

  it('eventCount conta total de events na sessão; kinds conta unique', async () => {
    await trackMetricEvent({ sessionId: 's', kind: 'session_started' });
    await trackMetricEvent({ sessionId: 's', kind: 'action_taken' });
    await trackMetricEvent({ sessionId: 's', kind: 'action_taken' });
    await trackMetricEvent({ sessionId: 's', kind: 'action_taken' });
    const r = await computeSessionDebug(2, 10);
    const session = r.sessions[0]!;
    expect(session.eventCount).toBe(4);
    expect(session.kinds.length).toBe(2); // session_started + action_taken
    const actionKind = session.kinds.find((k) => k.kind === 'action_taken');
    expect(actionKind?.count).toBe(3);
  });
});

// JSgame · γ.6 — UX funnel: latência percebida + engajamento dado.
//
// Mede o "coração" do jogo: quão rápido o player vê a primeira narração,
// quantos dados rola por sessão, quanto silêncio o DM teve.
// Endpoint GET /api/dm/ux-funnel?days=7.

import { getDbClient } from './persistence.js';

export interface UxFunnelSummary {
  windowStart: number;
  windowEnd: number;
  sessions: {
    total: number;
    withFirstNarration: number;
    withFirstRoll: number;
  };
  latency: {
    timeToFirstNarrationMs: { p50: number; p90: number; p99: number; sample: number };
    timeToFirstRollMs: { p50: number; p90: number; p99: number; sample: number };
  };
  rolls: {
    avgPerSession: number;
    medianPerSession: number;
    maxInSession: number;
    /** Mestre Experiente — % de actions de player que resultaram em roll.
     *  Alvo: >40%. Abaixo = DM narrando demais sem pedir dado. */
    rollsPerActionRatio: number;
    /** Mestre Experiente — média de skills DIFERENTES usadas por sessão.
     *  Alvo: >5. Baixo = DM repetindo Percepção/Investigação/Persuasão. */
    avgDistinctSkillsPerSession: number;
    /** Top-3 skills mais usadas globalmente (debug pra ver desbalanço). */
    topSkills: Array<{ skill: string; count: number }>;
  };
  silence: {
    avgSecondsPerSession: number;
    sampleCount: number;
  };
  blocked: {
    totalCount: number;        // count of combat_action_blocked events
    bySession: number;          // average blocks per session that had any
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx]!;
}

export async function computeUxFunnel(daysBack = 7): Promise<UxFunnelSummary> {
  const now = Date.now();
  const since = now - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();

  // 1) total sessions com qualquer evento
  const sessionsRes = await db.execute({
    sql: `SELECT COUNT(DISTINCT session_id) AS c
          FROM metrics_events
          WHERE created_at >= ? AND session_id IS NOT NULL`,
    args: [since],
  });
  const totalSessions = Number(sessionsRes.rows[0]?.c ?? 0);

  // 2) Latency: time_to_first_narration / time_to_first_roll
  const latencyRes = await db.execute({
    sql: `SELECT kind, payload, session_id
          FROM metrics_events
          WHERE created_at >= ? AND kind IN ('time_to_first_narration', 'time_to_first_roll')`,
    args: [since],
  });
  const firstNarrationMs: number[] = [];
  const firstRollMs: number[] = [];
  const sessionsWithFirstNarration = new Set<string>();
  const sessionsWithFirstRoll = new Set<string>();
  for (const row of latencyRes.rows) {
    const kind = String(row.kind);
    const payloadStr = row.payload != null ? String(row.payload) : null;
    if (!payloadStr) continue;
    try {
      const p = JSON.parse(payloadStr) as { latency_ms?: number };
      if (typeof p.latency_ms !== 'number') continue;
      const ms = Math.max(0, p.latency_ms);
      if (kind === 'time_to_first_narration') {
        firstNarrationMs.push(ms);
        if (row.session_id) sessionsWithFirstNarration.add(String(row.session_id));
      } else if (kind === 'time_to_first_roll') {
        firstRollMs.push(ms);
        if (row.session_id) sessionsWithFirstRoll.add(String(row.session_id));
      }
    } catch { /* payload malformado, ignora */ }
  }

  firstNarrationMs.sort((a, b) => a - b);
  firstRollMs.sort((a, b) => a - b);

  // 3) Rolls per session
  const rollsRes = await db.execute({
    sql: `SELECT session_id, COUNT(*) AS c
          FROM metrics_events
          WHERE created_at >= ? AND kind = 'roll_in_session' AND session_id IS NOT NULL
          GROUP BY session_id`,
    args: [since],
  });
  const rollsPerSession: number[] = [];
  for (const row of rollsRes.rows) {
    rollsPerSession.push(Number(row.c));
  }
  rollsPerSession.sort((a, b) => a - b);
  const totalRolls = rollsPerSession.reduce((s, n) => s + n, 0);
  const avgRolls = rollsPerSession.length > 0 ? totalRolls / rollsPerSession.length : 0;
  const medianRolls = rollsPerSession.length > 0
    ? rollsPerSession[Math.floor(rollsPerSession.length / 2)]!
    : 0;
  const maxRolls = rollsPerSession.length > 0 ? rollsPerSession[rollsPerSession.length - 1]! : 0;

  // 3b) Mestre Experiente — actions taken (pra ratio rolls/actions)
  const actionsRes = await db.execute({
    sql: `SELECT COUNT(*) AS c
          FROM metrics_events
          WHERE created_at >= ? AND kind = 'action_taken'`,
    args: [since],
  });
  const totalActions = Number(actionsRes.rows[0]?.c ?? 0);
  const rollsPerActionRatio = totalActions > 0 ? Math.round((totalRolls / totalActions) * 1000) / 1000 : 0;

  // 3c) Mestre Experiente — skill variety (distinct skills per session + global top)
  const skillsRes = await db.execute({
    sql: `SELECT session_id, payload
          FROM metrics_events
          WHERE created_at >= ? AND kind = 'roll_in_session' AND session_id IS NOT NULL`,
    args: [since],
  });
  const distinctSkillsBySession = new Map<string, Set<string>>();
  const globalSkillCount = new Map<string, number>();
  for (const row of skillsRes.rows) {
    const sid = String(row.session_id ?? '');
    const payloadStr = row.payload != null ? String(row.payload) : null;
    if (!payloadStr) continue;
    try {
      const p = JSON.parse(payloadStr) as { skill?: string };
      if (typeof p.skill !== 'string' || p.skill.length === 0) continue;
      const set = distinctSkillsBySession.get(sid) ?? new Set<string>();
      set.add(p.skill);
      distinctSkillsBySession.set(sid, set);
      globalSkillCount.set(p.skill, (globalSkillCount.get(p.skill) ?? 0) + 1);
    } catch { /* ignore */ }
  }
  let totalDistinct = 0;
  for (const set of distinctSkillsBySession.values()) totalDistinct += set.size;
  const avgDistinctSkillsPerSession = distinctSkillsBySession.size > 0
    ? Math.round((totalDistinct / distinctSkillsBySession.size) * 10) / 10
    : 0;
  const topSkills = Array.from(globalSkillCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill, count]) => ({ skill, count }));

  // 4) DM silence — média de silence_seconds por sessão
  const silenceRes = await db.execute({
    sql: `SELECT session_id, payload
          FROM metrics_events
          WHERE created_at >= ? AND kind = 'dm_silence' AND session_id IS NOT NULL`,
    args: [since],
  });
  const silencePerSession = new Map<string, { total: number; count: number }>();
  for (const row of silenceRes.rows) {
    const sid = String(row.session_id ?? '');
    const payloadStr = row.payload != null ? String(row.payload) : null;
    if (!payloadStr) continue;
    try {
      const p = JSON.parse(payloadStr) as { silence_seconds?: number };
      if (typeof p.silence_seconds !== 'number') continue;
      const cur = silencePerSession.get(sid) ?? { total: 0, count: 0 };
      cur.total += p.silence_seconds;
      cur.count += 1;
      silencePerSession.set(sid, cur);
    } catch { /* ignore */ }
  }
  let silenceSumAvg = 0;
  for (const v of silencePerSession.values()) {
    silenceSumAvg += v.total / Math.max(1, v.count);
  }
  const avgSilenceSeconds = silencePerSession.size > 0 ? silenceSumAvg / silencePerSession.size : 0;

  // 5) Blocked actions (β.4 V2 economy)
  const blockedRes = await db.execute({
    sql: `SELECT session_id, COUNT(*) AS c
          FROM metrics_events
          WHERE created_at >= ? AND kind = 'combat_action_blocked'
          GROUP BY session_id`,
    args: [since],
  });
  let totalBlocked = 0;
  let sessionsWithBlocks = 0;
  for (const row of blockedRes.rows) {
    const c = Number(row.c);
    totalBlocked += c;
    if (c > 0) sessionsWithBlocks += 1;
  }
  const avgBlocksPerActiveSession = sessionsWithBlocks > 0 ? totalBlocked / sessionsWithBlocks : 0;

  return {
    windowStart: since,
    windowEnd: now,
    sessions: {
      total: totalSessions,
      withFirstNarration: sessionsWithFirstNarration.size,
      withFirstRoll: sessionsWithFirstRoll.size,
    },
    latency: {
      timeToFirstNarrationMs: {
        p50: percentile(firstNarrationMs, 0.5),
        p90: percentile(firstNarrationMs, 0.9),
        p99: percentile(firstNarrationMs, 0.99),
        sample: firstNarrationMs.length,
      },
      timeToFirstRollMs: {
        p50: percentile(firstRollMs, 0.5),
        p90: percentile(firstRollMs, 0.9),
        p99: percentile(firstRollMs, 0.99),
        sample: firstRollMs.length,
      },
    },
    rolls: {
      avgPerSession: Math.round(avgRolls * 100) / 100,
      medianPerSession: medianRolls,
      maxInSession: maxRolls,
      rollsPerActionRatio,
      avgDistinctSkillsPerSession,
      topSkills,
    },
    silence: {
      avgSecondsPerSession: Math.round(avgSilenceSeconds * 10) / 10,
      sampleCount: silencePerSession.size,
    },
    blocked: {
      totalCount: totalBlocked,
      bySession: Math.round(avgBlocksPerActiveSession * 10) / 10,
    },
  };
}

// JSgame · Sprint C — Anomaly detection.
// Lê metrics_events + baselines hardcoded, produz alerts estruturados.
// Pure functions onde possível (testable). I/O isolado em `detectAnomalies`.

import { getDbClient } from './persistence.js';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  severity: AlertSeverity;
  kind: string;
  value: number;
  baseline: number;
  message: string;
  windowDays: number;
}

// Baselines — valores "normais" calibrados pelo histórico de produção.
// Ajustar conforme dataset cresce.
export const BASELINES = {
  // DM error rate aceitável até 5%. > 10% é HIGH, > 20% CRITICAL.
  dmErrorRate: { normal: 0.05, high: 0.10, critical: 0.20 },
  // Session length médio esperado 15-45 min. Fora disso suspeito.
  sessionMinAvg: { min: 5, max: 90 },
  // Character died per session — mais que 0.5 = encontros muito difíceis.
  charDiedPerSession: { high: 0.5, critical: 1.0 },
  // Combat lost rate — mais que 30% defeats = balance ruim.
  combatLostRate: { high: 0.30, critical: 0.50 },
};

// Pure: dado os números, computa alerts. Testável sem DB.
export function computeAlerts(input: {
  dmErrorRate: number;
  sessionMinAvg: number;
  sessionSampleCount: number;
  charDiedPerSession: number;
  combatLostRate: number;
  combatSampleCount: number;
  windowDays: number;
}): Alert[] {
  const alerts: Alert[] = [];
  const { windowDays } = input;

  // 1) DM error rate
  if (input.dmErrorRate >= BASELINES.dmErrorRate.critical) {
    alerts.push({
      severity: 'critical',
      kind: 'dm_error_rate_critical',
      value: input.dmErrorRate,
      baseline: BASELINES.dmErrorRate.normal,
      message: `DM error rate ${(input.dmErrorRate * 100).toFixed(1)}% (>20% crítico). Provider possivelmente offline.`,
      windowDays,
    });
  } else if (input.dmErrorRate >= BASELINES.dmErrorRate.high) {
    alerts.push({
      severity: 'high',
      kind: 'dm_error_rate_high',
      value: input.dmErrorRate,
      baseline: BASELINES.dmErrorRate.normal,
      message: `DM error rate ${(input.dmErrorRate * 100).toFixed(1)}% (>10%). Verificar cascade providers.`,
      windowDays,
    });
  }

  // 2) Session length anormal
  if (input.sessionSampleCount >= 5) {
    const minAvg = input.sessionMinAvg;
    if (minAvg < BASELINES.sessionMinAvg.min) {
      alerts.push({
        severity: 'medium',
        kind: 'session_too_short',
        value: minAvg,
        baseline: BASELINES.sessionMinAvg.min,
        message: `Sessões muito curtas (avg ${minAvg.toFixed(1)}min). Players abandonando cedo?`,
        windowDays,
      });
    } else if (minAvg > BASELINES.sessionMinAvg.max) {
      alerts.push({
        severity: 'low',
        kind: 'session_too_long',
        value: minAvg,
        baseline: BASELINES.sessionMinAvg.max,
        message: `Sessões muito longas (avg ${minAvg.toFixed(1)}min). Engagement alto OU sessões esquecidas abertas.`,
        windowDays,
      });
    }
  }

  // 3) Character deaths por sessão
  if (input.charDiedPerSession >= BASELINES.charDiedPerSession.critical) {
    alerts.push({
      severity: 'critical',
      kind: 'char_died_rate_critical',
      value: input.charDiedPerSession,
      baseline: 0,
      message: `${input.charDiedPerSession.toFixed(2)} mortes/sessão (>1.0 crítico). Encontros muito difíceis?`,
      windowDays,
    });
  } else if (input.charDiedPerSession >= BASELINES.charDiedPerSession.high) {
    alerts.push({
      severity: 'medium',
      kind: 'char_died_rate_high',
      value: input.charDiedPerSession,
      baseline: 0,
      message: `${input.charDiedPerSession.toFixed(2)} mortes/sessão. Balance de combate?`,
      windowDays,
    });
  }

  // 4) Combat lost rate
  if (input.combatSampleCount >= 3) {
    if (input.combatLostRate >= BASELINES.combatLostRate.critical) {
      alerts.push({
        severity: 'high',
        kind: 'combat_lost_rate_critical',
        value: input.combatLostRate,
        baseline: BASELINES.combatLostRate.high,
        message: `${(input.combatLostRate * 100).toFixed(0)}% combates perdidos (>50%). Encounters mal balanceados.`,
        windowDays,
      });
    } else if (input.combatLostRate >= BASELINES.combatLostRate.high) {
      alerts.push({
        severity: 'medium',
        kind: 'combat_lost_rate_high',
        value: input.combatLostRate,
        baseline: BASELINES.combatLostRate.high,
        message: `${(input.combatLostRate * 100).toFixed(0)}% combates perdidos. Tendência preocupante.`,
        windowDays,
      });
    }
  }

  return alerts;
}

// I/O wrapper — busca dados do DB e chama computeAlerts.
export async function detectAnomalies(daysBack = 1): Promise<{
  alerts: Alert[];
  metrics: {
    dmErrorRate: number;
    sessionMinAvg: number;
    charDiedPerSession: number;
    combatLostRate: number;
  };
  windowStart: number;
  windowEnd: number;
}> {
  const now = Date.now();
  const since = now - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();

  // 1) DM error rate
  const dmR = await db.execute({
    sql: `SELECT kind, COUNT(*) AS c FROM metrics_events
          WHERE created_at >= ? AND kind IN ('narration_success', 'narration_error')
          GROUP BY kind`,
    args: [since],
  });
  let success = 0, error = 0;
  for (const row of dmR.rows) {
    if (row.kind === 'narration_success') success = Number(row.c);
    else if (row.kind === 'narration_error') error = Number(row.c);
  }
  const dmTotal = success + error;
  const dmErrorRate = dmTotal > 0 ? error / dmTotal : 0;

  // 2) Session length
  const sessR = await db.execute({
    sql: `SELECT session_id, MIN(created_at) AS start_ts, MAX(created_at) AS end_ts
          FROM metrics_events
          WHERE created_at >= ? AND session_id IS NOT NULL
          GROUP BY session_id
          HAVING COUNT(*) >= 2`,
    args: [since],
  });
  let sessSum = 0, sessCount = 0;
  for (const row of sessR.rows) {
    const ms = Number(row.end_ts) - Number(row.start_ts);
    if (ms > 0 && ms < 8 * 60 * 60 * 1000) {
      sessSum += ms;
      sessCount++;
    }
  }
  const sessionMinAvg = sessCount > 0 ? (sessSum / sessCount) / 60000 : 0;

  // 3) Character died rate
  const deathR = await db.execute({
    sql: `SELECT
          (SELECT COUNT(*) FROM metrics_events WHERE created_at >= ? AND kind = 'character_died') AS deaths,
          (SELECT COUNT(*) FROM metrics_events WHERE created_at >= ? AND kind = 'session_started') AS sessions`,
    args: [since, since],
  });
  const deaths = Number(deathR.rows[0]?.deaths ?? 0);
  const sessions = Number(deathR.rows[0]?.sessions ?? 0);
  const charDiedPerSession = sessions > 0 ? deaths / sessions : 0;

  // 4) Combat lost rate
  const combatR = await db.execute({
    sql: `SELECT kind, COUNT(*) AS c FROM metrics_events
          WHERE created_at >= ? AND kind IN ('combat_won', 'combat_lost')
          GROUP BY kind`,
    args: [since],
  });
  let combatWon = 0, combatLost = 0;
  for (const row of combatR.rows) {
    if (row.kind === 'combat_won') combatWon = Number(row.c);
    else if (row.kind === 'combat_lost') combatLost = Number(row.c);
  }
  const combatTotal = combatWon + combatLost;
  const combatLostRate = combatTotal > 0 ? combatLost / combatTotal : 0;

  const alerts = computeAlerts({
    dmErrorRate,
    sessionMinAvg,
    sessionSampleCount: sessCount,
    charDiedPerSession,
    combatLostRate,
    combatSampleCount: combatTotal,
    windowDays: daysBack,
  });

  return {
    alerts,
    metrics: { dmErrorRate, sessionMinAvg, charDiedPerSession, combatLostRate },
    windowStart: since,
    windowEnd: now,
  };
}

// Funnel analysis — mede drop-off entre etapas do user journey.
// character_created → session_started → combat_started → (combat_won | combat_lost)
export async function computeFunnel(daysBack = 7): Promise<{
  steps: Array<{ kind: string; count: number; conversionFromPrev: number | null }>;
  windowStart: number;
  windowEnd: number;
}> {
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();
  const FUNNEL_STEPS = [
    'character_created',
    'session_started',
    'combat_started',
    'combat_won',
  ] as const;

  const r = await db.execute({
    sql: `SELECT kind, COUNT(*) AS c FROM metrics_events
          WHERE created_at >= ? AND kind IN (?, ?, ?, ?)
          GROUP BY kind`,
    args: [since, ...FUNNEL_STEPS],
  });
  const counts: Record<string, number> = {};
  for (const row of r.rows) {
    counts[String(row.kind)] = Number(row.c);
  }
  const steps: Array<{ kind: string; count: number; conversionFromPrev: number | null }> = [];
  let prevCount = 0;
  for (let i = 0; i < FUNNEL_STEPS.length; i++) {
    const kind = FUNNEL_STEPS[i]!;
    const count = counts[kind] ?? 0;
    steps.push({
      kind,
      count,
      conversionFromPrev: i === 0 ? null : prevCount > 0 ? count / prevCount : 0,
    });
    prevCount = count;
  }
  return {
    steps,
    windowStart: since,
    windowEnd: Date.now(),
  };
}

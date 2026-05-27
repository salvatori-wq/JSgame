// JSgame · POLISH-0 — Debug per-session pra investigar gaps no funil.
//
// Endpoint GET /api/dm/session-debug?days=2&limit=30 retorna detalhamento
// de cada session_id: lista de event kinds + timestamps + userId. Permite
// investigar manualmente "por que essa sessão não chegou à primeira
// narração?", classificando: abandono no cold open, race coop, bot, etc.

import { getDbClient } from './persistence.js';

export interface SessionDebugEntry {
  sessionId: string;
  userId: string | null;
  firstEventAt: number;
  lastEventAt: number;
  durationMs: number;
  eventCount: number;
  /** Cronologicamente ordenada — primeira ocorrência de cada kind. */
  kinds: Array<{ kind: string; firstAt: number; count: number }>;
  /** Classificação heurística do funil pra triagem rápida. */
  stage:
    | 'started_only'              // só session_started, nada mais
    | 'narration_only'             // viu cold open mas não interagiu
    | 'action_no_response'         // tomou ação mas DM não respondeu (falha LLM?)
    | 'engaged_no_roll'            // ação + resposta DM, mas não rolou dado
    | 'rolled'                     // rolou ao menos 1 dado
    | 'combat'                     // entrou em combate
    | 'unknown';                   // sem session_started
}

export interface SessionDebugSummary {
  windowStart: number;
  windowEnd: number;
  totalSessions: number;
  byStage: Record<SessionDebugEntry['stage'], number>;
  sessions: SessionDebugEntry[];
}

function classifyStage(kinds: Set<string>): SessionDebugEntry['stage'] {
  if (!kinds.has('session_started')) return 'unknown';
  if (kinds.has('combat_started')) return 'combat';
  if (kinds.has('roll_in_session')) return 'rolled';
  if (kinds.has('time_to_first_dm_response')) return 'engaged_no_roll';
  if (kinds.has('action_taken')) return 'action_no_response';
  if (kinds.has('time_to_first_narration')) return 'narration_only';
  return 'started_only';
}

export async function computeSessionDebug(daysBack = 2, limit = 30): Promise<SessionDebugSummary> {
  const now = Date.now();
  const since = now - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();

  // Pega todos events das últimas N dias com session_id, agrupados por session.
  // Limit aplicado depois (precisa de todos eventos pra classificar corretamente).
  const eventsRes = await db.execute({
    sql: `SELECT session_id, user_id, kind, created_at
          FROM metrics_events
          WHERE created_at >= ? AND session_id IS NOT NULL
          ORDER BY created_at ASC`,
    args: [since],
  });

  interface Accum {
    userId: string | null;
    firstAt: number;
    lastAt: number;
    eventCount: number;
    kindFirstAt: Map<string, number>;
    kindCount: Map<string, number>;
    kindsSet: Set<string>;
  }

  const bySession = new Map<string, Accum>();
  for (const row of eventsRes.rows) {
    const sid = String(row.session_id);
    const kind = String(row.kind);
    const ts = Number(row.created_at);
    const uid = row.user_id != null ? String(row.user_id) : null;
    let a = bySession.get(sid);
    if (!a) {
      a = {
        userId: uid,
        firstAt: ts,
        lastAt: ts,
        eventCount: 0,
        kindFirstAt: new Map(),
        kindCount: new Map(),
        kindsSet: new Set(),
      };
      bySession.set(sid, a);
    }
    a.userId = a.userId ?? uid;
    a.lastAt = ts;
    a.eventCount += 1;
    if (!a.kindFirstAt.has(kind)) a.kindFirstAt.set(kind, ts);
    a.kindCount.set(kind, (a.kindCount.get(kind) ?? 0) + 1);
    a.kindsSet.add(kind);
  }

  const entries: SessionDebugEntry[] = [];
  for (const [sessionId, a] of bySession.entries()) {
    const kinds = Array.from(a.kindFirstAt.entries())
      .map(([kind, firstAt]) => ({ kind, firstAt, count: a.kindCount.get(kind) ?? 0 }))
      .sort((x, y) => x.firstAt - y.firstAt);
    entries.push({
      sessionId,
      userId: a.userId,
      firstEventAt: a.firstAt,
      lastEventAt: a.lastAt,
      durationMs: a.lastAt - a.firstAt,
      eventCount: a.eventCount,
      kinds,
      stage: classifyStage(a.kindsSet),
    });
  }

  // Ordena por firstEventAt DESC (mais recente primeiro) e aplica limit
  entries.sort((x, y) => y.firstEventAt - x.firstEventAt);
  const sessions = entries.slice(0, Math.max(1, Math.min(200, limit)));

  // Stage breakdown calculado em TODAS as sessões (não só as retornadas)
  const byStage: Record<SessionDebugEntry['stage'], number> = {
    started_only: 0,
    narration_only: 0,
    action_no_response: 0,
    engaged_no_roll: 0,
    rolled: 0,
    combat: 0,
    unknown: 0,
  };
  for (const e of entries) byStage[e.stage] += 1;

  return {
    windowStart: since,
    windowEnd: now,
    totalSessions: entries.length,
    byStage,
    sessions,
  };
}

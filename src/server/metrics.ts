// JSgame · T1 — Telemetria mínima.
// Tracker de eventos em metrics_events table (criada em persistence schema).
// Não é admin-gated por enquanto — endpoint /api/metrics/summary aberto pra qualquer
// user autenticado (zero data sensível, só contagens agregadas).

import { getDbClient } from './persistence.js';
import { uuid } from './util.js';

export type MetricsEventKind =
  | 'session_started'         // user inicia/continua campanha
  | 'campaign_created'        // nova campanha começou
  | 'character_created'       // wizard finalizado
  | 'combat_started'
  | 'combat_won'
  | 'combat_lost'
  | 'character_died'
  | 'narration_success'       // DM gerou narração com tools válidos
  | 'narration_error'         // DM falhou (timeout, tool inválido, etc)
  | 'lobby_created'
  | 'lobby_joined'
  | 'friend_invited'
  | 'highlight_exported'
  // γ.6 — UX baseline metrics
  | 'time_to_first_narration' // payload: { latency_ms } — primeira narração na sessão (joinCampaign → cold open)
  | 'time_to_first_player_action' // payload: { latency_ms } — primeira narração → primeira ação do player (engajamento humano)
  | 'time_to_first_dm_response'   // payload: { latency_ms } — primeira ação do player → resposta DM (latência LLM real)
  | 'time_to_first_roll'      // payload: { latency_ms } — primeiro skill check/save da sessão
  | 'roll_in_session'         // payload: { roll_total, success?, nat20?, nat1?, skill? }
  | 'dm_silence'              // payload: { silence_seconds } — gap entre player action e narration
  | 'combat_action_blocked'   // payload: { reason, kind } — β.4 V2 economy block
  | 'action_taken'            // payload: { action, has_details } — toda takeAction (pra ratio rolls/actions)
  // F3/F4 — Densidade metrics
  | 'dm_callback_used'        // payload: { npc_count, quest_count, location_count, total }
  | 'dm_used_backstory'       // payload: { trait, ideal, bond, flaw } booleans
  // POLISH-0 — Client-side eventos de funil pré-sessão (POST /api/metrics/track)
  | 'home_loaded'             // payload: { has_anon, has_user, returning } — homepage renderizada
  | 'prefab_clicked'          // payload: { prefab_id } — click em prefab card
  // π — Sprint π Bottom Tab Bar — distribuição de uso por slot
  | 'bottom_tab_tap'          // payload: { tab: 'quests'|'achievements'|'npcs'|'chat'|'share'|'more' }
  // κ.1 — Sprint κ.1 Tutorial Duolingo — taxa de conclusão por step
  | 'duolingo_tutorial_step'  // payload: { step, total, viewed?, completed?, skipped? }
  // ψ.5 — Sprint ψ.5 polish — métricas-chave faltantes
  | 'combat_turn_duration'    // payload: { duration_ms } — do start turn player até endTurn
  | 'narration_word_count'    // payload: { words, kind } — tamanho das narrações
  | 'auto_retry_success'      // payload: { attempt_n, success } — retry silencioso resolveu?
  | 'error_kind_seen'         // payload: { kind: 'timeout'|'rate_limit'|'auth'|'parse'|'empty'|'unknown' }
  // Ω.1 — Sprint Ω dado DEFINITIVO — watchdog 5s + render diagnostics
  | 'dice_roll_timeout'       // payload: { kind: 'skill-check'|'combat' } — watchdog disparou
  | 'dice_roll_visual_slow'   // payload: { elapsed_ms, expected_ms } — anim demorou +1.5s do esperado
  // Y.A1 — Sprint Y fog of war linter — DM vazou números do oponente
  | 'fog_violation';          // payload: { matches: string, retry_done: boolean, count: number }

export interface MetricsEvent {
  id: string;
  userId: string | null;
  sessionId: string | null;       // campaign-id quando aplicável
  kind: MetricsEventKind;
  payload: string | null;          // JSON stringificado
  createdAt: number;
}

export async function trackMetricEvent(opts: {
  userId?: string | null;
  sessionId?: string | null;
  kind: MetricsEventKind;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDbClient().execute({
      sql: 'INSERT INTO metrics_events (id, user_id, session_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        uuid(),
        opts.userId ?? null,
        opts.sessionId ?? null,
        opts.kind,
        opts.payload ? JSON.stringify(opts.payload) : null,
        Date.now(),
      ],
    });
  } catch (err) {
    // Falhas silenciosas — telemetria nunca quebra fluxo principal
    console.warn('[metrics] track failed:', err);
  }
}

// Agregado pra /api/metrics/summary. Retorna contagens por kind nos últimos N dias.
export async function getMetricsSummary(daysBack = 7): Promise<{
  byKind: Record<string, number>;
  totalEvents: number;
  dau: number;             // distinct user_id nas últimas 24h
  wau: number;             // distinct user_id nos últimos 7 dias
  windowStart: number;
  windowEnd: number;
}> {
  const now = Date.now();
  const windowStart = now - daysBack * 24 * 60 * 60 * 1000;
  const dauStart = now - 24 * 60 * 60 * 1000;
  const wauStart = now - 7 * 24 * 60 * 60 * 1000;

  const byKindRes = await getDbClient().execute({
    sql: 'SELECT kind, COUNT(*) AS c FROM metrics_events WHERE created_at >= ? GROUP BY kind',
    args: [windowStart],
  });
  const byKind: Record<string, number> = {};
  let totalEvents = 0;
  for (const row of byKindRes.rows) {
    const c = Number(row.c);
    byKind[String(row.kind)] = c;
    totalEvents += c;
  }

  const dauRes = await getDbClient().execute({
    sql: 'SELECT COUNT(DISTINCT user_id) AS c FROM metrics_events WHERE created_at >= ? AND user_id IS NOT NULL',
    args: [dauStart],
  });
  const wauRes = await getDbClient().execute({
    sql: 'SELECT COUNT(DISTINCT user_id) AS c FROM metrics_events WHERE created_at >= ? AND user_id IS NOT NULL',
    args: [wauStart],
  });

  return {
    byKind,
    totalEvents,
    dau: Number(dauRes.rows[0]?.c ?? 0),
    wau: Number(wauRes.rows[0]?.c ?? 0),
    windowStart,
    windowEnd: now,
  };
}

// DM error rate nos últimos N dias (úteis pra acompanhar saúde do LLM provider).
export async function getDmErrorRate(daysBack = 7): Promise<{ success: number; error: number; rate: number }> {
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const r = await getDbClient().execute({
    sql: "SELECT kind, COUNT(*) AS c FROM metrics_events WHERE created_at >= ? AND kind IN ('narration_success', 'narration_error') GROUP BY kind",
    args: [since],
  });
  let success = 0, error = 0;
  for (const row of r.rows) {
    const c = Number(row.c);
    if (row.kind === 'narration_success') success = c;
    else if (row.kind === 'narration_error') error = c;
  }
  const total = success + error;
  return { success, error, rate: total > 0 ? error / total : 0 };
}

// Session length médio: agrupa eventos por session_id, calcula min(created_at) → max(created_at).
export async function getAvgSessionLength(daysBack = 7): Promise<{ avgMs: number; sampleCount: number }> {
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const r = await getDbClient().execute({
    sql: `SELECT session_id, MIN(created_at) AS start_ts, MAX(created_at) AS end_ts
          FROM metrics_events
          WHERE created_at >= ? AND session_id IS NOT NULL
          GROUP BY session_id
          HAVING COUNT(*) >= 2`,
    args: [since],
  });
  let totalMs = 0;
  let count = 0;
  for (const row of r.rows) {
    const start = Number(row.start_ts);
    const end = Number(row.end_ts);
    const ms = end - start;
    if (ms > 0 && ms < 8 * 60 * 60 * 1000) {  // descarta sessões > 8h (provavelmente abandonadas)
      totalMs += ms;
      count += 1;
    }
  }
  return {
    avgMs: count > 0 ? Math.floor(totalMs / count) : 0,
    sampleCount: count,
  };
}

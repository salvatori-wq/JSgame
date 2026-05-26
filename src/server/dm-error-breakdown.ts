// JSgame · Sprint pós-deploy 2026-05-26 — Diagnostic detalhado de erros DM.
// Lê últimos N narration_error events e categoriza por:
//   - Provider (cerebras / gemini / groq / cascade)
//   - Tipo de erro (rate_limit / quota / timeout / parse_fail / tools_400 / safety / unknown)
//
// Usado pelo endpoint /api/dm/errors e pelo /api/dm/health expandido.

import { getDbClient } from './persistence.js';

export type ErrorCategory =
  | 'rate_limit'
  | 'quota_exceeded'
  | 'timeout'
  | 'parse_fail'
  | 'tools_400'
  | 'safety_block'
  | 'auth_fail'
  | 'upstream_5xx'
  | 'empty_response'
  | 'unknown';

export interface ErrorEvent {
  timestamp: number;
  provider: string;
  errorMsg: string;
  category: ErrorCategory;
}

// Pure: categoriza mensagem de erro. Testável sem DB.
// Ordem dos checks importa — primeiro match ganha. Categorias mais específicas antes.
export function categorizeError(msg: string): ErrorCategory {
  const m = msg.toLowerCase();
  // Empty response — verifica ANTES de generic "parse" porque é caso especial
  if (/empty narration|narração vazia|narration.+(vazi|empty)/.test(m)) return 'empty_response';
  if (/429|rate.?limit/.test(m)) return 'rate_limit';
  if (/quota|usage limit|daily limit|too many requests/.test(m)) return 'quota_exceeded';
  // Timeout — tanto "timeout", "timed out" quanto "operation was aborted" (AbortController)
  if (/tim(e|ed).?out|operation was aborted|aborterror/.test(m)) return 'timeout';
  if (/safety|filtered|blocked|recitation/.test(m)) return 'safety_block';
  if (/401|403|unauthorized|forbidden|invalid.?api.?key/.test(m)) return 'auth_fail';
  if (/5\d\d|503|502|504|overload|unavailable|internal server/.test(m)) return 'upstream_5xx';
  if (/parse|json|extractjson/.test(m)) return 'parse_fail';
  if (/400|invalid.?request|failed to call a function|tool/.test(m)) return 'tools_400';
  return 'unknown';
}

export interface ErrorBreakdown {
  total: number;
  windowDays: number;
  windowStart: number;
  windowEnd: number;
  byCategory: Record<ErrorCategory, number>;
  byProvider: Record<string, number>;
  // Combinação cruzada: { "gemini:rate_limit": 5 }
  byProviderCategory: Record<string, number>;
  // Top 10 messages distintas (sample pra debug)
  topMessages: Array<{ msg: string; count: number; provider: string; category: ErrorCategory }>;
  // Eventos recentes (últimos 20) pra timeline
  recentEvents: ErrorEvent[];
}

// Timeline de TODAS narrações (success + error) agrupado por hora.
// Útil pra ver picos de uso e identificar burst patterns.
export async function getDmTimeline(daysBack = 1): Promise<{
  windowStart: number;
  windowEnd: number;
  totalSuccess: number;
  totalError: number;
  hourlyBuckets: Array<{ hourUtc: string; success: number; error: number; total: number }>;
}> {
  const now = Date.now();
  const since = now - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();

  const r = await db.execute({
    sql: `SELECT created_at, kind FROM metrics_events
          WHERE created_at >= ? AND kind IN ('narration_success', 'narration_error')
          ORDER BY created_at ASC`,
    args: [since],
  });

  const buckets = new Map<string, { success: number; error: number }>();
  let totalSuccess = 0, totalError = 0;
  for (const row of r.rows) {
    const ts = Number(row.created_at);
    const d = new Date(ts);
    const hourKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}T${String(d.getUTCHours()).padStart(2,'0')}:00Z`;
    if (!buckets.has(hourKey)) buckets.set(hourKey, { success: 0, error: 0 });
    const b = buckets.get(hourKey)!;
    if (row.kind === 'narration_success') { b.success++; totalSuccess++; }
    else { b.error++; totalError++; }
  }

  const hourlyBuckets = Array.from(buckets.entries())
    .map(([hourUtc, v]) => ({ hourUtc, success: v.success, error: v.error, total: v.success + v.error }))
    .sort((a, b) => a.hourUtc.localeCompare(b.hourUtc));

  return { windowStart: since, windowEnd: now, totalSuccess, totalError, hourlyBuckets };
}

export async function getDmErrorBreakdown(daysBack = 1): Promise<ErrorBreakdown> {
  const now = Date.now();
  const since = now - daysBack * 24 * 60 * 60 * 1000;
  const db = getDbClient();

  const r = await db.execute({
    sql: `SELECT created_at, payload FROM metrics_events
          WHERE created_at >= ? AND kind = 'narration_error'
          ORDER BY created_at DESC`,
    args: [since],
  });

  const events: ErrorEvent[] = [];
  for (const row of r.rows) {
    let payload: { error?: string; provider?: string; effectiveProvider?: string } = {};
    try { payload = JSON.parse(String(row.payload ?? '{}')); } catch { /* ignore */ }
    const errorMsg = payload.error ?? 'unknown';
    // 2026-05-26: prefere effectiveProvider (qual provider individual falhou
    // dentro do cascade) sobre o name do cascade. Antes "cascade(...)" mascarava.
    const provider = payload.effectiveProvider ?? payload.provider ?? 'unknown';
    events.push({
      timestamp: Number(row.created_at),
      provider,
      errorMsg,
      category: categorizeError(errorMsg),
    });
  }

  const byCategory = {} as Record<ErrorCategory, number>;
  const byProvider: Record<string, number> = {};
  const byProviderCategory: Record<string, number> = {};
  const msgCounts: Map<string, { count: number; provider: string; category: ErrorCategory }> = new Map();

  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + 1;
    const pcKey = `${e.provider}:${e.category}`;
    byProviderCategory[pcKey] = (byProviderCategory[pcKey] ?? 0) + 1;
    const existing = msgCounts.get(e.errorMsg);
    if (existing) existing.count++;
    else msgCounts.set(e.errorMsg, { count: 1, provider: e.provider, category: e.category });
  }

  const topMessages = Array.from(msgCounts.entries())
    .map(([msg, v]) => ({ msg, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: events.length,
    windowDays: daysBack,
    windowStart: since,
    windowEnd: now,
    byCategory,
    byProvider,
    byProviderCategory,
    topMessages,
    recentEvents: events.slice(0, 20),
  };
}

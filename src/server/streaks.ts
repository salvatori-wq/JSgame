// JSgame · F20 — Daily streak tracker.
// Bump quando user toma uma ação. Trabalho em UTC YYYY-MM-DD pra evitar
// problemas de fuso (mesmo "dia" local pode estar em 2 dias UTC).
//
// Lógica:
// - Hoje já marcado: no-op.
// - Ontem marcado: current_streak += 1; bumpa longest se passar.
// - Mais de 1 dia atrás OU nunca: current_streak = 1 (resetou).

import { getDbClient } from './persistence.js';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;   // YYYY-MM-DD
  totalDays: number;
  bumped: boolean;          // true se essa chamada bumpou o streak (hoje virou ativo agora)
  brokeRecord: boolean;     // true se essa chamada atualizou longestStreak
}

function todayUtcDate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayOf(date: string): string {
  // Recebe YYYY-MM-DD, retorna o dia anterior (UTC)
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return todayUtcDate.call({ d: dt }) || formatUTC(dt);
}

function formatUTC(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function bumpStreak(userId: string | null | undefined): Promise<StreakState | null> {
  if (!userId) return null;
  const today = todayUtcDate();
  const now = Date.now();

  const existing = await getDbClient().execute({
    sql: 'SELECT current_streak, longest_streak, last_active_date, total_days FROM daily_streaks WHERE user_id = ?',
    args: [userId],
  });
  const row = existing.rows[0];

  if (!row) {
    // Primeiro dia
    await getDbClient().execute({
      sql: 'INSERT INTO daily_streaks (user_id, current_streak, longest_streak, last_active_date, total_days, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [userId, 1, 1, today, 1, now],
    });
    return {
      currentStreak: 1, longestStreak: 1, lastActiveDate: today, totalDays: 1,
      bumped: true, brokeRecord: true,
    };
  }

  const last = String(row.last_active_date);
  const cur = Number(row.current_streak);
  const longest = Number(row.longest_streak);
  const total = Number(row.total_days);

  if (last === today) {
    // Já marcado hoje, no-op
    return {
      currentStreak: cur, longestStreak: longest, lastActiveDate: last, totalDays: total,
      bumped: false, brokeRecord: false,
    };
  }

  const yesterday = formatUTC(new Date(Date.now() - 86_400_000));
  let newCurrent: number;
  if (last === yesterday) {
    newCurrent = cur + 1;
  } else {
    // Quebrou streak (>1 dia parado)
    newCurrent = 1;
  }
  const newLongest = Math.max(longest, newCurrent);
  const newTotal = total + 1;
  const brokeRecord = newLongest > longest;

  await getDbClient().execute({
    sql: 'UPDATE daily_streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, total_days = ?, updated_at = ? WHERE user_id = ?',
    args: [newCurrent, newLongest, today, newTotal, now, userId],
  });

  return {
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastActiveDate: today,
    totalDays: newTotal,
    bumped: true,
    brokeRecord,
  };
}

export async function getStreak(userId: string): Promise<StreakState | null> {
  const r = await getDbClient().execute({
    sql: 'SELECT current_streak, longest_streak, last_active_date, total_days FROM daily_streaks WHERE user_id = ?',
    args: [userId],
  });
  const row = r.rows[0];
  if (!row) return null;
  // Checa se streak está vivo (ativo hoje OU ontem). Se mais de 1 dia → mostra
  // current_streak como "será resetado na próxima ação" implicitamente.
  return {
    currentStreak: Number(row.current_streak),
    longestStreak: Number(row.longest_streak),
    lastActiveDate: String(row.last_active_date),
    totalDays: Number(row.total_days),
    bumped: false,
    brokeRecord: false,
  };
}

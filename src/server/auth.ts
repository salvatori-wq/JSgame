// JSgame · Auth core — magic link passwordless.
//
// Fluxo:
// 1. POST /api/auth/request-link { email }
//    → cria/encontra user, gera token 15min, manda email
// 2. GET /api/auth/verify?token=X
//    → consume token, marca email_verified, cria sessão 30d, set cookie httpOnly
// 3. Cliente apresenta sessão em todas requests (cookie auto)
//    → middleware popula req.user
// 4. POST /api/auth/logout → revoga sessão (DELETE row)
//
// Decisões:
// - Opaque token (crypto.randomBytes 32 bytes = 64 hex chars) em vez de JWT
//   → permite revogação trivial, sem secret env var
// - Sessão 30 dias rolling: cada uso aciona renovação se restam < 7 dias
// - Email case-insensitive (COLLATE NOCASE no schema)
// - Não armazena senhas — magic link é o "secret"

import { randomBytes } from 'node:crypto';
import { getDbClient } from './persistence.js';
import { uuid } from './util.js';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Constantes — duração de tokens
// ════════════════════════════════════════════════════════════════════════════

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;          // 15 minutos
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 dias
const SESSION_RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // renew se < 7 dias

// ════════════════════════════════════════════════════════════════════════════
// Helpers de token
// ════════════════════════════════════════════════════════════════════════════

function generateToken(): string {
  return randomBytes(32).toString('hex'); // 64 chars hex
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Validação simples — não tenta cobrir todos edge cases RFC; rejeita garbage óbvio
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// ════════════════════════════════════════════════════════════════════════════
// Users
// ════════════════════════════════════════════════════════════════════════════

export async function findOrCreateUser(email: string): Promise<User> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error('email inválido');
  }

  const client = getDbClient();
  const existing = await client.execute({
    sql: 'SELECT id, email, display_name, email_verified, created_at, last_login_at FROM users WHERE email = ? COLLATE NOCASE',
    args: [normalized],
  });

  if (existing.rows[0]) {
    return rowToUser(existing.rows[0]);
  }

  const now = Date.now();
  const id = uuid();
  await client.execute({
    sql: 'INSERT INTO users (id, email, display_name, email_verified, created_at) VALUES (?, ?, ?, 0, ?)',
    args: [id, normalized, null, now],
  });

  return {
    id,
    email: normalized,
    displayName: null,
    emailVerified: false,
    createdAt: now,
    lastLoginAt: null,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const r = await getDbClient().execute({
    sql: 'SELECT id, email, display_name, email_verified, created_at, last_login_at FROM users WHERE id = ?',
    args: [id],
  });
  return r.rows[0] ? rowToUser(r.rows[0]) : null;
}

export async function updateUserDisplayName(userId: string, displayName: string): Promise<void> {
  await getDbClient().execute({
    sql: 'UPDATE users SET display_name = ? WHERE id = ?',
    args: [displayName.trim().slice(0, 60) || null, userId],
  });
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    emailVerified: Number(row.email_verified) === 1,
    createdAt: Number(row.created_at),
    lastLoginAt: row.last_login_at != null ? Number(row.last_login_at) : null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Magic link tokens
// ════════════════════════════════════════════════════════════════════════════

/**
 * Gera token de magic link com TTL de 15min. Salva em email_tokens e retorna o
 * token bruto pra incluir no link. Token é só usado 1x (consumed_at impede reuso).
 */
export async function createMagicLink(userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + MAGIC_LINK_TTL_MS;
  await getDbClient().execute({
    sql: 'INSERT INTO email_tokens (token, user_id, kind, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
    args: [token, userId, 'login', expiresAt, now],
  });
  return { token, expiresAt };
}

/**
 * Verifica token, marca como consumed, e retorna o user. Falha se inválido,
 * expirado, ou já usado.
 */
export async function consumeMagicLink(token: string): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return { ok: false, reason: 'token inválido' };
  }

  const client = getDbClient();
  const r = await client.execute({
    sql: 'SELECT user_id, expires_at, consumed_at FROM email_tokens WHERE token = ?',
    args: [token],
  });
  const row = r.rows[0];
  if (!row) return { ok: false, reason: 'token não encontrado' };

  if (row.consumed_at != null) return { ok: false, reason: 'link já usado' };
  if (Number(row.expires_at) < Date.now()) return { ok: false, reason: 'link expirou' };

  const userId = row.user_id as string;

  // Marca consumed + atualiza last_login_at + marca email_verified
  const now = Date.now();
  await client.batch([
    { sql: 'UPDATE email_tokens SET consumed_at = ? WHERE token = ?', args: [now, token] },
    { sql: 'UPDATE users SET email_verified = 1, last_login_at = ? WHERE id = ?', args: [now, userId] },
  ], 'write');

  const user = await getUserById(userId);
  if (!user) return { ok: false, reason: 'usuário não encontrado' };

  // A4 — Auto-aceita convites de amizade pendentes pra este email.
  // Importação dinâmica pra evitar ciclo (friends → auth → friends).
  try {
    const { resolveInvitesForNewUser } = await import('./friends.js');
    const r = await resolveInvitesForNewUser(user.id, user.email);
    if (r.accepted > 0) console.log(`[friends] auto-aceitou ${r.accepted} convite(s) pra ${user.email}`);
  } catch (err) {
    console.warn('[friends] resolveInvitesForNewUser falhou:', err);
  }

  return { ok: true, user };
}

// ════════════════════════════════════════════════════════════════════════════
// Sessions
// ════════════════════════════════════════════════════════════════════════════

export async function createSession(userId: string): Promise<Session> {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await getDbClient().execute({
    sql: 'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    args: [token, userId, expiresAt, now],
  });
  return { token, userId, expiresAt, createdAt: now };
}

/**
 * Valida sessão. Se válida e perto de expirar (< 7 dias), renova in-place.
 * Retorna o user ou null se inválida/expirada.
 */
export async function validateSession(token: string | undefined | null): Promise<User | null> {
  if (!token || typeof token !== 'string' || token.length < 32) return null;

  const client = getDbClient();
  const r = await client.execute({
    sql: 'SELECT user_id, expires_at FROM sessions WHERE token = ?',
    args: [token],
  });
  const row = r.rows[0];
  if (!row) return null;

  const expiresAt = Number(row.expires_at);
  const now = Date.now();
  if (expiresAt < now) {
    // Expirada — limpa do DB
    await client.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    return null;
  }

  const userId = row.user_id as string;
  const user = await getUserById(userId);
  if (!user) return null;

  // Renova se faltam < 7 dias
  if (expiresAt - now < SESSION_RENEW_THRESHOLD_MS) {
    await client.execute({
      sql: 'UPDATE sessions SET expires_at = ? WHERE token = ?',
      args: [now + SESSION_TTL_MS, token],
    });
  }

  return user;
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await getDbClient().execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await getDbClient().execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
}

// ════════════════════════════════════════════════════════════════════════════
// Cleanup — chamável periodicamente pra limpar tokens expirados
// ════════════════════════════════════════════════════════════════════════════

export async function cleanupExpiredTokens(): Promise<{ tokens: number; sessions: number }> {
  const now = Date.now();
  const client = getDbClient();
  const r1 = await client.execute({
    sql: 'DELETE FROM email_tokens WHERE expires_at < ?',
    args: [now],
  });
  const r2 = await client.execute({
    sql: 'DELETE FROM sessions WHERE expires_at < ?',
    args: [now],
  });
  return { tokens: r1.rowsAffected, sessions: r2.rowsAffected };
}

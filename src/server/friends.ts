// JSgame · A4 — Friend graph + invites por email.
// Friendships são simétricas: (user_a, user_b) com user_a < user_b alfabeticamente.
// Invites são pra emails que ainda não existem no sistema — viram friendship
// automática quando o destinatário se registra ou já existe.

import { getDbClient } from './persistence.js';
import { uuid } from './util.js';

export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  userA: string;          // id (sempre < userB alfabético)
  userB: string;
  status: FriendshipStatus;
  requestedBy: string;    // quem mandou o pedido
  createdAt: number;
  acceptedAt: number | null;
}

export interface FriendSummary {
  userId: string;            // o OUTRO user (não você)
  displayName: string | null;
  email: string;
  status: FriendshipStatus;
  iRequested: boolean;       // true se eu mandei o pedido
  createdAt: number;
}

export interface FriendInvite {
  id: string;
  fromUserId: string;
  toEmail: string;
  lobbyCode: string | null;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 dias

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ════════════════════════════════════════════════════════════════════════════
// Friendships
// ════════════════════════════════════════════════════════════════════════════

export async function requestFriendship(fromUserId: string, toUserId: string): Promise<{ ok: boolean; reason?: string; friendship?: Friendship }> {
  if (fromUserId === toUserId) return { ok: false, reason: 'não pode pedir amizade pra si mesmo' };
  const [a, b] = orderPair(fromUserId, toUserId);
  const existing = await getFriendship(a, b);
  if (existing) {
    if (existing.status === 'accepted') return { ok: false, reason: 'já são amigos' };
    return { ok: false, reason: 'pedido pendente já existe' };
  }
  const now = Date.now();
  await getDbClient().execute({
    sql: 'INSERT INTO friendships (user_a, user_b, status, requested_by, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [a, b, 'pending', fromUserId, now],
  });
  return { ok: true, friendship: { userA: a, userB: b, status: 'pending', requestedBy: fromUserId, createdAt: now, acceptedAt: null } };
}

export async function acceptFriendship(acceptingUserId: string, otherUserId: string): Promise<{ ok: boolean; reason?: string }> {
  const [a, b] = orderPair(acceptingUserId, otherUserId);
  const f = await getFriendship(a, b);
  if (!f) return { ok: false, reason: 'pedido não encontrado' };
  if (f.status === 'accepted') return { ok: false, reason: 'já são amigos' };
  if (f.requestedBy === acceptingUserId) return { ok: false, reason: 'só o outro pode aceitar' };
  const now = Date.now();
  await getDbClient().execute({
    sql: "UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE user_a = ? AND user_b = ?",
    args: [now, a, b],
  });
  return { ok: true };
}

export async function removeFriendship(userId: string, otherUserId: string): Promise<{ ok: boolean }> {
  const [a, b] = orderPair(userId, otherUserId);
  await getDbClient().execute({
    sql: 'DELETE FROM friendships WHERE user_a = ? AND user_b = ?',
    args: [a, b],
  });
  return { ok: true };
}

async function getFriendship(a: string, b: string): Promise<Friendship | null> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM friendships WHERE user_a = ? AND user_b = ?',
    args: [a, b],
  });
  const row = r.rows[0];
  if (!row) return null;
  return {
    userA: String(row.user_a),
    userB: String(row.user_b),
    status: String(row.status) as FriendshipStatus,
    requestedBy: String(row.requested_by),
    createdAt: Number(row.created_at),
    acceptedAt: row.accepted_at ? Number(row.accepted_at) : null,
  };
}

// Lista todos amigos do user (accepted) + pedidos pendentes (recebidos e enviados).
export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const r = await getDbClient().execute({
    sql: `SELECT f.*, u.display_name, u.email
          FROM friendships f
          JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
          WHERE f.user_a = ? OR f.user_b = ?
          ORDER BY f.status DESC, f.created_at DESC`,
    args: [userId, userId, userId],
  });
  return r.rows.map((row) => {
    const otherId = String(row.user_a) === userId ? String(row.user_b) : String(row.user_a);
    return {
      userId: otherId,
      displayName: row.display_name ? String(row.display_name) : null,
      email: String(row.email),
      status: String(row.status) as FriendshipStatus,
      iRequested: String(row.requested_by) === userId,
      createdAt: Number(row.created_at),
    };
  });
}

export async function areFriends(userA: string, userB: string): Promise<boolean> {
  const [a, b] = orderPair(userA, userB);
  const f = await getFriendship(a, b);
  return !!f && f.status === 'accepted';
}

// ════════════════════════════════════════════════════════════════════════════
// Invites por email
// ════════════════════════════════════════════════════════════════════════════

export async function createFriendInvite(fromUserId: string, toEmail: string, lobbyCode?: string): Promise<FriendInvite> {
  const now = Date.now();
  const invite: FriendInvite = {
    id: uuid(),
    fromUserId,
    toEmail: toEmail.toLowerCase().trim(),
    lobbyCode: lobbyCode ?? null,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    consumedAt: null,
  };
  await getDbClient().execute({
    sql: 'INSERT INTO friend_invites (id, from_user_id, to_email, lobby_code, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [invite.id, invite.fromUserId, invite.toEmail, invite.lobbyCode, invite.createdAt, invite.expiresAt],
  });
  return invite;
}

// Lista convites pendentes (não consumidos, não expirados) pelo email.
// Chamado ao registrar user pra auto-vincular friendships.
export async function listPendingInvitesForEmail(email: string): Promise<FriendInvite[]> {
  const now = Date.now();
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM friend_invites WHERE to_email = ? AND consumed_at IS NULL AND expires_at > ?',
    args: [email.toLowerCase().trim(), now],
  });
  return r.rows.map(rowToInvite);
}

export async function listInvitesSentBy(userId: string): Promise<FriendInvite[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT * FROM friend_invites WHERE from_user_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [userId],
  });
  return r.rows.map(rowToInvite);
}

export async function consumeInvite(id: string): Promise<{ ok: boolean }> {
  await getDbClient().execute({
    sql: 'UPDATE friend_invites SET consumed_at = ? WHERE id = ?',
    args: [Date.now(), id],
  });
  return { ok: true };
}

// Hook ao registrar/logar user: confere se há invites pra esse email e
// converte em friendships pendentes (acceptadas automaticamente — invite É o consent).
export async function resolveInvitesForNewUser(userId: string, email: string): Promise<{ accepted: number }> {
  const pending = await listPendingInvitesForEmail(email);
  let count = 0;
  for (const inv of pending) {
    if (inv.fromUserId === userId) continue;  // edge case: convidou próprio email
    const [a, b] = orderPair(inv.fromUserId, userId);
    const existing = await getFriendship(a, b);
    if (existing) {
      // Já existe (pendente ou accepted) — aceita
      if (existing.status === 'pending') {
        await getDbClient().execute({
          sql: "UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE user_a = ? AND user_b = ?",
          args: [Date.now(), a, b],
        });
        count += 1;
      }
    } else {
      // Cria já como accepted (invite é o consent mútuo)
      const now = Date.now();
      await getDbClient().execute({
        sql: "INSERT INTO friendships (user_a, user_b, status, requested_by, created_at, accepted_at) VALUES (?, ?, 'accepted', ?, ?, ?)",
        args: [a, b, inv.fromUserId, now, now],
      });
      count += 1;
    }
    await consumeInvite(inv.id);
  }
  return { accepted: count };
}

function rowToInvite(row: Record<string, unknown>): FriendInvite {
  return {
    id: String(row.id),
    fromUserId: String(row.from_user_id),
    toEmail: String(row.to_email),
    lobbyCode: row.lobby_code ? String(row.lobby_code) : null,
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    consumedAt: row.consumed_at ? Number(row.consumed_at) : null,
  };
}

export function buildInviteEmail(opts: { fromName: string; toEmail: string; verifyUrl: string; lobbyCode?: string | null }): { to: string; subject: string; htmlContent: string; textContent: string } {
  const lobbyLine = opts.lobbyCode
    ? `<p>Lobby pronto: <strong>${opts.lobbyCode}</strong> — entre pelo link.</p>`
    : '';
  const htmlContent = `<!doctype html><html><body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
<h2 style="color:#8a4">Você foi convidado pra jogar D&amp;D no JSgame</h2>
<p><strong>${opts.fromName}</strong> te convidou pra jogar D&amp;D 5e online com Mestre IA.</p>
${lobbyLine}
<p><a href="${opts.verifyUrl}" style="display:inline-block;padding:10px 20px;background:#6840a0;color:#fff;text-decoration:none;border-radius:4px;">Aceitar convite</a></p>
<p style="color:#888;font-size:11px">Convite expira em 7 dias. Se não foi você, ignore.</p>
</body></html>`;
  const textContent = `${opts.fromName} te convidou pra jogar D&D 5e online no JSgame.\n\n${opts.lobbyCode ? `Lobby: ${opts.lobbyCode}\n` : ''}Aceitar: ${opts.verifyUrl}\n\nExpira em 7 dias.`;
  return {
    to: opts.toEmail,
    subject: `${opts.fromName} te convidou pra jogar D&D no JSgame`,
    htmlContent,
    textContent,
  };
}

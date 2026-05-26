// Tests pra A4 — Friend graph + invites.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import {
  requestFriendship, acceptFriendship, removeFriendship,
  listFriends, areFriends,
  createFriendInvite, listPendingInvitesForEmail, listInvitesSentBy,
  resolveInvitesForNewUser,
} from '../friends.js';

async function mkUser(id: string, email: string, displayName?: string): Promise<void> {
  await getDbClient().execute({
    sql: 'INSERT INTO users (id, email, display_name, email_verified, created_at) VALUES (?, ?, ?, 1, ?)',
    args: [id, email, displayName ?? null, Date.now()],
  });
}

describe('A4 — Friend graph', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    const db = getDbClient();
    await db.execute('DELETE FROM friendships');
    await db.execute('DELETE FROM friend_invites');
    await db.execute('DELETE FROM users');
    await mkUser('u-alice', 'alice@test.com', 'Alice');
    await mkUser('u-bob', 'bob@test.com', 'Bob');
    await mkUser('u-carol', 'carol@test.com', 'Carol');
  });

  it('requestFriendship cria pending', async () => {
    const r = await requestFriendship('u-alice', 'u-bob');
    expect(r.ok).toBe(true);
    expect(r.friendship?.status).toBe('pending');
  });

  it('rejeita self-friendship', async () => {
    const r = await requestFriendship('u-alice', 'u-alice');
    expect(r.ok).toBe(false);
  });

  it('rejeita pedido duplicado', async () => {
    await requestFriendship('u-alice', 'u-bob');
    const r2 = await requestFriendship('u-alice', 'u-bob');
    expect(r2.ok).toBe(false);
  });

  it('rejeita pedido reverso quando já pendente', async () => {
    await requestFriendship('u-alice', 'u-bob');
    const r2 = await requestFriendship('u-bob', 'u-alice');
    expect(r2.ok).toBe(false);
  });

  it('acceptFriendship marca accepted', async () => {
    await requestFriendship('u-alice', 'u-bob');
    const r = await acceptFriendship('u-bob', 'u-alice');
    expect(r.ok).toBe(true);
    expect(await areFriends('u-alice', 'u-bob')).toBe(true);
  });

  it('só o destinatário pode aceitar (não o pedinte)', async () => {
    await requestFriendship('u-alice', 'u-bob');
    const r = await acceptFriendship('u-alice', 'u-bob');
    expect(r.ok).toBe(false);
  });

  it('removeFriendship apaga relação', async () => {
    await requestFriendship('u-alice', 'u-bob');
    await acceptFriendship('u-bob', 'u-alice');
    await removeFriendship('u-alice', 'u-bob');
    expect(await areFriends('u-alice', 'u-bob')).toBe(false);
  });

  it('listFriends retorna todos (pending + accepted)', async () => {
    await requestFriendship('u-alice', 'u-bob');
    await acceptFriendship('u-bob', 'u-alice');
    await requestFriendship('u-alice', 'u-carol');  // pendente
    const friends = await listFriends('u-alice');
    expect(friends).toHaveLength(2);
    const bob = friends.find((f) => f.userId === 'u-bob');
    const carol = friends.find((f) => f.userId === 'u-carol');
    expect(bob?.status).toBe('accepted');
    expect(carol?.status).toBe('pending');
    expect(carol?.iRequested).toBe(true);
  });

  it('listFriends iRequested correto pra pedido recebido', async () => {
    await requestFriendship('u-bob', 'u-alice');
    const aliceFriends = await listFriends('u-alice');
    expect(aliceFriends[0]?.iRequested).toBe(false);  // alice NÃO pediu
    const bobFriends = await listFriends('u-bob');
    expect(bobFriends[0]?.iRequested).toBe(true);     // bob pediu
  });
});

describe('A4 — Friend invites por email', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    const db = getDbClient();
    await db.execute('DELETE FROM friendships');
    await db.execute('DELETE FROM friend_invites');
    await db.execute('DELETE FROM users');
    await mkUser('u-alice', 'alice@test.com');
  });

  it('createFriendInvite gera ID + expira em 7d', async () => {
    const inv = await createFriendInvite('u-alice', 'new@test.com', 'LOBBY1');
    expect(inv.id).toBeTruthy();
    expect(inv.toEmail).toBe('new@test.com');
    expect(inv.lobbyCode).toBe('LOBBY1');
    expect(inv.expiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('email é case-insensitive', async () => {
    await createFriendInvite('u-alice', 'NEW@TEST.COM');
    const list = await listPendingInvitesForEmail('new@test.com');
    expect(list).toHaveLength(1);
  });

  it('resolveInvitesForNewUser cria friendship auto-accepted', async () => {
    await createFriendInvite('u-alice', 'newcomer@test.com');
    // Simula registro de newcomer
    await mkUser('u-newcomer', 'newcomer@test.com');
    const r = await resolveInvitesForNewUser('u-newcomer', 'newcomer@test.com');
    expect(r.accepted).toBe(1);
    expect(await areFriends('u-alice', 'u-newcomer')).toBe(true);
  });

  it('invite consumido não vira friendship duas vezes', async () => {
    await createFriendInvite('u-alice', 'newcomer@test.com');
    await mkUser('u-newcomer', 'newcomer@test.com');
    await resolveInvitesForNewUser('u-newcomer', 'newcomer@test.com');
    // Segunda chamada não deve criar nada (invite já consumido)
    const r2 = await resolveInvitesForNewUser('u-newcomer', 'newcomer@test.com');
    expect(r2.accepted).toBe(0);
  });

  it('listInvitesSentBy retorna invites do user', async () => {
    await createFriendInvite('u-alice', 'a@test.com');
    await createFriendInvite('u-alice', 'b@test.com');
    const list = await listInvitesSentBy('u-alice');
    expect(list).toHaveLength(2);
  });
});

// Tests do auth core (F15) — magic link passwordless.
// Usa libsql in-memory pra isolar do file system.
//
// Nota: importa via module spy do `getDbClient` — não dá pra usar o singleton
// real do persistence porque queremos client isolado por teste. Workaround:
// faz reset do client interno via env var hack OU usa import dinâmico + side
// effects controlados. Aqui escolhemos abordagem direta: reinicializa schema
// em :memory: e invoca auth functions que dependem do client.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';

// Necessário mockar persistence.getDbClient pra retornar nosso client de teste
const testClientRef: { current: Client | null } = { current: null };

vi.mock('../persistence.js', () => ({
  getDbClient: () => {
    if (!testClientRef.current) throw new Error('client não inicializado no teste');
    return testClientRef.current;
  },
}));

// Importa DEPOIS do mock
const { findOrCreateUser, createMagicLink, consumeMagicLink, createSession, validateSession, revokeSession, cleanupExpiredTokens, MAGIC_LINK_TTL_MS, SESSION_TTL_MS } = await import('../auth.js');

async function freshClient(): Promise<Client> {
  const client = createClient({ url: ':memory:' });
  await client.batch([
    `CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      display_name TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, last_login_at INTEGER
    )`,
    `CREATE TABLE email_tokens (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
      expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`,
  ], 'write');
  return client;
}

describe('findOrCreateUser', () => {
  beforeEach(async () => { testClientRef.current = await freshClient(); });

  it('cria user novo', async () => {
    const u = await findOrCreateUser('Alice@example.com');
    expect(u.email).toBe('alice@example.com'); // normalizou pra lowercase
    expect(u.emailVerified).toBe(false);
    expect(u.id).toBeTruthy();
  });

  it('reusa user existente (case-insensitive)', async () => {
    const u1 = await findOrCreateUser('Bob@example.com');
    const u2 = await findOrCreateUser('BOB@example.com');
    expect(u2.id).toBe(u1.id);
  });

  it('rejeita email inválido', async () => {
    await expect(findOrCreateUser('not-an-email')).rejects.toThrow(/inválido/);
    await expect(findOrCreateUser('@no-local.com')).rejects.toThrow();
    await expect(findOrCreateUser('   ')).rejects.toThrow();
  });
});

describe('createMagicLink + consumeMagicLink', () => {
  beforeEach(async () => { testClientRef.current = await freshClient(); });

  it('valida flow completo: cria link, consome, marca user verified', async () => {
    const u = await findOrCreateUser('carol@example.com');
    expect(u.emailVerified).toBe(false);

    const { token, expiresAt } = await createMagicLink(u.id);
    expect(token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes hex
    expect(expiresAt).toBeGreaterThan(Date.now());

    const result = await consumeMagicLink(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe(u.id);
      expect(result.user.emailVerified).toBe(true); // marcou verified
      expect(result.user.lastLoginAt).toBeTruthy();
    }
  });

  it('rejeita token já usado (consumed_at)', async () => {
    const u = await findOrCreateUser('dan@example.com');
    const { token } = await createMagicLink(u.id);

    await consumeMagicLink(token); // primeiro uso
    const result = await consumeMagicLink(token); // segundo uso
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('usado');
  });

  it('rejeita token inexistente', async () => {
    const r = await consumeMagicLink('a'.repeat(64));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('não encontrado');
  });

  it('rejeita token expirado', async () => {
    // Forja token expirado via SQL direto
    const u = await findOrCreateUser('eva@example.com');
    const expiredToken = 'b'.repeat(64);
    await testClientRef.current!.execute({
      sql: 'INSERT INTO email_tokens (token, user_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [expiredToken, u.id, 'login', Date.now() - 1000, Date.now() - MAGIC_LINK_TTL_MS - 1000],
    });

    const r = await consumeMagicLink(expiredToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('expirou');
  });

  it('rejeita token malformado/curto', async () => {
    expect((await consumeMagicLink('')).ok).toBe(false);
    expect((await consumeMagicLink('short')).ok).toBe(false);
  });
});

describe('createSession + validateSession', () => {
  beforeEach(async () => { testClientRef.current = await freshClient(); });

  it('cria sessão e valida', async () => {
    const u = await findOrCreateUser('frank@example.com');
    const s = await createSession(u.id);
    expect(s.token).toMatch(/^[a-f0-9]{64}$/);

    const validated = await validateSession(s.token);
    expect(validated?.id).toBe(u.id);
    expect(validated?.email).toBe('frank@example.com');
  });

  it('retorna null pra token vazio/null/undefined', async () => {
    expect(await validateSession(null)).toBeNull();
    expect(await validateSession(undefined)).toBeNull();
    expect(await validateSession('')).toBeNull();
    expect(await validateSession('short')).toBeNull();
  });

  it('retorna null pra sessão expirada e remove do DB', async () => {
    const u = await findOrCreateUser('grace@example.com');
    const expiredToken = 'c'.repeat(64);
    await testClientRef.current!.execute({
      sql: 'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      args: [expiredToken, u.id, Date.now() - 1000, Date.now() - SESSION_TTL_MS - 1000],
    });

    expect(await validateSession(expiredToken)).toBeNull();

    // Confirmou que removeu
    const r = await testClientRef.current!.execute({
      sql: 'SELECT COUNT(*) AS c FROM sessions WHERE token = ?',
      args: [expiredToken],
    });
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it('revokeSession remove sessão', async () => {
    const u = await findOrCreateUser('helen@example.com');
    const s = await createSession(u.id);
    expect(await validateSession(s.token)).toBeTruthy();
    await revokeSession(s.token);
    expect(await validateSession(s.token)).toBeNull();
  });
});

describe('cleanupExpiredTokens', () => {
  beforeEach(async () => { testClientRef.current = await freshClient(); });

  it('limpa tokens e sessions expiradas', async () => {
    const u = await findOrCreateUser('ivan@example.com');
    const expired = Date.now() - 1000;
    await testClientRef.current!.batch([
      { sql: 'INSERT INTO email_tokens VALUES (?, ?, ?, ?, NULL, ?)', args: ['e1', u.id, 'login', expired, expired] },
      { sql: 'INSERT INTO email_tokens VALUES (?, ?, ?, ?, NULL, ?)', args: ['e2', u.id, 'login', expired, expired] },
      { sql: 'INSERT INTO sessions VALUES (?, ?, ?, ?)', args: ['s1', u.id, expired, expired] },
    ], 'write');

    const r = await cleanupExpiredTokens();
    expect(r.tokens).toBe(2);
    expect(r.sessions).toBe(1);
  });
});

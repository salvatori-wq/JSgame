// JSgame · 2B — Routes Express extraídas de index.ts.
// Função registerApiRoutes registra TODAS as rotas REST no app.
// Dependências passadas via ctx: campaigns map, memoryStore, dm, etc.

import express from 'express';
import type { CharacterSheet } from '../../shared/types.js';
import { ALL_CLASSES } from '../../dnd/classes.js';
import { ALL_RACES } from '../../dnd/races.js';
import { ALL_SKILLS } from '../../dnd/skills.js';
import { ALL_CONDITIONS } from '../../dnd/conditions.js';
import { ALL_BACKGROUNDS } from '../../dnd/backgrounds.js';
import {
  saveCharacter, loadCharacter, listCharactersByOwner, listCharactersByUserId, deleteCharacter,
  loadCampaign, listRecentCampaigns,
} from '../persistence.js';
import {
  findOrCreateUser, createMagicLink, consumeMagicLink, createSession,
  revokeSession, updateUserDisplayName, MAGIC_LINK_TTL_MS,
} from '../auth.js';
import { sendEmail, buildMagicLinkEmail } from '../email.js';
import {
  listUserProgress as listAchievementProgress,
  getUserCounters as getAchievementCounters,
} from '../achievements.js';
import { listTombstonesForUser } from '../tombstones.js';
import { getStreak } from '../streaks.js';
import { listHighlightsForUser } from '../highlights.js';
import type { MemoryStore } from '../memory.js';
import type { Campaign } from '../campaign.js';
import type { DMInterface } from '../campaign.js';
import {
  parseSessionCookie, buildSessionCookie, buildLogoutCookie, getVerifyBaseUrl,
  type ExpressReqWithUser,
} from '../http/cookies.js';

export interface ApiRouteCtx {
  campaigns: Map<string, Campaign>;
  memoryStore: MemoryStore | undefined;
  dm: DMInterface;
}

export function registerApiRoutes(app: express.Express, ctx: ApiRouteCtx): void {
  // === Health
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'jsgame',
      uptime: process.uptime(),
      dmProvider: process.env.DM_PROVIDER ?? 'auto',
      activeProvider: ctx.dm.constructor.name,
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasGroq: !!process.env.GROQ_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasEmail: !!process.env.BREVO_API_KEY,
      activeCampaigns: ctx.campaigns.size,
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Auth endpoints — magic link passwordless
  // ════════════════════════════════════════════════════════════════════════

  app.post('/api/auth/request-link', async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    if (!email) {
      res.status(400).json({ ok: false, error: 'email obrigatório' });
      return;
    }
    try {
      const user = await findOrCreateUser(email);
      const { token, expiresAt } = await createMagicLink(user.id);
      const verifyUrl = `${getVerifyBaseUrl(req)}/api/auth/verify?token=${encodeURIComponent(token)}`;
      const sent = await sendEmail(
        buildMagicLinkEmail({ email: user.email, verifyUrl, expiresMin: Math.round(MAGIC_LINK_TTL_MS / 60000) }),
      );
      res.json({
        ok: true,
        mode: sent.mode,
        expiresAt,
        ...(sent.mode === 'dev-log' ? { devLink: verifyUrl } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('inválido')) {
        res.status(400).json({ ok: false, error: 'email inválido' });
        return;
      }
      console.error('[auth] request-link:', err);
      res.status(500).json({ ok: false, error: 'erro interno' });
    }
  });

  app.get('/api/auth/verify', async (req, res) => {
    const token = String(req.query.token ?? '').trim();
    if (!token) { res.redirect('/?auth_error=missing_token'); return; }
    try {
      const result = await consumeMagicLink(token);
      if (!result.ok) {
        res.redirect(`/?auth_error=${encodeURIComponent(result.reason)}`);
        return;
      }
      const session = await createSession(result.user.id);
      res.setHeader('Set-Cookie', buildSessionCookie(session.token, session.expiresAt));
      res.redirect('/?auth=success');
    } catch (err) {
      console.error('[auth] verify:', err);
      res.redirect('/?auth_error=server_error');
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      try { await revokeSession(token); }
      catch (err) { console.warn('[auth] revokeSession:', err); }
    }
    res.setHeader('Set-Cookie', buildLogoutCookie());
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    res.json({ user: user ?? null });
  });

  app.patch('/api/auth/me', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ ok: false, error: 'não autenticado' }); return; }
    const name = String(req.body?.displayName ?? '').trim();
    try {
      await updateUserDisplayName(user.id, name);
      res.json({ ok: true });
    } catch (err) {
      console.error('[auth] updateName:', err);
      res.status(500).json({ ok: false, error: 'erro interno' });
    }
  });

  // === D&D reference data
  app.get('/api/dnd/races', (_req, res) => { res.json({ races: ALL_RACES }); });
  app.get('/api/dnd/classes', (_req, res) => { res.json({ classes: ALL_CLASSES }); });
  app.get('/api/dnd/skills', (_req, res) => { res.json({ skills: ALL_SKILLS }); });
  app.get('/api/dnd/conditions', (_req, res) => { res.json({ conditions: ALL_CONDITIONS }); });
  app.get('/api/dnd/backgrounds', (_req, res) => { res.json({ backgrounds: ALL_BACKGROUNDS }); });

  // === Characters CRUD
  app.get('/api/characters', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    try {
      if (user) {
        res.json({ characters: await listCharactersByUserId(user.id) });
        return;
      }
      const owner = String(req.query.owner ?? '').trim();
      if (!owner) { res.status(400).json({ error: 'owner required' }); return; }
      res.json({ characters: await listCharactersByOwner(owner) });
    } catch (err) {
      console.error('[api] listCharacters:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/characters/:id', async (req, res) => {
    try {
      const sheet = await loadCharacter(req.params.id);
      if (!sheet) { res.status(404).json({ error: 'not found' }); return; }
      res.json({ character: sheet });
    } catch (err) {
      console.error('[api] loadCharacter:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/characters', async (req, res) => {
    const sheet = req.body as CharacterSheet;
    if (!sheet?.id || !sheet?.ownerName || !sheet?.characterName || !sheet?.classId || !sheet?.raceId) {
      res.status(400).json({ error: 'invalid sheet' });
      return;
    }
    const reqUser = (req as ExpressReqWithUser).user;
    if (reqUser) {
      sheet.userId = reqUser.id;
      if (!sheet.ownerName.trim()) sheet.ownerName = reqUser.displayName || reqUser.email.split('@')[0]!;
    }
    sheet.lastPlayedAt = Date.now();
    try {
      await saveCharacter(sheet);
      res.json({ ok: true, id: sheet.id });
    } catch (err) {
      console.error('[api] saveCharacter:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/characters/:id', async (req, res) => {
    try {
      await deleteCharacter(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] deleteCharacter:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // === Campaigns
  app.get('/api/campaigns', async (_req, res) => {
    try {
      res.json({ campaigns: await listRecentCampaigns(20) });
    } catch (err) {
      console.error('[api] listCampaigns:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const c = await loadCampaign(req.params.id);
      if (!c) { res.status(404).json({ error: 'not found' }); return; }
      res.json({ campaign: c });
    } catch (err) {
      console.error('[api] loadCampaign:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/campaigns/:id/memory', async (req, res) => {
    if (!ctx.memoryStore) { res.status(503).json({ error: 'memory not initialized' }); return; }
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const kindParam = String(req.query.kind ?? '').trim();
    const kinds = kindParam ? kindParam.split(',').map((s) => s.trim()) as never[] : undefined;
    try {
      const facts = q
        ? await ctx.memoryStore.search(req.params.id, q, { limit, kinds })
        : await ctx.memoryStore.recent(req.params.id, { limit, kinds });
      const count = await ctx.memoryStore.count(req.params.id);
      res.json({ facts, total: count });
    } catch (err) {
      console.error('[api] memory:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/achievements', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    try {
      const progress = await listAchievementProgress(user.id);
      const counters = await getAchievementCounters(user.id);
      res.json({ progress, counters });
    } catch (err) {
      console.error('[api] achievements:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/tombstones', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.json({ tombstones: [] }); return; }
    try {
      const tombs = await listTombstonesForUser(user.id);
      res.json({ tombstones: tombs });
    } catch (err) {
      console.error('[api] tombstones:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/streak', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.json({ streak: null }); return; }
    try {
      const streak = await getStreak(user.id);
      res.json({ streak });
    } catch (err) {
      console.error('[api] streak:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/highlights', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.json({ highlights: [] }); return; }
    try {
      const items = await listHighlightsForUser(user.id);
      res.json({ highlights: items });
    } catch (err) {
      console.error('[api] highlights:', err);
      res.status(500).json({ error: String(err) });
    }
  });
}

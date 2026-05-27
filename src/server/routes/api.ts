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
  loadCampaign, listRecentCampaigns, listRecentCampaignsByUserId, deleteCampaign,
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
import { listHighlightsForUser, generateHighlightsHtml } from '../highlights.js';
import {
  listFriends, requestFriendship, acceptFriendship, removeFriendship,
  createFriendInvite, buildInviteEmail, listInvitesSentBy,
} from '../friends.js';
import { getMetricsSummary, getDmErrorRate, getAvgSessionLength, trackMetricEvent } from '../metrics.js';
import { detectAnomalies, computeFunnel } from '../anomaly-detector.js';
import { computeUxFunnel } from '../ux-funnel.js';
import { computeSessionDebug } from '../session-debug.js';
import { getDmErrorBreakdown, getDmTimeline } from '../dm-error-breakdown.js';
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
      hasCerebras: !!process.env.CEREBRAS_API_KEY,
      hasCloudflare: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
      hasEmail: !!process.env.BREVO_API_KEY,
      activeCampaigns: ctx.campaigns.size,
    });
  });

  // === DM health (Sprint 3) — detalhamento do cascade provider + métricas LLM
  app.get('/api/dm/health', async (_req, res) => {
    try {
      // ctx.dm é DungeonMaster ou FallbackDM. provider é private → access via cast bypassed.
      const providerName = 'provider' in ctx.dm ? (ctx.dm as unknown as { provider?: { name?: string } }).provider?.name ?? 'unknown' : 'fallback';
      // Últimos 100 events de narration pra computar success rate / médio
      const r = await (await import('../persistence.js')).getDbClient().execute({
        sql: `SELECT kind, payload, created_at FROM metrics_events
              WHERE kind IN ('narration_success', 'narration_error')
              ORDER BY created_at DESC LIMIT 100`,
        args: [],
      });
      let success = 0;
      let error = 0;
      const providerCounts: Record<string, number> = {};
      for (const row of r.rows) {
        if (row.kind === 'narration_success') success++;
        else if (row.kind === 'narration_error') error++;
        try {
          const p = row.payload ? JSON.parse(row.payload as string) : {};
          const prov = p.provider ?? 'unknown';
          providerCounts[prov] = (providerCounts[prov] ?? 0) + 1;
        } catch { /* ignore */ }
      }
      const total = success + error;
      res.json({
        provider: providerName,
        activeCampaigns: ctx.campaigns.size,
        last100: {
          success,
          error,
          successRate: total > 0 ? (success / total) : null,
        },
        providerCounts,
      });
    } catch (err) {
      console.error('[api] dm health:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // === DM anomalies (Sprint C) — alerts estruturados {severity, kind, value, baseline}
  app.get('/api/dm/anomalies', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 1));
      const result = await detectAnomalies(days);
      res.json(result);
    } catch (err) {
      console.error('[api] anomalies:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // === DM timeline (pós-deploy 2026-05-26) — narrações por hora UTC pra
  // visualizar picos de uso. Útil pra responder "quem está consumindo o free tier?".
  app.get('/api/dm/timeline', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 1));
      const result = await getDmTimeline(days);
      res.json(result);
    } catch (err) {
      console.error('[api] dm timeline:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // === DM errors breakdown (pós-deploy 2026-05-26) — categoriza últimos N erros
  // por provider + categoria (rate_limit/timeout/parse/etc) pra diagnosticar
  // alto error rate em prod.
  app.get('/api/dm/errors', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 1));
      const result = await getDmErrorBreakdown(days);
      res.json(result);
    } catch (err) {
      console.error('[api] dm errors:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // === DM funnel (Sprint C) — conversion entre etapas user journey
  app.get('/api/dm/funnel', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
      const result = await computeFunnel(days);
      res.json(result);
    } catch (err) {
      console.error('[api] funnel:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // γ.6 — UX baseline: latência percebida + engajamento de dado + silêncio DM
  app.get('/api/dm/ux-funnel', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
      const result = await computeUxFunnel(days);
      res.json(result);
    } catch (err) {
      console.error('[api] ux-funnel:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POLISH-0 — Per-session debug pra investigar dropoffs no funil.
  // Retorna lista das últimas N sessões com event kinds + timestamps + stage
  // classification heurística (started_only/narration_only/action_no_response/...).
  app.get('/api/dm/session-debug', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 2));
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 30));
      const result = await computeSessionDebug(days, limit);
      res.json(result);
    } catch (err) {
      console.error('[api] session-debug:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POLISH-0 — Client-side telemetria. Whitelist estrito de kinds pra cliente
  // emitir, evitando flood. Usado pra eventos pré-sessão (home_loaded, prefab_clicked)
  // que não passam pelo socket joinCampaign.
  const CLIENT_ALLOWED_KINDS = new Set([
    'home_loaded',
    'prefab_clicked',
    // π — Sprint π Bottom Tab Bar — qual slot é mais usado em mobile
    'bottom_tab_tap',
    // κ.1 — Sprint κ.1 Tutorial Duolingo — taxa de conclusão por step
    'duolingo_tutorial_step',
    // ψ.5 — Sprint ψ polish — métricas novas
    'combat_turn_duration',
    'narration_word_count',
    'auto_retry_success',
    'error_kind_seen',
    // Ω.1 — Sprint Ω dado DEFINITIVO
    'dice_roll_timeout',
    'dice_roll_visual_slow',
  ]);
  app.post('/api/metrics/track', express.json({ limit: '2kb' }), async (req, res) => {
    const kind = String(req.body?.kind ?? '');
    if (!CLIENT_ALLOWED_KINDS.has(kind)) {
      res.status(400).json({ ok: false, error: 'kind não permitido' });
      return;
    }
    const user = (req as ExpressReqWithUser).user;
    const payload = (req.body?.payload && typeof req.body.payload === 'object')
      ? req.body.payload as Record<string, unknown>
      : undefined;
    try {
      await trackMetricEvent({
        userId: user?.id ?? null,
        kind: kind as Parameters<typeof trackMetricEvent>[0]['kind'],
        payload,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] /api/metrics/track:', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
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
    const wasNew = sheet?.id ? !(await loadCharacter(sheet.id)) : false;
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
      // Sprint 3 — Telemetria: track character_created só se for PJ NOVO (não save de existing)
      if (wasNew) {
        void trackMetricEvent({
          userId: reqUser?.id ?? null,
          kind: 'character_created',
          payload: { classId: sheet.classId, raceId: sheet.raceId, level: sheet.level },
        });
      }
      res.json({ ok: true, id: sheet.id });
    } catch (err) {
      console.error('[api] saveCharacter:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // F1 — POST /api/characters/prefab — cria PJ pré-fab pronto pra jogar.
  // Body: { prefabId: 'borin' | 'lyra' | 'sina', ownerName?: string }
  // Server constrói sheet completo via buildPrefabCharacter, salva, retorna sheet+id.
  app.post('/api/characters/prefab', async (req, res) => {
    try {
      const { prefabId, ownerName } = req.body as { prefabId?: string; ownerName?: string };
      if (prefabId !== 'borin' && prefabId !== 'lyra' && prefabId !== 'sina') {
        res.status(400).json({ error: 'prefabId inválido (use borin/lyra/sina)' });
        return;
      }
      const reqUser = (req as ExpressReqWithUser).user;
      const owner = ownerName?.trim() || reqUser?.displayName || reqUser?.email?.split('@')[0] || 'Anônimo';
      const { buildPrefabCharacter } = await import('../../dnd/prefab-characters.js');
      const sheet = buildPrefabCharacter(prefabId, owner, reqUser?.id ?? null);
      await saveCharacter(sheet);
      void trackMetricEvent({
        userId: reqUser?.id ?? null,
        kind: 'character_created',
        payload: { classId: sheet.classId, raceId: sheet.raceId, level: 1, prefab: prefabId },
      });
      res.json({ ok: true, sheet });
    } catch (err) {
      console.error('[api] prefab character:', err);
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
  // QW-3 — Filtra por user autenticado se houver session. Anônimo continua
  // vendo todas (comportamento atual mantido).
  app.get('/api/campaigns', async (req, res) => {
    try {
      const user = (req as ExpressReqWithUser).user;
      if (user) {
        res.json({ campaigns: await listRecentCampaignsByUserId(user.id, 20) });
      } else {
        res.json({ campaigns: await listRecentCampaigns(20) });
      }
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

  app.delete('/api/campaigns/:id', async (req, res) => {
    const id = req.params.id;
    try {
      // Evict do Map em memória pra evitar que próximo broadcastState re-save o registro.
      ctx.campaigns.delete(id);
      await deleteCampaign(id);
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] deleteCampaign:', err);
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

  // β.1 — NPC roster por campaign (lista todos NPCs persistidos com contadores)
  app.get('/api/campaigns/:id/npcs', async (req, res) => {
    try {
      const { listNpcs } = await import('../npc-roster.js');
      const npcs = await listNpcs(req.params.id);
      res.json({ npcs });
    } catch (err) {
      console.error('[api] campaigns/:id/npcs:', err);
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

  // A4 — Friend graph
  app.get('/api/friends', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    try {
      const friends = await listFriends(user.id);
      res.json({ friends });
    } catch (err) {
      console.error('[api] friends:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/friends/request', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    const toUserId = String(req.body?.userId ?? '').trim();
    if (!toUserId) { res.status(400).json({ error: 'userId obrigatório' }); return; }
    try {
      const r = await requestFriendship(user.id, toUserId);
      if (!r.ok) { res.status(400).json({ error: r.reason }); return; }
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] friends/request:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/friends/accept', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    const otherUserId = String(req.body?.userId ?? '').trim();
    if (!otherUserId) { res.status(400).json({ error: 'userId obrigatório' }); return; }
    try {
      const r = await acceptFriendship(user.id, otherUserId);
      if (!r.ok) { res.status(400).json({ error: r.reason }); return; }
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] friends/accept:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/friends/:userId', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    try {
      await removeFriendship(user.id, req.params.userId);
      res.json({ ok: true });
    } catch (err) {
      console.error('[api] friends DELETE:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/friends/invite', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    const toEmail = String(req.body?.email ?? '').trim();
    const lobbyCode = req.body?.lobbyCode ? String(req.body.lobbyCode).trim() : undefined;
    if (!toEmail || !toEmail.includes('@')) { res.status(400).json({ error: 'email inválido' }); return; }
    try {
      const invite = await createFriendInvite(user.id, toEmail, lobbyCode);
      const fromName = user.displayName || user.email.split('@')[0]!;
      const verifyUrl = `${req.protocol}://${req.headers.host}/?invite=${encodeURIComponent(invite.id)}${lobbyCode ? `&lobby=${encodeURIComponent(lobbyCode)}` : ''}`;
      const emailMsg = buildInviteEmail({ fromName, toEmail, verifyUrl, lobbyCode });
      const sent = await sendEmail(emailMsg);
      res.json({ ok: true, mode: sent.mode, inviteId: invite.id, ...(sent.mode === 'dev-log' ? { devLink: verifyUrl } : {}) });
    } catch (err) {
      console.error('[api] friends/invite:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/friends/invites/sent', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    try {
      const invites = await listInvitesSentBy(user.id);
      res.json({ invites });
    } catch (err) {
      console.error('[api] friends/invites/sent:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // T1 — Telemetria summary (DAU + WAU + DM error rate + avg session length)
  app.get('/api/metrics/summary', async (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    if (!user) { res.status(401).json({ error: 'login required' }); return; }
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? '7'), 10) || 7));
    try {
      const [summary, dmRate, sessionLen] = await Promise.all([
        getMetricsSummary(days),
        getDmErrorRate(days),
        getAvgSessionLength(days),
      ]);
      res.json({ days, summary, dmRate, sessionLen });
    } catch (err) {
      console.error('[api] metrics/summary:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 3A — Exporta highlight reel da campanha como HTML standalone (compartilhável).
  // GET /api/highlights/:campaignId/export → text/html. Pode salvar como arquivo, ver offline.
  app.get('/api/highlights/:campaignId/export', async (req, res) => {
    try {
      const campaignId = String(req.params.campaignId);
      const campaign = await loadCampaign(campaignId);
      const html = await generateHighlightsHtml(campaignId, { campaignName: campaign?.name });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="highlights-${campaignId.slice(0, 8)}.html"`);
      res.send(html);
    } catch (err) {
      console.error('[api] highlights export:', err);
      res.status(500).send('<html><body>Erro ao exportar.</body></html>');
    }
  });
}

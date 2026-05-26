// JSgame · Server.
// Express + Socket.io + SQLite + DM IA + Campaign engine.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
  initPersistence, getDbClient,
  saveCharacter, loadCharacter, listCharactersByOwner, listCharactersByUserId, deleteCharacter,
  saveCampaign, loadCampaign, listRecentCampaigns,
} from './persistence.js';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet } from '../shared/types.js';
import { ALL_CLASSES } from '../dnd/classes.js';
import { ALL_RACES } from '../dnd/races.js';
import { ALL_SKILLS } from '../dnd/skills.js';
import { ALL_CONDITIONS } from '../dnd/conditions.js';
import { ALL_BACKGROUNDS } from '../dnd/backgrounds.js';
import { Campaign, DungeonMaster, FallbackDM, type DMInterface } from './campaign.js';
import { buildProviderFromEnv } from './dm/providers/factory.js';
import { LobbyManager } from './lobby.js';
import { MemoryStore } from './memory.js';
import {
  findOrCreateUser, createMagicLink, consumeMagicLink, createSession, validateSession,
  revokeSession, updateUserDisplayName, cleanupExpiredTokens,
  MAGIC_LINK_TTL_MS, SESSION_TTL_MS, type User,
} from './auth.js';
import { sendEmail, buildMagicLinkEmail } from './email.js';
import { uuid } from './util.js';
import {
  trackEvent as trackAchievement,
  listUserProgress as listAchievementProgress,
  getUserCounters as getAchievementCounters,
  type AchievementEvent,
  type UnlockResult,
} from './achievements.js';
import { saveTombstone, listTombstonesForUser } from './tombstones.js';
import { bumpStreak, getStreak } from './streaks.js';
import { saveHighlight, listHighlightsForUser } from './highlights.js';

// Render usa PORT (default 10000). Local usa SERVER_PORT (default 3001).
const PORT = parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '3001', 10);

// ════════════════════════════════════════════════════════════════════════════
// Auth — cookie helpers e tipos (sem cookie-parser dep)
// ════════════════════════════════════════════════════════════════════════════

const SESSION_COOKIE = 'jsg_session';

interface ExpressReqWithUser extends express.Request {
  user?: User;
}

function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    if (k === SESSION_COOKIE) {
      const v = pair.slice(eq + 1).trim();
      return decodeURIComponent(v);
    }
  }
  return null;
}

function buildSessionCookie(token: string, expiresAt: number): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const inProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (inProd) parts.push('Secure');
  return parts.join('; ');
}

function buildLogoutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

function getVerifyBaseUrl(req: express.Request): string {
  // Em prod, usa o host da request (Render). Em dev, frontend rodando em :5173 valida via API.
  // PUBLIC_URL pode sobrescrever (útil pra deploy com domínio próprio).
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}

// ════════════════════════════════════════════════════════════════════════════
// DM provider init (1x no boot)
// ════════════════════════════════════════════════════════════════════════════

function buildDM(): DMInterface {
  const provider = buildProviderFromEnv(process.env as Record<string, string | undefined>);
  if (provider) {
    console.log(`[dm] provider ativo: ${provider.name}`);
    return new DungeonMaster(provider);
  }
  console.log('[dm] sem provider — usando FallbackDM offline');
  return new FallbackDM();
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign store em memória (1 campanha por ID)
// ════════════════════════════════════════════════════════════════════════════

const campaigns = new Map<string, Campaign>();
const lobbyManager = new LobbyManager();
let memoryStore: MemoryStore | undefined;

async function getOrCreateCampaign(id: string | undefined, name: string | undefined, dm: DMInterface): Promise<Campaign> {
  if (id && campaigns.has(id)) return campaigns.get(id)!;
  if (id) {
    const persisted = await loadCampaign(id);
    if (persisted) {
      const camp = new Campaign(dm, { id: persisted.id, name: persisted.name, memory: memoryStore });
      camp.state = persisted;
      // Hidrata flags pra evitar disparar startSession outra vez no rejoin
      camp.markStartedIfHasHistory();
      campaigns.set(camp.state.id, camp);
      return camp;
    }
  }
  const camp = new Campaign(dm, { id, name, memory: memoryStore });
  campaigns.set(camp.state.id, camp);
  return camp;
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  await initPersistence();
  memoryStore = new MemoryStore(getDbClient());
  console.log('[memory] RAG store inicializado (FTS5/BM25)');
  const dm = buildDM();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // CORS — reflete origin (necessário pra cookies httpOnly + credentials).
  // Em dev, frontend (5173) e backend (3001) são origins diferentes;
  // em prod, mesmo host (Express serve static). Wildcard '*' NÃO pode coexistir
  // com credentials=true, então refletimos o Origin da request.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // Auth middleware — popula req.user quando cookie de sessão é válido.
  // Não bloqueia request: rotas anônimas continuam funcionando (compat com
  // ownerName legado). Rotas autenticadas checam req.user explicitamente.
  app.use(async (req, _res, next) => {
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      try {
        const user = await validateSession(token);
        if (user) (req as ExpressReqWithUser).user = user;
      } catch (err) {
        console.warn('[auth] validateSession falhou:', err);
      }
    }
    next();
  });

  // Cleanup periódico (1x na hora) — tira tokens/sessions expiradas do DB
  setInterval(() => {
    cleanupExpiredTokens().catch((err) => console.warn('[auth] cleanup falhou:', err));
  }, 60 * 60 * 1000);

  // === Health
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'jsgame',
      uptime: process.uptime(),
      dmProvider: process.env.DM_PROVIDER ?? 'auto',
      activeProvider: dm.constructor.name,
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasGroq: !!process.env.GROQ_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasEmail: !!process.env.BREVO_API_KEY,
      activeCampaigns: campaigns.size,
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Auth endpoints — magic link passwordless
  // ════════════════════════════════════════════════════════════════════════

  // POST /api/auth/request-link { email }
  // Cria/encontra user, gera token 15min, manda email com link.
  // Resposta NÃO confirma se email existe ou não (anti-enumeration).
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

      // Resposta uniforme — sempre "ok" pra não vazar se email existe
      res.json({
        ok: true,
        mode: sent.mode,
        expiresAt,
        // Em dev (sem BREVO_API_KEY), retorna o link no response pra facilitar testar
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

  // GET /api/auth/verify?token=X
  // Consome token, cria sessão, set cookie, redirect pra home.
  // Se token inválido, redirect pra /?auth_error=<reason>
  app.get('/api/auth/verify', async (req, res) => {
    const token = String(req.query.token ?? '').trim();
    if (!token) {
      res.redirect('/?auth_error=missing_token');
      return;
    }

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

  // POST /api/auth/logout — revoga sessão atual + limpa cookie
  app.post('/api/auth/logout', async (req, res) => {
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      try { await revokeSession(token); }
      catch (err) { console.warn('[auth] revokeSession:', err); }
    }
    res.setHeader('Set-Cookie', buildLogoutCookie());
    res.json({ ok: true });
  });

  // GET /api/auth/me — retorna user da sessão atual (null se anon)
  app.get('/api/auth/me', (req, res) => {
    const user = (req as ExpressReqWithUser).user;
    res.json({ user: user ?? null });
  });

  // PATCH /api/auth/me { displayName } — atualiza display name
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
      // Se logado, lista por userId (cross-device). Senão, fallback pra ownerName legado.
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
    // Se logado, vincula PJ ao userId (sobrescreve qualquer userId enviado pelo cliente).
    // Cliente não controla isto — server confia só na sessão validada.
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

  // Memória RAG do Mestre — debug/UI. Filtros opcionais via query string.
  // q=texto pra busca FTS5; kind=npc|location|... pra filtrar; limit (default 50).
  app.get('/api/campaigns/:id/memory', async (req, res) => {
    if (!memoryStore) { res.status(503).json({ error: 'memory not initialized' }); return; }
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const kindParam = String(req.query.kind ?? '').trim();
    const kinds = kindParam ? kindParam.split(',').map((s) => s.trim()) as any[] : undefined;
    try {
      const facts = q
        ? await memoryStore.search(req.params.id, q, { limit, kinds })
        : await memoryStore.recent(req.params.id, { limit, kinds });
      const count = await memoryStore.count(req.params.id);
      res.json({ facts, total: count });
    } catch (err) {
      console.error('[api] memory:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // F17 — Achievements. Lista TODOS marcos + status (unlocked? quando?) do user logado.
  // Anon: 401 (precisa estar logado pra ver progresso).
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

  // F19 — Cemitério de lápides do user. Anon não tem (não persiste).
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

  // F20 — Daily streak state pro user logado
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

  // F20 — Highlights do user (reel de momentos memoráveis)
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

  // === Static (produção) — serve dist/client buildado pelo Vite
  if (process.env.NODE_ENV === 'production') {
    const staticDir = path.resolve(process.cwd(), 'dist/client');
    console.log(`[jsgame] servindo estático de ${staticDir}`);
    app.use(express.static(staticDir, { maxAge: '1h', etag: true }));
    // SPA fallback — qualquer rota não-API vai pro index.html
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // === HTTP + Socket.io
  const httpServer = createServer(app);
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: true, credentials: true }, // reflete origin, permite cookies
  });

  // Socket auth middleware — valida cookie de sessão no handshake e popula socket.data.user.
  // Anônimos passam sem user (compat — features legado funcionam via ownerName).
  io.use(async (socket, next) => {
    const token = parseSessionCookie(socket.handshake.headers.cookie);
    if (token) {
      try {
        const user = await validateSession(token);
        if (user) (socket.data as { user?: User }).user = user;
      } catch (err) {
        console.warn('[socket] validateSession falhou:', err);
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const sUser = (socket.data as { user?: User }).user;
    console.log(`[socket] connected ${socket.id}${sUser ? ` (user=${sUser.email})` : ' (anon)'}`);
    let activeCampaignId: string | null = null;
    let activePlayerId: string | null = null;

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
      // Sai do lobby se estava em um
      const lobby = lobbyManager.leaveLobby(socket.id);
      if (lobby) {
        io.to(`lobby-${lobby.id}`).emit('lobbyState', lobby);
      }
    });

    // Helper: broadcast estado completo pra room
    const broadcastState = (camp: Campaign): void => {
      io.to(camp.state.id).emit('campaignState', camp.state);
      io.to(camp.state.id).emit('partyUpdate', camp.party);
      io.to(camp.state.id).emit('combatState', camp.state.combat);
    };

    // F20: drena highlights pendentes do Campaign + persiste por user.
    const drainHighlights = async (camp: Campaign): Promise<void> => {
      const items = camp.drainHighlights();
      if (items.length === 0) return;
      for (const h of items) {
        // Routing por userId do PJ. Se sem PJ específico, usa o primeiro com userId.
        const pj = h.characterId
          ? camp.party.find((p) => p.id === h.characterId)
          : camp.party.find((p) => p.userId);
        const userId = pj?.userId ?? null;
        try {
          await saveHighlight({
            userId,
            campaignId: camp.state.id,
            characterId: h.characterId,
            characterName: h.characterName,
            summary: h.summary,
            kind: h.kind,
          });
        } catch (err) {
          console.warn('[highlights] save falhou:', err);
        }
      }
    };

    // F17: drena fila de achievement events do Campaign + dispara tracker.
    // Mapeia playerId → userId via party do camp. Emite toast pro socket
    // do user específico (achievements são pessoais, não broadcast).
    const drainAchievements = async (camp: Campaign): Promise<void> => {
      const events = camp.drainAchievementEvents();
      if (events.length === 0) return;
      // Agrupa por playerId pra buscar userId uma vez por player
      const byPlayer = new Map<string, AchievementEvent[]>();
      for (const ev of events) {
        if (!ev.playerId) continue;
        const arr = byPlayer.get(ev.playerId) ?? [];
        arr.push(ev.event);
        byPlayer.set(ev.playerId, arr);
      }
      for (const [playerId, evList] of byPlayer) {
        const pj = camp.party.find((p) => p.id === playerId);
        const userId = pj?.userId ?? null;
        if (!userId) continue;
        const unlocks: UnlockResult[] = [];
        for (const e of evList) {
          try {
            const result = await trackAchievement(userId, e);
            unlocks.push(...result);
          } catch (err) {
            console.warn('[achievements] track error:', err);
          }
        }
        if (unlocks.length === 0) continue;
        // Acha o socket conectado desse PJ pra emit do toast
        const room = io.sockets.adapter.rooms.get(camp.state.id);
        if (!room) continue;
        for (const sockId of room) {
          const s = io.sockets.sockets.get(sockId);
          if (!s) continue;
          // Match: este socket é o dono desse PJ? Pegamos o user do socket.data
          const sUser = (s.data as { user?: User }).user;
          if (sUser && sUser.id === userId) {
            for (const u of unlocks) {
              s.emit('achievementUnlocked', {
                id: u.achievement.id,
                name: u.achievement.name,
                description: u.achievement.description,
                icon: u.achievement.icon,
              });
            }
          }
        }
      }
    };

    // F16: após combate vencido, emite xpAwarded + levelUp por player.
    // Persiste PJs atualizados (xp + level + maxHp + slots). Chamado de
    // combatAction / castSpell quando result.outcome === 'victory'.
    const flushPostCombatRewards = async (camp: Campaign): Promise<void> => {
      const awards = camp.lastCombatXpAwards;
      if (!awards || awards.length === 0) return;
      for (const award of awards) {
        const pj = camp.party.find((p) => p.id === award.characterId);
        if (!pj) continue;
        io.to(camp.state.id).emit('xpAwarded', {
          characterId: pj.id,
          characterName: pj.characterName,
          xpAwarded: award.xpAwarded,
          newXp: pj.xp,
        });
        // Emite 1 levelUp por nível subido (no caso raro de subir N de uma vez)
        for (const lu of award.levelUps) {
          io.to(camp.state.id).emit('levelUp', {
            characterId: pj.id,
            characterName: pj.characterName,
            oldLevel: lu.oldLevel,
            newLevel: lu.newLevel,
            hpGained: lu.hpGained,
            proficiencyBonusGained: lu.proficiencyBonusGained,
            slotsChanged: lu.slotsChanged,
            level4ChoiceApplied: lu.level4ChoiceApplied,
            notes: lu.notes,
          });
        }
        // Persiste PJ com XP/level/HP/slots atualizados
        try {
          await saveCharacter(pj);
        } catch (err) {
          console.warn('[xp] saveCharacter falhou pra', pj.id, err);
        }
      }
      camp.lastCombatXpAwards = [];
    };

    // Helper: broadcast thinking → ação → done
    const withThinkingBroadcast = async <T>(
      camp: Campaign,
      playerId: string,
      actionLabel: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const playerName = camp.party.find((p) => p.id === playerId)?.characterName ?? 'Alguém';
      io.to(camp.state.id).emit('dmThinking', { playerId, playerName, action: actionLabel });
      try {
        return await fn();
      } finally {
        io.to(camp.state.id).emit('dmDone');
      }
    };

    // ── joinCampaign: cria/carrega campanha + adiciona character ──
    socket.on('joinCampaign', async ({ campaignId, ownerName, characterId }) => {
      try {
        if (!characterId) { socket.emit('error', 'characterId required'); return; }
        const character = await loadCharacter(characterId);
        if (!character) { socket.emit('error', 'character not found'); return; }

        const camp = await getOrCreateCampaign(campaignId, `Crônica de ${ownerName}`, dm);
        camp.addCharacter(character);
        activeCampaignId = camp.state.id;
        activePlayerId = character.id;
        socket.join(camp.state.id);

        // Sempre envia estado inicial pro joiner
        socket.emit('campaignState', camp.state);
        socket.emit('combatState', camp.state.combat);
        io.to(camp.state.id).emit('partyUpdate', camp.party);

        // F17: credita "first_session" + "first_npc" potenciais + creditação de
        // criação multi-classe. Cada character_created só dispara pra owner do PJ.
        if (character.userId) {
          try {
            const unlocks = await trackAchievement(character.userId, { kind: 'session_started' });
            const multiclassUnlocks = character.additionalClasses && character.additionalClasses.length > 0
              ? await trackAchievement(character.userId, { kind: 'character_created', multiclass: true })
              : [];
            for (const u of [...unlocks, ...multiclassUnlocks]) {
              socket.emit('achievementUnlocked', {
                id: u.achievement.id, name: u.achievement.name,
                description: u.achievement.description, icon: u.achievement.icon,
              });
            }
            // F20: bump streak. Toast só se for bump (não no-op)
            const streak = await bumpStreak(character.userId);
            if (streak?.bumped) {
              socket.emit('streakUpdate', {
                currentStreak: streak.currentStreak,
                longestStreak: streak.longestStreak,
                brokeRecord: streak.brokeRecord,
              });
            }
          } catch (err) {
            console.warn('[ach] joinCampaign tracking err:', err);
          }
        }

        // Se campanha nova (sem início ainda), inicia. startSession é coop-safe
        // (mutex + isStarted guard), múltiplas chamadas concorrentes resultam em 1 narração.
        if (camp.getNarrationLog().length === 0 && camp.state.recentEvents.length === 0) {
          await withThinkingBroadcast(camp, character.id, 'abrir cena', async () => {
            const response = await camp.startSession();
            if (response) {
              io.to(camp.state.id).emit('dmNarration', {
                text: response.narration,
                speaker: response.speaker ?? 'Mestre',
                mood: 'neutral',
              });
              broadcastState(camp);
              await drainAchievements(camp);
            }
          });
        } else {
          // Recap das últimas narrações pro novo joiner (só pra ele)
          for (const entry of camp.getNarrationLog().slice(-3)) {
            const [speaker, ...rest] = entry.split(': ');
            socket.emit('dmNarration', { text: rest.join(': '), speaker: speaker ?? 'Mestre', mood: 'neutral' });
          }
        }
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] joinCampaign error:', err);
        socket.emit('error', `joinCampaign falhou: ${String(err)}`);
      }
    });

    // ── takeAction: player escolheu botão Exploração/etc ──
    socket.on('takeAction', async ({ action, details }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }

        await withThinkingBroadcast(camp, activePlayerId, String(action), async () => {
          const response = await camp.takeAction(activePlayerId!, action, details);
          io.to(camp.state.id).emit('dmNarration', {
            text: response.narration,
            speaker: response.speaker ?? 'Mestre',
            mood: 'neutral',
          });
          // F18: complete_quest pode ter deixado XP awards pendentes — flush
          if (camp.lastCombatXpAwards && camp.lastCombatXpAwards.length > 0) {
            await flushPostCombatRewards(camp);
          }
          broadcastState(camp);
          await drainAchievements(camp);
          await drainHighlights(camp);
          await saveCampaign(camp.state);

          // Se DM iniciou combate E enemy ganhou initiative, kickoff enemy turn
          if (camp.state.combat && camp.state.combat.active) {
            const cur = camp.state.combat.initiativeOrder[camp.state.combat.currentTurnIndex];
            if (cur && cur.kind === 'enemy') {
              const events = await camp.kickoffCombatIfEnemyFirst();
              for (const ev of events) {
                io.to(camp.state.id).emit('combatEvent', ev);
              }
              broadcastState(camp);
              await drainAchievements(camp);
              await saveCampaign(camp.state);
            }
          }
        });
      } catch (err) {
        console.error('[socket] takeAction error:', err);
        socket.emit('error', `takeAction falhou: ${String(err)}`);
      }
    });

    // ── requestSkillCheck: player rola d20 (server roleia, DM narra) ──
    socket.on('requestSkillCheck', async (_payload) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const pending = camp.getPendingSkillCheck();
        // Sem pending = clique duplo ou check já resolvido. Silent ignore — não polui o log do player.
        if (!pending) { return; }
        if (pending.playerId !== activePlayerId) {
          socket.emit('error', 'esse check é de outro player');
          return;
        }

        await withThinkingBroadcast(camp, activePlayerId, `rolar ${pending.skill}`, async () => {
          const result = await camp.resolveSkillCheck(activePlayerId!);
          if (!result) return;

          io.to(camp.state.id).emit('diceRollResult', {
            source: activePlayerId!,
            roll: result.roll,
            purpose: 'skill-check',
          });
          io.to(camp.state.id).emit('dmNarration', {
            text: result.dmResponse.narration,
            speaker: result.dmResponse.speaker ?? 'Mestre',
            mood: result.nat20 ? 'trickster' : result.nat1 ? 'sombrio' : 'neutral',
          });
          broadcastState(camp);
          await drainAchievements(camp);
          await saveCampaign(camp.state);
        });
      } catch (err) {
        console.error('[socket] requestSkillCheck error:', err);
        socket.emit('error', `skill check falhou: ${String(err)}`);
      }
    });

    // ── combatAction: ataque/esquiva/disparada/etc ──
    socket.on('combatAction', async ({ action, targetId }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        if (!camp.state.combat?.active) { socket.emit('error', 'sem combate ativo'); return; }

        const result = await camp.playerCombatAction(activePlayerId, action, targetId);
        if (!result) { socket.emit('error', 'ação de combate inválida'); return; }
        if (!result.ok) { socket.emit('error', result.log || 'ação rejeitada'); return; }

        for (const ev of result.events) {
          io.to(camp.state.id).emit('combatEvent', ev);
        }
        broadcastState(camp);

        if (result.outcome && result.dmFinalNarration) {
          io.to(camp.state.id).emit('dmNarration', {
            text: result.dmFinalNarration.narration,
            speaker: result.dmFinalNarration.speaker ?? 'Mestre',
            mood: result.outcome === 'victory' ? 'trickster' : 'sombrio',
          });
          if (result.outcome === 'victory') {
            await flushPostCombatRewards(camp);
          }
          broadcastState(camp);
        }
        await drainAchievements(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] combatAction error:', err);
        socket.emit('error', `combatAction falhou: ${String(err)}`);
      }
    });

    // ── castSpell: player lança magia (exploration OU combat)
    socket.on('castSpell', async ({ spellId, targetIds, slotLevel }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }

        const result = await camp.playerCastSpell(activePlayerId, spellId as never, targetIds ?? [], slotLevel);
        if (!result.ok) {
          socket.emit('error', result.reason ?? 'cast spell falhou');
          return;
        }

        // Narração curta — não vai pro LLM, é o engine narrando
        io.to(camp.state.id).emit('dmNarration', {
          text: result.narration,
          speaker: '✨ Magia',
          mood: 'trickster',
        });
        for (const ev of result.events) {
          io.to(camp.state.id).emit('combatEvent', ev);
        }
        broadcastState(camp);

        if (result.outcome === 'victory') {
          await flushPostCombatRewards(camp);
          broadcastState(camp);
        }
        await drainAchievements(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] castSpell error:', err);
        socket.emit('error', `castSpell falhou: ${String(err)}`);
      }
    });

    // ── endTurn: player passa o turno explicitamente (sem ação)
    socket.on('endTurn', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        // playerCombatAction com 'dodge' default — simplificação MVP
        const result = await camp.playerCombatAction(activePlayerId, 'dodge');
        if (!result?.ok) return;
        for (const ev of result.events) io.to(camp.state.id).emit('combatEvent', ev);
        broadcastState(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] endTurn error:', err);
      }
    });

    // ── F23 — useClassFeature: rage/surge/second-wind/channel/ki/bardic/wild-shape
    socket.on('useClassFeature', async ({ feature, targetId }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const result = await camp.useClassFeature(activePlayerId, feature as never, { targetId });
        if (!result.ok) { socket.emit('error', result.reason ?? 'class feature rejeitada'); return; }
        for (const ev of result.events) io.to(camp.state.id).emit('combatEvent', ev);
        if (result.log) {
          io.to(camp.state.id).emit('dmNarration', {
            text: result.log,
            speaker: '⚔ Habilidade',
            mood: 'trickster',
          });
        }
        broadcastState(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] useClassFeature error:', err);
        socket.emit('error', `useClassFeature falhou: ${String(err)}`);
      }
    });

    // ── useItem: consumível
    socket.on('useItem', async ({ itemId }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.useItem(activePlayerId, itemId);
        if (!r.ok) { socket.emit('error', r.message); return; }
        io.to(camp.state.id).emit('dmNarration', { text: r.message + (r.effectApplied ? ` — ${r.effectApplied}` : ''), speaker: 'Sistema', mood: 'neutral' });
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] useItem error:', err);
        socket.emit('error', `useItem falhou: ${String(err)}`);
      }
    });

    // ── equipItem
    socket.on('equipItem', async ({ itemId, slot }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.equipItem(activePlayerId, itemId, slot);
        if (!r.ok) { socket.emit('error', r.message); return; }
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] equipItem error:', err);
        socket.emit('error', `equipItem falhou: ${String(err)}`);
      }
    });

    // ── unequipItem
    socket.on('unequipItem', async ({ slot, itemId }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.unequipItem(activePlayerId, slot, itemId);
        if (!r.ok) { socket.emit('error', r.message); return; }
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] unequipItem error:', err);
        socket.emit('error', `unequipItem falhou: ${String(err)}`);
      }
    });

    // ── shortRest: gasta hit dice, cura
    socket.on('shortRest', async ({ hitDiceToSpend }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.shortRest(activePlayerId, hitDiceToSpend ?? 1);
        if (!r.ok) { socket.emit('error', r.reason ?? 'short rest falhou'); return; }
        io.to(camp.state.id).emit('dmNarration', {
          text: `${camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Você'} descansou curto: +${r.healed} HP (${r.diceSpent} hit dice).`,
          speaker: 'Sistema',
          mood: 'neutral',
        });
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        io.to(camp.state.id).emit('campaignState', camp.state);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] shortRest error:', err);
        socket.emit('error', `shortRest falhou: ${String(err)}`);
      }
    });

    // ── longRest: full restore
    socket.on('longRest', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.longRest(activePlayerId);
        if (!r.ok) { socket.emit('error', r.reason ?? 'long rest falhou'); return; }
        io.to(camp.state.id).emit('dmNarration', {
          text: `${camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Você'} descansou longo: HP cheio, slots resetados.`,
          speaker: 'Sistema',
          mood: 'neutral',
        });
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        io.to(camp.state.id).emit('campaignState', camp.state);
        await drainAchievements(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] longRest error:', err);
        socket.emit('error', `longRest falhou: ${String(err)}`);
      }
    });

    // ── rollDeathSave: d20 vs 10
    socket.on('rollDeathSave', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.rollDeathSave(activePlayerId);
        if (!r.ok) { socket.emit('error', r.reason ?? 'death save falhou'); return; }
        const playerName = camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Alguém';

        // F19: PJ morreu → salva lápide persistente com epitáfio
        if (r.died) {
          const sheet = camp.party.find((p) => p.id === activePlayerId);
          if (sheet) {
            void saveTombstone({
              sheet,
              campaignId: camp.state.id,
              campaignName: camp.state.name,
              cause: 'death-save triple fail',
            }).catch((err) => {
              console.warn('[tombstones] saveTombstone falhou:', err);
            });
          }
        }

        const msg = r.nat20
          ? `${playerName} rolou NAT 20 — recupera 1 HP!`
          : r.died
            ? `${playerName} MORREU (3 falhas no death save).`
            : r.stabilized
              ? `${playerName} ESTABILIZOU (3 sucessos).`
              : `${playerName} death save: ${r.rollTotal} → ${r.success ? '✓' : '✗'} (${r.successes}/3 ✓ · ${r.failures}/3 ✗)`;
        io.to(camp.state.id).emit('dmNarration', {
          text: msg,
          speaker: 'Death Save',
          mood: r.died ? 'sombrio' : r.nat20 ? 'trickster' : 'neutral',
        });
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        io.to(camp.state.id).emit('campaignState', camp.state);
        await drainAchievements(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] rollDeathSave error:', err);
        socket.emit('error', `rollDeathSave falhou: ${String(err)}`);
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    // Lobby — pre-game room
    // ════════════════════════════════════════════════════════════════════════

    socket.on('createLobby', ({ ownerName }) => {
      try {
        const lobby = lobbyManager.createLobby(socket.id, ownerName);
        socket.join(`lobby-${lobby.id}`);
        socket.emit('lobbyState', lobby);
        console.log(`[lobby] criado ${lobby.id} por ${ownerName}`);
      } catch (err) {
        console.error('[socket] createLobby error:', err);
        socket.emit('error', `createLobby falhou: ${String(err)}`);
      }
    });

    socket.on('joinLobby', ({ lobbyId, ownerName }) => {
      try {
        const result = lobbyManager.joinLobby(socket.id, lobbyId, ownerName);
        if (!result.ok || !result.lobby) {
          socket.emit('error', result.reason ?? 'erro ao joinar lobby');
          return;
        }
        socket.join(`lobby-${result.lobby.id}`);
        io.to(`lobby-${result.lobby.id}`).emit('lobbyState', result.lobby);
        console.log(`[lobby] ${ownerName} joinou ${result.lobby.id}`);
      } catch (err) {
        console.error('[socket] joinLobby error:', err);
        socket.emit('error', `joinLobby falhou: ${String(err)}`);
      }
    });

    socket.on('leaveLobby', () => {
      try {
        const lobby = lobbyManager.leaveLobby(socket.id);
        socket.emit('lobbyState', null);
        if (lobby) {
          io.to(`lobby-${lobby.id}`).emit('lobbyState', lobby);
        }
      } catch (err) {
        console.error('[socket] leaveLobby error:', err);
      }
    });

    socket.on('lobbyUpdateStatus', async ({ status, characterId, wizardStep }) => {
      try {
        // Se passou characterId, busca nome do PJ pra display
        let characterName: string | undefined;
        if (characterId) {
          const c = await loadCharacter(characterId);
          characterName = c?.characterName;
        }
        const lobby = lobbyManager.updateStatus(socket.id, status, characterId, characterName, wizardStep);
        if (lobby) {
          io.to(`lobby-${lobby.id}`).emit('lobbyState', lobby);
        }
      } catch (err) {
        console.error('[socket] lobbyUpdateStatus error:', err);
      }
    });

    socket.on('lobbyStartCampaign', async () => {
      try {
        const newCampaignId = uuid();
        const result = lobbyManager.startCampaign(socket.id, newCampaignId);
        if (!result.ok || !result.lobby) {
          socket.emit('error', result.reason ?? 'erro ao iniciar campanha');
          return;
        }
        // Cria a Campaign e adiciona TODOS os PJs dos players ready
        const camp = await getOrCreateCampaign(newCampaignId, `Crônica de ${result.lobby.players[0]?.ownerName ?? 'aventureiros'}`, dm);
        for (const p of result.lobby.players) {
          if (p.characterId) {
            const character = await loadCharacter(p.characterId);
            if (character) camp.addCharacter(character);
          }
        }
        await saveCampaign(camp.state);

        // Emite redirect pra todos no lobby
        io.to(`lobby-${result.lobby.id}`).emit('lobbyRedirect', { campaignId: newCampaignId });
        console.log(`[lobby] ${result.lobby.id} → campaign ${newCampaignId} com ${camp.party.length} PJs`);
      } catch (err) {
        console.error('[socket] lobbyStartCampaign error:', err);
        socket.emit('error', `lobbyStartCampaign falhou: ${String(err)}`);
      }
    });

    // ── chat: broadcast pra room
    socket.on('chat', ({ text }) => {
      if (!activeCampaignId) return;
      io.to(activeCampaignId).emit('dmNarration', { text: `Chat: ${text}`, speaker: 'Player', mood: 'neutral' });
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`[jsgame] server listening on http://localhost:${PORT}`);
    console.log(`[jsgame] health: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown — flush DB
  const shutdown = async (sig: string): Promise<void> => {
    console.log(`[jsgame] ${sig} — flush DB e saindo`);
    const { shutdownPersistence } = await import('./persistence.js');
    await shutdownPersistence();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
}

main().catch((err) => {
  console.error('[jsgame] fatal boot error:', err);
  process.exit(1);
});

// JSgame · Server.
// Express + Socket.io + SQLite + DM IA + Campaign engine.

import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
  initPersistence,
  saveCharacter, loadCharacter, listCharactersByOwner, deleteCharacter,
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

const PORT = parseInt(process.env.SERVER_PORT ?? '3001', 10);

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

async function getOrCreateCampaign(id: string | undefined, name: string | undefined, dm: DMInterface): Promise<Campaign> {
  if (id && campaigns.has(id)) return campaigns.get(id)!;
  if (id) {
    const persisted = loadCampaign(id);
    if (persisted) {
      const camp = new Campaign(dm, { id: persisted.id, name: persisted.name });
      camp.state = persisted;
      campaigns.set(camp.state.id, camp);
      return camp;
    }
  }
  const camp = new Campaign(dm, { id, name });
  campaigns.set(camp.state.id, camp);
  return camp;
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  await initPersistence();
  const dm = buildDM();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // CORS dev
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // === Health
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'jsgame',
      uptime: process.uptime(),
      dmProvider: process.env.DM_PROVIDER ?? 'auto',
      hasGroq: !!process.env.GROQ_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      activeCampaigns: campaigns.size,
    });
  });

  // === D&D reference data
  app.get('/api/dnd/races', (_req, res) => { res.json({ races: ALL_RACES }); });
  app.get('/api/dnd/classes', (_req, res) => { res.json({ classes: ALL_CLASSES }); });
  app.get('/api/dnd/skills', (_req, res) => { res.json({ skills: ALL_SKILLS }); });
  app.get('/api/dnd/conditions', (_req, res) => { res.json({ conditions: ALL_CONDITIONS }); });
  app.get('/api/dnd/backgrounds', (_req, res) => { res.json({ backgrounds: ALL_BACKGROUNDS }); });

  // === Characters CRUD
  app.get('/api/characters', (req, res) => {
    const owner = String(req.query.owner ?? '').trim();
    if (!owner) { res.status(400).json({ error: 'owner required' }); return; }
    res.json({ characters: listCharactersByOwner(owner) });
  });
  app.get('/api/characters/:id', (req, res) => {
    const sheet = loadCharacter(req.params.id);
    if (!sheet) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ character: sheet });
  });
  app.post('/api/characters', (req, res) => {
    const sheet = req.body as CharacterSheet;
    if (!sheet?.id || !sheet?.ownerName || !sheet?.characterName || !sheet?.classId || !sheet?.raceId) {
      res.status(400).json({ error: 'invalid sheet' });
      return;
    }
    sheet.lastPlayedAt = Date.now();
    saveCharacter(sheet);
    res.json({ ok: true, id: sheet.id });
  });
  app.delete('/api/characters/:id', (req, res) => {
    deleteCharacter(req.params.id);
    res.json({ ok: true });
  });

  // === Campaigns
  app.get('/api/campaigns', (_req, res) => {
    res.json({ campaigns: listRecentCampaigns(20) });
  });
  app.get('/api/campaigns/:id', (req, res) => {
    const c = loadCampaign(req.params.id);
    if (!c) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ campaign: c });
  });

  // === HTTP + Socket.io
  const httpServer = createServer(app);
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);
    let activeCampaignId: string | null = null;
    let activePlayerId: string | null = null;

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });

    // ── joinCampaign: cria/carrega campanha + adiciona character ──
    socket.on('joinCampaign', async ({ campaignId, ownerName, characterId }) => {
      try {
        if (!characterId) { socket.emit('error', 'characterId required'); return; }
        const character = loadCharacter(characterId);
        if (!character) { socket.emit('error', 'character not found'); return; }

        const camp = await getOrCreateCampaign(campaignId, `Crônica de ${ownerName}`, dm);
        camp.addCharacter(character);
        activeCampaignId = camp.state.id;
        activePlayerId = character.id;
        socket.join(camp.state.id);

        socket.emit('campaignState', camp.state);
        io.to(camp.state.id).emit('partyUpdate', camp.party);

        // Se campanha nova (sem narração ainda), inicia
        if (camp.getNarrationLog().length === 0) {
          const response = await camp.startSession();
          io.to(camp.state.id).emit('dmNarration', {
            text: response.narration,
            speaker: response.speaker ?? 'Mestre',
            mood: 'neutral',
          });
          io.to(camp.state.id).emit('campaignState', camp.state);
        } else {
          // Recap das últimas narrações pro novo joiner
          for (const entry of camp.getNarrationLog().slice(-3)) {
            const [speaker, ...rest] = entry.split(': ');
            socket.emit('dmNarration', { text: rest.join(': '), speaker: speaker ?? 'Mestre', mood: 'neutral' });
          }
        }
        saveCampaign(camp.state);
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

        const response = await camp.takeAction(activePlayerId, action, details);
        io.to(camp.state.id).emit('dmNarration', {
          text: response.narration,
          speaker: response.speaker ?? 'Mestre',
          mood: 'neutral',
        });
        io.to(camp.state.id).emit('campaignState', camp.state);
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] takeAction error:', err);
        socket.emit('error', `takeAction falhou: ${String(err)}`);
      }
    });

    // ── requestSkillCheck: player rola o d20 (server roleia, DM narra) ──
    socket.on('requestSkillCheck', async (_payload) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        if (!camp.hasPendingSkillCheck()) {
          socket.emit('error', 'no pending skill check');
          return;
        }
        const result = await camp.resolveSkillCheck(activePlayerId);
        if (!result) return;

        io.to(camp.state.id).emit('diceRollResult', {
          source: activePlayerId,
          roll: result.roll,
          purpose: 'skill-check',
        });
        io.to(camp.state.id).emit('dmNarration', {
          text: result.dmResponse.narration,
          speaker: result.dmResponse.speaker ?? 'Mestre',
          mood: result.nat20 ? 'trickster' : result.nat1 ? 'sombrio' : 'neutral',
        });
        io.to(camp.state.id).emit('campaignState', camp.state);
        io.to(camp.state.id).emit('partyUpdate', camp.party);
        saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] requestSkillCheck error:', err);
        socket.emit('error', `skill check falhou: ${String(err)}`);
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

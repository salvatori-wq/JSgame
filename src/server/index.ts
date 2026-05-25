// JSgame · Server.
// Express + Socket.io + SQLite + DM IA + Campaign engine.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
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

// Render usa PORT (default 10000). Local usa SERVER_PORT (default 3001).
const PORT = parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '3001', 10);

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
      // Hidrata flags pra evitar disparar startSession outra vez no rejoin
      camp.markStartedIfHasHistory();
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
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);
    let activeCampaignId: string | null = null;
    let activePlayerId: string | null = null;

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });

    // Helper: broadcast estado completo pra room
    const broadcastState = (camp: Campaign): void => {
      io.to(camp.state.id).emit('campaignState', camp.state);
      io.to(camp.state.id).emit('partyUpdate', camp.party);
      io.to(camp.state.id).emit('combatState', camp.state.combat);
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
        const character = loadCharacter(characterId);
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
            }
          });
        } else {
          // Recap das últimas narrações pro novo joiner (só pra ele)
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

        await withThinkingBroadcast(camp, activePlayerId, String(action), async () => {
          const response = await camp.takeAction(activePlayerId!, action, details);
          io.to(camp.state.id).emit('dmNarration', {
            text: response.narration,
            speaker: response.speaker ?? 'Mestre',
            mood: 'neutral',
          });
          broadcastState(camp);
          saveCampaign(camp.state);

          // Se DM iniciou combate E enemy ganhou initiative, kickoff enemy turn
          if (camp.state.combat && camp.state.combat.active) {
            const cur = camp.state.combat.initiativeOrder[camp.state.combat.currentTurnIndex];
            if (cur && cur.kind === 'enemy') {
              const events = await camp.kickoffCombatIfEnemyFirst();
              for (const ev of events) {
                io.to(camp.state.id).emit('combatEvent', ev);
              }
              broadcastState(camp);
              saveCampaign(camp.state);
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
          saveCampaign(camp.state);
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
          broadcastState(camp);
        }
        saveCampaign(camp.state);
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

        if (result.outcome) {
          // Combate acabou após magia — endCombatNarrate já narrou.
        }
        saveCampaign(camp.state);
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
        saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] endTurn error:', err);
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
        saveCampaign(camp.state);
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
        saveCampaign(camp.state);
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
        saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] rollDeathSave error:', err);
        socket.emit('error', `rollDeathSave falhou: ${String(err)}`);
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

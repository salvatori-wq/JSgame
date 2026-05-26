// JSgame · Server.
// Express + Socket.io + SQLite + DM IA + Campaign engine.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
  initPersistence, getDbClient,
  loadCharacter, loadCampaign, saveCampaign, saveCharacter,
} from './persistence.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';
import { Campaign, DungeonMaster, FallbackDM, type DMInterface } from './campaign.js';
import { buildProviderFromEnv } from './dm/providers/factory.js';
import { LobbyManager } from './lobby.js';
import { MemoryStore } from './memory.js';
import {
  validateSession, cleanupExpiredTokens, SESSION_TTL_MS, type User,
} from './auth.js';
import { uuid } from './util.js';
import {
  trackEvent as trackAchievement,
  type AchievementEvent, type UnlockResult,
} from './achievements.js';
import { saveTombstone } from './tombstones.js';
import { bumpStreak } from './streaks.js';
import { saveHighlight } from './highlights.js';
import { serializeCombatFlags } from './class-features-engine.js';
import { resolveCounterspell } from './reaction-engine.js';
import { parseSessionCookie, type ExpressReqWithUser } from './http/cookies.js';
import { registerApiRoutes } from './routes/api.js';

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

  // 2B — Routes Express extraídas pra src/server/routes/api.ts
  registerApiRoutes(app, { campaigns, memoryStore, dm });

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
      // 1B — Combat-local flags (rage, action-surge) por characterId pro client.
      if (camp.state.combat?.active) {
        io.to(camp.state.id).emit('combatFlags', serializeCombatFlags(camp.state.combat));
      } else {
        io.to(camp.state.id).emit('combatFlags', {});
      }
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

        // FIX coop-1: echo da ação do player ANTES da narração do Mestre.
        // Sem isso, ninguém vê o que o player fez — só a resposta do DM.
        // Aparece como entrada própria no histórico de narrações de TODOS na room.
        const myName = camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Aventureiro';
        const echoText = details ? `${String(action)} — "${details}"` : String(action);
        io.to(camp.state.id).emit('dmNarration', {
          text: echoText,
          speaker: `▶ ${myName}`,
          mood: 'neutral',
        });

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
          // FIX coop-4: spectator-side check é silent — UI já mostra "X está rolando..."
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
          // A1.1 — Spectator transcript: entrada permanente no log com resultado mecânico
          // pra que aliados vejam "X rolou Y" mesmo sem skill-check-overlay.
          const myName = camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Aventureiro';
          const verdict = result.nat20 ? 'NAT20 CRIT' : result.nat1 ? 'NAT1 FALHA' : (result.success ? 'SUCESSO' : 'FALHOU');
          io.to(camp.state.id).emit('dmNarration', {
            text: `${pending.skill} (DC ${pending.dc}): rolou ${result.roll.total} → ${verdict}`,
            speaker: `🎲 ${myName}`,
            mood: result.success ? 'trickster' : 'sombrio',
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

    // ── F27 — resolveSavingThrow: player rola ability save
    socket.on('resolveSavingThrow', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const pending = camp.getPendingSave();
        if (!pending) return;
        if (pending.playerId !== activePlayerId) {
          // FIX coop-4: spectator silent — banner já mostra "X está rolando save"
          return;
        }
        const result = await camp.resolveSavingThrow(activePlayerId);
        if (!result) return;
        io.to(camp.state.id).emit('diceRollResult', {
          source: activePlayerId,
          roll: result.roll,
          purpose: 'saving-throw',
        });
        // A1.1 — Spectator transcript: speaker é o PJ que rolou (não genérico)
        const saveName = camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Aventureiro';
        const saveVerdict = result.nat20 ? 'NAT20 SUCESSO ÉPICO' : result.nat1 ? 'NAT1 FALHA CRÍTICA' : (result.success ? 'SUCESSO' : 'FALHOU');
        io.to(camp.state.id).emit('dmNarration', {
          text: `Save ${pending.ability.toUpperCase()} (DC ${pending.dc}): rolou ${result.roll.total} → ${saveVerdict}`,
          speaker: `🛡 ${saveName}`,
          mood: result.success ? 'trickster' : 'sombrio',
        });
        broadcastState(camp);
        await drainAchievements(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] resolveSavingThrow error:', err);
        socket.emit('error', `save falhou: ${String(err)}`);
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

        // FIX coop-2: echo da ação de combate pra TODOS na room (sem isso,
        // aliados não vêem o que você fez — só vêem combatEvent solto).
        // Usa result.log já formatado pelo combat engine.
        if (result.log) {
          io.to(camp.state.id).emit('dmNarration', {
            text: result.log,
            speaker: `⚔ ${camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Aventureiro'}`,
            mood: 'neutral',
          });
        }

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

    // ── castReaction: player tenta Counterspell num enemy spell pendente.
    socket.on('castReaction', ({ reactionId, spellId, slotLevel }) => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const pending = camp.state.pendingEnemySpell;
        if (!pending) { socket.emit('error', 'sem spell inimiga pendente'); return; }
        if (pending.id !== reactionId) { socket.emit('error', 'reaction id desatualizado'); return; }
        if (pending.cancelled) { socket.emit('error', 'spell já cancelada'); return; }
        if (!pending.visible) { socket.emit('error', 'spell sem componentes visíveis — Counterspell não aplica'); return; }
        if (Date.now() - pending.createdAt > pending.windowMs) {
          socket.emit('error', 'janela de reação expirou');
          return;
        }
        const caster = camp.party.find((p) => p.id === activePlayerId);
        if (!caster) { socket.emit('error', 'caster não encontrado'); return; }
        if (spellId !== 'counterspell') { socket.emit('error', 'reação desconhecida'); return; }
        if (!caster.spellsKnown.includes('counterspell')) { socket.emit('error', `${caster.characterName} não conhece Contramágica`); return; }
        if (!camp.state.combat?.active) { socket.emit('error', 'reação só em combate'); return; }

        const result = resolveCounterspell({
          caster,
          incomingSpellLevel: pending.spellLevel,
          slotLevel,
          combat: camp.state.combat,
        });
        if (!result.ok) { socket.emit('error', result.reason ?? 'contramágica falhou'); return; }

        if (result.cancelled) {
          pending.cancelled = true;
        }
        // Emit log + events pra room
        io.to(camp.state.id).emit('dmNarration', {
          text: result.log,
          speaker: `✋ ${caster.characterName}`,
          mood: result.cancelled ? 'trickster' : 'sombrio',
        });
        for (const ev of result.events) {
          io.to(camp.state.id).emit('combatEvent', ev);
        }
        broadcastState(camp);
      } catch (err) {
        console.error('[socket] castReaction error:', err);
        socket.emit('error', `castReaction falhou: ${String(err)}`);
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
        // 1C — Propaga personality do lobby pro CampaignState (vai pro SYSTEM_PROMPT).
        if (result.lobby.dmPersonality) {
          camp.state.dmPersonality = result.lobby.dmPersonality;
        }
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

    // 1C — Host muda personality do DM (só vale antes da campanha iniciar).
    socket.on('lobbySetPersonality', ({ dmPersonality }) => {
      try {
        const result = lobbyManager.setPersonality(socket.id, dmPersonality);
        if (!result.ok || !result.lobby) {
          socket.emit('error', result.reason ?? 'erro ao mudar personality');
          return;
        }
        io.to(`lobby-${result.lobby.id}`).emit('lobbyState', result.lobby);
      } catch (err) {
        console.error('[socket] lobbySetPersonality error:', err);
        socket.emit('error', `lobbySetPersonality falhou: ${String(err)}`);
      }
    });

    // ── chat: broadcast pra room (FIX coop-3: usa nome de PJ real, não "Player")
    socket.on('chat', ({ text }) => {
      if (!activeCampaignId || !activePlayerId) return;
      const trimmed = String(text ?? '').trim().slice(0, 280);
      if (!trimmed) return;
      const camp = campaigns.get(activeCampaignId);
      const myName = camp?.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Anônimo';
      io.to(activeCampaignId).emit('dmNarration', {
        text: trimmed,
        speaker: `💬 ${myName}`,
        mood: 'neutral',
      });
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

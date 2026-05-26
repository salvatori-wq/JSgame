// JSgame · 2B — Connection handler (extraído de index.ts).
// Registra TODOS os socket handlers via registerConnectionHandler.
// Closure-per-connection mantém activeCampaignId / activePlayerId.

import type { Server as SocketIoServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';
import type { Campaign, DMInterface } from '../campaign.js';
import type { LobbyManager } from '../lobby.js';
import type { SocketHelpers } from './helpers.js';
import { loadCharacter, saveCampaign } from '../persistence.js';
import { uuid } from '../util.js';
import { saveTombstone } from '../tombstones.js';
import { bumpStreak } from '../streaks.js';
import { trackEvent as trackAchievement } from '../achievements.js';
import { resolveCounterspell } from '../reaction-engine.js';
import type { User } from '../auth.js';

export interface ConnectionCtx {
  io: SocketIoServer<ClientToServerEvents, ServerToClientEvents>;
  dm: DMInterface;
  lobbyManager: LobbyManager;
  campaigns: Map<string, Campaign>;
  helpers: SocketHelpers;
  getOrCreateCampaign: (id: string | undefined, name: string | undefined, dm: DMInterface) => Promise<Campaign>;
}

export function registerConnectionHandler(ctx: ConnectionCtx): void {
  const { io, dm, lobbyManager, campaigns, helpers, getOrCreateCampaign } = ctx;
  const { broadcastState, drainHighlights, drainAchievements, flushPostCombatRewards, withThinkingBroadcast } = helpers;

  io.on('connection', (socket) => {
    const sUser = (socket.data as { user?: User }).user;
    console.log(`[socket] connected ${socket.id}${sUser ? ` (user=${sUser.email})` : ' (anon)'}`);
    let activeCampaignId: string | null = null;
    let activePlayerId: string | null = null;

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
      const lobby = lobbyManager.leaveLobby(socket.id);
      if (lobby) {
        io.to(`lobby-${lobby.id}`).emit('lobbyState', lobby);
      }
    });

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

        socket.emit('campaignState', camp.state);
        socket.emit('combatState', camp.state.combat);
        io.to(camp.state.id).emit('partyUpdate', camp.party);

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
          if (camp.lastCombatXpAwards && camp.lastCombatXpAwards.length > 0) {
            await flushPostCombatRewards(camp);
          }
          broadcastState(camp);
          await drainAchievements(camp);
          await drainHighlights(camp);
          await saveCampaign(camp.state);

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
        if (!pending) { return; }
        if (pending.playerId !== activePlayerId) { return; }

        await withThinkingBroadcast(camp, activePlayerId, `rolar ${pending.skill}`, async () => {
          const result = await camp.resolveSkillCheck(activePlayerId!);
          if (!result) return;

          io.to(camp.state.id).emit('diceRollResult', {
            source: activePlayerId!,
            roll: result.roll,
            purpose: 'skill-check',
          });
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
        if (pending.playerId !== activePlayerId) { return; }
        const result = await camp.resolveSavingThrow(activePlayerId);
        if (!result) return;
        io.to(camp.state.id).emit('diceRollResult', {
          source: activePlayerId,
          roll: result.roll,
          purpose: 'saving-throw',
        });
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

    socket.on('endTurn', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const result = await camp.playerCombatAction(activePlayerId, 'dodge');
        if (!result?.ok) return;
        for (const ev of result.events) io.to(camp.state.id).emit('combatEvent', ev);
        broadcastState(camp);
        await saveCampaign(camp.state);
      } catch (err) {
        console.error('[socket] endTurn error:', err);
      }
    });

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

    socket.on('rollDeathSave', async () => {
      try {
        if (!activeCampaignId || !activePlayerId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        const r = await camp.rollDeathSave(activePlayerId);
        if (!r.ok) { socket.emit('error', r.reason ?? 'death save falhou'); return; }
        const playerName = camp.party.find((p) => p.id === activePlayerId)?.characterName ?? 'Alguém';

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
        const camp = await getOrCreateCampaign(newCampaignId, `Crônica de ${result.lobby.players[0]?.ownerName ?? 'aventureiros'}`, dm);
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

        io.to(`lobby-${result.lobby.id}`).emit('lobbyRedirect', { campaignId: newCampaignId });
        console.log(`[lobby] ${result.lobby.id} → campaign ${newCampaignId} com ${camp.party.length} PJs`);
      } catch (err) {
        console.error('[socket] lobbyStartCampaign error:', err);
        socket.emit('error', `lobbyStartCampaign falhou: ${String(err)}`);
      }
    });

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

    // 3B — Player atualiza settings da campanha (difficulty atual).
    socket.on('updateCampaignSettings', async ({ combatDifficulty }) => {
      try {
        if (!activeCampaignId) { socket.emit('error', 'no active campaign'); return; }
        const camp = campaigns.get(activeCampaignId);
        if (!camp) { socket.emit('error', 'campaign not found'); return; }
        if (combatDifficulty !== undefined) {
          const valid = ['easy', 'medium', 'hard', 'deadly', 'auto'];
          if (!valid.includes(combatDifficulty)) { socket.emit('error', 'difficulty inválido'); return; }
          camp.state.combatDifficulty = combatDifficulty;
        }
        await saveCampaign(camp.state);
        broadcastState(camp);
      } catch (err) {
        console.error('[socket] updateCampaignSettings error:', err);
        socket.emit('error', `updateCampaignSettings falhou: ${String(err)}`);
      }
    });

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
}

// JSgame · 2B — Socket helpers compartilhados (extraídos de index.ts).
// broadcastState / drainHighlights / drainAchievements / flushPostCombatRewards / withThinkingBroadcast.
// Função buildSocketHelpers(io) retorna objeto com closures bindadas no `io` server.

import type { Server as SocketIoServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, CampaignState, NpcSecret } from '../../shared/types.js';
import type { Campaign } from '../campaign.js';
import { saveCharacter } from '../persistence.js';
import { saveHighlight } from '../highlights.js';
import {
  trackEvent as trackAchievement,
  type AchievementEvent, type UnlockResult,
} from '../achievements.js';
import { serializeCombatFlags } from '../class-features-engine.js';
import type { User } from '../auth.js';

/**
 * Fase 0b — sanitiza o CampaignState ANTES de qualquer emit pro client.
 * `npcSecrets` é SERVER-ONLY (Sprint Y): o texto do segredo e a condição de reveal
 * NUNCA podem trafegar pro client — vazariam a conspiração inteira que o DM tece.
 * Mantemos só os segredos JÁ revelados (`revealed:true`) — esses são públicos por
 * design (reveal_npc_secret os tornou visíveis). Nenhum client lê `npcSecrets` hoje,
 * então isto é defesa em profundidade: fecha o vazamento mesmo em code paths futuros.
 * Devolve o MESMO objeto quando não há segredos (zero alocação no caminho comum).
 */
export function toClientCampaignState(state: CampaignState): CampaignState {
  const secrets = state.npcSecrets;
  if (!secrets) return state;
  const sanitized: Record<string, NpcSecret[]> = {};
  for (const [npc, list] of Object.entries(secrets)) {
    const revealed = list.filter((s) => s.revealed);
    if (revealed.length > 0) sanitized[npc] = revealed;
  }
  return { ...state, npcSecrets: sanitized };
}

export interface SocketHelpers {
  broadcastState(camp: Campaign): void;
  drainHighlights(camp: Campaign): Promise<void>;
  drainAchievements(camp: Campaign): Promise<void>;
  flushPostCombatRewards(camp: Campaign): Promise<void>;
  withThinkingBroadcast<T>(camp: Campaign, playerId: string, actionLabel: string, fn: () => Promise<T>): Promise<T>;
}

export function buildSocketHelpers(io: SocketIoServer<ClientToServerEvents, ServerToClientEvents>): SocketHelpers {
  const broadcastState = (camp: Campaign): void => {
    io.to(camp.state.id).emit('campaignState', toClientCampaignState(camp.state));
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
  const drainAchievements = async (camp: Campaign): Promise<void> => {
    const events = camp.drainAchievementEvents();
    if (events.length === 0) return;
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
      const room = io.sockets.adapter.rooms.get(camp.state.id);
      if (!room) continue;
      for (const sockId of room) {
        const s = io.sockets.sockets.get(sockId);
        if (!s) continue;
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
      try {
        await saveCharacter(pj);
      } catch (err) {
        console.warn('[xp] saveCharacter falhou pra', pj.id, err);
      }
    }
    camp.lastCombatXpAwards = [];
  };

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

  return { broadcastState, drainHighlights, drainAchievements, flushPostCombatRewards, withThinkingBroadcast };
}

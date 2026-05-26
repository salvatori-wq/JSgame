// JSgame · F35 — DM Tool Applier (extraído de campaign.applyValidatedTool).
// Aplica ValidatedTool no estado da Campaign. Lógica pura — toda mutação via
// camp.state, camp.party, camp.pushRecentEvent, camp.pushAchievementEvent, camp.indexFact.
//
// Por que extraído: campaign.ts havia chegado a 1415 LOC. Esse switch ocupava
// ~310 LOC (22% do arquivo). Isolar facilita audit de cada DM tool individualmente
// e abre caminho pra outros domínios (combat-handler, quest-handler) serem extraídos.

import type { Campaign } from './campaign.js';
import type { ValidatedTool } from './dm/tools.js';
import { startCombat, applyConditionTo } from './combat.js';
import { awardXpToParty } from '../dnd/leveling.js';
import { pickEncounter, picksToEnemyInputs } from '../dnd/encounter-builder.js';

export function applyValidatedToolToCampaign(camp: Campaign, tool: ValidatedTool): void {
  switch (tool.kind) {
    case 'request_skill_check': {
      const resolvedPlayerId = tool.playerId === 'active' && camp.party[0] ? camp.party[0].id : tool.playerId;
      const owner = camp.party.find((p) => p.id === resolvedPlayerId)?.id ?? camp.party[0]?.id ?? resolvedPlayerId;
      camp.state.pendingCheck = {
        skill: tool.skill,
        dc: tool.dc,
        reason: tool.reason,
        playerId: owner,
      };
      break;
    }

    case 'start_combat': {
      camp.state.mode = 'combat';
      camp.state.combat = startCombat({
        party: camp.party,
        enemies: tool.enemies,
      });
      camp.combatStartCount += 1;
      const enemyNames = tool.enemies.map((e) => e.name).join(', ');
      camp.pushRecentEvent(`Combate iniciado: ${enemyNames}`);
      camp.indexFact({
        kind: 'event',
        text: `Combate começou contra: ${enemyNames}. Local: ${camp.state.currentLocation}.`,
        tags: `combate inimigos ${enemyNames.toLowerCase()}`,
        importance: 1.3,
      });
      for (const pj of camp.party) {
        camp.pushAchievementEvent(pj.id, { kind: 'combat_started', isFirst: camp.combatStartCount === 1 });
      }
      break;
    }

    case 'apply_damage': {
      if (tool.playerId === 'all') {
        for (const p of camp.party) {
          p.currentHp = Math.max(0, p.currentHp - tool.damage);
          if (p.currentHp === 0 && !p.conditions.includes('inconsciente')) {
            p.conditions.push('inconsciente');
          }
        }
      } else {
        const p = camp.party.find((x) => x.id === tool.playerId);
        if (p) {
          p.currentHp = Math.max(0, p.currentHp - tool.damage);
          if (p.currentHp === 0 && !p.conditions.includes('inconsciente')) {
            p.conditions.push('inconsciente');
          }
        }
      }
      camp.pushRecentEvent(`Dano (${tool.type}): ${tool.damage} — ${tool.reason}`);
      break;
    }

    case 'apply_condition': {
      if (camp.state.combat) {
        const r = applyConditionTo(camp.state.combat, camp.party, tool.targetId, tool.condition);
        if (r.applied) camp.pushRecentEvent(`${r.targetName} ficou ${tool.condition}`);
      } else {
        const p = camp.party.find((x) => x.id === tool.targetId);
        if (p && !p.conditions.includes(tool.condition)) {
          p.conditions.push(tool.condition);
          camp.pushRecentEvent(`${p.characterName} ficou ${tool.condition}`);
        }
      }
      break;
    }

    case 'end_combat_with_outcome': {
      if (camp.state.combat) {
        camp.state.combat.active = false;
        camp.state.mode = 'exploration';
        camp.pushRecentEvent(`Combate encerrado: ${tool.outcome}`);
        camp.indexFact({
          kind: 'event',
          text: `Combate encerrado: ${tool.outcome}. Local: ${camp.state.currentLocation}.`,
          tags: `combate desfecho ${tool.outcome}`,
          importance: 1.2,
        });
        camp.state.combat = null;
      }
      break;
    }

    case 'apply_exhaustion': {
      const p = camp.party.find((x) => x.id === tool.targetId);
      if (p) {
        p.exhaustion = Math.max(0, Math.min(6, p.exhaustion + tool.levels));
        if (p.exhaustion >= 6) {
          p.currentHp = 0;
          p.deathCount += 1;
          camp.pushRecentEvent(`${p.characterName} morreu de exaustão (nv 6)`);
        } else {
          camp.pushRecentEvent(`${p.characterName} exaustão agora ${p.exhaustion}/6${tool.reason ? ` — ${tool.reason}` : ''}`);
        }
      }
      break;
    }

    case 'npc_speaks': {
      const existing = camp.state.npcsMet.find((n) => n.name === tool.name);
      if (!existing) {
        camp.state.npcsMet.push({
          name: tool.name,
          archetype: tool.archetype,
          attitude: tool.attitude,
          lastSeen: camp.state.currentLocation,
        });
        camp.indexFact({
          kind: 'npc',
          text: `NPC ${tool.name} (${tool.archetype}, atitude ${tool.attitude}) apareceu em ${camp.state.currentLocation}.`,
          tags: `npc ${tool.name.toLowerCase()} ${tool.archetype.toLowerCase()}`,
          importance: 1.4,
        });
        for (const pj of camp.party) {
          camp.pushAchievementEvent(pj.id, { kind: 'npc_met', name: tool.name });
        }
      } else {
        existing.attitude = tool.attitude;
        existing.lastSeen = camp.state.currentLocation;
      }
      break;
    }

    case 'give_item': {
      const p = camp.party.find((x) => x.id === tool.playerId);
      if (p) {
        p.inventory.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: tool.itemName,
          type: tool.type,
          quantity: tool.quantity,
          description: tool.description,
        });
        camp.pushRecentEvent(`${p.characterName} recebeu ${tool.itemName} × ${tool.quantity}`);
        camp.indexFact({
          kind: 'inventory',
          text: `${p.characterName} recebeu ${tool.itemName} (${tool.type}) × ${tool.quantity}${tool.description ? ` — ${tool.description}` : ''}.`,
          tags: `inventario item ${tool.itemName.toLowerCase()} ${tool.type}`,
          importance: tool.type === 'tesouro' ? 1.3 : 1.0,
        });
        camp.pushAchievementEvent(p.id, { kind: 'item_received' });
        if (tool.type === 'tesouro' && /ouro|gold|peças/i.test(tool.itemName)) {
          camp.pushAchievementEvent(p.id, { kind: 'gold_changed', newTotal: p.gold });
        }
      }
      break;
    }

    case 'advance_time': {
      camp.pushRecentEvent(`Tempo passou: ${tool.amount}${tool.reason ? ` (${tool.reason})` : ''}`);
      camp.state.worldFlags.lastTimeJump = tool.amount;
      break;
    }

    case 'describe_scene': {
      camp.state.currentLocation = tool.location;
      camp.state.currentSceneDescription = tool.description;
      camp.pushRecentEvent(`Mudou de local: ${tool.location}`);
      camp.indexFact({
        kind: 'location',
        text: `Local: ${tool.location}${tool.description ? ` — ${tool.description}` : ''}.`,
        tags: `local lugar ${tool.location.toLowerCase()}`,
        importance: 1.2,
      });
      for (const pj of camp.party) {
        camp.pushAchievementEvent(pj.id, { kind: 'location_visited', location: tool.location });
      }
      break;
    }

    case 'set_quest': {
      if (!camp.state.quests) camp.state.quests = [];
      const existing = camp.state.quests.find((q) => q.id === tool.questId);
      if (existing) {
        if (existing.status === 'active') {
          existing.title = tool.title;
          existing.description = tool.description;
          const newObjs = tool.objectives.map((o) => {
            const prev = existing.objectives.find((x) => x.id === o.id);
            return { id: o.id, description: o.description, done: prev?.done ?? false };
          });
          existing.objectives = newObjs;
          existing.rewardXp = tool.rewardXp;
          if (tool.giver) existing.giver = tool.giver;
          camp.pushRecentEvent(`Quest atualizada: ${tool.title}`);
        }
      } else {
        const quest = {
          id: tool.questId,
          title: tool.title,
          description: tool.description,
          objectives: tool.objectives.map((o) => ({ id: o.id, description: o.description, done: false })),
          status: 'active' as const,
          rewardXp: tool.rewardXp,
          giver: tool.giver,
          acceptedAt: Date.now(),
        };
        camp.state.quests.push(quest);
        camp.pushRecentEvent(`Nova quest: ${tool.title}${tool.giver ? ` (de ${tool.giver})` : ''}`);
        camp.indexFact({
          kind: 'promise',
          text: `Quest "${tool.title}": ${tool.description}${tool.giver ? ` Dada por ${tool.giver}.` : ''} Reward ${tool.rewardXp} XP.`,
          tags: `quest missao promessa ${tool.title.toLowerCase()} ${tool.giver?.toLowerCase() ?? ''}`,
          importance: 1.7,
        });
      }
      break;
    }

    case 'update_objective': {
      const quest = camp.state.quests?.find((q) => q.id === tool.questId);
      if (!quest || quest.status !== 'active') break;
      const obj = quest.objectives.find((o) => o.id === tool.objectiveId);
      if (!obj) break;
      obj.done = tool.done;
      camp.pushRecentEvent(`Quest "${quest.title}": ${obj.description} ${tool.done ? '✓' : '○'}${tool.note ? ` — ${tool.note}` : ''}`);
      if (tool.done) {
        camp.indexFact({
          kind: 'event',
          text: `Quest "${quest.title}" avançou: ${obj.description}${tool.note ? ` — ${tool.note}` : ''}.`,
          tags: `quest objetivo ${quest.title.toLowerCase()}`,
          importance: 1.3,
        });
      }
      break;
    }

    case 'mark_highlight': {
      const targetPj = tool.characterId
        ? camp.party.find((p) => p.id === tool.characterId)
        : camp.party[0];
      camp.pendingHighlights.push({
        characterId: targetPj?.id ?? null,
        characterName: targetPj?.characterName ?? null,
        summary: tool.summary,
        kind: tool.highlightKind,
      });
      camp.pushRecentEvent(`✨ Highlight: ${tool.summary}`);
      camp.indexFact({
        kind: 'event',
        text: `Momento memorável (${tool.highlightKind}): ${tool.summary}`,
        tags: `highlight memoravel ${tool.highlightKind}${targetPj ? ` ${targetPj.characterName.toLowerCase()}` : ''}`,
        importance: 1.8,
      });
      break;
    }

    case 'request_saving_throw': {
      const resolvedPlayerId = tool.playerId === 'active' && camp.party[0] ? camp.party[0].id : tool.playerId;
      const owner = camp.party.find((p) => p.id === resolvedPlayerId)?.id ?? camp.party[0]?.id ?? resolvedPlayerId;
      camp.state.pendingSave = {
        ability: tool.ability,
        dc: tool.dc,
        reason: tool.reason,
        playerId: owner,
      };
      break;
    }

    case 'start_combat_balanced': {
      // B3 — Builder calcula encontro balanceado pela party + difficulty.
      const partyComp = camp.party.map((p) => ({ level: p.level }));
      const encounter = pickEncounter(partyComp, tool.difficulty);
      const enemies = picksToEnemyInputs(encounter.picks);
      camp.state.mode = 'combat';
      camp.state.combat = startCombat({ party: camp.party, enemies });
      camp.combatStartCount += 1;
      const names = encounter.picks.map((p) => `${p.count}× ${p.monster.name}`).join(', ');
      camp.pushRecentEvent(`Combate balanceado (${tool.difficulty}, ${encounter.adjustedXp} XP): ${names}${tool.flavor ? ` — ${tool.flavor}` : ''}`);
      camp.indexFact({
        kind: 'event',
        text: `Combate balanceado ${tool.difficulty} contra: ${names}. Local: ${camp.state.currentLocation}.`,
        tags: `combate balanceado ${tool.difficulty}`,
        importance: 1.3,
      });
      for (const pj of camp.party) {
        camp.pushAchievementEvent(pj.id, { kind: 'combat_started', isFirst: camp.combatStartCount === 1 });
      }
      break;
    }

    case 'complete_quest': {
      const quest = camp.state.quests?.find((q) => q.id === tool.questId);
      if (!quest || quest.status !== 'active') break;
      quest.status = tool.outcome === 'success' ? 'completed' : 'failed';
      quest.completedAt = Date.now();
      camp.pushRecentEvent(`Quest ${tool.outcome === 'success' ? 'CONCLUÍDA' : 'FALHOU'}: ${quest.title} — ${tool.summary}`);
      camp.indexFact({
        kind: 'event',
        text: `Quest "${quest.title}" ${tool.outcome === 'success' ? 'concluída' : 'falhou'}: ${tool.summary}`,
        tags: `quest desfecho ${tool.outcome} ${quest.title.toLowerCase()}`,
        importance: 1.5,
      });
      if (tool.outcome === 'success' && quest.rewardXp > 0) {
        const awards = awardXpToParty(camp.party, quest.rewardXp);
        camp.lastCombatXpAwards = [...(camp.lastCombatXpAwards ?? []), ...awards];
        for (const r of awards) {
          if (r.levelUps.length > 0) {
            camp.pushRecentEvent(`${r.characterName} subiu pra nível ${r.levelUps[r.levelUps.length - 1]!.newLevel} (reward de quest)`);
            for (const lu of r.levelUps) {
              camp.pushAchievementEvent(r.characterId, { kind: 'level_up', oldLevel: lu.oldLevel, newLevel: lu.newLevel });
            }
          }
        }
      }
      break;
    }
  }
}

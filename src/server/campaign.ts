// JSgame · Campaign engine. Coordena estado de uma sessão de D&D.
// Estado in-memory + persistido via persistence.saveCampaign() em wave-end style.

import type { CharacterSheet, CampaignState, GameMode, EnemySnapshot, ExplorationAction } from '../shared/types.js';
import { DungeonMaster, FallbackDM, type DMInterface, type DMResponse } from './dm/dm.js';
import { validateToolCall, type ValidatedTool } from './dm/tools.js';
import { rollD20, type DiceRoll } from '../dnd/dice.js';
import { abilityModifier, proficiencyBonus } from '../dnd/attributes.js';
import { getSkill, type SkillId } from '../dnd/skills.js';
import { uuid } from './util.js';

const MAX_RECENT_EVENTS = 30;
const MAX_RECENT_NARRATIONS = 10;

export class Campaign {
  state: CampaignState;
  party: CharacterSheet[] = [];
  combat: { active: boolean; enemies: EnemySnapshot[]; round: number } = { active: false, enemies: [], round: 0 };
  private narrationLog: string[] = [];
  private pendingSkillCheck: { skill: SkillId; dc: number; reason: string; playerId: string } | null = null;
  private dm: DMInterface;

  constructor(dm: DMInterface, opts?: { id?: string; name?: string }) {
    this.dm = dm;
    const now = Date.now();
    this.state = {
      id: opts?.id ?? uuid(),
      name: opts?.name ?? 'Crônica Sem Nome',
      mode: 'exploration',
      partyCharacterIds: [],
      currentLocation: 'Início — taverna sem nome',
      currentSceneDescription: '',
      worldFlags: {},
      npcsMet: [],
      recentEvents: [],
      sessionNumber: 1,
      startedAt: now,
      lastPlayedAt: now,
    };
  }

  addCharacter(c: CharacterSheet): void {
    if (!this.party.find((p) => p.id === c.id)) {
      this.party.push(c);
      this.state.partyCharacterIds = this.party.map((p) => p.id);
    }
  }

  removeCharacter(id: string): void {
    this.party = this.party.filter((p) => p.id !== id);
    this.state.partyCharacterIds = this.party.map((p) => p.id);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Action loop — player toma ação, DM narra, tools aplicam
  // ════════════════════════════════════════════════════════════════════════

  async startSession(): Promise<DMResponse> {
    const response = await this.dm.narrate({
      campaign: this.state,
      party: this.party,
      recentNarrations: this.narrationLog,
    });
    this.applyDMResponse(response);
    return response;
  }

  async takeAction(playerId: string, action: ExplorationAction | string, details?: string): Promise<DMResponse> {
    const response = await this.dm.narrate({
      campaign: this.state,
      party: this.party,
      playerAction: { playerId, action: String(action), details },
      recentNarrations: this.narrationLog,
    });
    this.applyDMResponse(response);
    this.pushRecentEvent(`${playerNameOrId(this.party, playerId)} → ${action}${details ? `: ${details}` : ''}`);
    return response;
  }

  // Resolve um skill check pendente (server rola, depois pede narração da consequência ao DM)
  async resolveSkillCheck(playerId: string): Promise<{ roll: DiceRoll; success: boolean; nat20: boolean; nat1: boolean; dmResponse: DMResponse } | null> {
    if (!this.pendingSkillCheck) return null;
    const player = this.party.find((p) => p.id === playerId);
    if (!player) return null;

    const check = this.pendingSkillCheck;
    this.pendingSkillCheck = null;

    const skill = getSkill(check.skill);
    const abilityScore = player.abilityScores[skill.ability];
    const modifier = abilityModifier(abilityScore);
    const proficient = player.proficientSkills.includes(check.skill);
    const pb = proficiencyBonus(player.level);
    const totalMod = modifier + (proficient ? pb : 0);

    const roll = rollD20({ modifier: totalMod });
    const success = roll.total >= check.dc;

    // Pede ao DM pra narrar a consequência
    const dmResponse = await this.dm.narrate({
      campaign: this.state,
      party: this.party,
      recentNarrations: this.narrationLog,
      skillCheckResolution: {
        playerName: player.characterName,
        skill: skill.name,
        roll: roll.rolls[0] ?? 0,
        modifier: totalMod,
        total: roll.total,
        dc: check.dc,
        success,
        nat20: !!roll.nat20,
        nat1: !!roll.nat1,
      },
    });
    this.applyDMResponse(dmResponse);
    this.pushRecentEvent(`${player.characterName} rolou ${skill.name} (${roll.rolls[0]} + ${totalMod} = ${roll.total} vs DC ${check.dc}): ${success ? 'sucesso' : 'falhou'}`);

    return { roll, success, nat20: !!roll.nat20, nat1: !!roll.nat1, dmResponse };
  }

  hasPendingSkillCheck(): boolean {
    return this.pendingSkillCheck !== null;
  }

  getPendingSkillCheck(): { skill: SkillId; dc: number; reason: string; playerId: string } | null {
    return this.pendingSkillCheck;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Aplicação de tool calls do DM
  // ════════════════════════════════════════════════════════════════════════

  private applyDMResponse(response: DMResponse): void {
    // Log da narração
    const speaker = response.speaker ?? 'Mestre';
    const entry = `${speaker}: ${response.narration}`;
    this.narrationLog.push(entry);
    if (this.narrationLog.length > MAX_RECENT_NARRATIONS) {
      this.narrationLog = this.narrationLog.slice(-MAX_RECENT_NARRATIONS);
    }

    // Tools validadas server-side
    for (const tc of response.toolCalls) {
      const valid = validateToolCall(tc);
      if (!valid) {
        console.warn('[campaign] tool inválido rejeitado:', tc.name);
        continue;
      }
      this.applyValidatedTool(valid);
    }

    this.state.lastPlayedAt = Date.now();
  }

  private applyValidatedTool(tool: ValidatedTool): void {
    switch (tool.kind) {
      case 'request_skill_check': {
        const resolvedPlayerId = tool.playerId === 'active' && this.party[0] ? this.party[0].id : tool.playerId;
        this.pendingSkillCheck = {
          skill: tool.skill,
          dc: tool.dc,
          reason: tool.reason,
          playerId: resolvedPlayerId,
        };
        break;
      }

      case 'start_combat': {
        this.state.mode = 'combat';
        this.combat = {
          active: true,
          round: 1,
          enemies: tool.enemies.map((e, idx) => ({
            id: `enemy-${idx}-${Date.now()}`,
            name: e.name,
            maxHp: e.hp,
            currentHp: e.hp,
            armorClass: e.ac,
            conditions: [],
            description: e.description ?? '',
            isBoss: false,
          })),
        };
        this.pushRecentEvent(`Combate iniciado: ${tool.enemies.map((e) => e.name).join(', ')}`);
        break;
      }

      case 'apply_damage': {
        if (tool.playerId === 'all') {
          for (const p of this.party) {
            p.currentHp = Math.max(0, p.currentHp - tool.damage);
          }
        } else {
          const p = this.party.find((x) => x.id === tool.playerId);
          if (p) p.currentHp = Math.max(0, p.currentHp - tool.damage);
        }
        this.pushRecentEvent(`Dano (${tool.type}): ${tool.damage} — ${tool.reason}`);
        break;
      }

      case 'npc_speaks': {
        const existing = this.state.npcsMet.find((n) => n.name === tool.name);
        if (!existing) {
          this.state.npcsMet.push({
            name: tool.name,
            archetype: tool.archetype,
            attitude: tool.attitude,
            lastSeen: this.state.currentLocation,
          });
        } else {
          existing.attitude = tool.attitude;
          existing.lastSeen = this.state.currentLocation;
        }
        break;
      }

      case 'give_item': {
        const p = this.party.find((x) => x.id === tool.playerId);
        if (p) {
          p.inventory.push({
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: tool.itemName,
            type: tool.type,
            quantity: tool.quantity,
            description: tool.description,
          });
          this.pushRecentEvent(`${p.characterName} recebeu ${tool.itemName} × ${tool.quantity}`);
        }
        break;
      }

      case 'advance_time': {
        this.pushRecentEvent(`Tempo passou: ${tool.amount}${tool.reason ? ` (${tool.reason})` : ''}`);
        this.state.worldFlags.lastTimeJump = tool.amount;
        break;
      }

      case 'describe_scene': {
        this.state.currentLocation = tool.location;
        this.state.currentSceneDescription = tool.description;
        this.pushRecentEvent(`Mudou de local: ${tool.location}`);
        break;
      }
    }
  }

  private pushRecentEvent(text: string): void {
    this.state.recentEvents.push(text);
    if (this.state.recentEvents.length > MAX_RECENT_EVENTS) {
      this.state.recentEvents = this.state.recentEvents.slice(-MAX_RECENT_EVENTS);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Snapshot / restore
  // ════════════════════════════════════════════════════════════════════════

  setMode(mode: GameMode): void {
    this.state.mode = mode;
  }

  getNarrationLog(): string[] {
    return [...this.narrationLog];
  }
}

function playerNameOrId(party: CharacterSheet[], id: string): string {
  return party.find((p) => p.id === id)?.characterName ?? id;
}

// Re-export FallbackDM pra server/index.ts decidir
export { DungeonMaster, FallbackDM };
export type { DMInterface };

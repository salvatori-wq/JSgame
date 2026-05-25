// JSgame · Campaign engine. Coordena estado de uma sessão de D&D.
// Estado in-memory + persistido via persistence.saveCampaign() em wave-end style.
//
// Coop-safe:
// - mutex (actionQueue): serializa takeAction/resolveSkillCheck/combat action — evita
//   2 chamadas LLM paralelas + state corrompido quando 2 players agem juntos.
// - startSession one-shot: flag isStarted impede dupla narração de abertura.
// - pendingCheck no state.pendingCheck (público) com playerId owner — broadcast.
//   resolveSkillCheck rejeita se playerId !== pendingCheck.playerId.

import type {
  CharacterSheet, CampaignState, GameMode, ExplorationAction,
  CombatActionKind, CombatEvent,
} from '../shared/types.js';
import { DungeonMaster, FallbackDM, type DMInterface, type DMResponse } from './dm/dm.js';
import { validateToolCall, type ValidatedTool } from './dm/tools.js';
import { rollD20, type DiceRoll } from '../dnd/dice.js';
import { abilityModifier, proficiencyBonus } from '../dnd/attributes.js';
import { getSkill, type SkillId } from '../dnd/skills.js';
import {
  startCombat, currentParticipant, advanceTurn, isCombatOver,
  resolvePlayerAttack, resolveEnemyTurn, resolvePlayerDodge, resolvePlayerDash,
  applyConditionTo,
} from './combat.js';
import { resolvePlayerCastSpell, type CastSpellResult } from './spells-engine.js';
import type { SpellId } from '../dnd/spells.js';
import { getClass } from '../dnd/classes.js';
import { restoreAllSlots } from '../dnd/spell-slots.js';
import { rollDice } from '../dnd/dice.js';
import { uuid } from './util.js';

const MAX_RECENT_EVENTS = 30;
const MAX_RECENT_NARRATIONS = 10;

export class Campaign {
  state: CampaignState;
  party: CharacterSheet[] = [];
  private narrationLog: string[] = [];
  private dm: DMInterface;

  // Coop guards
  private isStarted = false;
  private isStarting = false;
  private actionQueue: Promise<unknown> = Promise.resolve();

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
      pendingCheck: null,
      combat: null,
    };
  }

  // Quando carregamos campanha persistida, restaura isStarted (se já tem narração)
  // pra evitar disparar startSession outra vez no rejoin.
  markStartedIfHasHistory(): void {
    if (this.narrationLog.length > 0 || this.state.recentEvents.length > 0) {
      this.isStarted = true;
    }
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
  // Mutex: enfileira async ops. Próxima só roda quando a anterior termina.
  // Erros não quebram o queue.
  // ════════════════════════════════════════════════════════════════════════

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.actionQueue.then(fn, fn);
    // Suprime warning de unhandled rejection na queue (caller já lida)
    this.actionQueue = next.catch(() => undefined);
    return next;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Action loop — player toma ação, DM narra, tools aplicam
  // ════════════════════════════════════════════════════════════════════════

  async startSession(): Promise<DMResponse | null> {
    return this.enqueue(async () => {
      if (this.isStarted || this.isStarting) return null;
      this.isStarting = true;
      try {
        const response = await this.dm.narrate({
          campaign: this.state,
          party: this.party,
          recentNarrations: this.narrationLog,
        });
        this.applyDMResponse(response);
        this.isStarted = true;
        return response;
      } finally {
        this.isStarting = false;
      }
    });
  }

  async takeAction(playerId: string, action: ExplorationAction | string, details?: string): Promise<DMResponse> {
    return this.enqueue(async () => {
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        playerAction: { playerId, action: String(action), details },
        recentNarrations: this.narrationLog,
      });
      this.applyDMResponse(response);
      this.pushRecentEvent(`${playerNameOrId(this.party, playerId)} → ${action}${details ? `: ${details}` : ''}`);
      return response;
    });
  }

  // Resolve skill check pendente. Verifica owner: só playerId === pendingCheck.playerId.
  async resolveSkillCheck(playerId: string): Promise<{ roll: DiceRoll; success: boolean; nat20: boolean; nat1: boolean; dmResponse: DMResponse } | null> {
    return this.enqueue(async () => {
      const check = this.state.pendingCheck;
      if (!check) return null;
      if (check.playerId !== playerId) return null;

      const player = this.party.find((p) => p.id === playerId);
      if (!player) return null;

      // Limpa antes de rolar (1 tentativa só)
      this.state.pendingCheck = null;

      const skill = getSkill(check.skill);
      const abilityScore = player.abilityScores[skill.ability];
      const modifier = abilityModifier(abilityScore);
      const proficient = player.proficientSkills.includes(check.skill);
      const pb = proficiencyBonus(player.level);
      const totalMod = modifier + (proficient ? pb : 0);

      const roll = rollD20({ modifier: totalMod });
      const success = roll.total >= check.dc;

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
    });
  }

  hasPendingSkillCheck(): boolean {
    return this.state.pendingCheck !== null;
  }

  getPendingSkillCheck(): CampaignState['pendingCheck'] {
    return this.state.pendingCheck;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Combat — ações de player + enemy turns automáticos.
  // ════════════════════════════════════════════════════════════════════════

  async playerCombatAction(
    playerId: string,
    action: CombatActionKind,
    targetId?: string,
  ): Promise<{
    ok: boolean;
    events: CombatEvent[];
    log: string;
    outcome?: 'victory' | 'defeat';
    dmFinalNarration?: DMResponse;
  } | null> {
    return this.enqueue(async () => {
      const combat = this.state.combat;
      if (!combat || !combat.active) return null;
      const current = currentParticipant(combat);
      if (!current || current.kind !== 'player' || current.id !== playerId) {
        return { ok: false, events: [], log: 'não é seu turno' };
      }

      const player = this.party.find((p) => p.id === playerId);
      if (!player) return null;

      const events: CombatEvent[] = [];
      let log = '';

      switch (action) {
        case 'attack': {
          if (!targetId) return { ok: false, events: [], log: 'precisa de alvo' };
          const result = resolvePlayerAttack(player, targetId, combat);
          if (!result) return { ok: false, events: [], log: 'alvo inválido' };
          events.push(...result.events);
          log = result.log;
          break;
        }
        case 'dodge': {
          const r = resolvePlayerDodge(player, combat);
          log = r.log;
          break;
        }
        case 'dash': {
          const r = resolvePlayerDash(player, combat);
          log = r.log;
          break;
        }
        default: {
          log = `${player.characterName} usa ${action}.`;
          combat.log.push(log);
          break;
        }
      }

      // Checa fim do combate antes de avançar turno
      const overCheck = isCombatOver(combat, this.party);
      if (overCheck.over) {
        const outcome = overCheck.victory ? 'victory' : 'defeat';
        const dmFinal = await this.endCombatNarrate(outcome);
        return { ok: true, events, log, outcome, dmFinalNarration: dmFinal };
      }

      // Avança turno e executa enemies até cair em player vivo
      const enemyTurnEvents = await this.runEnemyTurnsUntilPlayer();
      events.push(...enemyTurnEvents);

      // Checa novamente após enemy turns
      const overCheck2 = isCombatOver(combat, this.party);
      if (overCheck2.over) {
        const outcome = overCheck2.victory ? 'victory' : 'defeat';
        const dmFinal = await this.endCombatNarrate(outcome);
        return { ok: true, events, log, outcome, dmFinalNarration: dmFinal };
      }

      return { ok: true, events, log };
    });
  }

  // Avança turn e roda enemies sequencialmente até a vez voltar pra um player vivo
  // (ou combate acabar). Retorna events acumulados.
  private async runEnemyTurnsUntilPlayer(): Promise<CombatEvent[]> {
    const combat = this.state.combat;
    if (!combat) return [];
    const events: CombatEvent[] = [];

    // Max iterações = nº participantes × 2 pra evitar loop infinito
    const max = combat.initiativeOrder.length * 2;
    for (let i = 0; i < max; i++) {
      const adv = advanceTurn(combat, this.party);
      if (adv.combatOver) break;
      if (!adv.participant) break;
      if (adv.participant.kind === 'player') break;

      // Enemy turn
      const result = resolveEnemyTurn(adv.participant.id, this.party, combat);
      if (result) events.push(...result.events);

      // Checa fim depois de cada enemy
      const oc = isCombatOver(combat, this.party);
      if (oc.over) break;
    }

    return events;
  }

  private async endCombatNarrate(outcome: 'victory' | 'defeat'): Promise<DMResponse | undefined> {
    const combat = this.state.combat;
    if (!combat) return undefined;

    combat.active = false;
    this.state.mode = 'exploration';
    this.pushRecentEvent(outcome === 'victory' ? 'Combate vencido' : 'Party caiu em combate');

    try {
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        recentNarrations: this.narrationLog,
        playerAction: {
          playerId: this.party[0]?.id ?? 'system',
          action: outcome === 'victory' ? 'combate-vencido' : 'combate-perdido',
          details: outcome === 'victory'
            ? 'Inimigos derrotados. Narre desfecho curto.'
            : 'Party caiu (HP 0). Narre desfecho sombrio — não morte definitiva ainda, só inconsciência.',
        },
      });
      this.applyDMResponse(response);
      return response;
    } catch (err) {
      console.warn('[campaign] DM final combat narration failed:', err);
      return undefined;
    } finally {
      // Limpa combat após narração
      this.state.combat = null;
    }
  }

  // Chamado quando current turn é enemy E ninguém tomou action ainda (depois start_combat).
  // Útil pra primeiro turno se enemy ganhou initiative.
  async kickoffCombatIfEnemyFirst(): Promise<CombatEvent[]> {
    return this.enqueue(async () => {
      const combat = this.state.combat;
      if (!combat || !combat.active) return [];
      const current = currentParticipant(combat);
      if (!current || current.kind === 'player') return [];

      const events: CombatEvent[] = [];
      // Resolve este enemy + roda até player
      const result = resolveEnemyTurn(current.id, this.party, combat);
      if (result) events.push(...result.events);
      const more = await this.runEnemyTurnsUntilPlayer();
      events.push(...more);
      return events;
    });
  }

  getCombatState() {
    return this.state.combat;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Rest — short (gasta hit dice, cura) + long (full restore)
  // ════════════════════════════════════════════════════════════════════════

  async shortRest(playerId: string, hitDiceToSpend: number): Promise<{ ok: boolean; healed: number; diceSpent: number; reason?: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, healed: 0, diceSpent: 0, reason: 'jogador não encontrado' };
      if (this.state.combat?.active) return { ok: false, healed: 0, diceSpent: 0, reason: 'sem descanso durante combate' };

      const spend = Math.max(0, Math.min(hitDiceToSpend, player.hitDiceRemaining));
      if (spend === 0) return { ok: false, healed: 0, diceSpent: 0, reason: 'sem hit dice disponíveis' };

      const klass = getClass(player.classId);
      const conMod = Math.floor((player.abilityScores.con - 10) / 2);
      const roll = rollDice(spend, klass.hitDie, conMod * spend);
      const healed = Math.max(spend, roll.total); // pelo menos N pontos (1 por die)
      const oldHp = player.currentHp;
      player.currentHp = Math.min(player.maxHp, player.currentHp + healed);
      const actual = player.currentHp - oldHp;
      player.hitDiceRemaining = Math.max(0, player.hitDiceRemaining - spend);

      // Cura traz de volta da inconsciência
      if (actual > 0 && player.conditions.includes('inconsciente')) {
        player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
        player.deathSaveSuccesses = 0;
        player.deathSaveFailures = 0;
      }

      this.pushRecentEvent(`${player.characterName} descansou curto: gastou ${spend} hit dice, curou ${actual} HP`);
      return { ok: true, healed: actual, diceSpent: spend };
    });
  }

  async longRest(playerId: string): Promise<{ ok: boolean; healed: number; reason?: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, healed: 0, reason: 'jogador não encontrado' };
      if (this.state.combat?.active) return { ok: false, healed: 0, reason: 'sem descanso durante combate' };

      const oldHp = player.currentHp;
      player.currentHp = player.maxHp;
      // Hit dice: recupera metade do total max (min 1)
      const totalDice = player.level; // max hit dice = level
      const recovered = Math.max(1, Math.floor(totalDice / 2));
      player.hitDiceRemaining = Math.min(totalDice, player.hitDiceRemaining + recovered);
      // Spell slots full restore
      restoreAllSlots(player);
      // Cura conditions de batalha
      player.conditions = player.conditions.filter((c) => c !== 'inconsciente' && c !== 'envenenado' && c !== 'amedrontado');
      player.deathSaveSuccesses = 0;
      player.deathSaveFailures = 0;

      this.pushRecentEvent(`${player.characterName} descansou longo: HP cheio, slots resetados, ${recovered} hit dice voltam`);
      return { ok: true, healed: player.currentHp - oldHp };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Death saves — quando HP=0 em combate, no turn do PJ rola d20.
  // ≥10=sucesso; <10=falha. Nat20=recupera 1HP. Nat1=2 falhas.
  // 3 sucessos = estabiliza. 3 falhas = morre (deathCount++).
  // ════════════════════════════════════════════════════════════════════════

  async rollDeathSave(playerId: string): Promise<{
    ok: boolean;
    rollTotal?: number;
    success?: boolean;
    nat20?: boolean;
    nat1?: boolean;
    stabilized?: boolean;
    died?: boolean;
    successes?: number;
    failures?: number;
    reason?: string;
  }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, reason: 'jogador não encontrado' };
      if (player.currentHp > 0) return { ok: false, reason: 'só precisa de death save em HP=0' };
      if (player.deathSaveSuccesses >= 3) return { ok: false, reason: 'já estabilizou' };
      if (player.deathSaveFailures >= 3) return { ok: false, reason: 'já morreu' };

      const roll = rollD20();
      const total = roll.total;
      let stabilized = false;
      let died = false;

      if (roll.nat20) {
        // Recupera 1 HP
        player.currentHp = 1;
        player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
        player.deathSaveSuccesses = 0;
        player.deathSaveFailures = 0;
        this.pushRecentEvent(`${player.characterName} rolou NAT 20 no death save — recupera 1 HP`);
      } else if (roll.nat1) {
        player.deathSaveFailures = Math.min(3, player.deathSaveFailures + 2);
        this.pushRecentEvent(`${player.characterName} rolou NAT 1 — duas falhas (${player.deathSaveFailures}/3)`);
      } else if (total >= 10) {
        player.deathSaveSuccesses += 1;
        if (player.deathSaveSuccesses >= 3) {
          stabilized = true;
          player.deathSaveSuccesses = 0;
          player.deathSaveFailures = 0;
          this.pushRecentEvent(`${player.characterName} estabilizou (3 sucessos)`);
        } else {
          this.pushRecentEvent(`${player.characterName} death save sucesso (${player.deathSaveSuccesses}/3)`);
        }
      } else {
        player.deathSaveFailures += 1;
        if (player.deathSaveFailures >= 3) {
          died = true;
          player.deathCount += 1;
          this.pushRecentEvent(`${player.characterName} morreu (3 falhas)`);
        } else {
          this.pushRecentEvent(`${player.characterName} death save falha (${player.deathSaveFailures}/3)`);
        }
      }

      return {
        ok: true,
        rollTotal: total,
        success: total >= 10 || !!roll.nat20,
        nat20: !!roll.nat20,
        nat1: !!roll.nat1,
        stabilized,
        died,
        successes: player.deathSaveSuccesses,
        failures: player.deathSaveFailures,
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cast spell — funciona em exploration OU combat.
  // Em combat só se for vez do caster.
  // ════════════════════════════════════════════════════════════════════════

  async playerCastSpell(
    casterId: string,
    spellId: SpellId,
    targetIds: string[],
    slotLevel: 0 | 1 | 2 | 3 | 4 | 5,
  ): Promise<CastSpellResult & { outcome?: 'victory' | 'defeat' }> {
    return this.enqueue(async () => {
      const caster = this.party.find((p) => p.id === casterId);
      if (!caster) {
        return { ok: false, reason: 'caster não está na party', events: [], narration: '', spellName: '' };
      }

      // Em combate, só na vez do caster
      if (this.state.combat?.active) {
        const cur = currentParticipant(this.state.combat);
        if (!cur || cur.kind !== 'player' || cur.id !== casterId) {
          return { ok: false, reason: 'não é seu turno', events: [], narration: '', spellName: '' };
        }
      }

      const result = resolvePlayerCastSpell({
        caster,
        spellId,
        targetIds,
        slotLevel,
        party: this.party,
        combat: this.state.combat,
      });

      if (!result.ok) return result;

      this.pushRecentEvent(result.narration);

      // Em combate: checa fim e avança turno
      let outcome: 'victory' | 'defeat' | undefined;
      if (this.state.combat?.active) {
        const oc = isCombatOver(this.state.combat, this.party);
        if (oc.over) {
          outcome = oc.victory ? 'victory' : 'defeat';
          await this.endCombatNarrate(outcome);
        } else {
          // Avança turn e roda enemies
          const enemyEvents = await this.runEnemyTurnsUntilPlayer();
          result.events.push(...enemyEvents);

          const oc2 = isCombatOver(this.state.combat, this.party);
          if (oc2.over) {
            outcome = oc2.victory ? 'victory' : 'defeat';
            await this.endCombatNarrate(outcome);
          }
        }
      }

      return { ...result, outcome };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Aplicação de tool calls do DM
  // ════════════════════════════════════════════════════════════════════════

  private applyDMResponse(response: DMResponse): void {
    const speaker = response.speaker ?? 'Mestre';
    const entry = `${speaker}: ${response.narration}`;
    this.narrationLog.push(entry);
    if (this.narrationLog.length > MAX_RECENT_NARRATIONS) {
      this.narrationLog = this.narrationLog.slice(-MAX_RECENT_NARRATIONS);
    }

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
        // Se playerId não está na party, faz fallback pro primeiro
        const owner = this.party.find((p) => p.id === resolvedPlayerId)?.id ?? this.party[0]?.id ?? resolvedPlayerId;
        this.state.pendingCheck = {
          skill: tool.skill,
          dc: tool.dc,
          reason: tool.reason,
          playerId: owner,
        };
        break;
      }

      case 'start_combat': {
        this.state.mode = 'combat';
        this.state.combat = startCombat({
          party: this.party,
          enemies: tool.enemies,
        });
        this.pushRecentEvent(`Combate iniciado: ${tool.enemies.map((e) => e.name).join(', ')}`);
        break;
      }

      case 'apply_damage': {
        if (tool.playerId === 'all') {
          for (const p of this.party) {
            p.currentHp = Math.max(0, p.currentHp - tool.damage);
            if (p.currentHp === 0 && !p.conditions.includes('inconsciente')) {
              p.conditions.push('inconsciente');
            }
          }
        } else {
          const p = this.party.find((x) => x.id === tool.playerId);
          if (p) {
            p.currentHp = Math.max(0, p.currentHp - tool.damage);
            if (p.currentHp === 0 && !p.conditions.includes('inconsciente')) {
              p.conditions.push('inconsciente');
            }
          }
        }
        this.pushRecentEvent(`Dano (${tool.type}): ${tool.damage} — ${tool.reason}`);
        break;
      }

      case 'apply_condition': {
        if (this.state.combat) {
          const r = applyConditionTo(this.state.combat, this.party, tool.targetId, tool.condition);
          if (r.applied) this.pushRecentEvent(`${r.targetName} ficou ${tool.condition}`);
        } else {
          const p = this.party.find((x) => x.id === tool.targetId);
          if (p && !p.conditions.includes(tool.condition)) {
            p.conditions.push(tool.condition);
            this.pushRecentEvent(`${p.characterName} ficou ${tool.condition}`);
          }
        }
        break;
      }

      case 'end_combat_with_outcome': {
        if (this.state.combat) {
          this.state.combat.active = false;
          this.state.mode = 'exploration';
          this.pushRecentEvent(`Combate encerrado: ${tool.outcome}`);
          this.state.combat = null;
        }
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

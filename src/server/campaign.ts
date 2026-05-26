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
  CombatActionKind, CombatEvent, MemoryFact,
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
import type { MemoryStore } from './memory.js';

const MAX_RECENT_EVENTS = 30;
const MAX_RECENT_NARRATIONS = 10;
// Quantos facts injetar no prompt do Mestre por narração — equilibra tokens vs recall
const MEMORY_TOPK = 5;

export class Campaign {
  state: CampaignState;
  party: CharacterSheet[] = [];
  private narrationLog: string[] = [];
  private dm: DMInterface;
  private memory: MemoryStore | undefined;

  // Coop guards
  private isStarted = false;
  private isStarting = false;
  private actionQueue: Promise<unknown> = Promise.resolve();

  constructor(dm: DMInterface, opts?: { id?: string; name?: string; memory?: MemoryStore }) {
    this.dm = dm;
    this.memory = opts?.memory;
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
  // RAG: retrieve facts relevantes ao contexto + chama dm.narrate.
  // Centraliza a injeção de memória pra todos os 4-5 call sites do narrate().
  // ════════════════════════════════════════════════════════════════════════

  private async retrieveMemory(focusText: string): Promise<MemoryFact[]> {
    if (!this.memory) return [];
    try {
      // Concatena foco (ação/local) com últimos eventos pra ampliar keywords.
      // Limit nas últimas 3 entradas pra não diluir foco com história antiga.
      const lastEvents = this.state.recentEvents.slice(-3).join(' ');
      const query = [focusText, this.state.currentLocation, lastEvents].filter(Boolean).join(' ');
      return await this.memory.search(this.state.id, query, { limit: MEMORY_TOPK });
    } catch (err) {
      console.warn('[campaign] memory.search falhou:', err);
      return [];
    }
  }

  // Helper que extrai foco de uma chamada narrate() pra retrieval. Usa ação do
  // player se houver; senão usa skillCheck; senão usa local atual.
  private buildMemoryFocus(opts: {
    playerAction?: { action: string; details?: string };
    skillCheckResolution?: { skill: string; playerName: string };
  }): string {
    if (opts.playerAction) {
      return `${opts.playerAction.action}${opts.playerAction.details ? ' ' + opts.playerAction.details : ''}`;
    }
    if (opts.skillCheckResolution) {
      return `${opts.skillCheckResolution.playerName} ${opts.skillCheckResolution.skill}`;
    }
    return this.state.currentLocation ?? '';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Action loop — player toma ação, DM narra, tools aplicam
  // ════════════════════════════════════════════════════════════════════════

  async startSession(): Promise<DMResponse | null> {
    return this.enqueue(async () => {
      if (this.isStarted || this.isStarting) return null;
      this.isStarting = true;
      try {
        const memoryFacts = await this.retrieveMemory(this.buildMemoryFocus({}));
        const response = await this.dm.narrate({
          campaign: this.state,
          party: this.party,
          recentNarrations: this.narrationLog,
          memoryFacts,
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
      const memoryFacts = await this.retrieveMemory(
        this.buildMemoryFocus({ playerAction: { action: String(action), details } }),
      );
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        playerAction: { playerId, action: String(action), details },
        recentNarrations: this.narrationLog,
        memoryFacts,
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

      const memoryFacts = await this.retrieveMemory(
        this.buildMemoryFocus({ skillCheckResolution: { skill: skill.name, playerName: player.characterName } }),
      );
      const dmResponse = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        recentNarrations: this.narrationLog,
        memoryFacts,
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
      const memoryFacts = await this.retrieveMemory(
        this.buildMemoryFocus({ playerAction: { action: outcome === 'victory' ? 'combate-vencido' : 'combate-perdido' } }),
      );
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        recentNarrations: this.narrationLog,
        memoryFacts,
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
      // Long rest reduz exaustão em 1
      player.exhaustion = Math.max(0, player.exhaustion - 1);

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
  // Inventory — use/equip/unequip items
  // ════════════════════════════════════════════════════════════════════════

  async useItem(playerId: string, itemId: string): Promise<{ ok: boolean; message: string; effectApplied?: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, message: 'jogador não encontrado' };
      const idx = player.inventory.findIndex((i) => i.id === itemId);
      if (idx < 0) return { ok: false, message: 'item não está no inventário' };
      const item = player.inventory[idx]!;

      // Apenas consumíveis usam diretamente
      if (item.type !== 'consumivel') {
        return { ok: false, message: `${item.name} não é consumível` };
      }

      // Heuristicas pra poções comuns
      const name = item.name.toLowerCase();
      let effectApplied = '';
      if (/cura|poção.*cura|healing/.test(name)) {
        // Roll 2d4+2 (poção comum) — usa rollDice
        const roll = rollDice(2, 4, 2);
        const oldHp = player.currentHp;
        player.currentHp = Math.min(player.maxHp, player.currentHp + roll.total);
        const healed = player.currentHp - oldHp;
        if (healed > 0 && player.conditions.includes('inconsciente')) {
          player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
        }
        effectApplied = `Curou ${healed} HP`;
      } else if (/antídoto|veneno.*cura|poison.*cure/.test(name)) {
        player.conditions = player.conditions.filter((c) => c !== 'envenenado');
        effectApplied = 'Removeu condição envenenado';
      } else {
        effectApplied = `Usou ${item.name} (efeito narrado pelo Mestre)`;
      }

      // Consome quantity
      item.quantity -= 1;
      if (item.quantity <= 0) {
        player.inventory.splice(idx, 1);
      }
      this.pushRecentEvent(`${player.characterName} usou ${item.name}: ${effectApplied}`);
      return { ok: true, message: `${player.characterName} usou ${item.name}`, effectApplied };
    });
  }

  async equipItem(playerId: string, itemId: string, slot: 'weapon' | 'armor' | 'shield'): Promise<{ ok: boolean; message: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, message: 'jogador não encontrado' };
      const item = player.inventory.find((i) => i.id === itemId);
      if (!item) return { ok: false, message: 'item não está no inventário' };

      // Valida tipo conforme slot
      if (slot === 'weapon' && item.type !== 'arma') return { ok: false, message: `${item.name} não é arma` };
      if (slot === 'armor' && item.type !== 'armadura') return { ok: false, message: `${item.name} não é armadura` };
      if (slot === 'shield' && item.type !== 'escudo') return { ok: false, message: `${item.name} não é escudo` };

      if (slot === 'weapon') {
        if (!player.equippedWeapons.includes(itemId)) {
          // Até 2 armas
          if (player.equippedWeapons.length >= 2) player.equippedWeapons.shift();
          player.equippedWeapons.push(itemId);
        }
      } else if (slot === 'armor') {
        player.equippedArmor = itemId;
        // Re-calcula AC: armadura média = 14 + DEX(max 2); leve = 11 + DEX; pesada = base fixo
        // Pra MVP, usa nome do item:
        const conMod = Math.floor((player.abilityScores.des - 10) / 2);
        const armorName = item.name.toLowerCase();
        if (/couro/.test(armorName)) player.armorClass = 11 + conMod;
        else if (/cota.*malha|chain/.test(armorName)) player.armorClass = 13 + Math.min(2, conMod);
        else if (/cota.*placas|plate/.test(armorName)) player.armorClass = 18;
        else player.armorClass = 12 + conMod;
      } else if (slot === 'shield') {
        player.equippedShield = itemId;
        player.armorClass += 2;
      }
      this.pushRecentEvent(`${player.characterName} equipou ${item.name}`);
      return { ok: true, message: `${player.characterName} equipou ${item.name}` };
    });
  }

  async unequipItem(playerId: string, slot: 'weapon' | 'armor' | 'shield', itemId?: string): Promise<{ ok: boolean; message: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, message: 'jogador não encontrado' };

      if (slot === 'weapon') {
        if (itemId) {
          player.equippedWeapons = player.equippedWeapons.filter((w) => w !== itemId);
        } else {
          player.equippedWeapons = [];
        }
      } else if (slot === 'armor') {
        player.equippedArmor = undefined;
        const conMod = Math.floor((player.abilityScores.des - 10) / 2);
        player.armorClass = 10 + conMod;
        if (player.equippedShield) player.armorClass += 2;
      } else if (slot === 'shield') {
        if (player.equippedShield) {
          player.equippedShield = undefined;
          player.armorClass -= 2;
        }
      }
      this.pushRecentEvent(`${player.characterName} desequipou ${slot}`);
      return { ok: true, message: `${player.characterName} desequipou ${slot}` };
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

    // Quote literal de NPC vale ouro pra manter tom — indexa antes dos tool calls
    // (que podem também salvar fact "npc apareceu", mas separados são complementares).
    // Mestre, Sistema e fallbacks degradados (ex: "Mestre (degradado)") ignorados.
    if (
      speaker !== 'Mestre' &&
      !speaker.startsWith('Mestre ') &&
      speaker !== 'Sistema' &&
      response.narration.trim().length > 0
    ) {
      this.indexFact({
        kind: 'npc',
        text: `${speaker} disse: "${response.narration.trim()}"`,
        tags: `npc fala dialogo ${speaker.toLowerCase()}`,
        importance: 1.5,
      });
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

  // Indexer fire-and-forget — salva fact relevante a partir de tool call. Não
  // bloqueia o caller (DB write é I/O e mutex Campaign já garante ordem das ações).
  // Erros são logados mas nunca propagados pra não quebrar narração.
  private indexFact(input: {
    kind: import('../shared/types.js').MemoryFactKind;
    text: string;
    tags?: string;
    importance?: number;
  }): void {
    if (!this.memory) return;
    void this.memory.saveFact({
      campaignId: this.state.id,
      sessionN: this.state.sessionNumber,
      ...input,
    }).catch((err) => {
      console.warn('[campaign] memory.saveFact falhou:', err);
    });
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
        const enemyNames = tool.enemies.map((e) => e.name).join(', ');
        this.pushRecentEvent(`Combate iniciado: ${enemyNames}`);
        this.indexFact({
          kind: 'event',
          text: `Combate começou contra: ${enemyNames}. Local: ${this.state.currentLocation}.`,
          tags: `combate inimigos ${enemyNames.toLowerCase()}`,
          importance: 1.3,
        });
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
          this.indexFact({
            kind: 'event',
            text: `Combate encerrado: ${tool.outcome}. Local: ${this.state.currentLocation}.`,
            tags: `combate desfecho ${tool.outcome}`,
            importance: 1.2,
          });
          this.state.combat = null;
        }
        break;
      }

      case 'apply_exhaustion': {
        const p = this.party.find((x) => x.id === tool.targetId);
        if (p) {
          p.exhaustion = Math.max(0, Math.min(6, p.exhaustion + tool.levels));
          if (p.exhaustion >= 6) {
            // Exaustão 6 = morte
            p.currentHp = 0;
            p.deathCount += 1;
            this.pushRecentEvent(`${p.characterName} morreu de exaustão (nv 6)`);
          } else {
            this.pushRecentEvent(`${p.characterName} exaustão agora ${p.exhaustion}/6${tool.reason ? ` — ${tool.reason}` : ''}`);
          }
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
          // Primeiro encontro com NPC — importante pro DM lembrar tom/role.
          this.indexFact({
            kind: 'npc',
            text: `NPC ${tool.name} (${tool.archetype}, atitude ${tool.attitude}) apareceu em ${this.state.currentLocation}.`,
            tags: `npc ${tool.name.toLowerCase()} ${tool.archetype.toLowerCase()}`,
            importance: 1.4,
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
          this.indexFact({
            kind: 'inventory',
            text: `${p.characterName} recebeu ${tool.itemName} (${tool.type}) × ${tool.quantity}${tool.description ? ` — ${tool.description}` : ''}.`,
            tags: `inventario item ${tool.itemName.toLowerCase()} ${tool.type}`,
            // Items mágicos/raros são âncoras de quest — boosta. Item normal pesa pouco.
            importance: tool.type === 'tesouro' ? 1.3 : 1.0,
          });
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
        this.indexFact({
          kind: 'location',
          text: `Local: ${tool.location}${tool.description ? ` — ${tool.description}` : ''}.`,
          tags: `local lugar ${tool.location.toLowerCase()}`,
          importance: 1.2,
        });
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

// JSgame · Combat engine D&D 5e.
// Initiative + turn order + ataques + enemy AI determinística.
// Server-side ONLY. Cliente espelha state via socket.

import type {
  CharacterSheet, CombatState, EnemySnapshot, CombatEvent, ConditionId,
} from '../shared/types.js';
import { rollD20, rollDice, parseDiceNotation, type DiceRoll } from '../dnd/dice.js';
import { abilityModifier, proficiencyBonus } from '../dnd/attributes.js';
import { uuid } from './util.js';
import {
  getRageDamageBonus, hasRageResistance, maybeSneakAttack, clearTurnFlags,
  hasCombatFlag, clearCombatFlag, setCombatFlag, clearStartOfTurnFlags,
} from './class-features-engine.js';
import { tryBreakConcentration, dropConcentrationIfUnconscious } from './spells-engine.js';
import { applyDamageMultiplier, damageVerdict, type DamageType } from '../dnd/damage-types.js';
import { consumeBuffs, readAcBonus } from './buff-engine.js';
import { resetReactionsForRound } from './reaction-engine.js';

const SKIP_TURN_CONDITIONS: ConditionId[] = ['atordoado', 'inconsciente', 'paralisado', 'petrificado'];

// ════════════════════════════════════════════════════════════════════════════
// Inicialização: rola initiative pra todo mundo.
// PHB pág 189: cada participante rola d20 + Des mod. Ordem decrescente.
// Tie: pra D&D 5e RAW é a critério do DM — usamos ordem de inserção como tiebreaker.
// ════════════════════════════════════════════════════════════════════════════

export interface StartCombatInput {
  party: CharacterSheet[];
  enemies: Array<{
    name: string;
    hp: number;
    ac: number;
    attackBonus?: number;
    damageDice?: string;
    damageBonus?: number;
    description?: string;
    xpAward?: number;  // F16 — quanta XP a kill concede. Default 10 (CR 0).
    isBoss?: boolean;
    // F26 — Damage profile vindo do MonsterDef (start_combat usa MONSTERS dict)
    resistances?: import('../dnd/damage-types.js').DamageType[];
    immunities?: import('../dnd/damage-types.js').DamageType[];
    vulnerabilities?: import('../dnd/damage-types.js').DamageType[];
    attackDamageType?: import('../dnd/damage-types.js').DamageType;
    // M1 — Ability scores reais (bestiary + inferAbilityScores)
    abilityScores?: { for: number; des: number; con: number; int: number; sab: number; car: number };
  }>;
}

export function startCombat(input: StartCombatInput): CombatState {
  const enemies: EnemySnapshot[] = input.enemies.map((e, idx) => {
    const enemyDexMod = 0; // padrão. DM pode declarar attackBonus que já inclui.
    const initRoll = rollD20({ modifier: enemyDexMod });
    return {
      id: `enemy-${Date.now()}-${idx}`,
      name: e.name,
      maxHp: e.hp,
      currentHp: e.hp,
      armorClass: e.ac,
      attackBonus: e.attackBonus ?? 3,
      damageDice: e.damageDice ?? '1d6',
      damageBonus: e.damageBonus ?? 0,
      initiative: initRoll.total,
      conditions: [],
      description: e.description ?? '',
      isBoss: !!e.isBoss,
      xpAward: e.xpAward ?? 10,
      resistances: e.resistances,
      immunities: e.immunities,
      vulnerabilities: e.vulnerabilities,
      attackDamageType: e.attackDamageType,
      abilityScores: e.abilityScores,
    };
  });

  const initiativeOrder: CombatState['initiativeOrder'] = [];
  for (const p of input.party) {
    const dexMod = abilityModifier(p.abilityScores.des);
    const roll = rollD20({ modifier: dexMod });
    initiativeOrder.push({
      id: p.id,
      kind: 'player',
      initiative: roll.total,
      name: p.characterName,
    });
  }
  for (const e of enemies) {
    initiativeOrder.push({
      id: e.id,
      kind: 'enemy',
      initiative: e.initiative,
      name: e.name,
    });
  }
  // Ordena desc (com index original como tiebreaker estável)
  initiativeOrder.sort((a, b) => b.initiative - a.initiative);

  // β.4 — Action Economy inicial: fresh por participante (action + bonusAction +
  // reaction disponíveis, movement 30ft padrão). Player vê isso no HUD; consume
  // mecânico em Sprint γ.
  const actionEconomy: Record<string, import('../shared/types.js').ActionEconomy> = {};
  for (const p of initiativeOrder) {
    actionEconomy[p.id] = freshActionEconomy();
  }

  return {
    active: true,
    round: 1,
    initiativeOrder,
    currentTurnIndex: 0,
    enemies,
    log: [`Initiative: ${initiativeOrder.map((p) => `${p.name}(${p.initiative})`).join(' · ')}`],
    actionEconomy,
  };
}

// β.4 — Action economy padrão: tudo disponível, 30ft movement (PHB pág 191).
// Custom move speeds (anão 25, monge 40+) ficam pra próxima iteração.
export function freshActionEconomy(): import('../shared/types.js').ActionEconomy {
  return { action: true, bonusAction: true, reaction: true, movement: 30 };
}

// β.4 — Consume helper (V1: noop seguro). Action handlers podem chamar via
// consumeActionEconomy(combat, id, 'action') pra marcar usado. Em V2 (γ),
// retorna false se já consumido → handler aborta. Por ora sempre permite,
// só atualiza state pra UI mostrar gray-out.
export function consumeActionEconomy(
  combat: import('../shared/types.js').CombatState,
  participantId: string,
  kind: 'action' | 'bonus' | 'reaction' | 'movement',
  movementFt = 0,
): boolean {
  if (!combat.actionEconomy) return true;
  const ec = combat.actionEconomy[participantId];
  if (!ec) return true;
  switch (kind) {
    case 'action':    ec.action = false; return true;
    case 'bonus':     ec.bonusAction = false; return true;
    case 'reaction':  ec.reaction = false; return true;
    case 'movement':
      ec.movement = Math.max(0, ec.movement - movementFt);
      return true;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Turn flow
// ════════════════════════════════════════════════════════════════════════════

export function currentParticipant(combat: CombatState): CombatState['initiativeOrder'][number] | null {
  return combat.initiativeOrder[combat.currentTurnIndex] ?? null;
}

// Avança turn. Pula participantes mortos/inconscientes. Incrementa round ao loop.
// Retorna o próximo participante ativo (ou null se combate acabou — todos vivos
// de um lado morreram).
export function advanceTurn(combat: CombatState, party: CharacterSheet[]): { participant: CombatState['initiativeOrder'][number] | null; combatOver: boolean } {
  if (!combat.active) return { participant: null, combatOver: true };
  if (isCombatOver(combat, party).over) {
    combat.active = false;
    return { participant: null, combatOver: true };
  }
  // F23 — limpa flags de turn (sneak-attack-used, action-surge) do participante saindo
  const exiting = combat.initiativeOrder[combat.currentTurnIndex];
  if (exiting) clearTurnFlags(combat, exiting.id);

  // Tenta até N voltas — se TODOS pulam, encerra.
  const max = combat.initiativeOrder.length * 2;
  for (let i = 0; i < max; i++) {
    combat.currentTurnIndex = (combat.currentTurnIndex + 1) % combat.initiativeOrder.length;
    if (combat.currentTurnIndex === 0) {
      combat.round += 1;
      // 2A — Reset reactions usadas no round anterior. Cada PJ ganha 1 reação por round.
      resetReactionsForRound(combat, party);
    }
    const next = combat.initiativeOrder[combat.currentTurnIndex];
    if (!next) continue;
    if (!isParticipantAlive(next, combat, party)) continue;
    if (shouldSkipTurn(next, combat, party)) {
      combat.log.push(`${next.name} pula o turno (condição incapacitante).`);
      continue;
    }
    // M3 — limpa flags que duram "until start of next turn" (dodging)
    clearStartOfTurnFlags(combat, next.id);
    // β.4 — Reset action economy do participante entrando no turno.
    // Reaction NÃO é resetada aqui (reset por round em resetReactionsForRound).
    if (combat.actionEconomy) {
      const prev = combat.actionEconomy[next.id] ?? freshActionEconomy();
      combat.actionEconomy[next.id] = {
        action: true,
        bonusAction: true,
        movement: 30,
        reaction: prev.reaction, // preserva (round-based)
      };
    }
    return { participant: next, combatOver: false };
  }
  combat.active = false;
  return { participant: null, combatOver: true };
}

function isParticipantAlive(
  p: CombatState['initiativeOrder'][number],
  combat: CombatState,
  party: CharacterSheet[],
): boolean {
  if (p.kind === 'enemy') {
    const e = combat.enemies.find((x) => x.id === p.id);
    return !!e && e.currentHp > 0;
  }
  const pj = party.find((x) => x.id === p.id);
  return !!pj && pj.currentHp > 0;
}

function shouldSkipTurn(
  p: CombatState['initiativeOrder'][number],
  combat: CombatState,
  party: CharacterSheet[],
): boolean {
  if (p.kind === 'enemy') {
    const e = combat.enemies.find((x) => x.id === p.id);
    if (!e) return true;
    return e.conditions.some((c) => SKIP_TURN_CONDITIONS.includes(c));
  }
  const pj = party.find((x) => x.id === p.id);
  if (!pj) return true;
  if (pj.currentHp <= 0) return true;
  return pj.conditions.some((c) => SKIP_TURN_CONDITIONS.includes(c));
}

// Combate acaba se todos players a 0 OR todos enemies a 0.
export function isCombatOver(combat: CombatState, party: CharacterSheet[]): { over: true; victory: boolean } | { over: false } {
  const playerIds = new Set(combat.initiativeOrder.filter((p) => p.kind === 'player').map((p) => p.id));
  const partyAlive = party.filter((p) => playerIds.has(p.id)).some((p) => p.currentHp > 0);
  const enemiesAlive = combat.enemies.some((e) => e.currentHp > 0);
  if (!partyAlive) return { over: true, victory: false };
  if (!enemiesAlive) return { over: true, victory: true };
  return { over: false };
}

// ════════════════════════════════════════════════════════════════════════════
// Player attack — d20 + bônus vs CA. Crit nat 20 dobra dados.
// Simplificação MVP: usa primary ability (FOR ou DES, maior modifier). Proficiência
// assumida (todos PJs proficientes em armas iniciais). Damage default 1d8.
// ════════════════════════════════════════════════════════════════════════════

export interface PlayerAttackResult {
  attackerId: string;
  targetId: string;
  attackRoll: DiceRoll;
  hit: boolean;
  crit: boolean;
  damageRoll: DiceRoll | null;
  enemyKilled: boolean;
  log: string;
  events: CombatEvent[];
}

export function resolvePlayerAttack(
  attacker: CharacterSheet,
  targetEnemyId: string,
  combat: CombatState,
  opts: { damageDice?: string; isRanged?: boolean; damageType?: DamageType } = {},
): PlayerAttackResult | null {
  const target = combat.enemies.find((e) => e.id === targetEnemyId);
  if (!target || target.currentHp <= 0) return null;

  const strMod = abilityModifier(attacker.abilityScores.for);
  const dexMod = abilityModifier(attacker.abilityScores.des);
  const useMod = opts.isRanged ? dexMod : Math.max(strMod, dexMod);
  const pb = proficiencyBonus(attacker.level);
  const attackBonus = useMod + pb;

  // Desvantagem se atacante cego/envenenado; vantagem se target caído (corpo-a-corpo)
  const disadvantage =
    attacker.conditions.includes('cego') ||
    attacker.conditions.includes('envenenado') ||
    attacker.conditions.includes('restrito');
  // F24 — Help flag: aliado deu Help no PJ pra esse próximo ataque
  const wasHelped = hasCombatFlag(combat, attacker.id, 'helped-next-attack');
  if (wasHelped) clearCombatFlag(combat, attacker.id, 'helped-next-attack');
  // Sprint 5 — Hidden flag: ataque com surpresa = advantage. Atacar quebra hide.
  const wasHidden = hasCombatFlag(combat, attacker.id, 'hidden');
  if (wasHidden) clearCombatFlag(combat, attacker.id, 'hidden');
  // A2 — Buff engine: consome attack buffs (Bardic Insp 1d6, Bless 1d4, Faerie Fire advantage)
  const buffs = consumeBuffs(attacker, 'attack');
  const advantage =
    wasHelped || wasHidden || buffs.advantage ||
    (!opts.isRanged && (target.conditions.includes('caido') || target.conditions.includes('restrito')));

  // A2 — soma buff bonuses ao attack roll
  const attackRoll = rollD20({ modifier: attackBonus + buffs.flatBonus + buffs.diceBonus, advantage, disadvantage: disadvantage || buffs.disadvantage });
  const crit = !!attackRoll.nat20;
  const hit = crit || (!attackRoll.nat1 && attackRoll.total >= target.armorClass);

  const events: CombatEvent[] = [];
  let damageRoll: DiceRoll | null = null;
  let enemyKilled = false;
  let log: string;

  if (hit) {
    const diceStr = opts.damageDice ?? '1d8';
    const parsed = parseDiceNotation(diceStr) ?? { count: 1, kind: 8 as const, modifier: 0 };
    const totalDice = crit ? parsed.count * 2 : parsed.count;
    // F23 — Rage damage bonus (melee only)
    const rageBonus = getRageDamageBonus(attacker, combat, !!opts.isRanged);
    damageRoll = rollDice(totalDice, parsed.kind, useMod + parsed.modifier + rageBonus);
    // F23 — Sneak Attack (passive, +1d6 cada 2 lvl quando aplicável)
    const sneak = maybeSneakAttack(
      attacker,
      combat,
      target.conditions,
      // party desconhecido aqui — passa array vazio (heurística cobre via condition)
      [],
      crit,
    );
    let totalDamage = damageRoll.total;
    if (sneak.applied && sneak.damageRoll) {
      totalDamage += sneak.damageRoll.total;
    }
    // F26 — aplica resistance/immunity/vulnerability do alvo
    const dmgType = opts.damageType ?? 'cortante';
    const profile = {
      resistances: target.resistances,
      immunities: target.immunities,
      vulnerabilities: target.vulnerabilities,
    };
    const rawDamage = totalDamage;
    totalDamage = applyDamageMultiplier(totalDamage, dmgType, profile);
    const verdict = damageVerdict(dmgType, profile);
    target.currentHp = Math.max(0, target.currentHp - totalDamage);
    enemyKilled = target.currentHp === 0;

    events.push({
      type: 'damage',
      sourceId: attacker.id,
      targetId: target.id,
      value: totalDamage,
      crit,
      text: `${attacker.characterName} ${crit ? 'CRITA' : 'acerta'} ${target.name}: ${totalDamage} ${dmgType}${verdict ? ` (${verdict})` : ''}${rawDamage !== totalDamage ? ` [${rawDamage} bruto]` : ''}${sneak.applied ? ` (sneak +${sneak.damageRoll!.total})` : ''}${rageBonus ? ` (+${rageBonus} fúria)` : ''}`,
    });
    if (enemyKilled) {
      events.push({
        type: 'death',
        targetId: target.id,
        text: `${target.name} cai.`,
      });
    }
    log = `${attacker.characterName} → ${target.name}: ${attackRoll.total} vs CA ${target.armorClass} · ${crit ? 'CRIT' : 'HIT'} · ${totalDamage} dmg${enemyKilled ? ' · MORTO' : ''}`;
  } else {
    events.push({
      type: 'attack-miss',
      sourceId: attacker.id,
      targetId: target.id,
      text: `${attacker.characterName} erra ${target.name}`,
    });
    log = `${attacker.characterName} → ${target.name}: ${attackRoll.total} vs CA ${target.armorClass} · ${attackRoll.nat1 ? 'FALHA CRÍTICA' : 'MISS'}`;
  }

  combat.log.push(log);
  if (combat.log.length > 50) combat.log = combat.log.slice(-50);

  return {
    attackerId: attacker.id,
    targetId: target.id,
    attackRoll,
    hit,
    crit,
    damageRoll,
    enemyKilled,
    log,
    events,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Enemy AI — escolhe alvo vivo random, rola d20+attackBonus vs CA do alvo.
// Hit → rola damageDice + damageBonus.
// ════════════════════════════════════════════════════════════════════════════

export interface EnemyAttackResult {
  attackerId: string;
  targetId: string;
  targetName: string;
  attackRoll: DiceRoll;
  hit: boolean;
  crit: boolean;
  damageRoll: DiceRoll | null;
  playerDowned: boolean;
  log: string;
  events: CombatEvent[];
}

export function resolveEnemyTurn(
  enemyId: string,
  party: CharacterSheet[],
  combat: CombatState,
): EnemyAttackResult | null {
  const enemy = combat.enemies.find((e) => e.id === enemyId);
  if (!enemy || enemy.currentHp <= 0) return null;

  const aliveTargets = party.filter((p) => p.currentHp > 0);
  if (aliveTargets.length === 0) return null;

  // B1 — Smart AI: boss/elite prioriza low-HP, casters concentrando-em-spell,
  // ou alvo com Bardic Inspiration (threat). Outros (skirmishers): closest = random.
  let target: CharacterSheet;
  if (enemy.isBoss) {
    const scored = aliveTargets.map((p) => {
      let score = 0;
      // Low HP relativo = mais alvo (finisher)
      score += (1 - p.currentHp / p.maxHp) * 50;
      // Concentrando em spell = high-value disruption target
      if (p.concentratingOn) score += 30;
      // Player com active buffs (Bardic etc) é threat
      if (p.activeBuffs && p.activeBuffs.length > 0) score += 15;
      // Caster preparado tem int/sab/car alto
      const isCaster = p.spellSlots[1] && p.spellSlots[1].max > 0;
      if (isCaster) score += 20;
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    target = scored[0]!.p;
  } else {
    // Skirmisher random — comportamento legado
    target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]!;
  }

  const advantage = target.conditions.includes('caido') || target.conditions.includes('cego');
  // M3 — Dodge real: target com flag 'dodging' impõe desvantagem em ataques contra ele.
  const targetDodging = hasCombatFlag(combat, target.id, 'dodging');
  const disadvantage = enemy.conditions.includes('cego') || enemy.conditions.includes('envenenado') || targetDodging;

  const attackRoll = rollD20({ modifier: enemy.attackBonus, advantage, disadvantage });
  // A2 — Buff engine: lê AC bonus passivo do PJ (Shield +5, magic armor, etc)
  const acBuff = readAcBonus(target);
  const effectiveAc = target.armorClass + acBuff.flatBonus;
  const crit = !!attackRoll.nat20;
  const hit = crit || (!attackRoll.nat1 && attackRoll.total >= effectiveAc);

  const events: CombatEvent[] = [];
  let damageRoll: DiceRoll | null = null;
  let playerDowned = false;
  let log: string;

  if (hit) {
    const parsed = parseDiceNotation(enemy.damageDice) ?? { count: 1, kind: 6 as const, modifier: 0 };
    const totalDice = crit ? parsed.count * 2 : parsed.count;
    damageRoll = rollDice(totalDice, parsed.kind, enemy.damageBonus + parsed.modifier);
    // F23 — Rage resistance halves bludgeoning/piercing/slashing (assume todo dmg físico)
    let finalDmg = hasRageResistance(target, combat)
      ? Math.floor(damageRoll.total / 2)
      : damageRoll.total;
    // F26 — PJ damage profile (race/class/item resistances/immunities/vulnerabilities)
    const dmgType: DamageType = enemy.attackDamageType ?? 'cortante';
    finalDmg = applyDamageMultiplier(finalDmg, dmgType, {
      resistances: target.resistances,
      immunities: target.immunities,
      vulnerabilities: target.vulnerabilities,
    });
    target.currentHp = Math.max(0, target.currentHp - finalDmg);
    playerDowned = target.currentHp === 0;

    // F25 — Concentration save (PHB pág 203). DC max(10, dmg/2).
    if (finalDmg > 0 && target.concentratingOn) {
      const r = tryBreakConcentration(target, finalDmg);
      if (r.broken) {
        events.push({
          type: 'condition-removed',
          targetId: target.id,
          text: `${target.characterName} falha CON ${r.rollTotal}<DC${r.dc} — perde concentração em ${r.spellDropped}.`,
        });
      }
    }
    if (playerDowned) dropConcentrationIfUnconscious(target);

    if (playerDowned && !target.conditions.includes('inconsciente')) {
      target.conditions.push('inconsciente');
    }

    events.push({
      type: 'damage',
      sourceId: enemy.id,
      targetId: target.id,
      value: finalDmg,
      crit,
      text: `${enemy.name} ${crit ? 'CRITA' : 'acerta'} ${target.characterName}: ${finalDmg} de dano${finalDmg !== damageRoll.total ? ' (½ fúria)' : ''}`,
    });
    if (playerDowned) {
      events.push({
        type: 'condition-applied',
        targetId: target.id,
        conditionId: 'inconsciente',
        text: `${target.characterName} caiu inconsciente.`,
      });
    }
    log = `${enemy.name} → ${target.characterName}: ${attackRoll.total} vs CA ${target.armorClass} · ${crit ? 'CRIT' : 'HIT'} · ${finalDmg} dmg${playerDowned ? ' · INCONSCIENTE' : ''}`;
  } else {
    events.push({
      type: 'attack-miss',
      sourceId: enemy.id,
      targetId: target.id,
      text: `${enemy.name} erra ${target.characterName}`,
    });
    log = `${enemy.name} → ${target.characterName}: ${attackRoll.total} vs CA ${target.armorClass} · ${attackRoll.nat1 ? 'FALHA CRÍTICA' : 'MISS'}`;
  }

  combat.log.push(log);
  if (combat.log.length > 50) combat.log = combat.log.slice(-50);

  return {
    attackerId: enemy.id,
    targetId: target.id,
    targetName: target.characterName,
    attackRoll,
    hit,
    crit,
    damageRoll,
    playerDowned,
    log,
    events,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Outras ações de player (esquivar/disparar/etc).
// M3 — Esquivar REAL: marca flag 'dodging' no PJ, resolveEnemyAttack rola
// 2d20 e pega o menor (disadvantage) quando ataca PJ com flag. Flag limpa
// no início do próximo turno do PJ (clearTurnFlags em advanceTurn).
// ════════════════════════════════════════════════════════════════════════════

export function resolvePlayerDodge(attacker: CharacterSheet, combat: CombatState): { log: string } {
  // M3 — Marca combat-flag pra dodge real. resolveEnemyAttack vai checar.
  setCombatFlag(combat, attacker.id, 'dodging');
  const log = `${attacker.characterName} usa Esquivar — ataques contra ele têm desvantagem até o próximo turno.`;
  combat.log.push(log);
  return { log };
}

// Sprint 5 — Hide (PHB pág 192): Stealth check vs maior passive Perception
// dos inimigos vivos. Sucesso seta flag 'hidden' → próximo ataque tem advantage.
// resolvePlayerAttack consome a flag automaticamente.
export function resolvePlayerHide(
  attacker: CharacterSheet,
  combat: CombatState,
): { success: boolean; roll: number; dc: number; log: string } {
  const dexMod = abilityModifier(attacker.abilityScores.des);
  const pb = proficiencyBonus(attacker.level);
  const stealthBonus = dexMod + (attacker.proficientSkills.includes('furtividade') ? pb : 0);
  const roll = rollD20({ modifier: stealthBonus });

  // DC = maior passive perception dos inimigos vivos. Fallback 10 (PHB default).
  // EnemySnapshot não tem passive perception explícito — derivamos de attackBonus
  // como surrogate (typically passive ≈ 10 + WIS mod + prof).
  const livingEnemies = combat.enemies.filter((e) => e.currentHp > 0);
  const dc = Math.max(10, ...livingEnemies.map((e) => 10 + Math.floor(e.attackBonus / 2)));
  const success = roll.total >= dc;

  if (success) {
    setCombatFlag(combat, attacker.id, 'hidden');
  }
  const log = success
    ? `${attacker.characterName} se esconde (Furtividade ${roll.total} vs DC ${dc}) — invisível, próximo ataque com vantagem`
    : `${attacker.characterName} tenta se esconder (Furtividade ${roll.total} vs DC ${dc}) — inimigos perceberam`;
  combat.log.push(log);
  return { success, roll: roll.total, dc, log };
}

export function resolvePlayerDash(attacker: CharacterSheet, combat: CombatState): { log: string } {
  const log = `${attacker.characterName} usa Disparada — movimento dobrado nesse turno.`;
  combat.log.push(log);
  return { log };
}

// F24 — Disengage real: marca flag pra prevenir opportunity attacks neste turno
export function resolvePlayerDisengage(attacker: CharacterSheet, combat: CombatState): { log: string } {
  const log = `${attacker.characterName} usa Desengajar — pode se mover sem provocar ataques de oportunidade.`;
  combat.log.push(log);
  return { log };
}

// F24 — Grapple: STR(Athletics) atacante vs STR(Athletics) ou DEX(Acrobatics) alvo.
// Sucesso aplica condition 'restrito' no alvo.
export function resolveGrapple(
  attacker: CharacterSheet,
  targetEnemyId: string,
  combat: CombatState,
): { ok: boolean; success: boolean; log: string; events: CombatEvent[] } {
  const target = combat.enemies.find((e) => e.id === targetEnemyId);
  if (!target || target.currentHp <= 0) {
    return { ok: false, success: false, log: 'alvo inválido', events: [] };
  }
  const strMod = abilityModifier(attacker.abilityScores.for);
  const pb = proficiencyBonus(attacker.level);
  const attackerBonus = strMod + (attacker.proficientSkills.includes('atletismo') ? pb : 0);
  // Alvo: usa attackBonus simplificado como surrogate pra resistência
  const targetBonus = Math.floor(target.attackBonus / 1.5);
  const atkRoll = rollD20({ modifier: attackerBonus });
  const tgtRoll = rollD20({ modifier: targetBonus });
  const success = atkRoll.total >= tgtRoll.total;
  if (success && !target.conditions.includes('restrito')) {
    target.conditions.push('restrito');
  }
  const log = success
    ? `${attacker.characterName} agarra ${target.name} (Atletismo ${atkRoll.total} vs ${tgtRoll.total}) — RESTRITO`
    : `${attacker.characterName} tenta agarrar ${target.name} (${atkRoll.total} vs ${tgtRoll.total}) — falhou`;
  combat.log.push(log);
  return {
    ok: true,
    success,
    log,
    events: [{
      type: success ? 'condition-applied' : 'attack-miss',
      sourceId: attacker.id,
      targetId: target.id,
      text: log,
      conditionId: success ? 'restrito' : undefined,
    }],
  };
}

// F24 — Shove: STR(Athletics) vs STR(Athletics)/DEX(Acrobatics). Sucesso = caido OU empurra 5ft.
// Default: derruba (caido).
export function resolveShove(
  attacker: CharacterSheet,
  targetEnemyId: string,
  combat: CombatState,
  mode: 'knock-down' | 'push' = 'knock-down',
): { ok: boolean; success: boolean; log: string; events: CombatEvent[] } {
  const target = combat.enemies.find((e) => e.id === targetEnemyId);
  if (!target || target.currentHp <= 0) {
    return { ok: false, success: false, log: 'alvo inválido', events: [] };
  }
  const strMod = abilityModifier(attacker.abilityScores.for);
  const pb = proficiencyBonus(attacker.level);
  const attackerBonus = strMod + (attacker.proficientSkills.includes('atletismo') ? pb : 0);
  const targetBonus = Math.floor(target.attackBonus / 1.5);
  const atkRoll = rollD20({ modifier: attackerBonus });
  const tgtRoll = rollD20({ modifier: targetBonus });
  const success = atkRoll.total >= tgtRoll.total;
  if (success && mode === 'knock-down' && !target.conditions.includes('caido')) {
    target.conditions.push('caido');
  }
  const verb = mode === 'knock-down' ? 'derruba' : 'empurra';
  const cond = mode === 'knock-down' ? 'CAÍDO' : 'EMPURRADO 5ft';
  const log = success
    ? `${attacker.characterName} ${verb} ${target.name} (Atletismo ${atkRoll.total} vs ${tgtRoll.total}) — ${cond}`
    : `${attacker.characterName} tenta ${verb} ${target.name} (${atkRoll.total} vs ${tgtRoll.total}) — falhou`;
  combat.log.push(log);
  return {
    ok: true,
    success,
    log,
    events: [{
      type: success ? 'condition-applied' : 'attack-miss',
      sourceId: attacker.id,
      targetId: target.id,
      text: log,
      conditionId: success && mode === 'knock-down' ? 'caido' : undefined,
    }],
  };
}

// F24 — Help: marca aliado pra ganhar vantagem no próximo ataque.
// Sem opt target, é genérico (vantagem em test/save próximo). Com target ally id, vantagem ataque.
export function resolveHelp(
  helper: CharacterSheet,
  party: CharacterSheet[],
  allyId: string | undefined,
  combat: CombatState,
): { ok: boolean; log: string; events: CombatEvent[] } {
  const ally = allyId ? party.find((p) => p.id === allyId) : null;
  const log = ally
    ? `${helper.characterName} ajuda ${ally.characterName} — próximo ataque tem VANTAGEM.`
    : `${helper.characterName} ajuda ${combat.enemies[0]?.name ?? 'aliado'} — vantagem em próximo teste.`;
  combat.log.push(log);
  return {
    ok: true,
    log,
    events: [{
      type: 'condition-applied',
      sourceId: helper.id,
      targetId: ally?.id,
      text: log,
    }],
  };
}

export function applyConditionTo(
  combat: CombatState,
  party: CharacterSheet[],
  targetId: string,
  condition: ConditionId,
): { applied: boolean; targetName: string } {
  const enemy = combat.enemies.find((e) => e.id === targetId);
  if (enemy) {
    if (!enemy.conditions.includes(condition)) enemy.conditions.push(condition);
    return { applied: true, targetName: enemy.name };
  }
  const pj = party.find((p) => p.id === targetId);
  if (pj) {
    if (!pj.conditions.includes(condition)) pj.conditions.push(condition);
    return { applied: true, targetName: pj.characterName };
  }
  return { applied: false, targetName: '' };
}

// Re-export uuid pra conveniência
export { uuid };

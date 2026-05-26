// JSgame · Combat engine D&D 5e.
// Initiative + turn order + ataques + enemy AI determinística.
// Server-side ONLY. Cliente espelha state via socket.

import type {
  CharacterSheet, CombatState, EnemySnapshot, CombatEvent, ConditionId,
} from '../shared/types.js';
import { rollD20, rollDice, parseDiceNotation, type DiceRoll } from '../dnd/dice.js';
import { abilityModifier, proficiencyBonus } from '../dnd/attributes.js';
import { uuid } from './util.js';

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

  return {
    active: true,
    round: 1,
    initiativeOrder,
    currentTurnIndex: 0,
    enemies,
    log: [`Initiative: ${initiativeOrder.map((p) => `${p.name}(${p.initiative})`).join(' · ')}`],
  };
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

  // Tenta até N voltas — se TODOS pulam, encerra.
  const max = combat.initiativeOrder.length * 2;
  for (let i = 0; i < max; i++) {
    combat.currentTurnIndex = (combat.currentTurnIndex + 1) % combat.initiativeOrder.length;
    if (combat.currentTurnIndex === 0) combat.round += 1;
    const next = combat.initiativeOrder[combat.currentTurnIndex];
    if (!next) continue;
    if (!isParticipantAlive(next, combat, party)) continue;
    if (shouldSkipTurn(next, combat, party)) {
      combat.log.push(`${next.name} pula o turno (condição incapacitante).`);
      continue;
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
  opts: { damageDice?: string; isRanged?: boolean } = {},
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
  const advantage = !opts.isRanged && target.conditions.includes('caido');

  const attackRoll = rollD20({ modifier: attackBonus, advantage, disadvantage });
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
    damageRoll = rollDice(totalDice, parsed.kind, useMod + parsed.modifier);
    target.currentHp = Math.max(0, target.currentHp - damageRoll.total);
    enemyKilled = target.currentHp === 0;

    events.push({
      type: 'damage',
      sourceId: attacker.id,
      targetId: target.id,
      value: damageRoll.total,
      text: `${attacker.characterName} ${crit ? 'CRITA' : 'acerta'} ${target.name}: ${damageRoll.total} de dano`,
    });
    if (enemyKilled) {
      events.push({
        type: 'death',
        targetId: target.id,
        text: `${target.name} cai.`,
      });
    }
    log = `${attacker.characterName} → ${target.name}: ${attackRoll.total} vs CA ${target.armorClass} · ${crit ? 'CRIT' : 'HIT'} · ${damageRoll.total} dmg${enemyKilled ? ' · MORTO' : ''}`;
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

  // AI simples: target random vivo
  const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]!;

  const advantage = target.conditions.includes('caido') || target.conditions.includes('cego');
  const disadvantage = enemy.conditions.includes('cego') || enemy.conditions.includes('envenenado');

  const attackRoll = rollD20({ modifier: enemy.attackBonus, advantage, disadvantage });
  const crit = !!attackRoll.nat20;
  const hit = crit || (!attackRoll.nat1 && attackRoll.total >= target.armorClass);

  const events: CombatEvent[] = [];
  let damageRoll: DiceRoll | null = null;
  let playerDowned = false;
  let log: string;

  if (hit) {
    const parsed = parseDiceNotation(enemy.damageDice) ?? { count: 1, kind: 6 as const, modifier: 0 };
    const totalDice = crit ? parsed.count * 2 : parsed.count;
    damageRoll = rollDice(totalDice, parsed.kind, enemy.damageBonus + parsed.modifier);
    target.currentHp = Math.max(0, target.currentHp - damageRoll.total);
    playerDowned = target.currentHp === 0;

    if (playerDowned && !target.conditions.includes('inconsciente')) {
      target.conditions.push('inconsciente');
    }

    events.push({
      type: 'damage',
      sourceId: enemy.id,
      targetId: target.id,
      value: damageRoll.total,
      text: `${enemy.name} ${crit ? 'CRITA' : 'acerta'} ${target.characterName}: ${damageRoll.total} de dano`,
    });
    if (playerDowned) {
      events.push({
        type: 'condition-applied',
        targetId: target.id,
        conditionId: 'inconsciente',
        text: `${target.characterName} caiu inconsciente.`,
      });
    }
    log = `${enemy.name} → ${target.characterName}: ${attackRoll.total} vs CA ${target.armorClass} · ${crit ? 'CRIT' : 'HIT'} · ${damageRoll.total} dmg${playerDowned ? ' · INCONSCIENTE' : ''}`;
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
// Outras ações de player (esquivar/disparar/etc): efeito narrativo simples.
// Esquivar dá disadvantage em ataques contra player no próximo turno (placeholder).
// ════════════════════════════════════════════════════════════════════════════

export function resolvePlayerDodge(attacker: CharacterSheet, combat: CombatState): { log: string } {
  const log = `${attacker.characterName} usa Esquivar — qualquer ataque contra ele tem desvantagem até o próximo turno.`;
  combat.log.push(log);
  return { log };
}

export function resolvePlayerDash(attacker: CharacterSheet, combat: CombatState): { log: string } {
  const log = `${attacker.characterName} usa Disparada — movimento dobrado nesse turno.`;
  combat.log.push(log);
  return { log };
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

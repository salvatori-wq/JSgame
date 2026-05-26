// JSgame · F23 — Engine de Class Features Big 7 server-side.
// Valida uses, aplica efeitos, gerencia ki/rage/etc. Conditions específicas vão
// no sheet.conditions usando ids preexistentes (Rage usa 'amedrontado' como
// placeholder visual? não — adiciona condition custom 'rage' via cast).

import type { CharacterSheet, CombatEvent, CombatState } from '../shared/types.js';
import {
  FEATURES, type FeatureKey, getMaxFeatureUses, sneakAttackDiceCount,
} from '../dnd/class-features.js';
import { abilityModifier } from '../dnd/attributes.js';
import { rollDice } from '../dnd/dice.js';

// Estado runtime extra mantido fora do CharacterSheet (não persistido — combat-local).
// rageActive/secondWindUsed/etc são tags efêmeras pra evitar abuse mid-combat.
const combatLocalFlags = new WeakMap<CombatState, Map<string, Set<string>>>();

function getFlags(combat: CombatState, characterId: string): Set<string> {
  let map = combatLocalFlags.get(combat);
  if (!map) { map = new Map(); combatLocalFlags.set(combat, map); }
  let set = map.get(characterId);
  if (!set) { set = new Set(); map.set(characterId, set); }
  return set;
}

export function hasCombatFlag(combat: CombatState, characterId: string, flag: string): boolean {
  return getFlags(combat, characterId).has(flag);
}

export function setCombatFlag(combat: CombatState, characterId: string, flag: string): void {
  getFlags(combat, characterId).add(flag);
}

export function clearCombatFlag(combat: CombatState, characterId: string, flag: string): void {
  getFlags(combat, characterId).delete(flag);
}

// ════════════════════════════════════════════════════════════════════════════
// Inicializa estrutura classFeatureUses ao carregar PJ (preserva used anterior se já existir).
// ════════════════════════════════════════════════════════════════════════════

export function ensureFeatureUses(sheet: CharacterSheet): void {
  if (!sheet.classFeatureUses) sheet.classFeatureUses = {};
  const chaMod = abilityModifier(sheet.abilityScores.car);
  for (const def of Object.values(FEATURES)) {
    const max = getMaxFeatureUses(sheet.classId, sheet.level, def.key, chaMod);
    if (max <= 0) continue;
    const finiteMax = Number.isFinite(max) ? max : 999;
    const existing = sheet.classFeatureUses[def.key];
    if (existing) {
      // Refresh max (e.g., level-up aumentou)
      existing.max = finiteMax;
      existing.used = Math.min(existing.used, finiteMax);
    } else {
      sheet.classFeatureUses[def.key] = { used: 0, max: finiteMax };
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Restore em short / long rest
// ════════════════════════════════════════════════════════════════════════════

export function restoreOnShortRest(sheet: CharacterSheet): void {
  ensureFeatureUses(sheet);
  if (!sheet.classFeatureUses) return;
  for (const def of Object.values(FEATURES)) {
    if (def.restoreOn === 'short' || def.restoreOn === 'long') {
      // Short rest restaura todas que são 'short' OR também faz parcial em 'long' pra Wizard arcane recovery?
      // Pra simplicidade Big 7: só restaura 'short' aqui.
      if (def.restoreOn !== 'short') continue;
      const slot = sheet.classFeatureUses[def.key];
      if (slot) slot.used = 0;
    }
  }
}

export function restoreOnLongRest(sheet: CharacterSheet): void {
  ensureFeatureUses(sheet);
  if (!sheet.classFeatureUses) return;
  for (const slot of Object.values(sheet.classFeatureUses)) {
    slot.used = 0;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// useFeature — valida uses, aplica efeito.
// Retorna events pra socket emit + log linha.
// ════════════════════════════════════════════════════════════════════════════

export interface UseFeatureResult {
  ok: boolean;
  reason?: string;
  events: CombatEvent[];
  log: string;
}

export function useFeature(
  caster: CharacterSheet,
  featureKey: FeatureKey,
  combat: CombatState | null,
  party: CharacterSheet[],
  opts: { targetId?: string } = {},
): UseFeatureResult {
  const def = FEATURES[featureKey];
  if (!def) return { ok: false, reason: 'feature desconhecida', events: [], log: '' };
  ensureFeatureUses(caster);
  const slot = caster.classFeatureUses?.[featureKey];
  if (!slot || slot.max <= 0) {
    return { ok: false, reason: `${def.label} não disponível neste nível/classe`, events: [], log: '' };
  }
  if (slot.used >= slot.max) {
    return { ok: false, reason: `${def.label} já gasto (${slot.used}/${slot.max})`, events: [], log: '' };
  }

  switch (featureKey) {
    case 'rage':
      return applyRage(caster, slot, combat);
    case 'action-surge':
      return applyActionSurge(caster, slot, combat);
    case 'second-wind':
      return applySecondWind(caster, slot);
    case 'channel-divinity':
      return applyChannelDivinity(caster, slot, combat);
    case 'ki':
      return applyKi(caster, slot, combat);
    case 'bardic-inspiration':
      return applyBardicInspiration(caster, slot, party, opts.targetId);
    case 'wild-shape':
      return applyWildShape(caster, slot, combat);
  }
}

function applyRage(caster: CharacterSheet, slot: { used: number; max: number }, combat: CombatState | null): UseFeatureResult {
  if (!combat?.active) return { ok: false, reason: 'Fúria só fora de combate? Use em combate.', events: [], log: '' };
  slot.used++;
  setCombatFlag(combat, caster.id, 'rage');
  const log = `${caster.characterName} entra em FÚRIA! +2 dano corpo-a-corpo, resistência física.`;
  combat.log.push(log);
  return {
    ok: true,
    log,
    events: [{ type: 'condition-applied', sourceId: caster.id, targetId: caster.id, text: log }],
  };
}

function applyActionSurge(caster: CharacterSheet, slot: { used: number; max: number }, combat: CombatState | null): UseFeatureResult {
  if (!combat?.active) return { ok: false, reason: 'Surto de Ação só funciona em combate', events: [], log: '' };
  slot.used++;
  setCombatFlag(combat, caster.id, 'action-surge');
  const log = `${caster.characterName} usa SURTO DE AÇÃO — pode atacar/agir de novo neste turno.`;
  combat.log.push(log);
  return {
    ok: true,
    log,
    events: [{ type: 'condition-applied', sourceId: caster.id, targetId: caster.id, text: log }],
  };
}

function applySecondWind(caster: CharacterSheet, slot: { used: number; max: number }): UseFeatureResult {
  slot.used++;
  const roll = rollDice(1, 10, caster.level);
  const oldHp = caster.currentHp;
  caster.currentHp = Math.min(caster.maxHp, caster.currentHp + roll.total);
  const actualHeal = caster.currentHp - oldHp;
  const log = `${caster.characterName} usa REFÔLEGO — cura ${actualHeal} HP (1d10+${caster.level} = ${roll.total}).`;
  return {
    ok: true,
    log,
    events: [{ type: 'heal', sourceId: caster.id, targetId: caster.id, value: actualHeal, text: log }],
  };
}

function applyChannelDivinity(caster: CharacterSheet, slot: { used: number; max: number }, combat: CombatState | null): UseFeatureResult {
  if (!combat?.active) return { ok: false, reason: 'Canalizar Divindade só funciona em combate', events: [], log: '' };
  slot.used++;
  // Turn Undead: aplica 'amedrontado' em todos enemies cujo nome sugere morto-vivo.
  // Sem tags de monster types, usamos heurística por nome.
  const undeadKeywords = /esqueleto|zumbi|fantasma|vampiro|lich|morto|ghoul|ghast|wraith|specter|wight/i;
  let affected = 0;
  for (const en of combat.enemies) {
    if (en.currentHp <= 0) continue;
    if (undeadKeywords.test(en.name)) {
      if (!en.conditions.includes('amedrontado')) en.conditions.push('amedrontado');
      affected++;
    }
  }
  const log = affected > 0
    ? `${caster.characterName} CANALIZA DIVINDADE: ${affected} morto-vivo${affected > 1 ? 's' : ''} foge${affected > 1 ? 'm' : ''} aterrorizado${affected > 1 ? 's' : ''}.`
    : `${caster.characterName} canaliza divindade — não há mortos-vivos perto. Energia divina dispersa.`;
  combat.log.push(log);
  return { ok: true, log, events: [{ type: 'condition-applied', sourceId: caster.id, text: log }] };
}

function applyKi(caster: CharacterSheet, slot: { used: number; max: number }, combat: CombatState | null): UseFeatureResult {
  if (!combat?.active) return { ok: false, reason: 'Rajada de Golpes só em combate', events: [], log: '' };
  // Flurry of Blows: gasta 1 ki, +2 ataques desarmados. Damage 1d4 base + STR mod cada.
  slot.used++;
  const strMod = abilityModifier(caster.abilityScores.for);
  const r1 = rollDice(1, 4, strMod);
  const r2 = rollDice(1, 4, strMod);
  const log = `${caster.characterName} usa KI — Rajada de Golpes (2 ataques desarmados): ${r1.total} + ${r2.total} dmg (próximos turnos, alvo manual).`;
  combat.log.push(log);
  setCombatFlag(combat, caster.id, 'ki-flurry');
  return { ok: true, log, events: [{ type: 'condition-applied', sourceId: caster.id, targetId: caster.id, text: log }] };
}

function applyBardicInspiration(caster: CharacterSheet, slot: { used: number; max: number }, party: CharacterSheet[], targetId?: string): UseFeatureResult {
  const target = party.find((p) => p.id === targetId);
  if (!target) return { ok: false, reason: 'Inspiração precisa de alvo aliado', events: [], log: '' };
  if (target.id === caster.id) return { ok: false, reason: 'Não pode inspirar a si mesmo', events: [], log: '' };
  slot.used++;
  // A2 — Buff engine: aplica +1d6 real no próximo attack do aliado (consume on use).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // Import dinâmico evitando ciclo (class-features-engine ↔ buff-engine)
  // Mais fácil: caller já tem acesso via campaign.ts. Aqui só anexamos via target.activeBuffs.
  if (!target.activeBuffs) target.activeBuffs = [];
  target.activeBuffs.push({
    id: `bardic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: `Bardic Inspiration (${caster.characterName})`,
    appliesTo: 'attack',
    effect: { kind: 'dice-bonus', dice: '1d6' },
    charges: 1,
  });
  const log = `${caster.characterName} inspira ${target.characterName} — próximo ataque ganha +1d6 (Inspiração de Bardo).`;
  return { ok: true, log, events: [{ type: 'condition-applied', sourceId: caster.id, targetId: target.id, text: log }] };
}

function applyWildShape(caster: CharacterSheet, slot: { used: number; max: number }, combat: CombatState | null): UseFeatureResult {
  if (!combat?.active) return { ok: false, reason: 'Forma Selvagem deve ser ativada em combate', events: [], log: '' };
  slot.used++;
  // Simplificação: dá +HP igual ao nível e mantém combate. Animal cosmético.
  const bonus = caster.level * 4;
  caster.currentHp = Math.min(caster.maxHp + bonus, caster.currentHp + bonus);
  setCombatFlag(combat, caster.id, 'wild-shape');
  const log = `${caster.characterName} entra em FORMA SELVAGEM — ganha ${bonus} HP temporário e fica como besta corpo-a-corpo.`;
  combat.log.push(log);
  return { ok: true, log, events: [{ type: 'heal', sourceId: caster.id, targetId: caster.id, value: bonus, text: log }] };
}

// ════════════════════════════════════════════════════════════════════════════
// Damage modifiers (rage + sneak attack) — chamados em resolvePlayerAttack
// ════════════════════════════════════════════════════════════════════════════

// Rage damage bonus: +2 melee se ativo, e resistance to bludgeoning/piercing/slashing.
// resistance reduz dano recebido em metade (round down).
export function getRageDamageBonus(attacker: CharacterSheet, combat: CombatState | null, isRanged: boolean): number {
  if (!combat?.active) return 0;
  if (isRanged) return 0;
  if (!hasCombatFlag(combat, attacker.id, 'rage')) return 0;
  // PHB Barbarian rage damage: +2 nv 1-8, +3 nv 9-15, +4 nv 16+
  if (attacker.level >= 16) return 4;
  if (attacker.level >= 9) return 3;
  return 2;
}

export function hasRageResistance(defender: CharacterSheet, combat: CombatState | null): boolean {
  if (!combat?.active) return false;
  return hasCombatFlag(combat, defender.id, 'rage');
}

// Sneak Attack: ativa se atacante é ladino + tem vantagem OU aliado adjacente ao alvo.
// Vamos simplificar: se classId=ladino e alvo está com qualquer condição negativa OR
// há outro PJ no party (assume adjacente), aplica sneak. Retorna damage roll extra.
// Lembrar: sneak attack só uma vez por turno (1/round).
export function maybeSneakAttack(
  attacker: CharacterSheet,
  combat: CombatState | null,
  targetConditions: string[],
  party: CharacterSheet[],
  crit: boolean,
): { applied: boolean; damageRoll: ReturnType<typeof rollDice> | null } {
  if (!combat?.active) return { applied: false, damageRoll: null };
  if (hasCombatFlag(combat, attacker.id, 'sneak-attack-used-this-round')) {
    return { applied: false, damageRoll: null };
  }
  const dice = sneakAttackDiceCount(attacker.classId, attacker.level);
  if (dice === 0) return { applied: false, damageRoll: null };
  // Condition pra sneak: alvo com algo OR aliado vivo no party (assume cobertura).
  const advantageHint = targetConditions.length > 0 || party.filter((p) => p.id !== attacker.id && p.currentHp > 0).length > 0;
  if (!advantageHint) return { applied: false, damageRoll: null };
  setCombatFlag(combat, attacker.id, 'sneak-attack-used-this-round');
  const totalDice = crit ? dice * 2 : dice;
  const roll = rollDice(totalDice, 6, 0);
  return { applied: true, damageRoll: roll };
}

// Clear flags one-shot (called at end of turn pra resetar sneak-attack-used).
// F24 — também reseta bonus-action-used e disengaged-this-turn.
export function clearTurnFlags(combat: CombatState, characterId: string): void {
  clearCombatFlag(combat, characterId, 'sneak-attack-used-this-round');
  clearCombatFlag(combat, characterId, 'action-surge');
  clearCombatFlag(combat, characterId, 'bonus-action-used');
  clearCombatFlag(combat, characterId, 'disengaged-this-turn');
}

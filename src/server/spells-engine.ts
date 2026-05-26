// JSgame · Spells engine D&D 5e.
// Resolve player cast spell — verifica slot, gasta, aplica dmg/heal/condition.
// Server-side ONLY. Cliente espelha via combatEvent.

import type {
  CharacterSheet, CombatState, CombatEvent, ConditionId,
} from '../shared/types.js';
import type { SpellDef, SpellEffect } from '../dnd/spells.js';
import { getSpell, type SpellId } from '../dnd/spells.js';
import { getCastingAbilityMod, isSpellcaster } from '../dnd/spell-slots.js';
import { rollD20, rollNotation } from '../dnd/dice.js';
import { proficiencyBonus, abilityModifier } from '../dnd/attributes.js';

export interface CastSpellResult {
  ok: boolean;
  reason?: string;
  events: CombatEvent[];
  narration: string;
  spellName: string;
  damageTotal?: number;
  healTotal?: number;
}

export interface CastSpellInput {
  caster: CharacterSheet;
  spellId: SpellId;
  targetIds: string[];           // pode ser PJ id ou enemy id
  slotLevel: 0 | 1 | 2 | 3 | 4 | 5; // 0 = cantrip (não gasta)
  party: CharacterSheet[];
  combat: CombatState | null;
}

export function resolvePlayerCastSpell(input: CastSpellInput): CastSpellResult {
  const { caster, spellId, targetIds, slotLevel, party, combat } = input;

  const spell = getSpell(spellId);
  if (!spell) return fail(`Magia desconhecida: ${spellId}`);

  // 1. Caster precisa conhecer/preparar a magia
  if (!caster.spellsKnown.includes(spellId)) {
    return fail(`${caster.characterName} não conhece ${spell.name}`);
  }

  // 2. Caster precisa ser caster da classe certa
  if (!spell.classes.includes(caster.classId)) {
    return fail(`${spell.name} não é da classe ${caster.classId}`);
  }
  if (!isSpellcaster(caster.classId)) {
    return fail(`${caster.classId} não casta magias`);
  }

  // 3. Slot: cantrip não gasta. Outros precisam de slot >= spell.level.
  // F25 — Ritual exception: spell.ritual=true + fora de combate = sem slot.
  const isRitualCast = !!spell.ritual && !combat?.active;
  if (spell.level > 0 && !isRitualCast) {
    if (slotLevel < spell.level) {
      return fail(`Slot de nv ${slotLevel} insuficiente pra magia de nv ${spell.level}`);
    }
    if (slotLevel >= 1 && slotLevel <= 5) {
      const slot = caster.spellSlots[slotLevel as 1 | 2 | 3 | 4 | 5];
      if (!slot || slot.used >= slot.max) {
        return fail(`Sem slot de nv ${slotLevel} disponível`);
      }
      // Gasta
      slot.used += 1;
    } else {
      return fail(`Slot level ${slotLevel} inválido`);
    }
  }

  // 4. Aplica efeito
  const pb = proficiencyBonus(caster.level);
  const castingMod = getCastingAbilityMod(caster.classId, caster);
  const saveDC = 8 + pb + castingMod;

  const events: CombatEvent[] = [];
  let narration = '';
  let damageTotal = 0;
  let healTotal = 0;

  // F25 — Concentration: drop previous se for outra de concentration.
  if (spell.concentration) {
    if (caster.concentratingOn && caster.concentratingOn !== spellId) {
      const previous = caster.concentratingOn;
      events.push({
        type: 'condition-removed',
        sourceId: caster.id,
        targetId: caster.id,
        text: `${caster.characterName} quebra concentração em ${previous} pra lançar ${spell.name}.`,
      });
    }
    caster.concentratingOn = spellId;
  }

  // F25 — Upcasting: calcula dice escalada se slotLevel > spell.level e spell tem upcastDice.
  const upcastBonus = computeUpcastBonus(spell, slotLevel);

  switch (spell.effect.kind) {
    case 'damage':
      ({ narration, damageTotal } = applyDamageSpell(spell, spell.effect, caster, targetIds, party, combat, events, saveDC, upcastBonus));
      break;
    case 'heal':
      ({ narration, healTotal } = applyHealSpell(spell, spell.effect, caster, castingMod, targetIds, party, events, upcastBonus));
      break;
    case 'condition':
      narration = applyConditionSpell(spell, spell.effect, caster, targetIds, party, combat, events, saveDC);
      break;
    case 'buff':
      narration = `${caster.characterName} lança ${spell.name} — ${spell.effect.description}`;
      events.push({ type: 'spell-cast', sourceId: caster.id, text: narration });
      break;
    case 'utility':
      narration = `${caster.characterName} lança ${spell.name}${isRitualCast ? ' (ritual)' : ''}: ${spell.effect.description}`;
      events.push({ type: 'spell-cast', sourceId: caster.id, text: narration });
      break;
  }

  return {
    ok: true,
    events,
    narration,
    spellName: spell.name,
    damageTotal: damageTotal || undefined,
    healTotal: healTotal || undefined,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Aplicadores por tipo de efeito
// ════════════════════════════════════════════════════════════════════════════

function applyDamageSpell(
  spell: SpellDef,
  effect: Extract<SpellEffect, { kind: 'damage' }>,
  caster: CharacterSheet,
  targetIds: string[],
  party: CharacterSheet[],
  combat: CombatState | null,
  events: CombatEvent[],
  saveDC: number,
  upcastBonus = 0,
): { narration: string; damageTotal: number } {
  const parts: string[] = [];
  let damageTotal = 0;

  for (const tid of targetIds) {
    const enemyTarget = combat?.enemies.find((e) => e.id === tid && e.currentHp > 0);
    const playerTarget = party.find((p) => p.id === tid && p.currentHp > 0);
    if (!enemyTarget && !playerTarget) continue;

    const targetName = enemyTarget?.name ?? playerTarget!.characterName;
    const targetAc = enemyTarget?.armorClass ?? playerTarget!.armorClass;

    let dmg = 0;
    let outcome = '';

    if (effect.save) {
      // Save DC
      const targetAbilityMod = enemyTarget
        ? 0  // simplificação: enemy não tem ability scores no MVP
        : abilityModifier(playerTarget!.abilityScores[effect.save.ability]);
      const saveRoll = rollD20({ modifier: targetAbilityMod });
      const saved = saveRoll.total >= saveDC;
      const fullDmg = rollNotation(effect.dice);
      const fullDmgVal = (fullDmg?.total ?? 0) + upcastBonus;
      if (saved) {
        dmg = effect.save.halfOnSave ? Math.floor(fullDmgVal / 2) : 0;
        outcome = effect.save.halfOnSave ? `save ${saveRoll.total}≥${saveDC} → metade ${dmg}` : `save ${saveRoll.total}≥${saveDC} → nada`;
      } else {
        dmg = fullDmgVal;
        outcome = `save ${saveRoll.total}<${saveDC} → ${dmg}`;
      }
    } else {
      // Spell attack
      const pb = proficiencyBonus(caster.level);
      const castingMod = getCastingAbilityMod(caster.classId, caster);
      const attackRoll = rollD20({ modifier: pb + castingMod });
      const hit = attackRoll.nat20 || (!attackRoll.nat1 && attackRoll.total >= targetAc);
      if (hit) {
        const dmgRoll = rollNotation(effect.dice);
        dmg = (dmgRoll?.total ?? 0) + upcastBonus;
        outcome = `${attackRoll.total} vs CA ${targetAc} → HIT · ${dmg}`;
      } else {
        dmg = 0;
        outcome = `${attackRoll.total} vs CA ${targetAc} → MISS`;
      }
    }

    // Aplica dano
    if (dmg > 0) {
      if (enemyTarget) {
        enemyTarget.currentHp = Math.max(0, enemyTarget.currentHp - dmg);
        if (enemyTarget.currentHp === 0) {
          events.push({ type: 'death', targetId: enemyTarget.id, text: `${enemyTarget.name} cai.` });
        }
      } else if (playerTarget) {
        playerTarget.currentHp = Math.max(0, playerTarget.currentHp - dmg);
        if (playerTarget.currentHp === 0 && !playerTarget.conditions.includes('inconsciente')) {
          playerTarget.conditions.push('inconsciente');
          events.push({ type: 'condition-applied', targetId: playerTarget.id, conditionId: 'inconsciente', text: `${playerTarget.characterName} caiu.` });
        }
      }
    }

    damageTotal += dmg;
    parts.push(`${targetName} (${outcome})`);
    events.push({
      type: 'damage',
      sourceId: caster.id,
      targetId: tid,
      value: dmg,
      text: `${caster.characterName} → ${targetName}: ${dmg} ${effect.damageType}`,
    });
  }

  const narration = `${caster.characterName} lança ${spell.name}${effect.aoe ? ' (em área)' : ''}: ${parts.join(' · ')}`;
  if (combat) {
    combat.log.push(narration);
    if (combat.log.length > 50) combat.log = combat.log.slice(-50);
  }
  return { narration, damageTotal };
}

function applyHealSpell(
  spell: SpellDef,
  effect: Extract<SpellEffect, { kind: 'heal' }>,
  caster: CharacterSheet,
  castingMod: number,
  targetIds: string[],
  party: CharacterSheet[],
  events: CombatEvent[],
  upcastBonus = 0,
): { narration: string; healTotal: number } {
  let healTotal = 0;
  const parts: string[] = [];

  for (const tid of targetIds) {
    const target = party.find((p) => p.id === tid);
    if (!target) continue;
    // Revivify só funciona em PJs inconscientes; outras curas funcionam normal
    const baseRoll = rollNotation(effect.dice);
    let heal = (baseRoll?.total ?? 0) + upcastBonus;
    if (effect.bonusFromCastingMod) heal += castingMod;
    const oldHp = target.currentHp;
    target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
    const actual = target.currentHp - oldHp;
    // Cura traz de volta da inconsciência
    if (actual > 0 && target.conditions.includes('inconsciente')) {
      target.conditions = target.conditions.filter((c) => c !== 'inconsciente');
      events.push({ type: 'condition-removed', targetId: target.id, conditionId: 'inconsciente', text: `${target.characterName} desperta.` });
    }
    healTotal += actual;
    parts.push(`${target.characterName} +${actual}`);
    events.push({
      type: 'heal',
      sourceId: caster.id,
      targetId: tid,
      value: actual,
      text: `${caster.characterName} cura ${target.characterName}: +${actual} HP`,
    });
  }

  const narration = `${caster.characterName} lança ${spell.name}: ${parts.join(' · ')}`;
  return { narration, healTotal };
}

function applyConditionSpell(
  spell: SpellDef,
  effect: Extract<SpellEffect, { kind: 'condition' }>,
  caster: CharacterSheet,
  targetIds: string[],
  party: CharacterSheet[],
  combat: CombatState | null,
  events: CombatEvent[],
  saveDC: number,
): string {
  const parts: string[] = [];

  for (const tid of targetIds) {
    const enemyTarget = combat?.enemies.find((e) => e.id === tid && e.currentHp > 0);
    const playerTarget = party.find((p) => p.id === tid && p.currentHp > 0);
    if (!enemyTarget && !playerTarget) continue;
    const targetName = enemyTarget?.name ?? playerTarget!.characterName;

    let saved = false;
    if (effect.save) {
      const mod = enemyTarget
        ? 0
        : abilityModifier(playerTarget!.abilityScores[effect.save.ability]);
      const saveRoll = rollD20({ modifier: mod });
      saved = saveRoll.total >= saveDC;
      if (!saved) {
        applyCondition(enemyTarget, playerTarget, effect.condition);
        parts.push(`${targetName} (save ${saveRoll.total}<${saveDC} → ${effect.condition})`);
        events.push({ type: 'condition-applied', sourceId: caster.id, targetId: tid, conditionId: effect.condition, text: `${targetName} agora ${effect.condition}` });
      } else {
        parts.push(`${targetName} (save ${saveRoll.total}≥${saveDC} → resiste)`);
      }
    } else {
      // Sem save — aplica direto
      applyCondition(enemyTarget, playerTarget, effect.condition);
      parts.push(`${targetName} → ${effect.condition}`);
      events.push({ type: 'condition-applied', sourceId: caster.id, targetId: tid, conditionId: effect.condition, text: `${targetName} agora ${effect.condition}` });
    }
  }

  return `${caster.characterName} lança ${spell.name}: ${parts.join(' · ')}`;
}

function applyCondition(
  enemyTarget: CombatState['enemies'][number] | undefined,
  playerTarget: CharacterSheet | undefined,
  condition: ConditionId,
): void {
  if (enemyTarget) {
    if (!enemyTarget.conditions.includes(condition)) enemyTarget.conditions.push(condition);
  } else if (playerTarget) {
    if (!playerTarget.conditions.includes(condition)) playerTarget.conditions.push(condition);
  }
}

function fail(reason: string): CastSpellResult {
  return {
    ok: false,
    reason,
    events: [],
    narration: '',
    spellName: '',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// F25 — Upcasting helper. Rolla N extra dice por slot acima do base.
// Ex: Magic Missile lv 1 + slot 3 → upcastDice='1d4' + delta 2 slots = +2d4.
// ════════════════════════════════════════════════════════════════════════════

export function computeUpcastBonus(spell: SpellDef, slotLevel: number): number {
  if (!spell.upcastDice || spell.level <= 0) return 0;
  const delta = slotLevel - spell.level;
  if (delta <= 0) return 0;
  // Roll N extra dice
  const parsed = parseDice(spell.upcastDice);
  if (!parsed) return 0;
  const totalCount = parsed.count * delta;
  const roll = rollNotation(`${totalCount}d${parsed.kind}`);
  return roll?.total ?? 0;
}

function parseDice(s: string): { count: number; kind: number } | null {
  const m = s.match(/^(\d+)d(\d+)$/i);
  if (!m) return null;
  return { count: parseInt(m[1]!, 10), kind: parseInt(m[2]!, 10) };
}

// ════════════════════════════════════════════════════════════════════════════
// F25 — Concentration enforce on damage.
// PHB pág 203: ao receber dano, save CON DC max(10, dmg/2). Falha = drop.
// Chamado por combat.ts dentro de resolveEnemyTurn ANTES de aplicar dmg.
// ════════════════════════════════════════════════════════════════════════════

export function tryBreakConcentration(
  target: CharacterSheet,
  damageReceived: number,
): { broken: boolean; rollTotal: number; dc: number; spellDropped: string | null } {
  if (!target.concentratingOn) return { broken: false, rollTotal: 0, dc: 0, spellDropped: null };
  if (damageReceived <= 0) return { broken: false, rollTotal: 0, dc: 0, spellDropped: null };
  const dc = Math.max(10, Math.floor(damageReceived / 2));
  const conMod = abilityModifier(target.abilityScores.con);
  const proficient = target.proficientSavingThrows.includes('con');
  const pb = proficient ? proficiencyBonus(target.level) : 0;
  const roll = rollD20({ modifier: conMod + pb });
  if (roll.total < dc) {
    const dropped = target.concentratingOn;
    target.concentratingOn = null;
    return { broken: true, rollTotal: roll.total, dc, spellDropped: dropped };
  }
  return { broken: false, rollTotal: roll.total, dc, spellDropped: null };
}

// Inconsciência quebra concentração (PHB pág 203).
export function dropConcentrationIfUnconscious(target: CharacterSheet): boolean {
  if (target.concentratingOn && target.conditions.includes('inconsciente')) {
    target.concentratingOn = null;
    return true;
  }
  return false;
}

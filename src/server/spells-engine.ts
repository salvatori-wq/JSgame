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
  if (spell.level > 0) {
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

  switch (spell.effect.kind) {
    case 'damage':
      ({ narration, damageTotal } = applyDamageSpell(spell, spell.effect, caster, targetIds, party, combat, events, saveDC));
      break;
    case 'heal':
      ({ narration, healTotal } = applyHealSpell(spell, spell.effect, caster, castingMod, targetIds, party, events));
      break;
    case 'condition':
      narration = applyConditionSpell(spell, spell.effect, caster, targetIds, party, combat, events, saveDC);
      break;
    case 'buff':
      narration = `${caster.characterName} lança ${spell.name} — ${spell.effect.description}`;
      events.push({ type: 'spell-cast', sourceId: caster.id, text: narration });
      break;
    case 'utility':
      narration = `${caster.characterName} lança ${spell.name}: ${spell.effect.description}`;
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
      const fullDmgVal = fullDmg?.total ?? 0;
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
        dmg = dmgRoll?.total ?? 0;
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
): { narration: string; healTotal: number } {
  let healTotal = 0;
  const parts: string[] = [];

  for (const tid of targetIds) {
    const target = party.find((p) => p.id === tid);
    if (!target) continue;
    // Revivify só funciona em PJs inconscientes; outras curas funcionam normal
    const baseRoll = rollNotation(effect.dice);
    let heal = baseRoll?.total ?? 0;
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

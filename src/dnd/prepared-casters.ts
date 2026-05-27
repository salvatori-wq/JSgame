// JSgame · η.5 — Prepared Casters helpers (PHB).
// Mago/Clérigo/Druida/Paladino precisam PREPARAR magias do spellbook/known list
// pós long rest. Limite = ability mod casting + nv classe.
// Bruxo/Feiticeiro/Bardo: known = prepared (sem step de seleção).
// Cantrips sempre preparados (não contam no limit).

import type { ClassId } from './classes.js';
import type { CharacterSheet } from '../shared/types.js';
import { abilityModifier } from './attributes.js';
import { getSpell, type SpellId } from './spells.js';

const PREPARED_CASTERS: ReadonlyArray<ClassId> = ['mago', 'clerigo', 'druida', 'paladino'];

/** True se a classe precisa preparar magias (vs known=prepared). */
export function isPreparedCaster(classId: ClassId): boolean {
  return PREPARED_CASTERS.includes(classId);
}

/**
 * Limite de magias preparadas (PHB):
 *   Mago: INT mod + nv mago
 *   Clérigo/Druida: WIS mod + nv
 *   Paladino: CHA mod + (nv / 2)
 *   Outros: Infinity (não usa esse limite)
 * Mínimo 1.
 */
export function getPreparedLimit(sheet: CharacterSheet): number {
  const lvl = sheet.level;
  const ab = sheet.abilityScores;
  switch (sheet.classId) {
    case 'mago': return Math.max(1, abilityModifier(ab.int) + lvl);
    case 'clerigo':
    case 'druida': return Math.max(1, abilityModifier(ab.sab) + lvl);
    case 'paladino': return Math.max(1, abilityModifier(ab.car) + Math.floor(lvl / 2));
    default: return Number.POSITIVE_INFINITY;
  }
}

/** Lista de cantrips (level 0) do caster — sempre preparados. */
export function getCantripsKnown(sheet: CharacterSheet): SpellId[] {
  return sheet.spellsKnown.filter((id) => {
    const spell = getSpell(id as SpellId);
    return spell?.level === 0;
  }) as SpellId[];
}

/** Lista de magias preparáveis (level >= 1) do spellsKnown. */
export function getPreparableSpells(sheet: CharacterSheet): SpellId[] {
  return sheet.spellsKnown.filter((id) => {
    const spell = getSpell(id as SpellId);
    return spell && spell.level >= 1;
  }) as SpellId[];
}

/**
 * Check se uma magia está pronta pra ser conjurada (preparada ou cantrip).
 * Bruxo/Feiticeiro/Bardo: spellsKnown.includes() basta.
 * Mago/Clérigo/Druida/Paladin: deve estar em spellsPrepared (ou cantrip).
 */
export function canCastSpell(sheet: CharacterSheet, spellId: SpellId): boolean {
  if (!sheet.spellsKnown.includes(spellId)) return false;
  const spell = getSpell(spellId);
  if (!spell) return false;
  if (spell.level === 0) return true; // cantrip sempre
  if (!isPreparedCaster(sheet.classId)) return true; // bruxo/sorcerer/bardo
  return sheet.spellsPrepared.includes(spellId);
}

/**
 * Inicializa spellsPrepared automaticamente pra preparedCasters em criação/migration.
 * Preenche até o limit com as primeiras magias conhecidas (não-cantrips).
 * Idempotente — se já tem prepared, não muta.
 */
export function autoFillPreparedSpells(sheet: CharacterSheet): void {
  if (!isPreparedCaster(sheet.classId)) return;
  if (sheet.spellsPrepared.length > 0) return;
  const preparable = getPreparableSpells(sheet);
  const limit = getPreparedLimit(sheet);
  const cap = Math.min(limit, preparable.length);
  sheet.spellsPrepared = preparable.slice(0, cap);
}

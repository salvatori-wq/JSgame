// JSgame · D&D 5e spell slots por classe/nível (PHB pág 113).
// BUG-004 fix (2026-05-26): tabela expandida pra nv 1-20 conforme PHB.
// Antes só ia até nv 5 — PJ Mago nv 11 não tinha slot pra Fireball (nv 3 já
// disponível desde nv 5) ou higher levels.

import type { ClassId } from './classes';
import type { CharacterSheet } from '../shared/types';
import type { SpellId } from './spells';
import { spellsForClass } from './spells';

export type SpellSlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type SlotsByLevel = Record<SpellSlotLevel, { max: number; used: number }>;
type LevelSlotMap = Partial<Record<SpellSlotLevel, number>>;

// PHB pág 113 — Full casters (Bardo, Clérigo, Druida, Feiticeiro, Mago)
// usam EXATAMENTE a mesma tabela. Extraído pra evitar duplicação.
const FULL_CASTER_SLOTS: Record<number, LevelSlotMap> = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

// Half casters (Paladino, Patrulheiro) — começam nv 2, max nv 5 slots.
const HALF_CASTER_SLOTS: Record<number, LevelSlotMap> = {
  1:  {},
  2:  { 1: 2 },
  3:  { 1: 3 },
  4:  { 1: 3 },
  5:  { 1: 4, 2: 2 },
  6:  { 1: 4, 2: 2 },
  7:  { 1: 4, 2: 3 },
  8:  { 1: 4, 2: 3 },
  9:  { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

// Pact Magic (Bruxo) — poucos slots mas REGENERAM EM SHORT REST (PHB pág 107).
// Todos slots na MESMA spell-level (não escalonado tipo full caster).
// BUG-005 (short rest regen) endereçado em Sprint 4 — aqui só completa tabela.
const PACT_MAGIC_SLOTS: Record<number, LevelSlotMap> = {
  1:  { 1: 1 },
  2:  { 1: 2 },
  3:  { 2: 2 },
  4:  { 2: 2 },
  5:  { 3: 2 },
  6:  { 3: 2 },
  7:  { 4: 2 },
  8:  { 4: 2 },
  9:  { 5: 2 },
  10: { 5: 2 },
  11: { 5: 3 },
  12: { 5: 3 },
  13: { 5: 3 },
  14: { 5: 3 },
  15: { 5: 3 },
  16: { 5: 3 },
  17: { 5: 4 },
  18: { 5: 4 },
  19: { 5: 4 },
  20: { 5: 4 },
};

const SPELL_SLOTS_TABLE: Partial<Record<ClassId, Record<number, LevelSlotMap>>> = {
  bardo:       FULL_CASTER_SLOTS,
  clerigo:     FULL_CASTER_SLOTS,
  druida:      FULL_CASTER_SLOTS,
  feiticeiro:  FULL_CASTER_SLOTS,
  mago:        FULL_CASTER_SLOTS,
  bruxo:       PACT_MAGIC_SLOTS,
  paladino:    HALF_CASTER_SLOTS,
  patrulheiro: HALF_CASTER_SLOTS,
  // Non-casters (omitidos): barbaro, guerreiro, ladino, monge
};

// Cantrips conhecidos no nv 1
const STARTING_CANTRIPS: Partial<Record<ClassId, number>> = {
  bardo: 2,
  bruxo: 2,
  clerigo: 3,
  druida: 2,
  feiticeiro: 4,
  mago: 3,
};

export function getStartingSlots(classId: ClassId, level: number): SlotsByLevel {
  const empty: SlotsByLevel = {
    1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
    4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
    7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
  };
  const classTable = SPELL_SLOTS_TABLE[classId];
  if (!classTable) return empty;
  // Clamp level entre 1-20 (PHB cap). PJ "nv 25" via debug ainda usa tabela do nv 20.
  const effectiveLevel = Math.max(1, Math.min(20, level));
  const levelTable = classTable[effectiveLevel] ?? {};
  for (const [k, v] of Object.entries(levelTable)) {
    const slotLvl = Number(k) as SpellSlotLevel;
    if (slotLvl >= 1 && slotLvl <= 9) {
      empty[slotLvl] = { max: v ?? 0, used: 0 };
    }
  }
  return empty;
}

export function getStartingCantripCount(classId: ClassId): number {
  return STARTING_CANTRIPS[classId] ?? 0;
}

// Preenche o sheet com spell slots iniciais, cantrips e algumas magias do nv 1.
// Pra MVP, escolhe as mais úteis automaticamente — depois F5.1d permite player escolher.
export function applySpellcasterDefaults(sheet: CharacterSheet): void {
  sheet.spellSlots = getStartingSlots(sheet.classId, sheet.level);
  const cantripCount = getStartingCantripCount(sheet.classId);
  if (cantripCount === 0 && !SPELL_SLOTS_TABLE[sheet.classId]) return; // não é caster

  // Pega magias da classe, prioriza recomendadas hardcoded por classe
  const RECOMMENDED: Partial<Record<ClassId, SpellId[]>> = {
    mago:       ['fire-bolt', 'mage-hand', 'light', 'magic-missile', 'shield', 'mage-armor', 'burning-hands', 'sleep'],
    feiticeiro: ['fire-bolt', 'mage-hand', 'light', 'prestidigitation', 'magic-missile', 'burning-hands', 'shield'],
    clerigo:    ['sacred-flame', 'guidance', 'light', 'cure-wounds', 'healing-word', 'bless', 'shield-of-faith'],
    druida:     ['guidance', 'resistance', 'cure-wounds', 'thunderwave', 'faerie-fire'],
    bardo:      ['vicious-mockery', 'prestidigitation', 'healing-word', 'faerie-fire', 'charm-person', 'sleep'],
    bruxo:      ['eldritch-blast', 'mage-hand', 'charm-person', 'sleep'],
    paladino:   ['bless', 'cure-wounds', 'shield-of-faith'],
    patrulheiro: ['cure-wounds'],
  };

  const classSpells = spellsForClass(sheet.classId, 3).map((s) => s.id);
  const recommended = RECOMMENDED[sheet.classId] ?? [];

  // Filtra recomendadas que existem pra classe
  const validRecommended = recommended.filter((id) => classSpells.includes(id));

  const cantripsOfClass = validRecommended.filter((id) => {
    const s = spellsForClass(sheet.classId).find((sp) => sp.id === id);
    return s?.level === 0;
  });
  const spellsLvl1 = validRecommended.filter((id) => {
    const s = spellsForClass(sheet.classId).find((sp) => sp.id === id);
    return s?.level === 1;
  });

  // Adiciona N cantrips
  const cantripsKnown = cantripsOfClass.slice(0, cantripCount);

  // Magias de nv 1 — pelo menos as recomendadas que tiver slot pra usar
  const slotsLvl1 = sheet.spellSlots[1]?.max ?? 0;
  const spellsKnown = slotsLvl1 > 0 ? spellsLvl1.slice(0, 4) : [];

  sheet.spellsKnown = [...cantripsKnown, ...spellsKnown];
  // Pra MVP: tudo conhecido também está preparado
  sheet.spellsPrepared = [...sheet.spellsKnown];
}

// Calcula ability modifier do casting attribute pra essa classe.
// Útil pra spell DC e bonus de attack.
export function getCastingAbilityMod(classId: ClassId, sheet: CharacterSheet): number {
  const CASTING_ABILITY: Partial<Record<ClassId, 'int' | 'sab' | 'car'>> = {
    bardo: 'car',
    bruxo: 'car',
    clerigo: 'sab',
    druida: 'sab',
    feiticeiro: 'car',
    mago: 'int',
    paladino: 'car',
    patrulheiro: 'sab',
  };
  const ability = CASTING_ABILITY[classId];
  if (!ability) return 0;
  return Math.floor((sheet.abilityScores[ability] - 10) / 2);
}

// Restaura slots no long rest (utilitário pra F5.2 rest).
export function restoreAllSlots(sheet: CharacterSheet): void {
  const levels: Array<keyof typeof sheet.spellSlots> = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const k of levels) {
    sheet.spellSlots[k].used = 0;
  }
}

// Lista classes que castam magia.
export function isSpellcaster(classId: ClassId): boolean {
  return classId in SPELL_SLOTS_TABLE;
}

// BUG-005 / Sprint 4 helper: marca classes que usam pact magic (regen em short rest).
// Atualmente só Bruxo. Multiclasse Mago/Bruxo tem slots separados (PHB pág 165).
export function isPactMagicClass(classId: ClassId): boolean {
  return classId === 'bruxo';
}

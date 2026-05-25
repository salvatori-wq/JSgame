// JSgame · D&D 5e spell slots por classe/nível (PHB cap 3).
// Tabela só até nv 5 (foco do MVP). Slots > nv 3 ficam zerados — caster ainda
// não tem magias daquele nível anyway.

import type { ClassId } from './classes';
import type { CharacterSheet } from '../shared/types';
import type { SpellId } from './spells';
import { spellsForClass } from './spells';

type SlotsByLevel = Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, { max: number; used: number }>;

// Tabela: classe → nível → { slots por nível de magia }
// 0 = não casta nesse spell-level. Empty = 0.
const SPELL_SLOTS_TABLE: Partial<Record<ClassId, Record<number, Partial<Record<1 | 2 | 3 | 4 | 5, number>>>>> = {
  // Full casters
  bardo: {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
  },
  clerigo: {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
  },
  druida: {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
  },
  feiticeiro: {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
  },
  mago: {
    1: { 1: 2 },
    2: { 1: 3 },
    3: { 1: 4, 2: 2 },
    4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 },
  },
  // Pact magic (Bruxo): poucos slots mas regeneram em short rest.
  // Simplificação MVP: trata como casters de slots normais (regen vai em F5.2 rest).
  bruxo: {
    1: { 1: 1 },
    2: { 1: 2 },
    3: { 2: 2 },
    4: { 2: 2 },
    5: { 3: 2 },
  },
  // Half casters: começam a castar no nv 2
  paladino: {
    1: {},
    2: { 1: 2 },
    3: { 1: 3 },
    4: { 1: 3 },
    5: { 1: 4, 2: 2 },
  },
  patrulheiro: {
    1: {},
    2: { 1: 2 },
    3: { 1: 3 },
    4: { 1: 3 },
    5: { 1: 4, 2: 2 },
  },
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
  const levelTable = classTable[level] ?? classTable[1] ?? {};
  for (const [k, v] of Object.entries(levelTable)) {
    const slotLvl = Number(k) as 1 | 2 | 3 | 4 | 5;
    if (slotLvl >= 1 && slotLvl <= 5) {
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

// Sprint X.B1 — Tests pro target-sheet feature chips.

import { describe, it, expect } from 'vitest';
import { buildTargetSheetFeatureChips, TARGET_SHEET_FEATURES } from '../combat-target-sheet';
import type { CharacterSheet } from '../../../shared/types';

const baseChar = (overrides: Partial<CharacterSheet> = {}): CharacterSheet => ({
  id: 'pc-1',
  ownerId: 'o',
  raceId: 'human',
  classId: 'fighter',
  characterName: 'Borin',
  level: 5,
  xp: 0,
  armorClass: 16,
  currentHp: 40,
  maxHp: 40,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
  savingThrows: {},
  proficientSkills: [],
  conditions: [],
  inventory: [],
  proficiencyBonus: 3,
  speed: 30,
  spellSlots: {},
  abilityScoreIncreases: 0,
  feats: [],
  proficiencies: [],
  classFeatureUses: {},
  ...overrides,
} as unknown as CharacterSheet);

describe('TARGET_SHEET_FEATURES — X.B1 whitelist (sem bardic, target-free)', () => {
  it('inclui rage / action-surge / second-wind / channel-divinity / ki / wild-shape', () => {
    expect(TARGET_SHEET_FEATURES.has('rage')).toBe(true);
    expect(TARGET_SHEET_FEATURES.has('action-surge')).toBe(true);
    expect(TARGET_SHEET_FEATURES.has('second-wind')).toBe(true);
    expect(TARGET_SHEET_FEATURES.has('channel-divinity')).toBe(true);
    expect(TARGET_SHEET_FEATURES.has('ki')).toBe(true);
    expect(TARGET_SHEET_FEATURES.has('wild-shape')).toBe(true);
  });

  it('EXCLUI bardic-inspiration (requer picker de target)', () => {
    expect(TARGET_SHEET_FEATURES.has('bardic-inspiration')).toBe(false);
  });
});

describe('buildTargetSheetFeatureChips — X.B1 chips no sheet', () => {
  it('fighter nv 5 com action-surge disponível mostra chip', () => {
    const char = baseChar({
      classId: 'guerreiro',
      level: 5,
      classFeatureUses: { 'action-surge': { used: 0, max: 1 }, 'second-wind': { used: 0, max: 1 } },
    });
    const chips = buildTargetSheetFeatureChips(char);
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.some((c) => c.key === 'action-surge')).toBe(true);
    expect(chips.some((c) => c.key === 'second-wind')).toBe(true);
  });

  it('feature exhausted (used >= max) NÃO aparece', () => {
    const char = baseChar({
      classId: 'guerreiro',
      level: 2,
      classFeatureUses: { 'action-surge': { used: 1, max: 1 } },
    });
    const chips = buildTargetSheetFeatureChips(char);
    expect(chips.some((c) => c.key === 'action-surge')).toBe(false);
  });

  it('bárbaro com rage disponível mostra chip', () => {
    const char = baseChar({
      classId: 'barbaro',
      level: 1,
      classFeatureUses: { rage: { used: 0, max: 2 } },
    });
    const chips = buildTargetSheetFeatureChips(char);
    expect(chips.some((c) => c.key === 'rage')).toBe(true);
    const rage = chips.find((c) => c.key === 'rage');
    expect(rage?.usesLabel).toBe('2/2');
  });

  it('bardo NÃO mostra bardic-inspiration no sheet (whitelist exclude)', () => {
    const char = baseChar({
      classId: 'bardo',
      level: 1,
      classFeatureUses: { 'bardic-inspiration': { used: 0, max: 3 } },
    });
    const chips = buildTargetSheetFeatureChips(char);
    expect(chips.some((c) => c.key === 'bardic-inspiration')).toBe(false);
  });

  it('classe sem features (mago) retorna lista vazia', () => {
    const char = baseChar({ classId: 'mago', level: 5 });
    const chips = buildTargetSheetFeatureChips(char);
    expect(chips).toEqual([]);
  });

  it('uses 999 mostra "∞" no label', () => {
    const char = baseChar({
      classId: 'barbaro',
      level: 20, // bárbaro 20 = rage unlimited
      classFeatureUses: { rage: { used: 0, max: 999 } },
    });
    const chips = buildTargetSheetFeatureChips(char);
    const rage = chips.find((c) => c.key === 'rage');
    expect(rage?.usesLabel).toBe('∞');
  });
});

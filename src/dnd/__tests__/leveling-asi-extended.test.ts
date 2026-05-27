// η.3 — Tests ASI/Feat estendido pra nv 8/12/16/19.

import { describe, it, expect } from 'vitest';
import { getAsiLevels, isAsiLevel, migratePlannedAsiChoices, applyAsiChoice, applyLevelUpsIfDue, XP_FOR_LEVEL } from '../leveling';
import type { CharacterSheet } from '../../shared/types';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'pc-1',
    ownerName: 'p',
    characterName: 'Borin',
    raceId: 'humano',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: 1, xp: 0,
    abilityScoresBase: { for: 14, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    abilityScores: { for: 14, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 14,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [],
    backstory: '', createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...overrides,
  };
}

describe('getAsiLevels η.3', () => {
  it('default (mago/clerigo/etc) = 4/8/12/16/19', () => {
    expect(getAsiLevels('mago')).toEqual([4, 8, 12, 16, 19]);
    expect(getAsiLevels('clerigo')).toEqual([4, 8, 12, 16, 19]);
  });

  it('Fighter = 4/6/8/12/14/16/19', () => {
    expect(getAsiLevels('guerreiro')).toEqual([4, 6, 8, 12, 14, 16, 19]);
  });

  it('Rogue = 4/8/10/12/16/19', () => {
    expect(getAsiLevels('ladino')).toEqual([4, 8, 10, 12, 16, 19]);
  });

  it('isAsiLevel detecta corretamente', () => {
    expect(isAsiLevel('guerreiro', 6)).toBe(true);
    expect(isAsiLevel('mago', 6)).toBe(false);
    expect(isAsiLevel('ladino', 10)).toBe(true);
    expect(isAsiLevel('mago', 8)).toBe(true);
  });
});

describe('migratePlannedAsiChoices η.3', () => {
  it('migra plannedLevel4Choice legacy → plannedAsiChoices[4]', () => {
    const s = makeSheet({
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'con' },
    });
    migratePlannedAsiChoices(s);
    expect(s.plannedAsiChoices?.[4]).toEqual({ kind: 'asi', plusTwo: 'for', plusOne: 'con' });
  });

  it('idempotente — não migra 2x se já tem plannedAsiChoices', () => {
    const s = makeSheet({
      plannedAsiChoices: { 8: { kind: 'feat', featId: 'alert' } },
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'con' },
    });
    migratePlannedAsiChoices(s);
    expect(s.plannedAsiChoices?.[4]).toBeUndefined();
    expect(s.plannedAsiChoices?.[8]).toEqual({ kind: 'feat', featId: 'alert' });
  });

  it('sem legacy = inicializa empty', () => {
    const s = makeSheet({ plannedLevel4Choice: null });
    migratePlannedAsiChoices(s);
    expect(s.plannedAsiChoices).toEqual({});
  });
});

describe('applyAsiChoice η.3', () => {
  it('ASI +2/+1 aplica corretamente', () => {
    const s = makeSheet({
      abilityScores: { ...makeSheet().abilityScores, for: 14, con: 14 },
    });
    applyAsiChoice(s, { kind: 'asi', plusTwo: 'for', plusOne: 'con' });
    expect(s.abilityScores.for).toBe(16);
    expect(s.abilityScores.con).toBe(15);
  });

  it('Feat aplica via engine', () => {
    const s = makeSheet();
    applyAsiChoice(s, { kind: 'feat', featId: 'alert' });
    expect(s.featsOwned).toContain('alert');
  });
});

describe('Level-up engine η.3', () => {
  it('Mago nv 4 com ASI planejado → aplica + remove de plannedAsiChoices', () => {
    const s = makeSheet({
      classId: 'mago',
      level: 3,
      xp: XP_FOR_LEVEL[4]!,
      abilityScores: { ...makeSheet().abilityScores, int: 14 },
      abilityScoresBase: { ...makeSheet().abilityScoresBase, int: 14 },
      plannedAsiChoices: { 4: { kind: 'asi', plusTwo: 'int', plusOne: 'con' } },
    });
    const results = applyLevelUpsIfDue(s);
    expect(results.length).toBe(1);
    expect(s.level).toBe(4);
    expect(s.abilityScores.int).toBe(16);
    expect(s.plannedAsiChoices?.[4]).toBeUndefined();
  });

  it('Sem plan → marca pendingAsiChoiceLevels', () => {
    const s = makeSheet({
      classId: 'mago',
      level: 3,
      xp: XP_FOR_LEVEL[4]!,
    });
    applyLevelUpsIfDue(s);
    expect(s.pendingAsiChoiceLevels).toContain(4);
  });

  it('Fighter sobe 5→6 (ASI extra) marca pending se sem plan', () => {
    const s = makeSheet({
      classId: 'guerreiro',
      level: 5,
      xp: XP_FOR_LEVEL[6]!,
    });
    applyLevelUpsIfDue(s);
    expect(s.pendingAsiChoiceLevels).toContain(6);
  });

  it('Mago não tem ASI em 6 (only Fighter)', () => {
    const s = makeSheet({
      classId: 'mago',
      level: 5,
      xp: XP_FOR_LEVEL[6]!,
    });
    applyLevelUpsIfDue(s);
    expect(s.pendingAsiChoiceLevels ?? []).not.toContain(6);
  });

  it('Migration acontece on-the-fly em level-up', () => {
    const s = makeSheet({
      classId: 'mago',
      level: 3,
      xp: XP_FOR_LEVEL[4]!,
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'int', plusOne: 'con' },
      // sem plannedAsiChoices — deve migrar
    });
    applyLevelUpsIfDue(s);
    expect(s.level).toBe(4);
    // ASI aplicado (mesmo via legacy)
    expect(s.abilityScoresBase.int).toBeGreaterThan(makeSheet().abilityScoresBase.int);
  });
});

// η.5 — Tests Prepared Casters.

import { describe, it, expect } from 'vitest';
import {
  isPreparedCaster, getPreparedLimit, canCastSpell, autoFillPreparedSpells,
  getCantripsKnown, getPreparableSpells,
} from '../prepared-casters';
import type { CharacterSheet } from '../../shared/types';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'pc-1', ownerName: 'p', characterName: 'Lyra',
    raceId: 'alto-elfo', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 5, xp: 6500,
    abilityScoresBase: { for: 8, des: 12, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 12, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 25, currentHp: 25, tempHp: 0, hitDiceRemaining: 5, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: ['raio-de-fogo' as any, 'curar-ferimentos' as any, 'magic-missile' as any, 'fire-bolt' as any],
    spellsPrepared: [],
    spellSlots: {
      1: { max: 3, used: 0 }, 2: { max: 2, used: 0 }, 3: { max: 1, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [],
    backstory: '', createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...overrides,
  };
}

describe('isPreparedCaster η.5', () => {
  it('Mago/Clérigo/Druida/Paladino = true', () => {
    expect(isPreparedCaster('mago')).toBe(true);
    expect(isPreparedCaster('clerigo')).toBe(true);
    expect(isPreparedCaster('druida')).toBe(true);
    expect(isPreparedCaster('paladino')).toBe(true);
  });

  it('Bruxo/Feiticeiro/Bardo = false', () => {
    expect(isPreparedCaster('bruxo')).toBe(false);
    expect(isPreparedCaster('feiticeiro')).toBe(false);
    expect(isPreparedCaster('bardo')).toBe(false);
  });

  it('Não-casters = false', () => {
    expect(isPreparedCaster('guerreiro')).toBe(false);
    expect(isPreparedCaster('barbaro')).toBe(false);
  });
});

describe('getPreparedLimit η.5', () => {
  it('Mago nv 5 INT 16 = mod 3 + 5 = 8', () => {
    const s = makeSheet();
    expect(getPreparedLimit(s)).toBe(8);
  });

  it('Clérigo nv 3 WIS 14 = mod 2 + 3 = 5', () => {
    const s = makeSheet({ classId: 'clerigo', level: 3, abilityScores: { ...makeSheet().abilityScores, sab: 14 } });
    expect(getPreparedLimit(s)).toBe(5);
  });

  it('Paladino nv 5 CHA 14 = mod 2 + 2 = 4', () => {
    const s = makeSheet({ classId: 'paladino', level: 5, abilityScores: { ...makeSheet().abilityScores, car: 14 } });
    expect(getPreparedLimit(s)).toBe(4);
  });

  it('mínimo 1 mesmo com mod negativo', () => {
    const s = makeSheet({ level: 1, abilityScores: { ...makeSheet().abilityScores, int: 8 } });
    expect(getPreparedLimit(s)).toBe(Math.max(1, -1 + 1)); // 1
  });

  it('Não-prepared caster = Infinity', () => {
    const s = makeSheet({ classId: 'bruxo' });
    expect(getPreparedLimit(s)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('canCastSpell η.5', () => {
  it('Bruxo: known + qualquer level = OK (não exige prepared)', () => {
    const s = makeSheet({ classId: 'bruxo', spellsPrepared: [], spellsKnown: ['magic-missile' as any] });
    expect(canCastSpell(s, 'magic-missile' as any)).toBe(true);
  });

  it('Mago: spell preparada = OK', () => {
    const s = makeSheet({ spellsPrepared: ['magic-missile' as any], spellsKnown: ['magic-missile' as any] });
    expect(canCastSpell(s, 'magic-missile' as any)).toBe(true);
  });

  it('Mago: spell NÃO preparada = false', () => {
    const s = makeSheet({ spellsPrepared: [], spellsKnown: ['magic-missile' as any] });
    expect(canCastSpell(s, 'magic-missile' as any)).toBe(false);
  });

  it('spell desconhecida = false', () => {
    const s = makeSheet();
    expect(canCastSpell(s, 'inexistente' as any)).toBe(false);
  });
});

describe('autoFillPreparedSpells η.5', () => {
  it('Mago sem prepared: preenche até limit', () => {
    const s = makeSheet({ spellsPrepared: [], level: 5 });
    autoFillPreparedSpells(s);
    expect(s.spellsPrepared.length).toBeGreaterThan(0);
    expect(s.spellsPrepared.length).toBeLessThanOrEqual(getPreparedLimit(s));
  });

  it('Idempotente — não muta se já tem prepared', () => {
    const s = makeSheet({ spellsPrepared: ['magic-missile' as any] });
    autoFillPreparedSpells(s);
    expect(s.spellsPrepared).toEqual(['magic-missile']);
  });

  it('Não-prepared caster: não muta', () => {
    const s = makeSheet({ classId: 'bruxo', spellsPrepared: [] });
    autoFillPreparedSpells(s);
    expect(s.spellsPrepared).toEqual([]);
  });
});

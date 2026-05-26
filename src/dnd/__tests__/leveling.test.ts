// Tests da matemática F16 — XP + level-up.
// Cobre tabelas PHB, level computation, slot progression e level-up aplicado.

import { describe, it, expect } from 'vitest';
import {
  xpForCR, levelFromXp, xpToNextLevel, xpProgressInLevel,
  divideXpForParty, applyLevelUpsIfDue, awardXpToParty,
  applySpellSlotProgression, totalXpFromKills,
  CR_TO_XP, XP_FOR_LEVEL, MAX_LEVEL,
} from '../leveling';
import type { CharacterSheet } from '../../shared/types';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  const base: CharacterSheet = {
    id: 'pj-1', ownerName: 'João', characterName: 'Borin',
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: ['Comum'], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [],
    inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
  return { ...base, ...overrides };
}

describe('xpForCR — tabela PHB pág 275', () => {
  it('mapeia CRs fracionários corretamente', () => {
    expect(xpForCR(0)).toBe(10);
    expect(xpForCR(0.125)).toBe(25);
    expect(xpForCR(0.25)).toBe(50);
    expect(xpForCR(0.5)).toBe(100);
  });

  it('mapeia CRs inteiros até CR 10', () => {
    expect(xpForCR(1)).toBe(200);
    expect(xpForCR(5)).toBe(1800);
    expect(xpForCR(10)).toBe(5900);
  });

  it('mapeia CRs altos', () => {
    expect(xpForCR(20)).toBe(25000);
    expect(xpForCR(24)).toBe(62000);
  });

  it('CR desconhecido cai pro default 10', () => {
    expect(xpForCR(99 as unknown as 0)).toBe(10);
  });
});

describe('levelFromXp — PHB pág 15', () => {
  it('xp=0 → nv 1', () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it('xp negativo → nv 1 (defensivo)', () => {
    expect(levelFromXp(-100)).toBe(1);
  });

  it('threshold exato sobe', () => {
    expect(levelFromXp(300)).toBe(2);
    expect(levelFromXp(900)).toBe(3);
    expect(levelFromXp(2700)).toBe(4);
    expect(levelFromXp(6500)).toBe(5);
  });

  it('xp pouco abaixo do threshold fica no nível anterior', () => {
    expect(levelFromXp(299)).toBe(1);
    expect(levelFromXp(2699)).toBe(3);
  });

  it('cap em nv 20', () => {
    expect(levelFromXp(355000)).toBe(20);
    expect(levelFromXp(999999)).toBe(20);
  });
});

describe('xpToNextLevel', () => {
  it('calcula diferença pro próximo nível', () => {
    expect(xpToNextLevel(0, 1)).toBe(300);
    expect(xpToNextLevel(100, 1)).toBe(200);
    expect(xpToNextLevel(300, 2)).toBe(600);
  });

  it('retorna 0 em max level', () => {
    expect(xpToNextLevel(355000, MAX_LEVEL)).toBe(0);
    expect(xpToNextLevel(999999, MAX_LEVEL)).toBe(0);
  });
});

describe('xpProgressInLevel — 0..1 pro XP bar', () => {
  it('início do nível = 0', () => {
    expect(xpProgressInLevel(0, 1)).toBe(0);
    expect(xpProgressInLevel(300, 2)).toBe(0);
  });

  it('meio do nível ~ 0.5', () => {
    // Nv 1 (0) → Nv 2 (300): metade = 150
    expect(xpProgressInLevel(150, 1)).toBeCloseTo(0.5, 2);
  });

  it('threshold do próximo = 1', () => {
    expect(xpProgressInLevel(300, 1)).toBe(1);
  });

  it('max level sempre 1', () => {
    expect(xpProgressInLevel(355000, MAX_LEVEL)).toBe(1);
  });
});

describe('divideXpForParty', () => {
  it('divide igualmente', () => {
    expect(divideXpForParty(900, 3)).toBe(300);
    expect(divideXpForParty(100, 2)).toBe(50);
  });

  it('floor — restos não distribuídos', () => {
    expect(divideXpForParty(100, 3)).toBe(33);
    expect(divideXpForParty(50, 3)).toBe(16);
  });

  it('zero elegíveis = 0', () => {
    expect(divideXpForParty(900, 0)).toBe(0);
  });
});

describe('totalXpFromKills', () => {
  it('soma awards individuais', () => {
    expect(totalXpFromKills([200, 200, 50])).toBe(450);
  });

  it('lista vazia = 0', () => {
    expect(totalXpFromKills([])).toBe(0);
  });
});

describe('applyLevelUpsIfDue — single level', () => {
  it('nv 1 → nv 2 quando atinge 300 XP', () => {
    const pj = makeSheet({ level: 1, xp: 300, maxHp: 12, currentHp: 12 });
    const results = applyLevelUpsIfDue(pj);
    expect(results).toHaveLength(1);
    expect(results[0]?.newLevel).toBe(2);
    expect(pj.level).toBe(2);
  });

  it('HP máx aumenta = avg hit die + CON mod', () => {
    // Guerreiro hit die d10 = avg 6. CON 14 = mod +2 → +8 HP por nível
    const pj = makeSheet({ classId: 'guerreiro', level: 1, xp: 300, maxHp: 12, currentHp: 12 });
    applyLevelUpsIfDue(pj);
    expect(pj.maxHp).toBe(12 + 8);
    expect(pj.currentHp).toBe(12 + 8);
  });

  it('Mago (d6) com CON 10 (+0) ganha 4 HP por level', () => {
    const pj = makeSheet({ classId: 'mago', level: 1, xp: 300, maxHp: 6, currentHp: 6,
      abilityScores: { for: 8, des: 14, con: 10, int: 16, sab: 12, car: 10 },
      abilityScoresBase: { for: 8, des: 14, con: 10, int: 16, sab: 12, car: 10 },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.maxHp).toBe(6 + 4);
  });

  it('hit dice acumulam até level', () => {
    const pj = makeSheet({ level: 1, xp: 900, hitDiceRemaining: 1 });
    applyLevelUpsIfDue(pj);
    // 2 levels gained, each +1 hit die. Cap em level.
    expect(pj.level).toBe(3);
    expect(pj.hitDiceRemaining).toBe(3);
  });

  it('proficiency bonus muda no nv 5', () => {
    const pj = makeSheet({ level: 4, xp: 6500, maxHp: 30, currentHp: 30 });
    const results = applyLevelUpsIfDue(pj);
    expect(pj.level).toBe(5);
    expect(results[0]?.proficiencyBonusGained).toBe(true);
  });

  it('proficiency bonus não muda no nv 6', () => {
    const pj = makeSheet({ level: 5, xp: 14000, maxHp: 40, currentHp: 40 });
    const results = applyLevelUpsIfDue(pj);
    expect(pj.level).toBe(6);
    expect(results[0]?.proficiencyBonusGained).toBe(false);
  });

  it('XP insuficiente — nada muda', () => {
    const pj = makeSheet({ level: 1, xp: 299 });
    const results = applyLevelUpsIfDue(pj);
    expect(results).toHaveLength(0);
    expect(pj.level).toBe(1);
  });

  it('cap em nv 20', () => {
    const pj = makeSheet({ level: 20, xp: 999999 });
    const results = applyLevelUpsIfDue(pj);
    expect(results).toHaveLength(0);
  });
});

describe('applyLevelUpsIfDue — multi-level catch-up', () => {
  it('XP grande sobe múltiplos níveis numa vez', () => {
    const pj = makeSheet({ level: 1, xp: 6500, maxHp: 12, currentHp: 12 });
    const results = applyLevelUpsIfDue(pj);
    // 1 → 2 → 3 → 4 → 5 = 4 levelups
    expect(results).toHaveLength(4);
    expect(pj.level).toBe(5);
  });
});

describe('applyLevelUpsIfDue — spell slots', () => {
  it('full caster (Mago) ganha slot nv 1 ao chegar em nv 2', () => {
    const pj = makeSheet({
      classId: 'mago', level: 1, xp: 300, maxHp: 8, currentHp: 8,
      spellSlots: {
        1: { max: 2, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
        4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
        7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
      },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.spellSlots[1]?.max).toBe(3); // nv 2 mago = 3 slots nv 1
  });

  it('half caster (Paladino) começa a castar no nv 2', () => {
    const pj = makeSheet({
      classId: 'paladino', level: 1, xp: 300, maxHp: 12, currentHp: 12,
      abilityScores: { for: 14, des: 10, con: 14, int: 10, sab: 12, car: 14 },
      abilityScoresBase: { for: 14, des: 10, con: 14, int: 10, sab: 12, car: 14 },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.spellSlots[1]?.max).toBe(2); // paladino nv 2 = 2 slots nv 1
  });

  it('non-caster (Guerreiro) — slots permanecem zero', () => {
    const pj = makeSheet({ classId: 'guerreiro', level: 1, xp: 300 });
    applyLevelUpsIfDue(pj);
    expect(pj.spellSlots[1]?.max).toBe(0);
  });

  it('preserva used count quando max aumenta', () => {
    const pj = makeSheet({
      classId: 'mago', level: 1, xp: 300, maxHp: 8, currentHp: 8,
      spellSlots: {
        1: { max: 2, used: 1 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
        4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
        7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
      },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.spellSlots[1]?.used).toBe(1);
    expect(pj.spellSlots[1]?.max).toBe(3);
  });
});

describe('applyLevelUpsIfDue — plannedLevel4Choice', () => {
  it('aplica ASI ao chegar em nv 4', () => {
    const pj = makeSheet({
      level: 3, xp: 2700, maxHp: 24, currentHp: 24,
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'con' },
    });
    const oldFor = pj.abilityScores.for;
    const oldCon = pj.abilityScores.con;
    const results = applyLevelUpsIfDue(pj);
    expect(pj.level).toBe(4);
    expect(results[0]?.level4ChoiceApplied).toBe(true);
    expect(pj.abilityScores.for).toBe(oldFor + 2);
    expect(pj.abilityScores.con).toBe(oldCon + 1);
    expect(pj.plannedLevel4Choice).toBeNull(); // limpa após aplicar
  });

  it('ASI cap em 20', () => {
    const pj = makeSheet({
      level: 3, xp: 2700, maxHp: 24, currentHp: 24,
      abilityScores: { for: 19, des: 12, con: 14, int: 10, sab: 13, car: 8 },
      abilityScoresBase: { for: 19, des: 12, con: 14, int: 10, sab: 13, car: 8 },
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'des' },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.abilityScores.for).toBe(20); // capped, não 21
    expect(pj.abilityScores.des).toBe(13);
  });

  it('+2 no mesmo atributo se plusTwo === plusOne (não duplica +3)', () => {
    const pj = makeSheet({
      level: 3, xp: 2700, maxHp: 24, currentHp: 24,
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'for' },
    });
    const oldFor = pj.abilityScores.for;
    applyLevelUpsIfDue(pj);
    expect(pj.abilityScores.for).toBe(oldFor + 2); // não +3
  });

  it('Feat: registra no backstory + limpa choice', () => {
    const pj = makeSheet({
      level: 3, xp: 2700, maxHp: 24, currentHp: 24,
      plannedLevel4Choice: { kind: 'feat', featId: 'sentinel' },
    });
    applyLevelUpsIfDue(pj);
    expect(pj.backstory).toContain('Feat nv 4: sentinel');
    expect(pj.plannedLevel4Choice).toBeNull();
  });

  it('sem plannedLevel4Choice — nada acontece extra', () => {
    const pj = makeSheet({
      level: 3, xp: 2700, maxHp: 24, currentHp: 24,
    });
    const results = applyLevelUpsIfDue(pj);
    expect(results[0]?.level4ChoiceApplied).toBe(false);
  });

  it('choice só aplica quando ATINGE nv 4, não nv 5', () => {
    const pj = makeSheet({
      level: 4, xp: 6500, maxHp: 30, currentHp: 30,
      plannedLevel4Choice: { kind: 'asi', plusTwo: 'for', plusOne: 'des' },
    });
    const oldFor = pj.abilityScores.for;
    applyLevelUpsIfDue(pj);
    expect(pj.level).toBe(5);
    expect(pj.abilityScores.for).toBe(oldFor); // não aplicou (já passou de 4)
    expect(pj.plannedLevel4Choice).toBeDefined(); // não limpou
  });
});

describe('awardXpToParty', () => {
  it('distribui XP entre party viva', () => {
    const a = makeSheet({ id: 'a', characterName: 'A', currentHp: 10, xp: 0 });
    const b = makeSheet({ id: 'b', characterName: 'B', currentHp: 10, xp: 100 });
    const results = awardXpToParty([a, b], 900);
    expect(results).toHaveLength(2);
    expect(a.xp).toBe(450);
    expect(b.xp).toBe(550);
  });

  it('PJ caído (HP 0) não ganha XP', () => {
    const a = makeSheet({ id: 'a', currentHp: 10, xp: 0 });
    const b = makeSheet({ id: 'b', currentHp: 0, xp: 0 });
    const results = awardXpToParty([a, b], 600);
    expect(results).toHaveLength(1);
    expect(a.xp).toBe(600); // ganha tudo
    expect(b.xp).toBe(0);
  });

  it('todos caídos — ninguém ganha XP', () => {
    const a = makeSheet({ id: 'a', currentHp: 0, xp: 0 });
    const b = makeSheet({ id: 'b', currentHp: 0, xp: 0 });
    const results = awardXpToParty([a, b], 600);
    expect(results).toHaveLength(0);
  });

  it('award dispara level-up', () => {
    const a = makeSheet({ id: 'a', currentHp: 10, xp: 0, level: 1 });
    const results = awardXpToParty([a], 300);
    expect(a.level).toBe(2);
    expect(results[0]?.levelUps).toHaveLength(1);
  });

  it('multi-level catch-up via award', () => {
    const a = makeSheet({ id: 'a', currentHp: 10, xp: 0, level: 1 });
    const results = awardXpToParty([a], 6500);
    expect(a.level).toBe(5);
    expect(results[0]?.levelUps).toHaveLength(4);
  });
});

describe('applySpellSlotProgression — re-deriva slots', () => {
  it('mago nv 5 sozinho — slots = (4, 3, 2)', () => {
    const pj = makeSheet({
      classId: 'mago', level: 5, maxHp: 30, currentHp: 30,
      abilityScores: { for: 8, des: 12, con: 12, int: 16, sab: 12, car: 10 },
      abilityScoresBase: { for: 8, des: 12, con: 12, int: 16, sab: 12, car: 10 },
    });
    applySpellSlotProgression(pj);
    expect(pj.spellSlots[1]?.max).toBe(4);
    expect(pj.spellSlots[2]?.max).toBe(3);
    expect(pj.spellSlots[3]?.max).toBe(2);
  });

  it('multi-classe Mago 3 + Paladino 4 — caster level 5', () => {
    const pj = makeSheet({
      classId: 'mago', level: 3,
      additionalClasses: [{ classId: 'paladino', level: 4 }],
    });
    applySpellSlotProgression(pj);
    expect(pj.spellSlots[1]?.max).toBe(4);
    expect(pj.spellSlots[2]?.max).toBe(3);
    expect(pj.spellSlots[3]?.max).toBe(2);
  });

  it('non-caster (Guerreiro) — slots zero', () => {
    const pj = makeSheet({ classId: 'guerreiro', level: 10 });
    applySpellSlotProgression(pj);
    expect(pj.spellSlots[1]?.max).toBe(0);
  });
});

describe('Tabelas — sanity checks', () => {
  it('CR_TO_XP tem todas as keys principais', () => {
    expect(CR_TO_XP[0]).toBeDefined();
    expect(CR_TO_XP[10]).toBeDefined();
    expect(CR_TO_XP[20]).toBeDefined();
  });

  it('XP_FOR_LEVEL é monotônico crescente', () => {
    for (let i = 2; i <= MAX_LEVEL; i++) {
      expect(XP_FOR_LEVEL[i]!).toBeGreaterThan(XP_FOR_LEVEL[i - 1]!);
    }
  });
});

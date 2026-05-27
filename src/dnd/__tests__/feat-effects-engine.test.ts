// η.1 — Tests Feat Effects Engine.

import { describe, it, expect } from 'vitest';
import {
  applyFeatEffects, getInitiativeBonus, getPassivePerceptionBonus, getPassiveInvestigationBonus,
  hasWarCasterConcentrationAdvantage, restoreLuckyOnLongRest, consumeLuckyPoint,
  ownedFeats, migrateLegacyFeats,
} from '../feat-effects-engine';
import type { CharacterSheet } from '../../shared/types';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'pc-1',
    ownerName: 'p',
    characterName: 'Borin',
    raceId: 'anao-montanha',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: 4,
    xp: 2700,
    abilityScoresBase: { for: 14, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    abilityScores: { for: 14, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0, hitDiceRemaining: 4, armorClass: 16,
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

describe('Feat Effects Engine η.1', () => {
  describe('Alert (+5 init)', () => {
    it('getInitiativeBonus retorna 5 quando tem Alert', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'alert');
      expect(getInitiativeBonus(s)).toBe(5);
    });

    it('getInitiativeBonus retorna 0 sem Alert', () => {
      expect(getInitiativeBonus(makeSheet())).toBe(0);
    });
  });

  describe('Tough (+2 HP/nv)', () => {
    it('aumenta maxHp em 2×nivel', () => {
      const s = makeSheet({ level: 5, maxHp: 30, currentHp: 30 });
      applyFeatEffects(s, 'tough');
      expect(s.maxHp).toBe(40); // +10
      expect(s.currentHp).toBe(40);
    });

    it('idempotente — chamar 2x não duplica HP', () => {
      const s = makeSheet({ level: 4, maxHp: 30, currentHp: 30 });
      applyFeatEffects(s, 'tough');
      applyFeatEffects(s, 'tough');
      expect(s.maxHp).toBe(38); // só uma aplicação
    });
  });

  describe('Lucky (3 pts / long rest)', () => {
    it('aplica luckyPoints inicial', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'lucky');
      expect(s.luckyPointsRemaining).toBe(3);
      expect(s.luckyPointsMax).toBe(3);
    });

    it('consumeLuckyPoint reduz contador', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'lucky');
      expect(consumeLuckyPoint(s)).toBe(true);
      expect(s.luckyPointsRemaining).toBe(2);
    });

    it('consumeLuckyPoint sem feat retorna false', () => {
      const s = makeSheet();
      expect(consumeLuckyPoint(s)).toBe(false);
    });

    it('consumeLuckyPoint com 0 retorna false', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'lucky');
      consumeLuckyPoint(s); consumeLuckyPoint(s); consumeLuckyPoint(s);
      expect(consumeLuckyPoint(s)).toBe(false);
      expect(s.luckyPointsRemaining).toBe(0);
    });

    it('restoreLuckyOnLongRest restaura ao max', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'lucky');
      consumeLuckyPoint(s); consumeLuckyPoint(s);
      restoreLuckyOnLongRest(s);
      expect(s.luckyPointsRemaining).toBe(3);
    });
  });

  describe('Resilient (+1 ability + save prof)', () => {
    it('aplica +1 ability + push em proficientSavingThrows', () => {
      const s = makeSheet({ abilityScores: { ...makeSheet().abilityScores, sab: 12 } });
      applyFeatEffects(s, 'resilient', 'sab');
      expect(s.abilityScores.sab).toBe(13);
      expect(s.proficientSavingThrows).toContain('sab');
    });

    it('sem ability passada, não muta', () => {
      const s = makeSheet();
      const originalCon = s.abilityScores.con;
      applyFeatEffects(s, 'resilient');
      expect(s.abilityScores.con).toBe(originalCon);
    });
  });

  describe('Observant (+5 passive)', () => {
    it('retorna +5 passive Perception + Investigation', () => {
      const s = makeSheet();
      applyFeatEffects(s, 'observant');
      expect(getPassivePerceptionBonus(s)).toBe(5);
      expect(getPassiveInvestigationBonus(s)).toBe(5);
    });
  });

  describe('Armor proficiency feats', () => {
    it('lightly-armored adiciona "armaduras leves"', () => {
      const s = makeSheet({ armorProficiencies: [] });
      applyFeatEffects(s, 'lightly-armored');
      expect(s.armorProficiencies).toContain('armaduras leves');
    });

    it('medium-armored adiciona médias + escudos', () => {
      const s = makeSheet({ armorProficiencies: [] });
      applyFeatEffects(s, 'medium-armored');
      expect(s.armorProficiencies).toContain('armaduras médias');
      expect(s.armorProficiencies).toContain('escudos');
    });
  });

  describe('War Caster (concentration advantage)', () => {
    it('hasWarCasterConcentrationAdvantage true após aplicar', () => {
      const s = makeSheet();
      expect(hasWarCasterConcentrationAdvantage(s)).toBe(false);
      applyFeatEffects(s, 'war-caster');
      expect(hasWarCasterConcentrationAdvantage(s)).toBe(true);
    });
  });

  describe('Ability increase feats (abilityIncrease)', () => {
    it('actor aplica +1 CHA', () => {
      const s = makeSheet({ abilityScores: { ...makeSheet().abilityScores, car: 10 } });
      applyFeatEffects(s, 'actor');
      expect(s.abilityScores.car).toBe(11);
    });

    it('durable aplica +1 CON', () => {
      const s = makeSheet({ abilityScores: { ...makeSheet().abilityScores, con: 14 } });
      applyFeatEffects(s, 'durable');
      expect(s.abilityScores.con).toBe(15);
    });

    it('cap em 20', () => {
      const s = makeSheet({ abilityScores: { ...makeSheet().abilityScores, car: 20 } });
      applyFeatEffects(s, 'actor');
      expect(s.abilityScores.car).toBe(20);
    });
  });

  describe('Migration legacy', () => {
    it('parsea "[Feat nv 4: alert]" e aplica', () => {
      const s = makeSheet({
        featsOwned: undefined,
        backstory: 'um soldado\n[Feat nv 4: alert]',
      });
      migrateLegacyFeats(s);
      expect(ownedFeats(s)).toContain('alert');
      expect(getInitiativeBonus(s)).toBe(5);
    });

    it('idempotente — não migra 2x', () => {
      const s = makeSheet({
        featsOwned: ['tough'],
        backstory: '[Feat nv 4: alert]',
      });
      migrateLegacyFeats(s);
      expect(ownedFeats(s)).toEqual(['tough']); // não tocou
    });

    it('sem marker, não toca', () => {
      const s = makeSheet({ backstory: 'sem feats aqui' });
      migrateLegacyFeats(s);
      expect(ownedFeats(s)).toEqual([]);
    });
  });
});

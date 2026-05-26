// Sprint A — Property-based testing pra encounter-builder.ts.
// Invariantes (DMG pág 82):
//  - totalXp sempre >= 0
//  - picks com count >= 1 quando tem picks
//  - party vazio → picks vazio + targetXp = 0
//  - adjustedXp sempre >= totalXp (multiplier 1+)
//  - level out-of-range é clampado [1, 20]

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { pickEncounter, type Difficulty } from '../encounter-builder.js';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'deadly'];
const anyDifficulty = fc.constantFrom(...DIFFICULTIES);

const anyPartyMember = fc.record({
  level: fc.integer({ min: 1, max: 20 }),
});
const anyParty = fc.array(anyPartyMember, { minLength: 1, maxLength: 6 });

describe('pickEncounter — property', () => {
  it('party vazio → picks vazio e XPs zerados', () => {
    fc.assert(fc.property(anyDifficulty, (diff) => {
      const r = pickEncounter([], diff);
      expect(r.picks).toEqual([]);
      expect(r.totalXp).toBe(0);
      expect(r.adjustedXp).toBe(0);
      expect(r.targetXp).toBe(0);
    }), { numRuns: 50 });
  });

  it('totalXp + adjustedXp + targetXp SEMPRE >= 0', () => {
    fc.assert(fc.property(anyParty, anyDifficulty, (party, diff) => {
      const r = pickEncounter(party, diff);
      expect(r.totalXp).toBeGreaterThanOrEqual(0);
      expect(r.adjustedXp).toBeGreaterThanOrEqual(0);
      expect(r.targetXp).toBeGreaterThanOrEqual(0);
    }), { numRuns: 500 });
  });

  it('cada pick.count >= 1', () => {
    fc.assert(fc.property(anyParty, anyDifficulty, (party, diff) => {
      const r = pickEncounter(party, diff);
      for (const p of r.picks) {
        expect(p.count).toBeGreaterThanOrEqual(1);
      }
    }), { numRuns: 500 });
  });

  it('adjustedXp >= totalXp (multiplier nunca diminui)', () => {
    fc.assert(fc.property(anyParty, anyDifficulty, (party, diff) => {
      const r = pickEncounter(party, diff);
      expect(r.adjustedXp).toBeGreaterThanOrEqual(r.totalXp);
    }), { numRuns: 500 });
  });

  it('cada monster pick referencia MonsterDef válido', () => {
    fc.assert(fc.property(anyParty, anyDifficulty, (party, diff) => {
      const r = pickEncounter(party, diff);
      for (const p of r.picks) {
        expect(p.monster).toBeDefined();
        expect(p.monster.name).toBeTruthy();
        expect(p.monster.hp).toBeGreaterThan(0);
        expect(p.monster.ac).toBeGreaterThan(0);
      }
    }), { numRuns: 500 });
  });

  it('level out-of-range NÃO crasha (clamp [1, 20])', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ level: fc.integer({ min: -10, max: 100 }) }), {
        minLength: 1, maxLength: 4,
      }),
      anyDifficulty,
      (party, diff) => {
        const r = pickEncounter(party, diff);
        expect(r.targetXp).toBeGreaterThanOrEqual(0);
      },
    ), { numRuns: 500 });
  });

  it('difficulty crescente: targetXp monotonicamente crescente', () => {
    fc.assert(fc.property(anyParty, (party) => {
      const easy = pickEncounter(party, 'easy').targetXp;
      const med = pickEncounter(party, 'medium').targetXp;
      const hard = pickEncounter(party, 'hard').targetXp;
      const deadly = pickEncounter(party, 'deadly').targetXp;
      // Monotonia: easy <= medium <= hard <= deadly
      expect(easy).toBeLessThanOrEqual(med);
      expect(med).toBeLessThanOrEqual(hard);
      expect(hard).toBeLessThanOrEqual(deadly);
    }), { numRuns: 500 });
  });

  it('targetXp para mesma party é determinístico (não depende de RNG)', () => {
    fc.assert(fc.property(anyParty, anyDifficulty, (party, diff) => {
      const a = pickEncounter(party, diff).targetXp;
      const b = pickEncounter(party, diff).targetXp;
      // targetXp é puro (depende só de party.level + difficulty)
      expect(a).toBe(b);
    }), { numRuns: 500 });
  });
});

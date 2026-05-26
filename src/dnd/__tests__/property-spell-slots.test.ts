// Sprint A — Property-based testing pra spell-slots.ts.
// Invariantes PHB pág 113:
//  - Full caster nv 17+ TEM slot 9 (max >= 1)
//  - Half caster NUNCA tem slot 6+ (PHB nunca passa de nv 5 pra paladino/ranger)
//  - Pact magic (bruxo) tem slots APENAS em UMA spell-level por vez
//  - non-caster (barbaro/guerreiro/ladino/monge) tem TODOS os slots zerados
//  - used inicial é 0 sempre
//  - Slots não acessados nunca são NaN/undefined

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  getStartingSlots, getStartingCantripCount, isSpellcaster, isPactMagicClass,
} from '../spell-slots.js';
import type { ClassId } from '../classes.js';

const ALL_CLASSES: ClassId[] = [
  'barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro',
  'guerreiro', 'ladino', 'mago', 'monge', 'paladino', 'patrulheiro',
];

const FULL_CASTERS: ClassId[] = ['bardo', 'clerigo', 'druida', 'feiticeiro', 'mago'];
const HALF_CASTERS: ClassId[] = ['paladino', 'patrulheiro'];
const NON_CASTERS: ClassId[] = ['barbaro', 'guerreiro', 'ladino', 'monge'];

const anyClass = fc.constantFrom(...ALL_CLASSES);
const anyLevel = fc.integer({ min: 1, max: 20 });

describe('getStartingSlots — property', () => {
  it('slots 1-9 sempre presentes com max >= 0', () => {
    fc.assert(fc.property(anyClass, anyLevel, (cls, lvl) => {
      const slots = getStartingSlots(cls, lvl);
      for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
        expect(slots[k]).toBeDefined();
        expect(slots[k].max).toBeGreaterThanOrEqual(0);
        expect(slots[k].used).toBe(0);
        expect(Number.isInteger(slots[k].max)).toBe(true);
      }
    }), { numRuns: 1000 });
  });

  it('non-caster: TODOS slots max = 0', () => {
    fc.assert(fc.property(fc.constantFrom(...NON_CASTERS), anyLevel, (cls, lvl) => {
      const slots = getStartingSlots(cls, lvl);
      for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
        expect(slots[k].max).toBe(0);
      }
    }), { numRuns: 200 });
  });

  it('full caster nv 17-20: TEM slot 9 (max >= 1)', () => {
    fc.assert(fc.property(
      fc.constantFrom(...FULL_CASTERS),
      fc.integer({ min: 17, max: 20 }),
      (cls, lvl) => {
        const slots = getStartingSlots(cls, lvl);
        expect(slots[9].max).toBeGreaterThanOrEqual(1);
      },
    ), { numRuns: 200 });
  });

  it('full caster nv < 17: slot 9 = 0', () => {
    fc.assert(fc.property(
      fc.constantFrom(...FULL_CASTERS),
      fc.integer({ min: 1, max: 16 }),
      (cls, lvl) => {
        const slots = getStartingSlots(cls, lvl);
        expect(slots[9].max).toBe(0);
      },
    ), { numRuns: 500 });
  });

  it('half caster (paladino/ranger) NUNCA tem slot 6+', () => {
    fc.assert(fc.property(
      fc.constantFrom(...HALF_CASTERS),
      anyLevel,
      (cls, lvl) => {
        const slots = getStartingSlots(cls, lvl);
        for (const k of [6, 7, 8, 9] as const) {
          expect(slots[k].max).toBe(0);
        }
      },
    ), { numRuns: 500 });
  });

  it('pact magic (bruxo): slots concentrados em UMA tier por vez', () => {
    fc.assert(fc.property(anyLevel, (lvl) => {
      const slots = getStartingSlots('bruxo', lvl);
      const tiersWithSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (k) => slots[k as 1|2|3|4|5|6|7|8|9].max > 0,
      );
      // Bruxo nv 1-20 SEMPRE tem slots em exatamente UMA tier (1-5).
      expect(tiersWithSlots.length).toBe(1);
      // E essa tier é ∈ [1, 5]
      expect(tiersWithSlots[0]).toBeLessThanOrEqual(5);
      expect(tiersWithSlots[0]).toBeGreaterThanOrEqual(1);
    }), { numRuns: 500 });
  });

  it('level out-of-range (>20 ou <1) é clampado, nunca crasha', () => {
    fc.assert(fc.property(
      anyClass,
      fc.integer({ min: -100, max: 100 }),
      (cls, lvl) => {
        const slots = getStartingSlots(cls, lvl);
        // Não deve crashar e deve retornar estrutura válida
        expect(slots[1]).toBeDefined();
        expect(slots[1].max).toBeGreaterThanOrEqual(0);
      },
    ), { numRuns: 500 });
  });

  it('monotonia: para full caster, slot total NÃO diminui com level', () => {
    fc.assert(fc.property(
      fc.constantFrom(...FULL_CASTERS),
      fc.integer({ min: 1, max: 19 }),
      (cls, lvl) => {
        const cur = getStartingSlots(cls, lvl);
        const next = getStartingSlots(cls, lvl + 1);
        const curTotal = [1,2,3,4,5,6,7,8,9].reduce(
          (a, k) => a + cur[k as 1|2|3|4|5|6|7|8|9].max, 0);
        const nextTotal = [1,2,3,4,5,6,7,8,9].reduce(
          (a, k) => a + next[k as 1|2|3|4|5|6|7|8|9].max, 0);
        expect(nextTotal).toBeGreaterThanOrEqual(curTotal);
      },
    ), { numRuns: 500 });
  });
});

describe('isSpellcaster / isPactMagicClass — property', () => {
  it('isPactMagicClass implica isSpellcaster', () => {
    fc.assert(fc.property(anyClass, (cls) => {
      if (isPactMagicClass(cls)) {
        expect(isSpellcaster(cls)).toBe(true);
      }
    }), { numRuns: 200 });
  });

  it('non-caster: isSpellcaster = false', () => {
    for (const cls of NON_CASTERS) {
      expect(isSpellcaster(cls)).toBe(false);
      expect(isPactMagicClass(cls)).toBe(false);
    }
  });

  it('apenas bruxo é pact magic', () => {
    fc.assert(fc.property(anyClass, (cls) => {
      expect(isPactMagicClass(cls)).toBe(cls === 'bruxo');
    }), { numRuns: 200 });
  });
});

describe('getStartingCantripCount — property', () => {
  it('sempre >= 0 e inteiro', () => {
    fc.assert(fc.property(anyClass, (cls) => {
      const n = getStartingCantripCount(cls);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(n)).toBe(true);
    }), { numRuns: 200 });
  });

  it('non-caster: cantrip count = 0', () => {
    for (const cls of NON_CASTERS) {
      expect(getStartingCantripCount(cls)).toBe(0);
    }
  });
});

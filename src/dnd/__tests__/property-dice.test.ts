// Sprint A — Property-based testing pra dice.ts.
// Invariantes: total ∈ [N+M, N*K+M]; advantage >= normal >= disadvantage (em média);
// crit dobra os DADOS mas NÃO o modifier; parser reverse-safe.

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  rollDice, rollD20, rollDamage, rollDie, parseDiceNotation, rollNotation,
  type DieKind,
} from '../dice.js';

const DIE_KINDS: DieKind[] = [4, 6, 8, 10, 12, 20, 100];
const dieKind = fc.constantFrom<DieKind>(...DIE_KINDS);

describe('rollDie — property', () => {
  it('sempre retorna [1, kind]', () => {
    fc.assert(fc.property(dieKind, (k) => {
      for (let i = 0; i < 20; i++) {
        const v = rollDie(k);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(k);
        expect(Number.isInteger(v)).toBe(true);
      }
    }), { numRuns: 200 });
  });
});

describe('rollDice — property', () => {
  it('total sempre em [count + mod, count*kind + mod]', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      dieKind,
      fc.integer({ min: -10, max: 20 }),
      (count, kind, mod) => {
        const r = rollDice(count, kind, mod);
        expect(r.total).toBeGreaterThanOrEqual(count + mod);
        expect(r.total).toBeLessThanOrEqual(count * kind + mod);
      },
    ), { numRuns: 5000 });
  });

  it('rolls.length === count e cada roll ∈ [1, kind]', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      dieKind,
      (count, kind) => {
        const r = rollDice(count, kind, 0);
        expect(r.rolls).toHaveLength(count);
        for (const v of r.rolls) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(kind);
        }
      },
    ), { numRuns: 1000 });
  });

  it('notation reflete count/kind/mod', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 9 }),
      dieKind,
      fc.integer({ min: -5, max: 10 }),
      (count, kind, mod) => {
        const r = rollDice(count, kind, mod);
        expect(r.notation).toContain(`${count}d${kind}`);
        if (mod > 0) expect(r.notation).toContain(`+${mod}`);
        if (mod < 0) expect(r.notation).toContain(`${mod}`);
      },
    ), { numRuns: 500 });
  });
});

describe('rollD20 — property', () => {
  it('normal: total ∈ [1+mod, 20+mod]', () => {
    fc.assert(fc.property(fc.integer({ min: -10, max: 20 }), (mod) => {
      const r = rollD20({ modifier: mod });
      expect(r.total).toBeGreaterThanOrEqual(1 + mod);
      expect(r.total).toBeLessThanOrEqual(20 + mod);
      expect(r.kind).toBe(20);
    }), { numRuns: 500 });
  });

  it('advantage: picked = max(a, b); bothRolls preservado', () => {
    fc.assert(fc.property(fc.integer({ min: -5, max: 10 }), (mod) => {
      const r = rollD20({ modifier: mod, advantage: true });
      expect(r.bothRolls).toBeDefined();
      const [a, b] = r.bothRolls!;
      const picked = Math.max(a, b);
      expect(r.total).toBe(picked + mod);
      expect(r.withAdvantage).toBe('advantage');
    }), { numRuns: 500 });
  });

  it('disadvantage: picked = min(a, b)', () => {
    fc.assert(fc.property(fc.integer({ min: -5, max: 10 }), (mod) => {
      const r = rollD20({ modifier: mod, disadvantage: true });
      const [a, b] = r.bothRolls!;
      const picked = Math.min(a, b);
      expect(r.total).toBe(picked + mod);
      expect(r.withAdvantage).toBe('disadvantage');
    }), { numRuns: 500 });
  });

  it('advantage + disadvantage → normal (cancelam, PHB pág 175)', () => {
    fc.assert(fc.property(fc.integer({ min: -5, max: 5 }), (mod) => {
      const r = rollD20({ modifier: mod, advantage: true, disadvantage: true });
      expect(r.withAdvantage).toBe('normal');
      expect(r.bothRolls).toBeUndefined();
      expect(r.rolls).toHaveLength(1);
    }), { numRuns: 200 });
  });

  it('nat20/nat1 flags consistentes', () => {
    fc.assert(fc.property(fc.integer({ min: -5, max: 10 }), (mod) => {
      const r = rollD20({ modifier: mod });
      const picked = r.rolls[0]!;
      expect(r.nat20).toBe(picked === 20);
      expect(r.nat1).toBe(picked === 1);
    }), { numRuns: 500 });
  });
});

describe('rollDamage — property', () => {
  it('crit DOBRA dados mas NÃO modifier (PHB pág 196)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 8 }),
      dieKind,
      fc.integer({ min: 0, max: 10 }),
      (count, kind, mod) => {
        const r = rollDamage(count, kind, mod, true);
        // dados são 2*count, modifier permanece mod
        expect(r.rolls).toHaveLength(count * 2);
        expect(r.modifier).toBe(mod);
        // total >= 2*count + mod, <= 2*count*kind + mod
        expect(r.total).toBeGreaterThanOrEqual(count * 2 + mod);
        expect(r.total).toBeLessThanOrEqual(count * 2 * kind + mod);
        expect(r.notation).toContain('CRIT');
      },
    ), { numRuns: 2000 });
  });

  it('sem crit: idêntico a rollDice', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 8 }),
      dieKind,
      fc.integer({ min: -5, max: 10 }),
      (count, kind, mod) => {
        const r = rollDamage(count, kind, mod, false);
        expect(r.rolls).toHaveLength(count);
        expect(r.modifier).toBe(mod);
        expect(r.notation).not.toContain('CRIT');
      },
    ), { numRuns: 1000 });
  });
});

describe('parseDiceNotation — property', () => {
  it('round-trip: count/kind/mod válidos sempre parseiam', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 99 }),
      dieKind,
      fc.integer({ min: -99, max: 99 }),
      (count, kind, mod) => {
        const notation = mod === 0
          ? `${count}d${kind}`
          : mod > 0 ? `${count}d${kind}+${mod}` : `${count}d${kind}${mod}`;
        const parsed = parseDiceNotation(notation);
        expect(parsed).not.toBeNull();
        expect(parsed!.count).toBe(count);
        expect(parsed!.kind).toBe(kind);
        expect(parsed!.modifier).toBe(mod);
      },
    ), { numRuns: 2000 });
  });

  it('input arbitrário NUNCA crasha (retorna null se inválido)', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const r = parseDiceNotation(s);
      // Aceita null ou objeto válido
      if (r !== null) {
        expect(r.count).toBeGreaterThan(0);
        expect([4, 6, 8, 10, 12, 20, 100]).toContain(r.kind);
      }
    }), { numRuns: 5000 });
  });
});

describe('rollNotation — property', () => {
  it('input arbitrário NUNCA crasha', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const r = rollNotation(s);
      if (r !== null) {
        expect(r.total).toBeGreaterThanOrEqual(r.count + r.modifier);
      }
    }), { numRuns: 2000 });
  });
});

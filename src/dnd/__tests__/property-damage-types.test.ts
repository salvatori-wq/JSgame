// Sprint A — Property-based testing pra damage-types.ts.
// Invariantes (PHB pág 196-197):
//  - immunity (×0) sempre vence vulnerability/resistance
//  - vulnerability + resistance simultâneos cancelam → ×1 (regra de mesa comum)
//  - vulnerability sozinho → ×2
//  - resistance sozinho → ×0.5
//  - sem profile → ×1
//  - applyDamageMultiplier SEMPRE retorna inteiro >= 0

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  damageMultiplier, applyDamageMultiplier, damageVerdict,
  type DamageType,
} from '../damage-types.js';

const DAMAGE_TYPES: DamageType[] = [
  'cortante', 'perfurante', 'contundente',
  'fogo', 'frio', 'eletricidade', 'ácido', 'trovão',
  'veneno', 'psíquico', 'radiante', 'necrótico', 'força',
];
const anyDamageType = fc.constantFrom(...DAMAGE_TYPES);

const arrOfTypes = fc.uniqueArray(anyDamageType, { maxLength: 5 });

const anyProfile = fc.record({
  resistances: fc.option(arrOfTypes, { nil: undefined }),
  immunities: fc.option(arrOfTypes, { nil: undefined }),
  vulnerabilities: fc.option(arrOfTypes, { nil: undefined }),
});

describe('damageMultiplier — property', () => {
  it('immunity sempre vence (retorna 0)', () => {
    fc.assert(fc.property(anyDamageType, anyProfile, (dmgType, profile) => {
      if (profile.immunities?.includes(dmgType)) {
        expect(damageMultiplier(dmgType, profile)).toBe(0);
      }
    }), { numRuns: 2000 });
  });

  it('vulnerability sozinho → 2', () => {
    fc.assert(fc.property(anyDamageType, arrOfTypes, (dmgType, vulns) => {
      const profile = { vulnerabilities: [...vulns, dmgType] };
      expect(damageMultiplier(dmgType, profile)).toBe(2);
    }), { numRuns: 500 });
  });

  it('resistance sozinho → 0.5', () => {
    fc.assert(fc.property(anyDamageType, arrOfTypes, (dmgType, res) => {
      const profile = { resistances: [...res, dmgType] };
      expect(damageMultiplier(dmgType, profile)).toBe(0.5);
    }), { numRuns: 500 });
  });

  it('vulnerability + resistance simultâneos → 1 (cancelam)', () => {
    fc.assert(fc.property(anyDamageType, (dmgType) => {
      const profile = {
        vulnerabilities: [dmgType],
        resistances: [dmgType],
      };
      expect(damageMultiplier(dmgType, profile)).toBe(1);
    }), { numRuns: 100 });
  });

  it('profile vazio → 1', () => {
    fc.assert(fc.property(anyDamageType, (dmgType) => {
      expect(damageMultiplier(dmgType, {})).toBe(1);
    }), { numRuns: 100 });
  });

  it('multiplier sempre ∈ {0, 0.5, 1, 2}', () => {
    fc.assert(fc.property(anyDamageType, anyProfile, (dmgType, profile) => {
      const m = damageMultiplier(dmgType, profile);
      expect([0, 0.5, 1, 2]).toContain(m);
    }), { numRuns: 2000 });
  });
});

describe('applyDamageMultiplier — property', () => {
  it('NUNCA retorna número negativo', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1000 }),
      anyDamageType,
      anyProfile,
      (raw, dmgType, profile) => {
        const result = applyDamageMultiplier(raw, dmgType, profile);
        expect(result).toBeGreaterThanOrEqual(0);
      },
    ), { numRuns: 2000 });
  });

  it('SEMPRE inteiro (Math.floor garantido)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1000 }),
      anyDamageType,
      anyProfile,
      (raw, dmgType, profile) => {
        const result = applyDamageMultiplier(raw, dmgType, profile);
        expect(Number.isInteger(result)).toBe(true);
      },
    ), { numRuns: 2000 });
  });

  it('imune: dano final SEMPRE 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10000 }),
      anyDamageType,
      (raw, dmgType) => {
        const profile = { immunities: [dmgType] };
        expect(applyDamageMultiplier(raw, dmgType, profile)).toBe(0);
      },
    ), { numRuns: 500 });
  });

  it('resistente: dano final ≤ floor(raw / 2)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10000 }),
      anyDamageType,
      (raw, dmgType) => {
        const profile = { resistances: [dmgType] };
        expect(applyDamageMultiplier(raw, dmgType, profile))
          .toBe(Math.floor(raw / 2));
      },
    ), { numRuns: 500 });
  });

  it('vulnerável: dano final exatamente 2*raw', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10000 }),
      anyDamageType,
      (raw, dmgType) => {
        const profile = { vulnerabilities: [dmgType] };
        expect(applyDamageMultiplier(raw, dmgType, profile)).toBe(raw * 2);
      },
    ), { numRuns: 500 });
  });

  it('raw = 0 → resultado 0 sempre', () => {
    fc.assert(fc.property(anyDamageType, anyProfile, (dmgType, profile) => {
      expect(applyDamageMultiplier(0, dmgType, profile)).toBe(0);
    }), { numRuns: 500 });
  });
});

describe('damageVerdict — property', () => {
  it('imune retorna texto contendo "imune"', () => {
    fc.assert(fc.property(anyDamageType, (dmgType) => {
      const verdict = damageVerdict(dmgType, { immunities: [dmgType] });
      expect(verdict).toMatch(/imune/i);
    }), { numRuns: 200 });
  });

  it('normal retorna null', () => {
    fc.assert(fc.property(anyDamageType, (dmgType) => {
      expect(damageVerdict(dmgType, {})).toBeNull();
    }), { numRuns: 100 });
  });
});

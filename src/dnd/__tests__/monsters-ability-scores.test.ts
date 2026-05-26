// Tests pra M1 — inferAbilityScores.

import { describe, it, expect } from 'vitest';
import { inferAbilityScores, MONSTERS } from '../monsters.js';

describe('M1 — inferAbilityScores', () => {
  it('CR baixo (0) tem scores menores que CR alto (10+)', () => {
    const rato = inferAbilityScores(MONSTERS.rato!);
    const dragao = inferAbilityScores(MONSTERS['dragão-jovem-vermelho']!);
    // Dragão tem STR maior que rato
    expect(dragao.for).toBeGreaterThan(rato.for);
    expect(dragao.con).toBeGreaterThan(rato.con);
  });

  it('fera tem INT baixa', () => {
    const lobo = inferAbilityScores(MONSTERS.lobo!);
    expect(lobo.int).toBeLessThan(8);
  });

  it('morto-vivo tem CHA reduzido', () => {
    const esq = inferAbilityScores(MONSTERS.esqueleto!);
    expect(esq.car).toBeLessThan(esq.con);
  });

  it('construto tem INT muito baixa', () => {
    const garg = inferAbilityScores(MONSTERS.gargula!);
    expect(garg.int).toBeLessThanOrEqual(12);
  });

  it('aberração tem INT alta', () => {
    const ab = MONSTERS.aboleth;
    if (!ab) return;  // skip se não no bestiary
    const scores = inferAbilityScores(ab);
    expect(scores.int).toBeGreaterThanOrEqual(16);
  });

  it('respeita abilityScores explícito se declarado', () => {
    const fake = { ...MONSTERS.rato!, abilityScores: { for: 30, des: 30, con: 30, int: 30, sab: 30, car: 30 } };
    const scores = inferAbilityScores(fake);
    expect(scores.for).toBe(30);
  });

  it('todo monster do bestiary recebe scores válidos (não NaN)', () => {
    for (const m of Object.values(MONSTERS)) {
      const s = inferAbilityScores(m);
      for (const v of Object.values(s)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(2);
        expect(v).toBeLessThanOrEqual(30);
      }
    }
  });
});

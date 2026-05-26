// Tests pra F26 — Damage types resistance/immunity/vulnerability.

import { describe, it, expect } from 'vitest';
import { damageMultiplier, applyDamageMultiplier, damageVerdict } from '../damage-types.js';

describe('F26 — damageMultiplier', () => {
  it('sem profile = 1', () => {
    expect(damageMultiplier('fogo', {})).toBe(1);
  });
  it('resistance = 0.5', () => {
    expect(damageMultiplier('fogo', { resistances: ['fogo'] })).toBe(0.5);
  });
  it('immunity = 0', () => {
    expect(damageMultiplier('veneno', { immunities: ['veneno'] })).toBe(0);
  });
  it('vulnerability = 2', () => {
    expect(damageMultiplier('contundente', { vulnerabilities: ['contundente'] })).toBe(2);
  });
  it('immunity tem prioridade sobre vulnerability', () => {
    expect(damageMultiplier('fogo', { immunities: ['fogo'], vulnerabilities: ['fogo'] })).toBe(0);
  });
  it('resist + vuln cancelam = 1', () => {
    expect(damageMultiplier('fogo', { resistances: ['fogo'], vulnerabilities: ['fogo'] })).toBe(1);
  });
  it('outro damage type ignora resistance', () => {
    expect(damageMultiplier('frio', { resistances: ['fogo'] })).toBe(1);
  });
});

describe('F26 — applyDamageMultiplier', () => {
  it('resistance floor down', () => {
    expect(applyDamageMultiplier(11, 'fogo', { resistances: ['fogo'] })).toBe(5);
  });
  it('immunity zera', () => {
    expect(applyDamageMultiplier(100, 'veneno', { immunities: ['veneno'] })).toBe(0);
  });
  it('vulnerability dobra', () => {
    expect(applyDamageMultiplier(7, 'contundente', { vulnerabilities: ['contundente'] })).toBe(14);
  });
});

describe('F26 — damageVerdict', () => {
  it('null quando normal', () => {
    expect(damageVerdict('fogo', {})).toBeNull();
  });
  it('texto pra immunity', () => {
    expect(damageVerdict('veneno', { immunities: ['veneno'] })).toMatch(/imune/);
  });
  it('texto pra resistance', () => {
    expect(damageVerdict('fogo', { resistances: ['fogo'] })).toMatch(/resistência/);
  });
  it('texto pra vulnerability', () => {
    expect(damageVerdict('contundente', { vulnerabilities: ['contundente'] })).toMatch(/vulnerável/);
  });
});

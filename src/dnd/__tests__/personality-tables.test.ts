// η.2 — Tests Personality Tables.

import { describe, it, expect } from 'vitest';
import { PERSONALITY_POOLS, getPersonalityPool, rollRandomPersonality } from '../personality-tables';
import type { BackgroundId } from '../backgrounds';

const ALL_BG_IDS: BackgroundId[] = [
  'acolito', 'artesao', 'artista', 'charlatao', 'criminoso',
  'eremita', 'forasteiro', 'herois-do-povo', 'marinheiro', 'nobre',
  'orfao', 'sabio', 'soldado',
];

describe('Personality Tables η.2', () => {
  it('todos 13 backgrounds têm pool', () => {
    for (const id of ALL_BG_IDS) {
      const pool = PERSONALITY_POOLS[id];
      expect(pool).toBeDefined();
      expect(pool.traits.length).toBe(8);
      expect(pool.ideals.length).toBe(6);
      expect(pool.bonds.length).toBe(6);
      expect(pool.flaws.length).toBe(6);
    }
  });

  it('getPersonalityPool retorna pool correto', () => {
    const pool = getPersonalityPool('acolito');
    expect(pool.traits[0]).toContain('Cito passagens');
  });

  it('rollRandomPersonality retorna 2+1+1+1', () => {
    const p = rollRandomPersonality('soldado');
    expect(p.traits.length).toBe(2);
    expect(p.ideals.length).toBe(1);
    expect(p.bonds.length).toBe(1);
    expect(p.flaws.length).toBe(1);
  });

  it('rolled traits são do pool do bg', () => {
    const p = rollRandomPersonality('sabio');
    const pool = PERSONALITY_POOLS.sabio;
    for (const t of p.traits) {
      expect(pool.traits).toContain(t);
    }
    for (const i of p.ideals) {
      expect(pool.ideals).toContain(i);
    }
  });

  it('rolled traits são únicos (não duplicados)', () => {
    for (let i = 0; i < 10; i++) {
      const p = rollRandomPersonality('orfao');
      expect(new Set(p.traits).size).toBe(p.traits.length);
    }
  });

  it('total pool tem 13×26 = 338 strings', () => {
    let total = 0;
    for (const id of ALL_BG_IDS) {
      const pool = PERSONALITY_POOLS[id];
      total += pool.traits.length + pool.ideals.length + pool.bonds.length + pool.flaws.length;
    }
    expect(total).toBe(13 * 26);
  });
});

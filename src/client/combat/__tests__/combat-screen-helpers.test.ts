// W3.1 Sprint W — Tests pro enemyHpAdjective (fog of war).
// Consultor D&D pediu: "DM real não diz '23/45 HP', diz 'está ferido / à beira'".

import { describe, it, expect } from 'vitest';
import { enemyHpAdjective } from '../combat-screen-helpers';

describe('enemyHpAdjective — W3.1 fog of war', () => {
  it('hp full (100%) → "intacto"', () => {
    expect(enemyHpAdjective(45, 45)).toBe('intacto');
    expect(enemyHpAdjective(95, 100)).toBe('intacto'); // 95% inclusive
  });

  it('hp 70-94% → "arranhado"', () => {
    expect(enemyHpAdjective(90, 100)).toBe('arranhado');
    expect(enemyHpAdjective(70, 100)).toBe('arranhado');
  });

  it('hp 45-69% → "ferido"', () => {
    expect(enemyHpAdjective(60, 100)).toBe('ferido');
    expect(enemyHpAdjective(45, 100)).toBe('ferido');
  });

  it('hp 20-44% → "muito ferido"', () => {
    expect(enemyHpAdjective(40, 100)).toBe('muito ferido');
    expect(enemyHpAdjective(20, 100)).toBe('muito ferido');
  });

  it('hp 1-19% → "à beira"', () => {
    expect(enemyHpAdjective(15, 100)).toBe('à beira');
    expect(enemyHpAdjective(1, 100)).toBe('à beira');
  });

  it('hp 0 → "caído"', () => {
    expect(enemyHpAdjective(0, 100)).toBe('caído');
    expect(enemyHpAdjective(-3, 100)).toBe('caído'); // overkill ainda é caído
  });

  it('maxHp 0 → "morto"', () => {
    expect(enemyHpAdjective(0, 0)).toBe('morto');
  });
});

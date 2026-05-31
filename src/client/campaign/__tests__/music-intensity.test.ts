// Onda 5 — Tests da intensidade musical adaptativa (puro).

import { describe, it, expect } from 'vitest';
import { computeIntensity } from '../music-intensity';
import type { CampaignState, CharacterSheet, CombatState, EnemySnapshot } from '../../../shared/types';

function enemy(currentHp: number, isBoss = false): EnemySnapshot {
  return { currentHp, isBoss, maxHp: 20 } as unknown as EnemySnapshot;
}
function combat(enemies: EnemySnapshot[], active = true): CombatState {
  return { active, enemies } as unknown as CombatState;
}
function st(p: Partial<CampaignState>): CampaignState {
  return { mode: 'exploration', combat: null, ...p } as unknown as CampaignState;
}
function char(currentHp: number, maxHp: number): CharacterSheet {
  return { currentHp, maxHp } as unknown as CharacterSheet;
}

describe('computeIntensity — combate', () => {
  it('skirmish (1 inimigo, sem boss) ≈ 0.55', () => {
    const i = computeIntensity(st({ combat: combat([enemy(20)]) }), char(20, 20));
    expect(i).toBeCloseTo(0.55, 2);
  });
  it('boss eleva pra ≥ 0.78', () => {
    const i = computeIntensity(st({ combat: combat([enemy(50, true)]) }), char(20, 20));
    expect(i).toBeGreaterThanOrEqual(0.78);
  });
  it('mais inimigos vivos = mais intenso (até +0.15)', () => {
    const one = computeIntensity(st({ combat: combat([enemy(10)]) }), char(20, 20));
    const many = computeIntensity(st({ combat: combat([enemy(10), enemy(10), enemy(10), enemy(10)]) }), char(20, 20));
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThanOrEqual(0.7 + 1e-6); // cap +0.15 (≈0.70)
  });
  it('inimigos mortos não contam', () => {
    const i = computeIntensity(st({ combat: combat([enemy(0), enemy(0), enemy(10)]) }), char(20, 20));
    expect(i).toBeCloseTo(0.55, 2); // só 1 vivo → sem bônus
  });
  it('HP crítico do PJ empurra pro auge (≥ 0.92)', () => {
    const i = computeIntensity(st({ combat: combat([enemy(10)]) }), char(4, 20)); // 20%
    expect(i).toBeGreaterThanOrEqual(0.92);
  });
  it('nunca passa de 1', () => {
    const i = computeIntensity(st({ combat: combat([enemy(9, true), enemy(9), enemy(9), enemy(9), enemy(9)]) }), char(1, 20));
    expect(i).toBeLessThanOrEqual(1);
  });
});

describe('computeIntensity — fora de combate', () => {
  it('loja = 0.4', () => {
    expect(computeIntensity(st({ openShop: { } as never }), char(20, 20))).toBe(0.4);
  });
  it('perigo (HP < 25%) fora de combate = 0.5', () => {
    expect(computeIntensity(st({}), char(4, 20))).toBe(0.5);
  });
  it('descanso = 0.12', () => {
    expect(computeIntensity(st({ mode: 'rest' as never }), char(20, 20))).toBe(0.12);
  });
  it('exploração default = 0.3', () => {
    expect(computeIntensity(st({}), char(20, 20))).toBe(0.3);
  });
  it('HP desconhecido (sem PJ) não quebra', () => {
    expect(computeIntensity(st({}), null)).toBe(0.3);
  });
});

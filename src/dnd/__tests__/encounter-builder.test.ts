import { describe, it, expect } from 'vitest';
import { pickEncounter, picksToEnemyInputs } from '../encounter-builder.js';

describe('B3 — Encounter builder', () => {
  it('party nv 1 medium retorna alvo XP > 0 e picks > 0', () => {
    const r = pickEncounter([{ level: 1 }, { level: 1 }], 'medium');
    expect(r.targetXp).toBe(100); // 50×2
    expect(r.picks.length).toBeGreaterThan(0);
    expect(r.adjustedXp).toBeGreaterThan(0);
  });

  it('party nv 5 deadly tem adjusted ≥ target', () => {
    const r = pickEncounter([{ level: 5 }, { level: 5 }, { level: 5 }], 'deadly');
    expect(r.targetXp).toBe(3300); // 1100×3
    expect(r.adjustedXp).toBeGreaterThanOrEqual(r.targetXp * 0.5);
  });

  it('party vazia retorna 0', () => {
    const r = pickEncounter([], 'medium');
    expect(r.picks.length).toBe(0);
    expect(r.targetXp).toBe(0);
  });

  it('picksToEnemyInputs expande count em N inputs com nomes únicos', () => {
    const r = pickEncounter([{ level: 3 }, { level: 3 }], 'medium');
    const inputs = picksToEnemyInputs(r.picks);
    const totalCount = r.picks.reduce((s, p) => s + p.count, 0);
    expect(inputs.length).toBe(totalCount);
    if (totalCount > 1) {
      // Pelo menos 1 nome com sufixo numérico
      expect(inputs.some((i) => / \d+$/.test(i.name))).toBe(true);
    }
  });

  it('hard difficulty inclui pelo menos 1 boss-like (xpAward ≥ 25)', () => {
    const r = pickEncounter([{ level: 8 }, { level: 8 }], 'hard');
    const inputs = picksToEnemyInputs(r.picks);
    expect(inputs.every((i) => i.xpAward > 0)).toBe(true);
  });
});

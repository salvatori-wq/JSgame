// Rank 8 — inimigos FREE-FORM (start_combat custom) ganham ability scores
// inferidos por um proxy de CR. Antes, sem abilityScores, o save do inimigo caía
// pra +0 e magias de save (Hold Person, Tasha's Hideous Laughter, etc.)
// trivializavam qualquer chefe improvisado pelo Mestre.

import { describe, it, expect } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { inferAbilityScoresFromCr, MONSTERS } from '../../dnd/monsters.js';
import { picksToEnemyInputs } from '../../dnd/encounter-builder.js';

type AnyTool = { name: string; input: Record<string, unknown> };
const call = (name: string, input: Record<string, unknown>): unknown =>
  validateToolCall({ name, input } as unknown as AnyTool);

describe('Rank 8 — saves de inimigo free-form não são mais +0', () => {
  it('start_combat free-form recebe abilityScores inferidos (chefe forte)', () => {
    const tool = call('start_combat', {
      enemies: [{ name: 'Carrasco Sombrio', hp: 80, ac: 16, attackBonus: 7, damageDice: '2d8', damageBonus: 4, isBoss: true }],
    }) as { kind: string; enemies: Array<{ abilityScores?: { con: number; for: number } }> } | null;
    expect(tool).not.toBeNull();
    expect(tool!.kind).toBe('start_combat');
    const ab = tool!.enemies[0]!.abilityScores;
    expect(ab).toBeDefined();
    // hp80 + atk7 + boss → CR proxy ~8 → base 16 (mod +3), longe de +0.
    expect(ab!.con).toBeGreaterThanOrEqual(14);
  });

  it('mook fraco continua modesto (DEVE falhar saves) — scores baixos', () => {
    const tool = call('start_combat', {
      enemies: [{ name: 'Rato Gigante', hp: 7, ac: 11, attackBonus: 2 }],
    }) as { enemies: Array<{ abilityScores?: { for: number } }> };
    expect(tool.enemies[0]!.abilityScores!.for).toBeLessThanOrEqual(12);
  });

  it('inferAbilityScoresFromCr cresce com o CR (nunca trivial pra chefe)', () => {
    expect(inferAbilityScoresFromCr(0).for).toBe(10);
    expect(inferAbilityScoresFromCr(2).for).toBe(12);
    expect(inferAbilityScoresFromCr(5).for).toBe(14);
    expect(inferAbilityScoresFromCr(10).for).toBe(16);
    expect(inferAbilityScoresFromCr(20).for).toBe(20);
  });

  it('picksToEnemyInputs (encontro balanceado) também inclui abilityScores', () => {
    const monster = MONSTERS['esqueleto'];
    expect(monster).toBeDefined();
    const inputs = picksToEnemyInputs([{ monster, count: 2 } as unknown as Parameters<typeof picksToEnemyInputs>[0][number]]);
    expect(inputs.length).toBe(2);
    expect(inputs[0]!.abilityScores).toBeDefined();
  });
});

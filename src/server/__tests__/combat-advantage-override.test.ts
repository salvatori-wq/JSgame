// Rank 4 fix — apply_advantage (next-attack) declarado pelo DM agora é consumido
// no ataque. Antes resolvePlayerAttack tinha um TODO "V2" e ignorava o
// pendingAdvantages do estado — "ataca o ogro adormecido com vantagem" rolava
// 1d20 normal. Aqui cobrimos a metade combat (opts.advantageOverride → roll com
// advantage/disadvantage de verdade, via bothRolls/withAdvantage do DiceRoll).

import { describe, it, expect } from 'vitest';
import { startCombat, resolvePlayerAttack } from '../combat.js';
import type { CharacterSheet } from '../../shared/types.js';

function makeChar(id: string, name: string, opts: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id, ownerName: id, characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 1, xp: 0,
    abilityScoresBase: { for: 16, des: 14, con: 14, int: 10, sab: 10, car: 8 },
    abilityScores: { for: 16, des: 14, con: 14, int: 10, sab: 10, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: ['Armas simples'],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...opts,
  };
}

function freshCombat() {
  const attacker = makeChar('p1', 'Borin');
  const combat = startCombat({
    party: [attacker],
    enemies: [{ name: 'Saco de Treino', hp: 500, ac: 5 }],
  });
  return { attacker, combat, targetId: combat.enemies[0]!.id };
}

describe('Rank 4 — resolvePlayerAttack respeita advantageOverride', () => {
  it('advantageOverride "advantage" → rola 2d20 (bothRolls + withAdvantage)', () => {
    const { attacker, combat, targetId } = freshCombat();
    const res = resolvePlayerAttack(attacker, targetId, combat, { advantageOverride: 'advantage' });
    expect(res).not.toBeNull();
    expect(res!.attackRoll.withAdvantage).toBe('advantage');
    expect(res!.attackRoll.bothRolls).toBeDefined();
    expect(res!.attackRoll.bothRolls!.length).toBe(2);
  });

  it('advantageOverride "disadvantage" → withAdvantage disadvantage', () => {
    const { attacker, combat, targetId } = freshCombat();
    const res = resolvePlayerAttack(attacker, targetId, combat, { advantageOverride: 'disadvantage' });
    expect(res).not.toBeNull();
    expect(res!.attackRoll.withAdvantage).toBe('disadvantage');
    expect(res!.attackRoll.bothRolls).toBeDefined();
  });

  it('sem override e sem condições → ataque normal (1 roll, sem bothRolls)', () => {
    const { attacker, combat, targetId } = freshCombat();
    const res = resolvePlayerAttack(attacker, targetId, combat);
    expect(res).not.toBeNull();
    // normal: rollD20 não popula bothRolls
    expect(res!.attackRoll.bothRolls).toBeUndefined();
    expect(res!.attackRoll.withAdvantage === 'advantage').toBe(false);
  });
});

// Tests pra M3 — Esquivar real (PHB pág 192).

import { describe, it, expect } from 'vitest';
import { resolvePlayerDodge, resolveEnemyTurn, advanceTurn } from '../combat.js';
import { hasCombatFlag } from '../class-features-engine.js';
import type { CharacterSheet, CombatState } from '../../shared/types.js';

function mkPj(): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Borin',
    raceId: 'anao-montanha', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 16, des: 14, con: 16, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 16, des: 14, con: 16, int: 10, sab: 10, car: 10 },
    maxHp: 50, currentHp: 50, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 22,  // AC alto pra fazer disadvantage mais visível
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

function mkCombat(party: CharacterSheet[]): CombatState {
  return {
    active: true,
    round: 1,
    initiativeOrder: [
      { id: party[0]!.id, kind: 'player', initiative: 15, name: party[0]!.characterName },
      { id: 'e1', kind: 'enemy', initiative: 10, name: 'Goblin' },
    ],
    currentTurnIndex: 0,
    enemies: [{
      id: 'e1', name: 'Goblin', maxHp: 10, currentHp: 10, armorClass: 13,
      attackBonus: 4, damageDice: '1d6', damageBonus: 2, initiative: 10,
      conditions: [], description: '', isBoss: false, xpAward: 50,
    }],
    log: [],
  };
}

describe('M3 — Esquivar real (Dodge)', () => {
  it('resolvePlayerDodge seta combat-flag dodging', () => {
    const pj = mkPj();
    const c = mkCombat([pj]);
    resolvePlayerDodge(pj, c);
    expect(hasCombatFlag(c, pj.id, 'dodging')).toBe(true);
  });

  it('ataque inimigo contra dodger usa disadvantage (resulta em menos hits)', () => {
    // Sem dodge: 100 ataques de +4 vs AC 22 → precisa nat ≥18 = 15% hit
    // Com disadvantage: P(nat ≥18) na pior de 2 dice = ~2.4% hit
    let hitsNoDodge = 0;
    let hitsDodge = 0;
    for (let i = 0; i < 200; i++) {
      const pj = mkPj();
      const c = mkCombat([pj]);
      const r = resolveEnemyTurn('e1', [pj], c);
      if (r?.hit) hitsNoDodge++;
    }
    for (let i = 0; i < 200; i++) {
      const pj = mkPj();
      const c = mkCombat([pj]);
      resolvePlayerDodge(pj, c);
      const r = resolveEnemyTurn('e1', [pj], c);
      if (r?.hit) hitsDodge++;
    }
    // Dodge deve reduzir hits substancialmente
    expect(hitsDodge).toBeLessThan(hitsNoDodge);
    // E mais que 50% de redução é esperado (de 15% pra ~2.4%)
    expect(hitsDodge).toBeLessThan(hitsNoDodge * 0.6);
  });

  it('flag dodging persiste até início do próximo turno do esquivador', () => {
    const pj = mkPj();
    const c = mkCombat([pj]);
    resolvePlayerDodge(pj, c);
    expect(hasCombatFlag(c, pj.id, 'dodging')).toBe(true);

    // Avança pra próximo participante (enemy)
    advanceTurn(c, [pj]);
    // Ainda dodging — enemy turn
    expect(hasCombatFlag(c, pj.id, 'dodging')).toBe(true);

    // Avança pra volta no PJ
    advanceTurn(c, [pj]);
    // Agora limpou no início do turno do PJ
    expect(hasCombatFlag(c, pj.id, 'dodging')).toBe(false);
  });
});

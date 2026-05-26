// Sprint 5 — Hide combat action (PHB pág 192).
// Stealth check vs maior passive Perception dos inimigos. Sucesso = flag 'hidden'
// → próximo ataque com advantage. Atacar consome a flag.

import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePlayerHide, resolvePlayerAttack } from '../combat.js';
import { hasCombatFlag, setCombatFlag } from '../class-features-engine.js';
import type { CharacterSheet, CombatState } from '../../shared/types.js';

function mkPj(stealthProficient = true): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Furtivo',
    raceId: 'humano', classId: 'ladino', backgroundId: 'criminoso', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 10, des: 18, con: 14, int: 12, sab: 12, car: 10 },
    abilityScores: { for: 10, des: 18, con: 14, int: 12, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 14,
    proficientSkills: stealthProficient ? ['furtividade'] : [],
    proficientSavingThrows: ['des', 'int'],
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

function mkCombat(pj: CharacterSheet, enemyAttackBonus = 4): CombatState {
  return {
    active: true, round: 1,
    initiativeOrder: [
      { id: pj.id, kind: 'player', initiative: 15, name: pj.characterName },
      { id: 'e1', kind: 'enemy', initiative: 10, name: 'Goblin' },
    ],
    currentTurnIndex: 0,
    enemies: [{
      id: 'e1', name: 'Goblin', maxHp: 10, currentHp: 10, armorClass: 13,
      attackBonus: enemyAttackBonus, damageDice: '1d6', damageBonus: 2, initiative: 10,
      conditions: [], description: '', isBoss: false, xpAward: 50,
    }],
    log: [],
  };
}

describe('Sprint 5 — resolvePlayerHide', () => {
  it('sucesso seta flag hidden no PJ', () => {
    const pj = mkPj();
    const combat = mkCombat(pj, 0);  // enemy fraco → DC baixa
    // Forçar muitos rolls pra eventually sucesso vai dar
    let sawSuccess = false;
    for (let i = 0; i < 50; i++) {
      const combatFresh = mkCombat(pj, 0);
      const r = resolvePlayerHide(pj, combatFresh);
      if (r.success) {
        expect(hasCombatFlag(combatFresh, pj.id, 'hidden')).toBe(true);
        sawSuccess = true;
        break;
      }
    }
    expect(sawSuccess).toBe(true);
  });

  it('falha NÃO seta flag hidden', () => {
    const pj = mkPj(false);  // sem proficiency
    pj.abilityScores.des = 6;  // -2 DEX mod
    // 50 rolls vs goblin DC 12 com -2 mod — espera muitas falhas
    let sawFailure = false;
    for (let i = 0; i < 50; i++) {
      const combatFresh = mkCombat(pj, 8);  // enemy forte → DC 14
      const r = resolvePlayerHide(pj, combatFresh);
      if (!r.success) {
        expect(hasCombatFlag(combatFresh, pj.id, 'hidden')).toBe(false);
        sawFailure = true;
        break;
      }
    }
    expect(sawFailure).toBe(true);
  });

  it('ataque após hide bem-sucedido limpa flag (consume)', () => {
    const pj = mkPj();
    const combat = mkCombat(pj);
    // Setup: força flag hidden manualmente pra teste isolado de "consume"
    combat.enemies[0]!.armorClass = 1; // garante hit
    setCombatFlag(combat, pj.id, 'hidden');
    expect(hasCombatFlag(combat, pj.id, 'hidden')).toBe(true);

    resolvePlayerAttack(pj, 'e1', combat, { damageDice: '1d4' });
    // Flag deve ter sido consumida
    expect(hasCombatFlag(combat, pj.id, 'hidden')).toBe(false);
  });

  it('DC baseia em maior passive Perception (derivada do attackBonus do inimigo mais forte)', () => {
    const pj = mkPj();
    // Inimigo com attackBonus 8 → DC = 10 + 4 = 14
    const combat = mkCombat(pj, 8);
    const r = resolvePlayerHide(pj, combat);
    expect(r.dc).toBe(14);
  });

  it('DC mínimo 10 mesmo sem inimigos vivos (PHB default)', () => {
    const pj = mkPj();
    const combat = mkCombat(pj);
    combat.enemies[0]!.currentHp = 0;  // todos mortos
    const r = resolvePlayerHide(pj, combat);
    expect(r.dc).toBe(10);
  });

  it('hide log narrativo contém roll e DC', () => {
    const pj = mkPj();
    const combat = mkCombat(pj);
    const r = resolvePlayerHide(pj, combat);
    expect(r.log).toMatch(/Furtividade \d+/);
    expect(r.log).toContain('DC');
  });
});

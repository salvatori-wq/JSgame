// Tests pra A2 — Buff engine genérico + B1 — Smart enemy AI.

import { describe, it, expect } from 'vitest';
import {
  addBuff, consumeBuffs, readAcBonus, tickBuffsEndOfTurn, clearAllBuffs,
  makeBardicInspiration, makeBless, makeGuidance, makeShield, makeFaerieFire,
} from '../buff-engine.js';
import { startCombat, resolveEnemyTurn } from '../combat.js';
import type { CharacterSheet } from '../../shared/types.js';

function mkPj(opts: { id?: string; hp?: number; maxHp?: number; isCaster?: boolean } = {}): CharacterSheet {
  return {
    id: opts.id ?? 'pj', ownerName: 'p', characterName: 'Test',
    raceId: 'humano', classId: opts.isCaster ? 'mago' : 'guerreiro',
    backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 14, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    maxHp: opts.maxHp ?? 30, currentHp: opts.hp ?? 30, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 14,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: opts.isCaster
      ? { 1:{max:4,used:0},2:{max:2,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} }
      : { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('A2 — Buff engine', () => {
  it('addBuff substitui mesma source (re-cast Bless dropa antigo)', () => {
    const pj = mkPj();
    addBuff(pj, makeBless()[0]!);
    addBuff(pj, makeBless()[0]!);
    const blessBuffs = pj.activeBuffs!.filter((b) => b.source === 'Bless (attack)');
    expect(blessBuffs.length).toBe(1);
  });

  it('consumeBuffs (attack) consome charge e remove esgotado', () => {
    const pj = mkPj();
    addBuff(pj, makeBardicInspiration('Lyra'));
    const r1 = consumeBuffs(pj, 'attack');
    expect(r1.diceBonus).toBeGreaterThanOrEqual(1);
    expect(r1.diceBonus).toBeLessThanOrEqual(6);
    expect(r1.consumedSources).toContain('Bardic Inspiration (Lyra)');
    expect(pj.activeBuffs!.find((b) => b.source.startsWith('Bardic'))).toBeUndefined();
    const r2 = consumeBuffs(pj, 'attack');
    expect(r2.diceBonus).toBe(0);
  });

  it('Bless aplica em attack E save (2 buffs distintos)', () => {
    const pj = mkPj();
    for (const b of makeBless()) addBuff(pj, b);
    expect(pj.activeBuffs!.length).toBe(2);
    const rAttack = consumeBuffs(pj, 'attack');
    expect(rAttack.diceBonus).toBeGreaterThanOrEqual(1);
    // Save buff ainda lá (não consumiu)
    expect(pj.activeBuffs!.find((b) => b.appliesTo === 'save')).toBeDefined();
  });

  it('readAcBonus retorna soma Shield', () => {
    const pj = mkPj();
    addBuff(pj, makeShield());
    const r = readAcBonus(pj);
    expect(r.flatBonus).toBe(5);
    expect(r.sources).toContain('Shield');
  });

  it('Faerie Fire dá advantage no attack', () => {
    const pj = mkPj();
    addBuff(pj, makeFaerieFire());
    const r = consumeBuffs(pj, 'attack');
    expect(r.advantage).toBe(true);
  });

  it('tickBuffsEndOfTurn decrementa turnsLeft, remove expirados', () => {
    const pj = mkPj();
    addBuff(pj, makeShield()); // turnsLeft: 1
    const r1 = tickBuffsEndOfTurn(pj);
    expect(r1.expired).toContain('Shield');
    expect(pj.activeBuffs!.length).toBe(0);
  });

  it('clearAllBuffs zera tudo (long rest)', () => {
    const pj = mkPj();
    addBuff(pj, makeShield());
    addBuff(pj, makeGuidance());
    clearAllBuffs(pj);
    expect(pj.activeBuffs!.length).toBe(0);
  });

  it('Guidance afeta skill-check apenas', () => {
    const pj = mkPj();
    addBuff(pj, makeGuidance());
    const rAttack = consumeBuffs(pj, 'attack');
    expect(rAttack.diceBonus).toBe(0);
    expect(rAttack.consumedSources.length).toBe(0);
    const rCheck = consumeBuffs(pj, 'skill-check');
    expect(rCheck.diceBonus).toBeGreaterThanOrEqual(1);
  });
});

describe('B1 — Smart enemy AI', () => {
  it('boss prioriza PJ com menor HP relativo', () => {
    const tank = mkPj({ id: 'tank', hp: 40, maxHp: 40 });   // 100%
    const wounded = mkPj({ id: 'wounded', hp: 5, maxHp: 30 }); // 17%
    const combat = startCombat({
      party: [tank, wounded],
      enemies: [{ name: 'Dragão', hp: 100, ac: 15, attackBonus: 5, isBoss: true }],
    });
    // 20 rodadas — boss deve mirar wounded a maioria das vezes
    let woundedHits = 0;
    for (let i = 0; i < 20; i++) {
      tank.currentHp = 40;
      wounded.currentHp = 5;
      const result = resolveEnemyTurn(combat.enemies[0]!.id, [tank, wounded], combat);
      if (result?.targetId === wounded.id) woundedHits++;
    }
    // Boss prioriza ~100% das vezes (score wounded muito maior)
    expect(woundedHits).toBeGreaterThanOrEqual(18);
  });

  it('boss prioriza concentrating-on-spell over healthy aliado', () => {
    const conc = mkPj({ id: 'conc', isCaster: true });
    conc.concentratingOn = 'bless' as never;
    const ally = mkPj({ id: 'ally' });
    const combat = startCombat({
      party: [conc, ally],
      enemies: [{ name: 'Boss', hp: 50, ac: 14, isBoss: true }],
    });
    let concHits = 0;
    for (let i = 0; i < 15; i++) {
      conc.currentHp = 30;
      ally.currentHp = 30;
      const result = resolveEnemyTurn(combat.enemies[0]!.id, [conc, ally], combat);
      if (result?.targetId === conc.id) concHits++;
    }
    // Conc + caster score ≈ 50; ally ≈ 0 → boss mira conc quase sempre
    expect(concHits).toBeGreaterThanOrEqual(12);
  });

  it('non-boss continua escolhendo random', () => {
    const pj1 = mkPj({ id: 'pj1', hp: 5, maxHp: 30 });
    const pj2 = mkPj({ id: 'pj2', hp: 30, maxHp: 30 });
    const combat = startCombat({
      party: [pj1, pj2],
      enemies: [{ name: 'Goblin', hp: 7, ac: 13, isBoss: false }],
    });
    let pj1Hits = 0;
    for (let i = 0; i < 50; i++) {
      pj1.currentHp = 5;
      pj2.currentHp = 30;
      const result = resolveEnemyTurn(combat.enemies[0]!.id, [pj1, pj2], combat);
      if (result?.targetId === pj1.id) pj1Hits++;
    }
    // Random ≈ 25/50. Não deve estar fixado em pj1.
    expect(pj1Hits).toBeGreaterThan(10);
    expect(pj1Hits).toBeLessThan(40);
  });
});

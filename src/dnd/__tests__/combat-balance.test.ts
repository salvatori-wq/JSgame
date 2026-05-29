// Fase 3 — Balance de combate freeform (anti-slog).

import { describe, it, expect } from 'vitest';
import { estimatePartyDpr, balanceFreeformEnemies } from '../combat-balance.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { ClassId } from '../classes.js';

function mkPj(classId: ClassId, level = 1, over: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: `pj-${classId}`, ownerName: 'p', characterName: classId,
    raceId: 'humano', classId, backgroundId: 'soldado', alignment: 'nn',
    level, xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: [],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...over,
  };
}

describe('estimatePartyDpr', () => {
  it('é positivo e determinístico (sem RNG)', () => {
    const party = [mkPj('guerreiro')];
    const a = estimatePartyDpr(party);
    const b = estimatePartyDpr(party);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it('party maior tem DPR maior', () => {
    const solo = estimatePartyDpr([mkPj('guerreiro')]);
    const trio = estimatePartyDpr([mkPj('guerreiro'), mkPj('mago'), mkPj('ladino')]);
    expect(trio).toBeGreaterThan(solo);
  });

  it('guerreiro nv5 (Extra Attack) > guerreiro nv1', () => {
    expect(estimatePartyDpr([mkPj('guerreiro', 5)])).toBeGreaterThan(estimatePartyDpr([mkPj('guerreiro', 1)]));
  });

  it('PJ caído (HP 0) não conta', () => {
    const full = estimatePartyDpr([mkPj('guerreiro'), mkPj('mago')]);
    const downed = estimatePartyDpr([mkPj('guerreiro'), mkPj('mago', 1, { currentHp: 0 })]);
    expect(downed).toBeLessThan(full);
  });
});

describe('balanceFreeformEnemies — o caso do playtest', () => {
  it('1 PJ vs 3 bandidos (33 HP, 8 rounds) → reduz HP pra ~4 rounds', () => {
    const party = [mkPj('guerreiro', 1)];
    const enemies = [
      { name: 'Bandido', hp: 11 },
      { name: 'Bandido', hp: 11 },
      { name: 'Bandido', hp: 11 },
    ];
    const r = balanceFreeformEnemies(party, enemies);
    expect(r.adjusted).toBe(true);
    expect(r.newTotalHp).toBeLessThan(r.originalTotalHp);
    // alvo ~ partyDpr × 4, com folga de AIM 1.2
    expect(r.newTotalHp).toBeLessThanOrEqual(Math.round(r.partyDpr * 4 * 1.2) + 3);
    expect(r.note).toContain('Combate calibrado');
  });

  it('NÃO infla HP de inimigo fraco (só reduz)', () => {
    const party = [mkPj('guerreiro', 5), mkPj('mago', 5), mkPj('ladino', 5)];
    const enemies = [{ name: 'Rato', hp: 3 }];
    const r = balanceFreeformEnemies(party, enemies);
    expect(r.adjusted).toBe(false);
    expect(r.enemies[0]!.hp).toBe(3);
  });

  it('respeita o piso (não reduz abaixo de 50% normal / 70% boss)', () => {
    const party = [mkPj('guerreiro', 1)]; // DPR baixo → fator agressivo
    const enemies = [
      { name: 'Tank', hp: 200, isBoss: false },
      { name: 'Chefe', hp: 200, isBoss: true },
    ];
    const r = balanceFreeformEnemies(party, enemies);
    const normal = r.enemies.find((e) => e.name === 'Tank')!;
    const boss = r.enemies.find((e) => e.name === 'Chefe')!;
    expect(normal.hp).toBeGreaterThanOrEqual(Math.round(200 * 0.5));
    expect(boss.hp).toBeGreaterThanOrEqual(Math.round(200 * 0.7));
  });

  it('preserva nome/flags, só mexe no HP', () => {
    const party = [mkPj('guerreiro', 1)];
    const enemies = [{ name: 'Ogro', hp: 100, isBoss: true }];
    const r = balanceFreeformEnemies(party, enemies);
    expect(r.enemies[0]!.name).toBe('Ogro');
    expect(r.enemies[0]!.isBoss).toBe(true);
  });

  it('combate já balanceado não é tocado', () => {
    const party = [mkPj('guerreiro', 1)];
    // partyDpr ~ (6.5+3)*0.6 = ~5.7 → alvo ~23 HP; 18 está dentro do threshold
    const enemies = [{ name: 'Goblin', hp: 7 }, { name: 'Goblin', hp: 7 }];
    const r = balanceFreeformEnemies(party, enemies);
    expect(r.adjusted).toBe(false);
  });
});

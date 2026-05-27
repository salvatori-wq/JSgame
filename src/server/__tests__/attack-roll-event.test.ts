// γ.1 — Tests que verificam que combat events emit `attack-roll` ANTES de
// `damage` (ou `attack-miss`). Cliente usa essa ordem pra abrir overlay do
// dado antes de revelar dano.

import { describe, it, expect } from 'vitest';
import { startCombat, resolvePlayerAttack, resolveEnemyTurn } from '../combat.js';
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
    deathSaveSuccesses: 0, deathSaveFailures: 0,
    exhaustion: 0,
    ...opts,
  };
}

describe('γ.1 — attack-roll combat event', () => {
  it('player attack emite attack-roll ANTES de damage/miss', () => {
    const attacker = makeChar('p1', 'Borin', { abilityScores: { for: 18, des: 10, con: 14, int: 8, sab: 10, car: 8 } });
    const combat = startCombat({
      party: [attacker],
      enemies: [{ name: 'Saco de Treino', hp: 50, ac: 5 }], // CA baixa = hit garantido
    });
    const targetId = combat.enemies[0]!.id;
    const res = resolvePlayerAttack(attacker, targetId, combat);
    expect(res).not.toBeNull();
    const events = res!.events;

    // attack-roll deve estar SEMPRE no índice 0
    expect(events[0]!.type).toBe('attack-roll');
    // value = roll total (1-20+bonus)
    expect(typeof events[0]!.value).toBe('number');
    expect(events[0]!.value).toBeGreaterThanOrEqual(1);
    // preview tem formato "d20+X vs CA Y"
    expect(events[0]!.preview).toMatch(/d20.+vs CA/);
    // sourceId e targetId presentes
    expect(events[0]!.sourceId).toBe('p1');
    expect(events[0]!.targetId).toBe(targetId);

    // O próximo event é damage (porque CA=5 sempre hit) ou attack-miss
    expect(['damage', 'attack-miss']).toContain(events[1]!.type);
  });

  it('attack-roll com nat20 marca crit:true', () => {
    // Forçar nat20 é difícil sem mock — testamos via 100 rolls
    const attacker = makeChar('p1', 'Borin', { abilityScores: { for: 18, des: 10, con: 14, int: 8, sab: 10, car: 8 } });
    const combat = startCombat({
      party: [attacker],
      enemies: [{ name: 'Treino', hp: 100, ac: 30 }],
    });
    const targetId = combat.enemies[0]!.id;
    let foundCrit = false;
    let foundNat1 = false;
    for (let i = 0; i < 200; i++) {
      // reset HP do enemy pra não acabar combate
      combat.enemies[0]!.currentHp = 100;
      const res = resolvePlayerAttack(attacker, targetId, combat);
      if (!res) continue;
      const ar = res.events[0]!;
      if (ar.crit) foundCrit = true;
      if (ar.nat1) foundNat1 = true;
      if (foundCrit && foundNat1) break;
    }
    expect(foundCrit).toBe(true);
    expect(foundNat1).toBe(true);
  });

  it('enemy attack também emite attack-roll antes de damage', () => {
    const player = makeChar('p1', 'Borin', { maxHp: 50, currentHp: 50, armorClass: 5 });
    const combat = startCombat({
      party: [player],
      enemies: [{ name: 'Brutamonte', hp: 30, ac: 12, attackBonus: 10, damageDice: '1d4' }],
    });
    const enemyId = combat.enemies[0]!.id;
    const res = resolveEnemyTurn(enemyId, [player], combat);
    expect(res).not.toBeNull();
    const events = res!.events;
    // Primeiro event = attack-roll
    expect(events[0]!.type).toBe('attack-roll');
    expect(events[0]!.sourceId).toBe(enemyId);
    expect(events[0]!.targetId).toBe('p1');
  });

  it('attack-roll preview inclui CA efetiva do alvo', () => {
    const attacker = makeChar('p1', 'Borin');
    const combat = startCombat({
      party: [attacker],
      enemies: [{ name: 'Knight', hp: 30, ac: 18 }],
    });
    const targetId = combat.enemies[0]!.id;
    const res = resolvePlayerAttack(attacker, targetId, combat);
    expect(res!.events[0]!.preview).toContain('CA 18');
  });
});

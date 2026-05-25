// Tests pro combat engine D&D 5e:
// - initiative ordering desc
// - attack vs CA (hit/miss/crit/fumble)
// - damage application + crit dobra dados
// - isCombatOver (vitória/derrota)
// - enemy AI escolhe alvo vivo

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  startCombat, resolvePlayerAttack, resolveEnemyTurn,
  isCombatOver, advanceTurn, currentParticipant, applyConditionTo,
} from '../combat.js';
import type { CharacterSheet, CombatState } from '../../shared/types.js';

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
    armorProficiencies: [], weaponProficiencies: ['Armas simples', 'Armas marciais'],
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

describe('combat engine', () => {
  describe('startCombat', () => {
    it('cria CombatState com initiative ordenada desc', () => {
      const party = [makeChar('a', 'Alice'), makeChar('b', 'Bob')];
      const c = startCombat({
        party,
        enemies: [{ name: 'Goblin', hp: 7, ac: 15 }],
      });
      expect(c.active).toBe(true);
      expect(c.round).toBe(1);
      expect(c.initiativeOrder.length).toBe(3);
      // ordem decrescente
      for (let i = 0; i < c.initiativeOrder.length - 1; i++) {
        expect(c.initiativeOrder[i]!.initiative).toBeGreaterThanOrEqual(c.initiativeOrder[i + 1]!.initiative);
      }
    });

    it('enemies têm defaults de attackBonus/damageDice', () => {
      const party = [makeChar('a', 'Alice')];
      const c = startCombat({
        party,
        enemies: [{ name: 'Goblin', hp: 7, ac: 15 }],
      });
      const en = c.enemies[0]!;
      expect(en.attackBonus).toBeGreaterThanOrEqual(-2);
      expect(en.damageDice).toBeTruthy();
      expect(en.maxHp).toBe(7);
      expect(en.currentHp).toBe(7);
    });
  });

  describe('resolvePlayerAttack', () => {
    let alice: CharacterSheet;
    let combat: CombatState;

    beforeEach(() => {
      alice = makeChar('alice', 'Alice');
      combat = startCombat({
        party: [alice],
        enemies: [{ name: 'Boneco', hp: 20, ac: 10 }], // CA baixa → fácil hit
      });
    });

    it('hit reduz HP do enemy', () => {
      const before = combat.enemies[0]!.currentHp;
      const r = resolvePlayerAttack(alice, combat.enemies[0]!.id, combat, { damageDice: '1d6' });
      expect(r).not.toBeNull();
      if (r!.hit) {
        expect(combat.enemies[0]!.currentHp).toBeLessThan(before);
      }
    });

    it('nat 20 sempre crita (não importa CA)', () => {
      // Mock Math.random pra forçar nat 20
      const spy = vi.spyOn(Math, 'random');
      // rollD20 chama rollDie(20) que faz 1 + floor(random * 20). Pra 20: random ≥ 0.95
      spy.mockReturnValue(0.99);
      const enemy = combat.enemies[0]!;
      enemy.armorClass = 30; // CA absurda — só nat20 acerta
      const r = resolvePlayerAttack(alice, enemy.id, combat, { damageDice: '1d6' });
      expect(r).not.toBeNull();
      expect(r!.crit).toBe(true);
      expect(r!.hit).toBe(true);
      spy.mockRestore();
    });

    it('nat 1 sempre erra', () => {
      const spy = vi.spyOn(Math, 'random');
      spy.mockReturnValue(0); // → 1
      const enemy = combat.enemies[0]!;
      enemy.armorClass = 1; // CA mínima — qualquer outro acertaria
      const r = resolvePlayerAttack(alice, enemy.id, combat, { damageDice: '1d6' });
      expect(r).not.toBeNull();
      expect(r!.hit).toBe(false);
      spy.mockRestore();
    });

    it('target enemy morto retorna null', () => {
      combat.enemies[0]!.currentHp = 0;
      const r = resolvePlayerAttack(alice, combat.enemies[0]!.id, combat);
      expect(r).toBeNull();
    });

    it('crit dobra a quantidade de dados rolados', () => {
      const spy = vi.spyOn(Math, 'random');
      spy.mockReturnValueOnce(0.99); // d20 → 20 (crit)
      // restante: 0.5 → ~3 em d8
      spy.mockReturnValue(0.5);
      const enemy = combat.enemies[0]!;
      enemy.armorClass = 25;
      const r = resolvePlayerAttack(alice, enemy.id, combat, { damageDice: '1d8' });
      expect(r!.crit).toBe(true);
      // Crit duplica dados: 1d8 vira 2d8 (rolls.length=2)
      expect(r!.damageRoll?.rolls.length).toBe(2);
      spy.mockRestore();
    });
  });

  describe('isCombatOver', () => {
    it('vitória quando todos enemies HP 0', () => {
      const party = [makeChar('a', 'Alice')];
      const c = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      c.enemies[0]!.currentHp = 0;
      const r = isCombatOver(c, party);
      expect(r.over).toBe(true);
      if (r.over) expect(r.victory).toBe(true);
    });

    it('derrota quando todos players HP 0', () => {
      const a = makeChar('a', 'Alice');
      const c = startCombat({ party: [a], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      a.currentHp = 0;
      const r = isCombatOver(c, [a]);
      expect(r.over).toBe(true);
      if (r.over) expect(r.victory).toBe(false);
    });

    it('ongoing quando ambos lados vivos', () => {
      const party = [makeChar('a', 'Alice')];
      const c = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const r = isCombatOver(c, party);
      expect(r.over).toBe(false);
    });
  });

  describe('resolveEnemyTurn', () => {
    it('enemy ataca player vivo e pode dar dano', () => {
      const alice = makeChar('a', 'Alice', { armorClass: 5 }); // CA baixa → fácil hit
      const c = startCombat({
        party: [alice],
        enemies: [{ name: 'Orc', hp: 15, ac: 13, attackBonus: 5, damageDice: '1d12', damageBonus: 3 }],
      });
      const en = c.enemies[0]!;
      const r = resolveEnemyTurn(en.id, [alice], c);
      expect(r).not.toBeNull();
      expect(r!.attackerId).toBe(en.id);
      expect(r!.targetId).toBe(alice.id);
    });

    it('sem alvos vivos retorna null', () => {
      const alice = makeChar('a', 'Alice');
      alice.currentHp = 0;
      const c = startCombat({ party: [alice], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const r = resolveEnemyTurn(c.enemies[0]!.id, [alice], c);
      expect(r).toBeNull();
    });

    it('player downed ganha condição inconsciente automaticamente', () => {
      const spy = vi.spyOn(Math, 'random');
      // Força nat 20 + dano alto
      spy.mockReturnValueOnce(0.99); // d20=20
      spy.mockReturnValue(0.99); // dmg high
      const alice = makeChar('a', 'Alice', { armorClass: 5, currentHp: 1, maxHp: 12 });
      const c = startCombat({
        party: [alice],
        enemies: [{ name: 'Boss', hp: 30, ac: 18, attackBonus: 8, damageDice: '2d8', damageBonus: 5 }],
      });
      const en = c.enemies[0]!;
      const r = resolveEnemyTurn(en.id, [alice], c);
      expect(r).not.toBeNull();
      if (r!.hit) {
        expect(alice.currentHp).toBe(0);
        expect(alice.conditions).toContain('inconsciente');
      }
      spy.mockRestore();
    });
  });

  describe('advanceTurn', () => {
    it('avança index circular e incrementa round ao zerar', () => {
      const party = [makeChar('a', 'A'), makeChar('b', 'B')];
      const c = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const initialRound = c.round;
      const len = c.initiativeOrder.length;

      // Avança len vezes — deve dar round=2
      for (let i = 0; i < len; i++) {
        advanceTurn(c, party);
      }
      expect(c.round).toBeGreaterThanOrEqual(initialRound + 1);
    });

    it('pula participantes mortos', () => {
      const a = makeChar('a', 'A');
      const c = startCombat({
        party: [a],
        enemies: [{ name: 'X', hp: 5, ac: 10 }, { name: 'Y', hp: 5, ac: 10 }],
      });
      // Mata um enemy
      c.enemies[0]!.currentHp = 0;
      // Avança turn — deve pular o morto
      const adv = advanceTurn(c, [a]);
      const cur = currentParticipant(c);
      if (cur && cur.kind === 'enemy') {
        const en = c.enemies.find((e) => e.id === cur.id);
        expect(en?.currentHp).toBeGreaterThan(0);
      }
      expect(adv.combatOver).toBe(false);
    });
  });

  describe('applyConditionTo', () => {
    it('aplica condição a enemy', () => {
      const a = makeChar('a', 'A');
      const c = startCombat({ party: [a], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const en = c.enemies[0]!;
      const r = applyConditionTo(c, [a], en.id, 'envenenado');
      expect(r.applied).toBe(true);
      expect(en.conditions).toContain('envenenado');
    });

    it('aplica condição a player', () => {
      const a = makeChar('a', 'A');
      const c = startCombat({ party: [a], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const r = applyConditionTo(c, [a], a.id, 'amedrontado');
      expect(r.applied).toBe(true);
      expect(a.conditions).toContain('amedrontado');
    });

    it('alvo inválido retorna applied=false', () => {
      const a = makeChar('a', 'A');
      const c = startCombat({ party: [a], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
      const r = applyConditionTo(c, [a], 'nonexistent-id', 'envenenado');
      expect(r.applied).toBe(false);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

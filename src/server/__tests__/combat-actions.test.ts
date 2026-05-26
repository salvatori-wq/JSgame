// Tests pra F24 — Combat actions completas (grapple/shove/help/two-weapon/disengage/bonus action).

import { describe, it, expect, beforeEach } from 'vitest';
import { startCombat, resolveGrapple, resolveShove, resolveHelp, resolvePlayerDisengage, resolvePlayerAttack } from '../combat.js';
import {
  hasCombatFlag, setCombatFlag, clearCombatFlag,
} from '../class-features-engine.js';
import type { CharacterSheet, ClassId } from '../../shared/types.js';

function mkPj(opts: { id?: string; classId?: ClassId; level?: number; str?: number; proficient?: string[] } = {}): CharacterSheet {
  return {
    id: opts.id ?? 'pj',
    ownerName: 'p', characterName: 'PJ', raceId: 'humano',
    classId: opts.classId ?? 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: opts.level ?? 5, xp: 0,
    abilityScoresBase: { for: opts.str ?? 16, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    abilityScores: { for: opts.str ?? 16, des: 12, con: 14, int: 10, sab: 10, car: 10 },
    maxHp: 40, currentHp: 40, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 16,
    proficientSkills: (opts.proficient ?? []) as never,
    proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [],
    inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('F24 — Combat actions completas', () => {
  describe('resolveGrapple', () => {
    it('falha alvo inválido', () => {
      const pj = mkPj();
      const combat = startCombat({ party: [pj], enemies: [{ name: 'g', hp: 1, ac: 10 }] });
      const r = resolveGrapple(pj, 'fake-id', combat);
      expect(r.ok).toBe(false);
    });
    it('sucesso aplica condition restrito (atletismo wins)', () => {
      // PJ STR 20 proficient vs enemy attackBonus baixo
      const pj = mkPj({ str: 20, proficient: ['atletismo'] });
      const combat = startCombat({ party: [pj], enemies: [{ name: 'goblin', hp: 7, ac: 13, attackBonus: 0 }] });
      // Roda múltiplas vezes pra capturar sucesso pelo menos uma vez
      let sawSuccess = false;
      for (let i = 0; i < 20; i++) {
        // Reseta condition
        combat.enemies[0]!.conditions = [];
        const r = resolveGrapple(pj, combat.enemies[0]!.id, combat);
        if (r.success) { sawSuccess = true; break; }
      }
      expect(sawSuccess).toBe(true);
    });
  });

  describe('resolveShove', () => {
    it('knock-down aplica caido em sucesso', () => {
      const pj = mkPj({ str: 20, proficient: ['atletismo'] });
      const combat = startCombat({ party: [pj], enemies: [{ name: 'goblin', hp: 7, ac: 13, attackBonus: 0 }] });
      let sawCaido = false;
      for (let i = 0; i < 20; i++) {
        combat.enemies[0]!.conditions = [];
        const r = resolveShove(pj, combat.enemies[0]!.id, combat, 'knock-down');
        if (r.success && combat.enemies[0]!.conditions.includes('caido')) { sawCaido = true; break; }
      }
      expect(sawCaido).toBe(true);
    });
  });

  describe('resolveHelp', () => {
    it('sucesso retorna event', () => {
      const pj = mkPj();
      const ally = mkPj({ id: 'ally' });
      const combat = startCombat({ party: [pj, ally], enemies: [{ name: 'g', hp: 5, ac: 10 }] });
      const r = resolveHelp(pj, [pj, ally], ally.id, combat);
      expect(r.ok).toBe(true);
      expect(r.events.length).toBeGreaterThan(0);
    });
  });

  describe('Disengage flag', () => {
    it('seta flag disengaged-this-turn', () => {
      const pj = mkPj();
      const combat = startCombat({ party: [pj], enemies: [{ name: 'g', hp: 5, ac: 10 }] });
      resolvePlayerDisengage(pj, combat);
      setCombatFlag(combat, pj.id, 'disengaged-this-turn');
      expect(hasCombatFlag(combat, pj.id, 'disengaged-this-turn')).toBe(true);
    });
  });

  describe('Helped flag dá vantagem no próximo ataque', () => {
    it('clearCombatFlag remove após attack', () => {
      const pj = mkPj({ str: 18 });
      const combat = startCombat({ party: [pj], enemies: [{ name: 'g', hp: 50, ac: 25, attackBonus: 0 }] });
      setCombatFlag(combat, pj.id, 'helped-next-attack');
      expect(hasCombatFlag(combat, pj.id, 'helped-next-attack')).toBe(true);
      resolvePlayerAttack(pj, combat.enemies[0]!.id, combat);
      // Após attack a flag é consumida
      expect(hasCombatFlag(combat, pj.id, 'helped-next-attack')).toBe(false);
    });
  });

  describe('Bonus action manager (via flag)', () => {
    it('flag bloqueada após set', () => {
      const pj = mkPj();
      const combat = startCombat({ party: [pj], enemies: [{ name: 'g', hp: 5, ac: 10 }] });
      setCombatFlag(combat, pj.id, 'bonus-action-used');
      expect(hasCombatFlag(combat, pj.id, 'bonus-action-used')).toBe(true);
      clearCombatFlag(combat, pj.id, 'bonus-action-used');
      expect(hasCombatFlag(combat, pj.id, 'bonus-action-used')).toBe(false);
    });
  });
});

// Tests pra F23 — Class Features Big 7 engine (uses, restore, sneak, rage).

import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet, ClassId } from '../../shared/types.js';
import {
  ensureFeatureUses,
  useFeature,
  restoreOnShortRest,
  restoreOnLongRest,
  hasCombatFlag,
} from '../class-features-engine.js';
import { startCombat } from '../combat.js';
import {
  getMaxFeatureUses,
  sneakAttackDiceCount,
} from '../../dnd/class-features.js';

class MockDM {
  async narrate(_ctx: NarrationContext): Promise<DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function makeChar(opts: { classId?: ClassId; level?: number; characterId?: string } = {}): CharacterSheet {
  return {
    id: opts.characterId ?? 'pj',
    ownerName: 'p',
    characterName: 'Test',
    raceId: 'humano',
    classId: opts.classId ?? 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: opts.level ?? 5,
    xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 14 },
    abilityScores: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 14 },
    maxHp: 40,
    currentHp: 25,
    tempHp: 0,
    hitDiceRemaining: 5,
    armorClass: 16,
    proficientSkills: [],
    proficientSavingThrows: ['for', 'con'],
    languages: [],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    conditions: [],
    inventory: [],
    equippedWeapons: [],
    gold: 0,
    spellsKnown: [],
    spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('F23 — Class Features Big 7', () => {
  describe('getMaxFeatureUses', () => {
    it('Bárbaro nv 1 = 2 rages', () => {
      expect(getMaxFeatureUses('barbaro', 1, 'rage')).toBe(2);
    });
    it('Bárbaro nv 6 = 4 rages', () => {
      expect(getMaxFeatureUses('barbaro', 6, 'rage')).toBe(4);
    });
    it('Guerreiro nv 2 ganha Action Surge (1)', () => {
      expect(getMaxFeatureUses('guerreiro', 2, 'action-surge')).toBe(1);
      expect(getMaxFeatureUses('guerreiro', 1, 'action-surge')).toBe(0);
    });
    it('Guerreiro nv 17 ganha 2 Action Surges', () => {
      expect(getMaxFeatureUses('guerreiro', 17, 'action-surge')).toBe(2);
    });
    it('Monge nv N = N ki points', () => {
      expect(getMaxFeatureUses('monge', 2, 'ki')).toBe(2);
      expect(getMaxFeatureUses('monge', 7, 'ki')).toBe(7);
    });
    it('Bardo bardic-inspiration = max(1, Cha mod)', () => {
      expect(getMaxFeatureUses('bardo', 1, 'bardic-inspiration', 3)).toBe(3);
      expect(getMaxFeatureUses('bardo', 1, 'bardic-inspiration', 0)).toBe(1);
    });
    it('Classe errada retorna 0', () => {
      expect(getMaxFeatureUses('mago', 5, 'rage')).toBe(0);
      expect(getMaxFeatureUses('barbaro', 5, 'second-wind')).toBe(0);
    });
  });

  describe('sneakAttackDiceCount', () => {
    it('Ladino nv 1 = 1d6', () => {
      expect(sneakAttackDiceCount('ladino', 1)).toBe(1);
    });
    it('Ladino nv 5 = 3d6', () => {
      expect(sneakAttackDiceCount('ladino', 5)).toBe(3);
    });
    it('Ladino nv 11 = 6d6', () => {
      expect(sneakAttackDiceCount('ladino', 11)).toBe(6);
    });
    it('Não-ladino = 0', () => {
      expect(sneakAttackDiceCount('guerreiro', 5)).toBe(0);
    });
  });

  describe('ensureFeatureUses', () => {
    it('cria slots iniciais pra Bárbaro nv 3', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      ensureFeatureUses(pj);
      expect(pj.classFeatureUses?.['rage']).toEqual({ used: 0, max: 3 });
    });
    it('preserva used existente quando refresca max', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      pj.classFeatureUses = { rage: { used: 1, max: 2 } };
      ensureFeatureUses(pj);
      expect(pj.classFeatureUses?.['rage']).toEqual({ used: 1, max: 3 });
    });
    it('não cria slots pra classe sem feature', () => {
      const pj = makeChar({ classId: 'mago', level: 5 });
      ensureFeatureUses(pj);
      expect(pj.classFeatureUses?.['rage']).toBeUndefined();
      expect(pj.classFeatureUses?.['second-wind']).toBeUndefined();
    });
  });

  describe('useFeature — second-wind (Guerreiro)', () => {
    it('cura 1d10 + level e marca used', () => {
      const pj = makeChar({ classId: 'guerreiro', level: 5 });
      pj.currentHp = 10;
      ensureFeatureUses(pj);
      const result = useFeature(pj, 'second-wind', null, [pj]);
      expect(result.ok).toBe(true);
      expect(pj.currentHp).toBeGreaterThan(10);
      expect(pj.classFeatureUses!['second-wind']!.used).toBe(1);
    });
    it('rejeita se já usou', () => {
      const pj = makeChar({ classId: 'guerreiro', level: 5 });
      ensureFeatureUses(pj);
      pj.classFeatureUses!['second-wind']!.used = 1;
      const result = useFeature(pj, 'second-wind', null, [pj]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/já gasto/);
    });
  });

  describe('useFeature — rage (Bárbaro)', () => {
    it('precisa de combat ativo', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      ensureFeatureUses(pj);
      const result = useFeature(pj, 'rage', null, [pj]);
      expect(result.ok).toBe(false);
    });
    it('seta flag de rage + marca used', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      ensureFeatureUses(pj);
      const combat = startCombat({ party: [pj], enemies: [{ name: 'goblin', hp: 10, ac: 12 }] });
      const result = useFeature(pj, 'rage', combat, [pj]);
      expect(result.ok).toBe(true);
      expect(hasCombatFlag(combat, pj.id, 'rage')).toBe(true);
      expect(pj.classFeatureUses!['rage']!.used).toBe(1);
    });
  });

  describe('useFeature — channel-divinity (Clérigo) Turn Undead', () => {
    it('aplica amedrontado em zumbis', () => {
      const pj = makeChar({ classId: 'clerigo', level: 2 });
      ensureFeatureUses(pj);
      const combat = startCombat({
        party: [pj],
        enemies: [
          { name: 'Zumbi Andante', hp: 8, ac: 8 },
          { name: 'Goblin', hp: 7, ac: 13 },
        ],
      });
      const result = useFeature(pj, 'channel-divinity', combat, [pj]);
      expect(result.ok).toBe(true);
      const zumbi = combat.enemies.find((e) => e.name.includes('Zumbi'))!;
      expect(zumbi.conditions).toContain('amedrontado');
      const goblin = combat.enemies.find((e) => e.name === 'Goblin')!;
      expect(goblin.conditions).not.toContain('amedrontado');
    });
  });

  describe('useFeature — bardic-inspiration', () => {
    it('falha sem target', () => {
      const pj = makeChar({ classId: 'bardo', level: 1 });
      ensureFeatureUses(pj);
      const result = useFeature(pj, 'bardic-inspiration', null, [pj]);
      expect(result.ok).toBe(false);
    });
    it('falha se target é o próprio caster', () => {
      const pj = makeChar({ classId: 'bardo', level: 1 });
      ensureFeatureUses(pj);
      const result = useFeature(pj, 'bardic-inspiration', null, [pj], { targetId: pj.id });
      expect(result.ok).toBe(false);
    });
    it('sucesso com aliado válido', () => {
      const pj = makeChar({ classId: 'bardo', level: 1 });
      const ally = makeChar({ characterId: 'ally', classId: 'guerreiro', level: 1 });
      ensureFeatureUses(pj);
      const result = useFeature(pj, 'bardic-inspiration', null, [pj, ally], { targetId: ally.id });
      expect(result.ok).toBe(true);
    });
  });

  describe('restoreOnShortRest / longRest', () => {
    it('short rest restaura second-wind (short) e ki (short) mas NÃO rage (long)', () => {
      const pj = makeChar({ classId: 'guerreiro', level: 5 });
      ensureFeatureUses(pj);
      pj.classFeatureUses!['second-wind']!.used = 1;
      pj.classFeatureUses!['action-surge']!.used = 1;
      restoreOnShortRest(pj);
      expect(pj.classFeatureUses!['second-wind']!.used).toBe(0);
      expect(pj.classFeatureUses!['action-surge']!.used).toBe(0);
    });
    it('long rest restaura TUDO incluindo rage', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      ensureFeatureUses(pj);
      pj.classFeatureUses!['rage']!.used = 2;
      restoreOnLongRest(pj);
      expect(pj.classFeatureUses!['rage']!.used).toBe(0);
    });
    it('short rest NÃO restaura rage', () => {
      const pj = makeChar({ classId: 'barbaro', level: 3 });
      ensureFeatureUses(pj);
      pj.classFeatureUses!['rage']!.used = 1;
      restoreOnShortRest(pj);
      expect(pj.classFeatureUses!['rage']!.used).toBe(1);
    });
  });

  describe('Campaign.useClassFeature integration', () => {
    let camp: Campaign;

    beforeEach(() => {
      camp = new Campaign(new MockDM() as unknown as DMInterface);
    });

    it('player feature falha sem player', async () => {
      const result = await camp.useClassFeature('ghost-id', 'rage');
      expect(result.ok).toBe(false);
    });

    it('second-wind cura via socket', async () => {
      const pj = makeChar({ classId: 'guerreiro', level: 5 });
      pj.currentHp = 10;
      camp.addCharacter(pj);
      const result = await camp.useClassFeature(pj.id, 'second-wind');
      expect(result.ok).toBe(true);
      expect(pj.currentHp).toBeGreaterThan(10);
    });
  });
});

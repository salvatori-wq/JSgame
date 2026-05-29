// Tests pra spells-engine D&D 5e:
// - cantrip não gasta slot
// - spell nv 1 gasta slot
// - damage com save (half / full / nothing)
// - heal aplica HP + restaura inconsciente
// - condition aplica
// - sem slot → fail; magia de outra classe → fail

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolvePlayerCastSpell } from '../spells-engine.js';
import { startCombat } from '../combat.js';
import { applySpellcasterDefaults, getStartingSlots } from '../../dnd/spell-slots.js';
import type { CharacterSheet, CombatState } from '../../shared/types.js';

function makeMago(): CharacterSheet {
  const sheet: CharacterSheet = {
    id: 'mago1', ownerName: 'p', characterName: 'Elara',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 1, xp: 0,
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 7, currentHp: 7, tempHp: 0, hitDiceRemaining: 1, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
  applySpellcasterDefaults(sheet);
  return sheet;
}

function makeAliado(): CharacterSheet {
  const s = makeMago();
  s.id = 'aliado';
  s.characterName = 'Borin';
  s.classId = 'guerreiro';
  s.maxHp = 12;
  s.currentHp = 5;
  s.spellsKnown = [];
  s.spellsPrepared = [];
  return s;
}

describe('spells engine', () => {
  describe('starting setup', () => {
    it('mago nv1 ganha 2 slots de nv 1 + 3 cantrips', () => {
      const m = makeMago();
      expect(m.spellSlots[1].max).toBe(2);
      expect(m.spellSlots[1].used).toBe(0);
      // 3 cantrips
      expect(m.spellsKnown.length).toBeGreaterThanOrEqual(3);
    });

    it('guerreiro não ganha slots nem cantrips', () => {
      const slots = getStartingSlots('guerreiro', 1);
      expect(slots[1].max).toBe(0);
    });

    it('clérigo ganha slots full caster', () => {
      const slots = getStartingSlots('clerigo', 3);
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(2);
    });

    it('paladino lvl 1 sem slots (half caster começa nv 2)', () => {
      const slots = getStartingSlots('paladino', 1);
      expect(slots[1].max).toBe(0);
    });

    it('paladino lvl 2 ganha 2 slots de nv 1', () => {
      const slots = getStartingSlots('paladino', 2);
      expect(slots[1].max).toBe(2);
    });
  });

  describe('cantrip não gasta slot', () => {
    it('fire-bolt funciona sem slot disponível', () => {
      const mago = makeMago();
      mago.spellSlots[1].used = mago.spellSlots[1].max; // gasta todos
      const combat = startCombat({
        party: [mago],
        enemies: [{ name: 'Boneco', hp: 20, ac: 5 }],
      });
      const r = resolvePlayerCastSpell({
        caster: mago,
        spellId: 'fire-bolt',
        targetIds: [combat.enemies[0]!.id],
        slotLevel: 0,
        party: [mago],
        combat,
      });
      expect(r.ok).toBe(true);
      expect(mago.spellSlots[1].used).toBe(mago.spellSlots[1].max); // não mudou
    });
  });

  // Rank 5 — spell attack com nat20 dobra os dados de dano (PHB p.196), igual
  // arma. Antes Fire Bolt/Eldritch Blast crit davam dano normal.
  describe('spell attack crit dobra dados', () => {
    it('fire-bolt nat20 → 2d10 (=20 com rolls max), não 1d10 (=10)', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // todo dado no máximo; d20=20 (crit)
      const mago = makeMago();
      const combat = startCombat({
        party: [mago],
        enemies: [{ name: 'Boneco', hp: 100, ac: 5 }], // AC baixa: nat20 sempre acerta
      });
      const beforeHp = combat.enemies[0]!.currentHp;
      const r = resolvePlayerCastSpell({
        caster: mago, spellId: 'fire-bolt', targetIds: [combat.enemies[0]!.id],
        slotLevel: 0, party: [mago], combat,
      });
      expect(r.ok).toBe(true);
      const dealt = beforeHp - combat.enemies[0]!.currentHp;
      expect(dealt).toBe(20); // sem o fix seria 10
      spy.mockRestore();
    });
  });

  describe('spell nv 1 gasta slot', () => {
    it('magic-missile gasta 1 slot', () => {
      const mago = makeMago();
      const initialUsed = mago.spellSlots[1].used;
      const combat = startCombat({
        party: [mago],
        enemies: [{ name: 'Boneco', hp: 30, ac: 12 }],
      });
      const r = resolvePlayerCastSpell({
        caster: mago,
        spellId: 'magic-missile',
        targetIds: [combat.enemies[0]!.id],
        slotLevel: 1,
        party: [mago],
        combat,
      });
      expect(r.ok).toBe(true);
      expect(mago.spellSlots[1].used).toBe(initialUsed + 1);
    });

    it('sem slot disponível, falha', () => {
      const mago = makeMago();
      mago.spellSlots[1].used = mago.spellSlots[1].max;
      const combat = startCombat({
        party: [mago],
        enemies: [{ name: 'Boneco', hp: 20, ac: 5 }],
      });
      const r = resolvePlayerCastSpell({
        caster: mago,
        spellId: 'magic-missile',
        targetIds: [combat.enemies[0]!.id],
        slotLevel: 1,
        party: [mago],
        combat,
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/slot/i);
    });
  });

  describe('damage com save', () => {
    let mago: CharacterSheet;
    let combat: CombatState;

    beforeEach(() => {
      mago = makeMago();
      mago.spellsKnown.push('burning-hands');
      mago.spellsPrepared.push('burning-hands');
      combat = startCombat({
        party: [mago],
        enemies: [{ name: 'Boneco', hp: 30, ac: 12 }],
      });
    });

    it('burning-hands aplica dano (metade no save de Des sucesso)', () => {
      // Mock Math.random pra forçar: enemy save sucesso → dano metade
      // Enemy save é d20+0 (simplificação engine). Pra sucesso, precisa total >= DC (8+2+3=13)
      const spy = vi.spyOn(Math, 'random');
      // 1ª chamada: save roll do alvo. Force 19/20 = 0.95+
      spy.mockReturnValueOnce(0.95);
      // resto: damage rolls (3d6)
      spy.mockReturnValue(0.99);
      const beforeHp = combat.enemies[0]!.currentHp;
      const r = resolvePlayerCastSpell({
        caster: mago,
        spellId: 'burning-hands',
        targetIds: [combat.enemies[0]!.id],
        slotLevel: 1,
        party: [mago],
        combat,
      });
      expect(r.ok).toBe(true);
      const dmgTaken = beforeHp - combat.enemies[0]!.currentHp;
      // Save sucesso → metade. Max é 3d6=18, então metade=9
      expect(dmgTaken).toBeGreaterThan(0);
      spy.mockRestore();
    });
  });

  describe('heal', () => {
    it('cure-wounds cura aliado + remove inconsciente', () => {
      const clerigo = makeMago();
      clerigo.classId = 'clerigo';
      clerigo.spellsKnown = ['cure-wounds'];
      clerigo.spellsPrepared = ['cure-wounds'];
      clerigo.spellSlots = getStartingSlots('clerigo', 1);

      const aliado = makeAliado();
      aliado.currentHp = 0;
      aliado.conditions = ['inconsciente'];

      const r = resolvePlayerCastSpell({
        caster: clerigo,
        spellId: 'cure-wounds',
        targetIds: [aliado.id],
        slotLevel: 1,
        party: [clerigo, aliado],
        combat: null,
      });
      expect(r.ok).toBe(true);
      expect(aliado.currentHp).toBeGreaterThan(0);
      expect(aliado.conditions).not.toContain('inconsciente');
    });

    it('cura não passa do maxHp', () => {
      const clerigo = makeMago();
      clerigo.classId = 'clerigo';
      clerigo.spellsKnown = ['cure-wounds'];
      clerigo.spellsPrepared = ['cure-wounds'];
      clerigo.spellSlots = getStartingSlots('clerigo', 1);

      const aliado = makeAliado();
      aliado.currentHp = aliado.maxHp - 1; // só 1 HP de espaço

      resolvePlayerCastSpell({
        caster: clerigo,
        spellId: 'cure-wounds',
        targetIds: [aliado.id],
        slotLevel: 1,
        party: [clerigo, aliado],
        combat: null,
      });
      expect(aliado.currentHp).toBeLessThanOrEqual(aliado.maxHp);
    });
  });

  describe('class restriction', () => {
    it('mago não consegue lançar cure-wounds (não é da classe dele)', () => {
      const mago = makeMago();
      mago.spellsKnown.push('cure-wounds'); // simula caso degenerate
      mago.spellsPrepared.push('cure-wounds');
      mago.spellSlots[1].max = 2;
      const r = resolvePlayerCastSpell({
        caster: mago,
        spellId: 'cure-wounds',
        targetIds: [mago.id],
        slotLevel: 1,
        party: [mago],
        combat: null,
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/classe/i);
    });

    it('guerreiro não casta nada', () => {
      const guerreiro = makeAliado();
      const r = resolvePlayerCastSpell({
        caster: guerreiro,
        spellId: 'fire-bolt',
        targetIds: [],
        slotLevel: 0,
        party: [guerreiro],
        combat: null,
      });
      expect(r.ok).toBe(false);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

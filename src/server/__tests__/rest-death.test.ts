// Tests pra Campaign.shortRest, longRest, rollDeathSave (PHB pág 186, 197).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet } from '../../shared/types.js';
import { applySpellcasterDefaults } from '../../dnd/spell-slots.js';

class MockDM {
  async narrate(_ctx: NarrationContext): Promise<DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function makeChar(opts: { classId?: 'guerreiro' | 'mago' | 'clerigo'; currentHp?: number; conditions?: never[] } = {}): CharacterSheet {
  const sheet: CharacterSheet = {
    id: 'pj', ownerName: 'p', characterName: 'Test',
    raceId: 'humano', classId: opts.classId ?? 'guerreiro',
    backgroundId: 'soldado', alignment: 'nn',
    level: 3, xp: 0,
    abilityScoresBase: { for: 14, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    abilityScores: { for: 14, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    maxHp: 22, currentHp: opts.currentHp ?? 22, tempHp: 0,
    hitDiceRemaining: 3, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: opts.conditions ?? [],
    inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
  if (opts.classId === 'mago' || opts.classId === 'clerigo') applySpellcasterDefaults(sheet);
  return sheet;
}

describe('Campaign rest', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new MockDM() as unknown as DMInterface);
  });

  describe('shortRest', () => {
    it('gasta hit dice e cura HP', async () => {
      const pj = makeChar({ currentHp: 5 });
      camp.addCharacter(pj);
      const r = await camp.shortRest(pj.id, 2);
      expect(r.ok).toBe(true);
      expect(r.diceSpent).toBe(2);
      expect(r.healed).toBeGreaterThanOrEqual(2);
      expect(pj.hitDiceRemaining).toBe(1);
      expect(pj.currentHp).toBeGreaterThan(5);
    });

    it('rejeita em combate', async () => {
      const pj = makeChar();
      camp.addCharacter(pj);
      camp.state.combat = { active: true, round: 1, initiativeOrder: [], currentTurnIndex: 0, enemies: [], log: [] };
      const r = await camp.shortRest(pj.id, 1);
      expect(r.ok).toBe(false);
    });

    it('limita hit dice ao disponível', async () => {
      const pj = makeChar({ currentHp: 1 });
      pj.hitDiceRemaining = 1;
      camp.addCharacter(pj);
      const r = await camp.shortRest(pj.id, 999);
      expect(r.ok).toBe(true);
      expect(r.diceSpent).toBe(1);
      expect(pj.hitDiceRemaining).toBe(0);
    });

    it('cura não passa do maxHp', async () => {
      const pj = makeChar({ currentHp: 21 });
      pj.hitDiceRemaining = 3;
      camp.addCharacter(pj);
      const r = await camp.shortRest(pj.id, 3);
      expect(r.ok).toBe(true);
      expect(pj.currentHp).toBeLessThanOrEqual(pj.maxHp);
    });

    it('cura traz de volta da inconsciência', async () => {
      const pj = makeChar({ currentHp: 0 });
      pj.conditions = ['inconsciente'];
      pj.hitDiceRemaining = 2;
      camp.addCharacter(pj);
      const r = await camp.shortRest(pj.id, 2);
      expect(r.ok).toBe(true);
      expect(pj.conditions).not.toContain('inconsciente');
    });
  });

  describe('longRest', () => {
    it('full HP + reset slots + half hit dice voltam', async () => {
      const mago = makeChar({ classId: 'mago' });
      mago.currentHp = 5;
      mago.hitDiceRemaining = 0;
      mago.spellSlots[1].used = mago.spellSlots[1].max;
      camp.addCharacter(mago);

      const r = await camp.longRest(mago.id);
      expect(r.ok).toBe(true);
      expect(mago.currentHp).toBe(mago.maxHp);
      expect(mago.spellSlots[1].used).toBe(0);
      expect(mago.hitDiceRemaining).toBeGreaterThanOrEqual(1);
    });

    it('rejeita em combate', async () => {
      const pj = makeChar();
      camp.addCharacter(pj);
      camp.state.combat = { active: true, round: 1, initiativeOrder: [], currentTurnIndex: 0, enemies: [], log: [] };
      const r = await camp.longRest(pj.id);
      expect(r.ok).toBe(false);
    });

    it('reseta death saves', async () => {
      const pj = makeChar();
      pj.deathSaveSuccesses = 2;
      pj.deathSaveFailures = 1;
      camp.addCharacter(pj);
      await camp.longRest(pj.id);
      expect(pj.deathSaveSuccesses).toBe(0);
      expect(pj.deathSaveFailures).toBe(0);
    });
  });
});

describe('Campaign death saves', () => {
  let camp: Campaign;
  let pj: CharacterSheet;

  beforeEach(() => {
    camp = new Campaign(new MockDM() as unknown as DMInterface);
    pj = makeChar({ currentHp: 0 });
    camp.addCharacter(pj);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('roll < 10 conta como falha', async () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.05); // d20 ≈ 2
    const r = await camp.rollDeathSave(pj.id);
    expect(r.ok).toBe(true);
    expect(r.success).toBe(false);
    expect(pj.deathSaveFailures).toBe(1);
  });

  it('roll ≥ 10 conta como sucesso', async () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.7); // d20 ≈ 15
    const r = await camp.rollDeathSave(pj.id);
    expect(r.ok).toBe(true);
    expect(r.success).toBe(true);
    expect(pj.deathSaveSuccesses).toBe(1);
  });

  it('3 sucessos estabiliza', async () => {
    pj.deathSaveSuccesses = 2;
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.7); // d20 ≈ 15
    const r = await camp.rollDeathSave(pj.id);
    expect(r.stabilized).toBe(true);
    expect(pj.deathSaveSuccesses).toBe(0); // reset após estabilizar
  });

  it('3 falhas mata (deathCount++)', async () => {
    pj.deathSaveFailures = 2;
    const before = pj.deathCount;
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.05); // d20 ≈ 2
    const r = await camp.rollDeathSave(pj.id);
    expect(r.died).toBe(true);
    expect(pj.deathCount).toBe(before + 1);
  });

  it('nat 20 recupera 1 HP e reseta saves', async () => {
    pj.deathSaveSuccesses = 1;
    pj.deathSaveFailures = 2;
    pj.conditions = ['inconsciente'];
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.99); // d20 = 20
    const r = await camp.rollDeathSave(pj.id);
    expect(r.nat20).toBe(true);
    expect(pj.currentHp).toBe(1);
    expect(pj.deathSaveSuccesses).toBe(0);
    expect(pj.deathSaveFailures).toBe(0);
    expect(pj.conditions).not.toContain('inconsciente');
  });

  it('nat 1 conta como 2 falhas', async () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0); // d20 = 1
    const r = await camp.rollDeathSave(pj.id);
    expect(r.nat1).toBe(true);
    expect(pj.deathSaveFailures).toBe(2);
  });

  it('rejeita se HP > 0', async () => {
    pj.currentHp = 5;
    const r = await camp.rollDeathSave(pj.id);
    expect(r.ok).toBe(false);
  });
});

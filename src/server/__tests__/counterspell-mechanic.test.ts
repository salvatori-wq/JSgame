// Tests pra S2 — Counterspell mecânico: bloqueia apply_damage/apply_condition
// quando pendingEnemySpell.cancelled === true.

import { describe, it, expect, beforeEach } from 'vitest';
import { applyValidatedToolToCampaign } from '../dm-tool-applier.js';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet } from '../../shared/types.js';

class MockDM {
  async narrate(_ctx: NarrationContext): Promise<DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function mkPj(): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Lyra',
    raceId: 'alto-elfo', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 18, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 14, con: 12, int: 18, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: ['counterspell'], spellsPrepared: ['counterspell'],
    spellSlots: { 1:{max:4,used:0},2:{max:3,used:0},3:{max:2,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('S2 — Counterspell mecânico bloqueia apply_damage/apply_condition', () => {
  let camp: Campaign;
  beforeEach(() => {
    camp = new Campaign(new MockDM() as unknown as DMInterface);
    camp.addCharacter(mkPj());
  });

  it('apply_damage NORMAL quando sem pendingEnemySpell', () => {
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_damage', playerId: 'pj', damage: 10, type: 'fogo', reason: 'fireball',
    });
    expect(camp.party[0]!.currentHp).toBe(20);
  });

  it('apply_damage BLOQUEADO quando pendingEnemySpell.cancelled=true', () => {
    camp.state.pendingEnemySpell = {
      id: 'pes-1', sourceName: 'Mago Cinza', spellName: 'Fireball', spellLevel: 3,
      targetIds: ['pj'], visible: true, cancelled: true,
      createdAt: Date.now(), windowMs: 5000,
    };
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_damage', playerId: 'pj', damage: 30, type: 'fogo', reason: 'fireball',
    });
    expect(camp.party[0]!.currentHp).toBe(30);  // damage anulado
    expect(camp.state.pendingEnemySpell).toBeNull();  // pending limpa
  });

  it('apply_damage NORMAL quando pendingEnemySpell.cancelled=false (passou contramágica)', () => {
    camp.state.pendingEnemySpell = {
      id: 'pes-1', sourceName: 'Mago Cinza', spellName: 'Fireball', spellLevel: 3,
      targetIds: ['pj'], visible: true, cancelled: false,
      createdAt: Date.now(), windowMs: 5000,
    };
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_damage', playerId: 'pj', damage: 20, type: 'fogo', reason: 'fireball',
    });
    expect(camp.party[0]!.currentHp).toBe(10);  // damage aplicado
    expect(camp.state.pendingEnemySpell).toBeNull();  // pending limpa após resolução
  });

  it('apply_damage all bloqueia damage em toda party quando cancelled', () => {
    const pj2 = mkPj();
    pj2.id = 'pj2';
    camp.addCharacter(pj2);
    camp.state.pendingEnemySpell = {
      id: 'pes-1', sourceName: 'Lich', spellName: 'Meteor Swarm', spellLevel: 9,
      targetIds: [], visible: true, cancelled: true,
      createdAt: Date.now(), windowMs: 5000,
    };
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_damage', playerId: 'all', damage: 40, type: 'fogo', reason: 'meteor',
    });
    expect(camp.party[0]!.currentHp).toBe(30);
    expect(camp.party[1]!.currentHp).toBe(30);
    expect(camp.state.pendingEnemySpell).toBeNull();
  });

  it('apply_condition BLOQUEADO quando cancelled', () => {
    camp.state.pendingEnemySpell = {
      id: 'pes-1', sourceName: 'Bruxa', spellName: 'Hold Person', spellLevel: 2,
      targetIds: ['pj'], visible: true, cancelled: true,
      createdAt: Date.now(), windowMs: 5000,
    };
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_condition', targetId: 'pj', condition: 'paralisado', reason: 'hold',
    });
    expect(camp.party[0]!.conditions).not.toContain('paralisado');
    expect(camp.state.pendingEnemySpell).toBeNull();
  });

  it('apply_condition NORMAL quando sem pendingEnemySpell', () => {
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_condition', targetId: 'pj', condition: 'envenenado', reason: 'veneno',
    });
    expect(camp.party[0]!.conditions).toContain('envenenado');
  });

  it('apply_damage limpa pending mesmo quando aplica (sequência cast→damage)', () => {
    camp.state.pendingEnemySpell = {
      id: 'pes-1', sourceName: 'X', spellName: 'Fireball', spellLevel: 3,
      targetIds: ['pj'], visible: true, cancelled: false,
      createdAt: Date.now(), windowMs: 5000,
    };
    applyValidatedToolToCampaign(camp, {
      kind: 'apply_damage', playerId: 'pj', damage: 10, type: 'fogo', reason: 'r',
    });
    expect(camp.state.pendingEnemySpell).toBeNull();
  });
});

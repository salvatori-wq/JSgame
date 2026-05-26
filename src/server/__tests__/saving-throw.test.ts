// Tests pra F27 — Saving throw genérico unificado.

import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet } from '../../shared/types.js';
import { validateToolCall } from '../dm/tools.js';

class MockDM {
  async narrate(_ctx: NarrationContext): Promise<DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function mkPj(): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Test',
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 16, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 16, des: 12, con: 16, int: 10, sab: 10, car: 10 },
    maxHp: 40, currentHp: 40, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 16,
    proficientSkills: [],
    proficientSavingThrows: ['for', 'con'],
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

describe('F27 — request_saving_throw tool', () => {
  it('valida ability conhecido', () => {
    const tool = validateToolCall({ name: 'request_saving_throw', input: { ability: 'des', dc: 15, reason: 'esquivar bola de fogo', playerId: 'p1' } } as never);
    expect(tool).toMatchObject({ kind: 'request_saving_throw', ability: 'des', dc: 15, playerId: 'p1' });
  });

  it('rejeita ability inválido', () => {
    const tool = validateToolCall({ name: 'request_saving_throw', input: { ability: 'xxx', dc: 15, reason: 'ruim' } } as never);
    expect(tool).toBeNull();
  });

  it('clampa DC fora do range', () => {
    const tool = validateToolCall({ name: 'request_saving_throw', input: { ability: 'for', dc: 100, reason: 'super' } } as never);
    expect((tool as { dc: number }).dc).toBeLessThanOrEqual(30);
  });

  it('default DC 15 se não passar', () => {
    const tool = validateToolCall({ name: 'request_saving_throw', input: { ability: 'con', reason: 'veneno' } } as never);
    expect((tool as { dc: number }).dc).toBe(15);
  });
});

describe('F27 — Campaign.resolveSavingThrow', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new MockDM() as unknown as DMInterface);
  });

  it('sem pending = null', async () => {
    const r = await camp.resolveSavingThrow('pj');
    expect(r).toBeNull();
  });

  it('player não dono = null', async () => {
    const pj = mkPj();
    camp.addCharacter(pj);
    camp.state.pendingSave = { ability: 'des', dc: 15, reason: 'r', playerId: 'other' };
    const r = await camp.resolveSavingThrow(pj.id);
    expect(r).toBeNull();
  });

  it('player dono rola e limpa pending', async () => {
    const pj = mkPj();
    camp.addCharacter(pj);
    camp.state.pendingSave = { ability: 'for', dc: 10, reason: 'puxa porta', playerId: pj.id };
    const r = await camp.resolveSavingThrow(pj.id);
    expect(r).not.toBeNull();
    expect(r!.roll.total).toBeGreaterThanOrEqual(1 + 3 + 3); // STR mod 3 + prof 3
    expect(camp.state.pendingSave).toBeNull();
  });

  it('proficiência aplicada se PJ tem em proficientSavingThrows', async () => {
    const pj = mkPj(); // proficient em for, con
    camp.addCharacter(pj);
    // CON save: tem proficiência → bonus = 3 (mod) + 3 (pb nv 5) = 6
    // d20+6 vs DC 10 → precisa nat ≥4 (P=17/20=85%).
    // Estatística: 30 rolls, ≥20 sucessos. P(≥20|0.85,30) ≈ 0.9998 — efetivamente nunca falha.
    let success = 0;
    for (let i = 0; i < 30; i++) {
      camp.state.pendingSave = { ability: 'con', dc: 10, reason: 'veneno', playerId: pj.id };
      const r = await camp.resolveSavingThrow(pj.id);
      if (r?.success) success++;
    }
    expect(success).toBeGreaterThanOrEqual(20);
  });

  it('sem proficiência usa só ability mod', async () => {
    const pj = mkPj();
    camp.addCharacter(pj);
    // SAB save: NÃO tem proficiência → bonus = 0 (mod 10 = 0)
    camp.state.pendingSave = { ability: 'sab', dc: 18, reason: 'difícil', playerId: pj.id };
    let success = 0;
    for (let i = 0; i < 20; i++) {
      camp.state.pendingSave = { ability: 'sab', dc: 18, reason: 'd', playerId: pj.id };
      const r = await camp.resolveSavingThrow(pj.id);
      if (r?.success) success++;
    }
    // d20 vs 18 → precisa ≥18 = só 3/20 = 15% nominalmente
    expect(success).toBeLessThan(8);
  });
});

// α.3 — Tests inspirações DnD (PHB pág 125).
// Cobre: validator grant_inspiration, handler clamp max 3, resolveSkillCheck
// useInspiration força advantage + decrementa, useInspiration sem ter é no-op.

import { describe, it, expect, beforeEach } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string, name: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: ['atletismo'], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('α.3 — validateToolCall grant_inspiration', () => {
  it('valida estrutura mínima', () => {
    const r = validateToolCall({
      name: 'grant_inspiration',
      input: { playerId: 'pj-1', reason: 'fala icônica' },
    });
    expect(r?.kind === 'grant_inspiration' && r.playerId).toBe('pj-1');
    expect(r?.kind === 'grant_inspiration' && r.reason).toBe('fala icônica');
  });

  it('default playerId "active"', () => {
    const r = validateToolCall({
      name: 'grant_inspiration',
      input: { reason: 'boa decisão' },
    });
    expect(r?.kind === 'grant_inspiration' && r.playerId).toBe('active');
  });

  it('limita reason a 200 chars', () => {
    const r = validateToolCall({
      name: 'grant_inspiration',
      input: { playerId: 'pj-1', reason: 'x'.repeat(500) },
    });
    expect(r?.kind === 'grant_inspiration' && r.reason.length).toBeLessThanOrEqual(200);
  });
});

describe('α.3 — Campaign grant_inspiration handler', () => {
  let camp: Campaign;
  let pj: CharacterSheet;

  beforeEach(() => {
    camp = new Campaign(fakeDM, { id: 'c-insp', name: 'T' });
    pj = makePJ('pj-1', 'Borin');
    camp.addCharacter(pj);
  });

  it('incrementa inspirations de 0 → 1', () => {
    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'grant_inspiration', playerId: 'pj-1', reason: 'salvou o NPC arriscando vida',
    });
    expect(pj.inspirations).toBe(1);
  });

  it('clampa a 3 (PHB max)', () => {
    const apply = (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool.bind(camp);
    for (let i = 0; i < 5; i++) {
      apply({ kind: 'grant_inspiration', playerId: 'pj-1', reason: `r${i}` });
    }
    expect(pj.inspirations).toBe(3);
  });

  it('resolve playerId "active" pro primeiro PJ', () => {
    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'grant_inspiration', playerId: 'active', reason: 'r',
    });
    expect(pj.inspirations).toBe(1);
  });
});

describe('α.3 — resolveSkillCheck useInspiration', () => {
  let camp: Campaign;
  let pj: CharacterSheet;

  beforeEach(() => {
    camp = new Campaign(fakeDM, { id: 'c-resolve', name: 'T' });
    pj = makePJ('pj-1', 'Borin');
    pj.inspirations = 2;
    camp.addCharacter(pj);
    camp.state.pendingCheck = { skill: 'atletismo', dc: 15, reason: 'escalar', playerId: 'pj-1' };
  });

  it('useInspiration=true decrementa de 2 → 1', async () => {
    const result = await camp.resolveSkillCheck('pj-1', { useInspiration: true });
    expect(result?.usedInspiration).toBe(true);
    expect(pj.inspirations).toBe(1);
  });

  it('useInspiration=false não consome', async () => {
    const result = await camp.resolveSkillCheck('pj-1', { useInspiration: false });
    expect(result?.usedInspiration).toBe(false);
    expect(pj.inspirations).toBe(2);
  });

  it('useInspiration sem ter (0) é no-op silencioso', async () => {
    pj.inspirations = 0;
    camp.state.pendingCheck = { skill: 'atletismo', dc: 15, reason: 'X', playerId: 'pj-1' };
    const result = await camp.resolveSkillCheck('pj-1', { useInspiration: true });
    expect(result?.usedInspiration).toBe(false);
    expect(pj.inspirations).toBe(0);
  });

  it('omitido = false (não usa)', async () => {
    const result = await camp.resolveSkillCheck('pj-1');
    expect(result?.usedInspiration).toBe(false);
    expect(pj.inspirations).toBe(2);
  });
});

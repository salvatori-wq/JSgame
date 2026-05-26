// Tests pra 3B — Player escolhe dificuldade de combate.
// CampaignState.combatDifficulty influencia SYSTEM_PROMPT pra DM respeitar.

import { describe, it, expect } from 'vitest';
import { buildNarrationPrompt, type NarrationContext } from '../dm/prompts.js';
import type { CampaignState, CharacterSheet } from '../../shared/types.js';

function mkBaseState(overrides?: Partial<CampaignState>): CampaignState {
  return {
    id: 'camp', name: 'Test', mode: 'exploration',
    partyCharacterIds: [], currentLocation: 'Vila',
    currentSceneDescription: '', worldFlags: {},
    npcsMet: [], recentEvents: [], sessionNumber: 1,
    startedAt: 0, lastPlayedAt: 0,
    pendingCheck: null, pendingSave: null, combat: null,
    ...overrides,
  };
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

describe('3B — combatDifficulty no SYSTEM_PROMPT', () => {
  it('sem combatDifficulty (auto) NÃO injeta bloco de difficulty', () => {
    const ctx: NarrationContext = {
      campaign: mkBaseState(),
      party: [mkPj()],
    };
    const prompt = buildNarrationPrompt(ctx);
    expect(prompt).not.toContain('DIFICULDADE DE COMBATE');
  });

  it('combatDifficulty=auto também NÃO injeta', () => {
    const ctx: NarrationContext = {
      campaign: mkBaseState({ combatDifficulty: 'auto' }),
      party: [mkPj()],
    };
    const prompt = buildNarrationPrompt(ctx);
    expect(prompt).not.toContain('DIFICULDADE DE COMBATE');
  });

  it('combatDifficulty=easy injeta instrução pro DM', () => {
    const ctx: NarrationContext = {
      campaign: mkBaseState({ combatDifficulty: 'easy' }),
      party: [mkPj()],
    };
    const prompt = buildNarrationPrompt(ctx);
    expect(prompt).toContain('DIFICULDADE DE COMBATE');
    expect(prompt).toContain('difficulty="easy"');
  });

  it('combatDifficulty=deadly injeta com nível deadly', () => {
    const ctx: NarrationContext = {
      campaign: mkBaseState({ combatDifficulty: 'deadly' }),
      party: [mkPj()],
    };
    const prompt = buildNarrationPrompt(ctx);
    expect(prompt).toContain('difficulty="deadly"');
  });

  it('cada nível distinto aparece no prompt', () => {
    for (const diff of ['easy', 'medium', 'hard', 'deadly'] as const) {
      const ctx: NarrationContext = {
        campaign: mkBaseState({ combatDifficulty: diff }),
        party: [mkPj()],
      };
      const prompt = buildNarrationPrompt(ctx);
      expect(prompt).toContain(`difficulty="${diff}"`);
    }
  });
});

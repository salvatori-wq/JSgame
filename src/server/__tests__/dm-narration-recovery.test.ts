// BUG-001 — Recovery quando provider devolve narração vazia.
// Gemini com toolConfig=auto (e às vezes Groq) chama functionCalls e omite text part.
// dm.narrate deve detectar narração vazia + toolCalls e retentar sem tools.

import { describe, it, expect } from 'vitest';
import { DungeonMaster } from '../dm/dm.js';
import type { DMProvider, DMRawResponse, DMToolDef } from '../dm/providers/base.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet } from '../../shared/types.js';

class StubProvider implements DMProvider {
  readonly name = 'stub';
  calls: Array<{ withTools: boolean }> = [];
  constructor(private replies: DMRawResponse[]) {}
  async generate(opts: { tools?: DMToolDef[] } & Record<string, unknown>): Promise<DMRawResponse> {
    const idx = Math.min(this.calls.length, this.replies.length - 1);
    this.calls.push({ withTools: !!opts.tools });
    return this.replies[idx]!;
  }
}

function mkContext(): NarrationContext {
  const pj: CharacterSheet = {
    id: 'pj', ownerName: 'p', characterName: 'Lyra',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 3, xp: 0,
    abilityScoresBase: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 18, currentHp: 18, tempHp: 0,
    hitDiceRemaining: 3, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
  return {
    campaign: {
      id: 'camp', name: 'Test', mode: 'exploration',
      partyCharacterIds: ['pj'],
      currentLocation: 'Taverna do Dragão Caolho',
      currentSceneDescription: '',
      worldFlags: {},
      npcsMet: [],
      recentEvents: [],
      sessionNumber: 1,
      startedAt: 0, lastPlayedAt: 0,
      pendingCheck: null, pendingSave: null,
      combat: null,
      combatDifficulty: 'auto',
    },
    party: [pj],
    recentNarrations: [],
    memoryFacts: [],
  };
}

describe('BUG-001 — DM narration recovery', () => {
  it('retenta sem tools quando primeira call devolve text vazio + toolCalls', async () => {
    const provider = new StubProvider([
      { text: '', toolCalls: [{ name: 'roll_skill_check', input: { skill: 'arcanismo', dc: 10 } }] },
      { text: '{"narration":"A taverna range. Algo chia no canto.","speaker":"Mestre"}', toolCalls: [] },
    ]);
    const dm = new DungeonMaster(provider);
    const result = await dm.narrate(mkContext());

    expect(provider.calls.length).toBe(2);
    expect(provider.calls[0]!.withTools).toBe(true);
    expect(provider.calls[1]!.withTools).toBe(false);
    expect(result.narration).toBe('A taverna range. Algo chia no canto.');
    expect(result.speaker).toBe('Mestre');
  });

  it('aceita narration válida no primeiro try sem retentar', async () => {
    const provider = new StubProvider([
      { text: '{"narration":"Cena perfeita.","speaker":"Mestre"}', toolCalls: [] },
    ]);
    const dm = new DungeonMaster(provider);
    const result = await dm.narrate(mkContext());

    expect(provider.calls.length).toBe(1);
    expect(result.narration).toBe('Cena perfeita.');
  });

  it('cai em graceful fallback se retry sem tools também devolve vazio', async () => {
    const provider = new StubProvider([
      { text: '', toolCalls: [{ name: 'roll_skill_check', input: {} }] },
      { text: '   ', toolCalls: [] },
    ]);
    const dm = new DungeonMaster(provider);
    const result = await dm.narrate(mkContext());

    expect(provider.calls.length).toBe(2);
    // BUG-Ω.5 — FallbackDM agora gera narrações decentes via templates
    // (speaker "Mestre (offline)" detectado por isDegradedNarration no client).
    expect(result.speaker).toBe('Mestre (offline)');
    expect(result.narration.length).toBeGreaterThan(10);
  });

  it('cobre o caso "narration":"" literal — string vazia em JSON válido', async () => {
    const provider = new StubProvider([
      { text: '{"narration":"","speaker":"Mestre"}', toolCalls: [{ name: 'apply_damage', input: {} }] },
      { text: '{"narration":"Recovery ok.","speaker":"Mestre"}', toolCalls: [] },
    ]);
    const dm = new DungeonMaster(provider);
    const result = await dm.narrate(mkContext());

    expect(provider.calls.length).toBe(2);
    expect(result.narration).toBe('Recovery ok.');
  });

  it('não retenta sem tools se narração vazia mas sem toolCalls (LLM realmente travou)', async () => {
    const provider = new StubProvider([
      { text: '', toolCalls: [] },
    ]);
    const dm = new DungeonMaster(provider);
    const result = await dm.narrate(mkContext());

    expect(provider.calls.length).toBe(1);
    // BUG-Ω.5 — FallbackDM agora gera narrações decentes via templates
    // (speaker "Mestre (offline)" detectado por isDegradedNarration no client).
    expect(result.speaker).toBe('Mestre (offline)');
  });
});

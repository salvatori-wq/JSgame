// Fase 2 — GOLDEN da contingência: o streaming é só uma PRÉVIA; a resposta
// bufferizada + pós-processada continua sendo a autoridade. Prova que:
//   1. os deltas que chegam ao client são a narração LIMPA (sem o envelope JSON);
//   2. o bug V.2 ("narração vazia + toolCalls → combate nunca inicia") continua
//      RESOLVIDO no mundo streamado: o retry-sem-tools roda e as toolCalls
//      originais sobrevivem, sem vazar nada na prévia.

import { describe, it, expect } from 'vitest';
import { DungeonMaster } from '../dm';
import type { DMProvider, DMRawResponse, GenerateOpts } from '../providers/base';
import type { NarrationContext } from '../prompts';
import type { CharacterSheet } from '../../../shared/types';

class StreamStub implements DMProvider {
  readonly name = 'stream-stub';
  streamCalls = 0;
  generateCalls = 0;
  constructor(
    private streamRaw: string,
    private streamReturn: DMRawResponse,
    private generateReplies: DMRawResponse[] = [],
  ) {}
  async generate(_opts: GenerateOpts): Promise<DMRawResponse> {
    const idx = Math.min(this.generateCalls, this.generateReplies.length - 1);
    this.generateCalls += 1;
    return this.generateReplies[idx] ?? { text: '', toolCalls: [] };
  }
  async generateStream(_opts: GenerateOpts, onText: (d: string) => void): Promise<DMRawResponse> {
    this.streamCalls += 1;
    for (let i = 0; i < this.streamRaw.length; i += 5) onText(this.streamRaw.slice(i, i + 5)); // chunks de 5
    return this.streamReturn;
  }
}

function mkContext(): NarrationContext {
  const pj = {
    id: 'pj', ownerName: 'p', characterName: 'Lyra',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 3, xp: 0,
    abilityScoresBase: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 18, currentHp: 18, tempHp: 0, hitDiceRemaining: 3, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  } as unknown as CharacterSheet;
  return {
    campaign: {
      id: 'camp', name: 'Test', mode: 'exploration',
      partyCharacterIds: ['pj'],
      currentLocation: 'Taverna do Dragão Caolho',
      currentSceneDescription: '',
      worldFlags: {}, npcsMet: [], recentEvents: [],
      sessionNumber: 1, startedAt: 0, lastPlayedAt: 0,
      pendingCheck: null, pendingSave: null, combat: null, combatDifficulty: 'auto',
    },
    party: [pj], recentNarrations: [], memoryFacts: [],
  } as unknown as NarrationContext;
}

describe('DungeonMaster.narrate streaming — Fase 2 golden', () => {
  it('happy path: os deltas chegam LIMPOS (sem JSON) e a narração final bate', async () => {
    const raw = '{"narration":"Você vê o orc girar o machado.","speaker":"Mestre"}';
    const stub = new StreamStub(raw, { text: raw, toolCalls: [{ name: 'suggest_actions', input: { actions: [] } }] });
    const dm = new DungeonMaster(stub);
    const deltas: string[] = [];
    const res = await dm.narrate(mkContext(), (d) => deltas.push(d));

    const preview = deltas.join('');
    expect(preview).toBe('Você vê o orc girar o machado.');
    expect(preview).not.toContain('"narration"');
    expect(preview).not.toContain('{');
    expect(res.narration).toBe('Você vê o orc girar o machado.');
    expect(stub.streamCalls).toBe(1);
  });

  it('V.2: narração vazia + toolCalls no stream → retry preserva as toolCalls, prévia não vaza', async () => {
    const stub = new StreamStub(
      '',                                                   // stream não emite narração (caso V.2)
      { text: '', toolCalls: [{ name: 'start_combat', input: { surprise: false, enemies: [{ name: 'Orc', hp: 10, ac: 13 }] } }] },
      [{ text: '{"narration":"O machado sobe no ar — a dança começa."}', toolCalls: [] }], // retry sem tools
    );
    const dm = new DungeonMaster(stub);
    const deltas: string[] = [];
    const res = await dm.narrate(mkContext(), (d) => deltas.push(d));

    // narração veio do retry (não-vazia)
    expect(res.narration).toContain('machado sobe');
    // V.2 — as toolCalls ORIGINAIS sobreviveram ao retry-sem-tools
    expect(res.toolCalls.map((t) => t.name)).toContain('start_combat');
    // a prévia não vazou NADA durante o stream vazio
    expect(deltas.join('')).toBe('');
    expect(stub.streamCalls).toBe(1);
    expect(stub.generateCalls).toBe(1); // o retry usou generate (sem stream)
  });
});

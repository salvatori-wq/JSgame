// Integration tests: Campaign + MemoryStore.
// - Indexer: tool calls geram facts persistentes
// - Retriever: próxima narração recebe facts relevantes via memoryFacts
// - Idempotência: NPC já conhecido não duplica fact

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { Campaign } from '../campaign.js';
import { MemoryStore } from '../memory.js';
import type { DMResponse } from '../dm/dm.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { NarrationContext } from '../dm/prompts.js';

async function freshMemoryClient(): Promise<Client> {
  const client = createClient({ url: ':memory:' });
  await client.batch([
    `CREATE TABLE memory_facts (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, kind TEXT NOT NULL,
      text TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
      importance REAL NOT NULL DEFAULT 1.0, session_n INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_memory_facts_campaign ON memory_facts(campaign_id, created_at DESC)`,
    `CREATE VIRTUAL TABLE memory_facts_fts USING fts5(
      fact_id UNINDEXED, campaign_id UNINDEXED, kind UNINDEXED,
      text, tags, tokenize='unicode61 remove_diacritics 2'
    )`,
  ], 'write');
  return client;
}

// DM mock que captura contextos e pode encadear responses pre-programadas.
class MockDM {
  contexts: NarrationContext[] = [];
  responses: DMResponse[] = [];

  async narrate(ctx: NarrationContext): Promise<DMResponse> {
    this.contexts.push(ctx);
    const next = this.responses.shift();
    return next ?? { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function makeChar(id: string, name = 'Test'): CharacterSheet {
  return {
    id, ownerName: 'tester', characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 1, xp: 0,
    abilityScoresBase: { for: 14, des: 12, con: 13, int: 10, sab: 10, car: 8 },
    abilityScores: { for: 15, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: ['Comum'], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: Date.now(), lastPlayedAt: Date.now(),
    deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('Campaign + MemoryStore (RAG integration)', () => {
  let client: Client;
  let memory: MemoryStore;
  let dm: MockDM;
  let campaign: Campaign;

  beforeEach(async () => {
    client = await freshMemoryClient();
    memory = new MemoryStore(client);
    dm = new MockDM();
    campaign = new Campaign(dm as any, { id: 'camp-test', memory });
    campaign.addCharacter(makeChar('p1', 'Borin'));
  });

  it('describe_scene tool indexa location fact', async () => {
    dm.responses.push({
      narration: 'Vocês entram na taverna do Cervo Vermelho.',
      speaker: 'Mestre',
      toolCalls: [{ name: 'describe_scene', input: { location: 'Taverna do Cervo Vermelho', description: 'Lugar úmido e barulhento.' } }],
      raw: '',
    });
    await campaign.takeAction('p1', 'entrar');

    const facts = await memory.recent('camp-test');
    const locFact = facts.find((f) => f.kind === 'location');
    expect(locFact).toBeDefined();
    expect(locFact!.text).toContain('Cervo Vermelho');
  });

  it('npc_speaks indexa NPC fact com importance > 1', async () => {
    dm.responses.push({
      narration: 'Um homem barbado te encara.',
      speaker: 'Mestre',
      toolCalls: [{ name: 'npc_speaks', input: { name: 'Borin Barbalonga', archetype: 'ferreiro', attitude: 'hostil', dialogue: 'cala a boca' } }],
      raw: '',
    });
    await campaign.takeAction('p1', 'falar com ferreiro');

    const facts = await memory.search('camp-test', 'ferreiro');
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0]!.kind).toBe('npc');
    expect(facts[0]!.importance).toBeGreaterThan(1);
  });

  it('quote literal de NPC (speaker custom) vira fact', async () => {
    dm.responses.push({
      narration: 'Saiam ou apodreçam aqui mesmo.',
      speaker: 'Velho Cego',
      toolCalls: [],
      raw: '',
    });
    await campaign.takeAction('p1', 'ouvir');

    const facts = await memory.search('camp-test', 'velho cego');
    const quote = facts.find((f) => f.text.includes('apodreçam'));
    expect(quote).toBeDefined();
    expect(quote!.kind).toBe('npc');
  });

  it('quote do Mestre NÃO vira fact (só NPCs viram)', async () => {
    dm.responses.push({
      narration: 'O vento sopra forte.',
      speaker: 'Mestre',
      toolCalls: [],
      raw: '',
    });
    await campaign.takeAction('p1', 'esperar');

    const count = await memory.count('camp-test');
    expect(count).toBe(0);
  });

  it('fallback degradado NÃO vira fact', async () => {
    dm.responses.push({
      narration: 'O Mestre travou no éter.',
      speaker: 'Mestre (degradado)',
      toolCalls: [],
      raw: '',
    });
    await campaign.takeAction('p1', 'esperar');

    const count = await memory.count('camp-test');
    expect(count).toBe(0);
  });

  it('give_item indexa inventory fact', async () => {
    dm.responses.push({
      narration: 'Você acha uma espada.',
      speaker: 'Mestre',
      toolCalls: [{
        name: 'give_item',
        input: { playerId: 'p1', itemName: 'Lâmina do Sussurro', type: 'arma', quantity: 1, description: 'arma rara' },
      }],
      raw: '',
    });
    await campaign.takeAction('p1', 'procurar');

    const facts = await memory.search('camp-test', 'lâmina sussurro');
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0]!.kind).toBe('inventory');
  });

  it('start_combat indexa event fact', async () => {
    dm.responses.push({
      narration: 'Goblins atacam!',
      speaker: 'Mestre',
      toolCalls: [{
        name: 'start_combat',
        input: { enemies: [{ monsterId: 'goblin' }] },
      }],
      raw: '',
    });
    await campaign.takeAction('p1', 'fugir');

    const facts = await memory.search('camp-test', 'goblin');
    expect(facts.find((f) => f.kind === 'event')).toBeDefined();
  });

  it('próxima narração recebe memoryFacts relevantes', async () => {
    // 1ª ação: estabelece NPC
    dm.responses.push({
      narration: 'O ferreiro Borin te encara.',
      speaker: 'Mestre',
      toolCalls: [{ name: 'npc_speaks', input: { name: 'Borin', archetype: 'ferreiro', attitude: 'neutro' } }],
      raw: '',
    });
    await campaign.takeAction('p1', 'falar com ferreiro');

    // 2ª ação relacionada — deve trazer fact do Borin
    dm.responses.push({ narration: 'ok', speaker: 'Mestre', toolCalls: [], raw: '' });
    await campaign.takeAction('p1', 'voltar pro ferreiro Borin');

    const lastCtx = dm.contexts[dm.contexts.length - 1];
    expect(lastCtx!.memoryFacts).toBeDefined();
    expect(lastCtx!.memoryFacts!.length).toBeGreaterThan(0);
    expect(lastCtx!.memoryFacts!.some((f) => f.text.includes('Borin'))).toBe(true);
  });

  it('NPC já conhecido NÃO duplica fact', async () => {
    // 1º encontro
    dm.responses.push({
      narration: 'Encontrei Borin.',
      speaker: 'Mestre',
      toolCalls: [{ name: 'npc_speaks', input: { name: 'Borin', archetype: 'ferreiro', attitude: 'neutro' } }],
      raw: '',
    });
    await campaign.takeAction('p1', 'falar');

    // 2º encontro com mesmo NPC
    dm.responses.push({
      narration: 'Borin de novo.',
      speaker: 'Mestre',
      toolCalls: [{ name: 'npc_speaks', input: { name: 'Borin', archetype: 'ferreiro', attitude: 'hostil' } }],
      raw: '',
    });
    await campaign.takeAction('p1', 'falar 2');

    // Só deve existir 1 fact "npc" pro Borin (do 1º encontro)
    const npcFacts = await memory.search('camp-test', 'borin', { kinds: ['npc'] });
    const borinIntroFacts = npcFacts.filter((f) => f.text.startsWith('NPC Borin'));
    expect(borinIntroFacts.length).toBe(1);
  });

  it('isolation: facts não vazam entre campanhas', async () => {
    const dm2 = new MockDM();
    const campaign2 = new Campaign(dm2 as any, { id: 'camp-other', memory });
    campaign2.addCharacter(makeChar('p2', 'Outro'));

    dm.responses.push({
      narration: 'NPC só da camp-test',
      speaker: 'Aragorn',
      toolCalls: [],
      raw: '',
    });
    await campaign.takeAction('p1', 'falar');

    const ownFacts = await memory.search('camp-test', 'aragorn');
    const otherFacts = await memory.search('camp-other', 'aragorn');
    expect(ownFacts.length).toBeGreaterThan(0);
    expect(otherFacts.length).toBe(0);
  });
});

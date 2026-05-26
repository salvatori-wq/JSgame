// Tests pra A3 — Auto-recap via RAG sessão N>1.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence.js';
import { MemoryStore } from '../memory.js';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet, MemoryFact } from '../../shared/types.js';

class MockDM {
  recapCalls: Array<{ facts: MemoryFact[] }> = [];
  narrateCalls: NarrationContext[] = [];

  async narrate(ctx: NarrationContext): Promise<DMResponse> {
    this.narrateCalls.push(ctx);
    return { narration: 'cena nova', speaker: 'Mestre', toolCalls: [], raw: '' };
  }

  async summarize(_t: string): Promise<string | null> {
    return null;
  }

  async generateRecap(facts: MemoryFact[]): Promise<string | null> {
    this.recapCalls.push({ facts });
    if (facts.length === 0) return null;
    return `Anteriormente: ${facts.slice(0, 3).map((f) => f.text).join('. ')}.`;
  }
}

function mkPj(): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Lyra',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 10, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 12,
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
}

describe('A3 — Auto-recap', () => {
  let memory: MemoryStore;

  beforeAll(async () => {
    await initPersistence();
    memory = new MemoryStore(getDbClient());
  });

  beforeEach(async () => {
    await getDbClient().execute('DELETE FROM memory_facts');
    await getDbClient().execute("DELETE FROM memory_facts_fts WHERE 1=1");
    await getDbClient().execute('DELETE FROM campaigns');
  });

  it('sessionNumber=1 NÃO chama generateRecap', async () => {
    const dm = new MockDM();
    const camp = new Campaign(dm as unknown as DMInterface, { id: 'c1', name: 'C1', memory });
    camp.addCharacter(mkPj());
    // sessionNumber default 1
    expect(camp.state.sessionNumber).toBe(1);
    await camp.startSession();
    expect(dm.recapCalls).toHaveLength(0);
  });

  it('sessionNumber=2 + sem facts importantes NÃO chama recap', async () => {
    const dm = new MockDM();
    const camp = new Campaign(dm as unknown as DMInterface, { id: 'c2', name: 'C2', memory });
    camp.addCharacter(mkPj());
    camp.state.sessionNumber = 2;
    await camp.startSession();
    expect(dm.recapCalls).toHaveLength(0);  // 0 facts → topImportant retorna [] → não chama
  });

  it('sessionNumber=2 + facts importantes CHAMA generateRecap', async () => {
    await memory.saveFact({
      campaignId: 'c3', kind: 'npc',
      text: 'Conheceram Gorlak o ferreiro em Pedraverde',
      tags: 'gorlak ferreiro pedraverde',
      importance: 1.7,
    });
    await memory.saveFact({
      campaignId: 'c3', kind: 'promise',
      text: 'Prometeram entregar a carta selada ao prefeito',
      tags: 'carta selada prefeito',
      importance: 1.8,
    });
    await memory.saveFact({
      campaignId: 'c3', kind: 'event',
      text: 'Borin matou o ogro líder na floresta',
      tags: 'borin ogro floresta',
      importance: 1.5,
    });

    const dm = new MockDM();
    const camp = new Campaign(dm as unknown as DMInterface, { id: 'c3', name: 'C3', memory });
    camp.addCharacter(mkPj());
    camp.state.sessionNumber = 2;
    const response = await camp.startSession();

    expect(dm.recapCalls).toHaveLength(1);
    expect(dm.recapCalls[0]!.facts.length).toBeGreaterThanOrEqual(2);
    // Recap deve estar prefixado na narration final
    expect(response?.narration).toContain('Anteriormente');
    expect(response?.narration).toContain('cena nova');  // narração principal preservada
  });

  it('QW-4: recap + narrate executam em PARALELO (Promise.all)', async () => {
    // Verifica que recap e narrate são paralelos: total ≈ max(recap_delay, narrate_delay),
    // não soma (que seria caso sequencial).
    await memory.saveFact({
      campaignId: 'c-parallel', kind: 'npc',
      text: 'Fact pra recap',
      tags: 'parallel',
      importance: 1.8,
    });

    // Mock DM com delays propositais — recap 200ms, narrate 200ms.
    // Sequencial: ~400ms. Paralelo: ~200ms.
    class SlowDM {
      async narrate(): Promise<DMResponse> {
        await new Promise((r) => setTimeout(r, 200));
        return { narration: 'narração final', speaker: 'Mestre', toolCalls: [], raw: '' };
      }
      async summarize(): Promise<string | null> { return null; }
      async generateRecap(): Promise<string | null> {
        await new Promise((r) => setTimeout(r, 200));
        return 'Anteriormente: o passado.';
      }
    }
    const dm = new SlowDM();
    const camp = new Campaign(dm as unknown as DMInterface, { id: 'c-parallel', name: 'CP', memory });
    camp.addCharacter(mkPj());
    camp.state.sessionNumber = 2;

    const start = Date.now();
    const response = await camp.startSession();
    const elapsed = Date.now() - start;

    // Paralelo: ~200ms + overhead. Limite generoso 320ms (caso sequencial seria 400+).
    expect(elapsed).toBeLessThan(320);
    // Ordem preservada: recap antes da narração principal
    expect(response?.narration).toMatch(/Anteriormente: o passado\.[\s\S]*narração final/);
  });

  it('topImportant ordena por importance DESC', async () => {
    await memory.saveFact({ campaignId: 'c4', kind: 'npc', text: 'A', tags: 'a', importance: 1.5 });
    await memory.saveFact({ campaignId: 'c4', kind: 'npc', text: 'B', tags: 'b', importance: 1.9 });
    await memory.saveFact({ campaignId: 'c4', kind: 'npc', text: 'C', tags: 'c', importance: 1.4 });
    const top = await memory.topImportant('c4', { limit: 3, minImportance: 1.3 });
    expect(top[0]!.text).toBe('B');
    expect(top[1]!.text).toBe('A');
    expect(top[2]!.text).toBe('C');
  });

  it('topImportant filtra por kinds quando passado', async () => {
    await memory.saveFact({ campaignId: 'c5', kind: 'npc', text: 'NPC', tags: '', importance: 1.5 });
    await memory.saveFact({ campaignId: 'c5', kind: 'lore', text: 'lore não-quest', tags: '', importance: 1.9 });
    const top = await memory.topImportant('c5', { limit: 5, kinds: ['npc', 'event'], minImportance: 1.3 });
    expect(top).toHaveLength(1);
    expect(top[0]!.kind).toBe('npc');
  });

  it('topImportant respeita minImportance', async () => {
    await memory.saveFact({ campaignId: 'c6', kind: 'npc', text: 'Importante', tags: '', importance: 1.8 });
    await memory.saveFact({ campaignId: 'c6', kind: 'npc', text: 'Banal', tags: '', importance: 1.0 });
    const top = await memory.topImportant('c6', { limit: 5, minImportance: 1.3 });
    expect(top).toHaveLength(1);
    expect(top[0]!.text).toBe('Importante');
  });
});

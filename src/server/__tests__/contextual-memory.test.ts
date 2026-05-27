// F3 — Tests pro MemoryStore.contextualSearch (forced slots).

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient } from '../persistence';
import { MemoryStore } from '../memory';

const CAMPAIGN_ID = 'test-contextual-mem';

describe('contextualSearch', () => {
  let store: MemoryStore;

  beforeAll(async () => {
    await initPersistence();
    store = new MemoryStore(getDbClient());
  });

  beforeEach(async () => {
    await store.purge(CAMPAIGN_ID);
  });

  it('força slot NPC com relationship quando forceNpcSlot=true', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'npc',
      text: 'Ferdok é um comerciante hostil',
      tags: 'npc relationship:-5',
      importance: 1.2,
    });
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'event',
      text: 'Combate na taverna',
      importance: 1.0,
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'taverna', { forceNpcSlot: true });
    const npcFact = results.find((f) => f.kind === 'npc');
    expect(npcFact).toBeDefined();
    expect(npcFact?.text).toContain('Ferdok');
  });

  it('força slot promise quando forcePromiseSlot=true', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'promise',
      text: 'PJ prometeu encontrar a relíquia',
      tags: 'promise active',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'qualquer query', { forcePromiseSlot: true });
    const promiseFact = results.find((f) => f.kind === 'promise');
    expect(promiseFact).toBeDefined();
  });

  it('força slot location quando forceLocationSlot=true', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'location',
      text: 'Torre de Cristal — biblioteca arcana',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'taverna', { forceLocationSlot: true });
    const locFact = results.find((f) => f.kind === 'location');
    expect(locFact).toBeDefined();
  });

  it('dedup: NPC já no top-N não duplica nos slots', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'npc',
      text: 'Ferdok hostil',
      tags: 'npc relationship:-5',
      importance: 1.5,
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'Ferdok', { forceNpcSlot: true });
    // Não pode ter Ferdok duas vezes
    const ferdok = results.filter((f) => f.text.includes('Ferdok'));
    expect(ferdok).toHaveLength(1);
  });

  it('ignora promessas completed (tag completed)', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'promise',
      text: 'Quest done',
      tags: 'promise completed',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'qualquer', { forcePromiseSlot: true });
    const promiseFacts = results.filter((f) => f.kind === 'promise');
    expect(promiseFacts).toHaveLength(0);
  });

  it('sem slots forçados, retorna apenas top-N normal', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'npc',
      text: 'Ferdok hostil',
      tags: 'npc relationship:-5',
    });
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'event',
      text: 'taverna queimou',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'taverna');
    // Não força nada — só o que veio da query
    expect(results.some((f) => f.kind === 'event')).toBe(true);
  });

  it('contextualSearch funciona com query vazia (fallback recent)', async () => {
    await store.saveFact({
      campaignId: CAMPAIGN_ID,
      kind: 'npc',
      text: 'Mira amigável',
      tags: 'npc relationship:3',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, '', { forceNpcSlot: true });
    expect(results.length).toBeGreaterThan(0);
  });

  it('campaignId isolado — fact de outra campanha não vaza', async () => {
    await store.saveFact({
      campaignId: 'outra-campanha',
      kind: 'npc',
      text: 'NPC de outra crônica',
      tags: 'npc relationship:5',
    });

    const results = await store.contextualSearch(CAMPAIGN_ID, 'qualquer', { forceNpcSlot: true });
    expect(results.some((f) => f.text.includes('outra crônica'))).toBe(false);
  });
});

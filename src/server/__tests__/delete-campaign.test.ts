// Tests pra deleteCampaign — remove campaign + memory_facts (+ FTS) + highlights.
// Tombstones e metrics_events ficam (history do user).

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient, saveCampaign, loadCampaign, deleteCampaign, listRecentCampaigns } from '../persistence.js';
import { MemoryStore } from '../memory.js';
import type { CampaignState } from '../../shared/types.js';

function mkCampaign(id: string): CampaignState {
  return {
    id, name: 'Teste', mode: 'exploration',
    partyCharacterIds: ['pj'],
    currentLocation: 'Taverna',
    currentSceneDescription: '',
    worldFlags: {},
    npcsMet: [],
    recentEvents: [],
    sessionNumber: 1,
    startedAt: Date.now(), lastPlayedAt: Date.now(),
    pendingCheck: null, pendingSave: null,
    combat: null,
  };
}

describe('deleteCampaign — limpa cascata', () => {
  let memory: MemoryStore;

  beforeAll(async () => {
    await initPersistence();
    memory = new MemoryStore(getDbClient());
  });

  beforeEach(async () => {
    const client = getDbClient();
    await client.execute({ sql: 'DELETE FROM campaigns', args: [] });
    await client.execute({ sql: 'DELETE FROM memory_facts', args: [] });
    await client.execute({ sql: 'DELETE FROM memory_facts_fts', args: [] });
    await client.execute({ sql: 'DELETE FROM highlights', args: [] });
  });

  it('remove campaign do listRecentCampaigns', async () => {
    await saveCampaign(mkCampaign('camp-a'));
    await saveCampaign(mkCampaign('camp-b'));
    expect((await listRecentCampaigns()).map(c => c.id).sort()).toEqual(['camp-a', 'camp-b']);

    await deleteCampaign('camp-a');

    const after = await listRecentCampaigns();
    expect(after.map(c => c.id)).toEqual(['camp-b']);
    expect(await loadCampaign('camp-a')).toBeNull();
  });

  it('apaga memory_facts + FTS associados', async () => {
    await saveCampaign(mkCampaign('camp-a'));
    await memory.saveFact({
      campaignId: 'camp-a', kind: 'npc',
      text: 'Garro vendeu informação',
      tags: 'garro npc',
      importance: 1.5, sessionN: 1,
    });
    await memory.saveFact({
      campaignId: 'camp-b', kind: 'npc',
      text: 'Outra crônica fica intacta',
      tags: 'outro',
      importance: 1.0, sessionN: 1,
    });

    expect(await memory.count('camp-a')).toBe(1);

    await deleteCampaign('camp-a');

    expect(await memory.count('camp-a')).toBe(0);
    expect(await memory.count('camp-b')).toBe(1);  // outra crônica intacta
  });

  it('apaga highlights da crônica deletada, preserva outros', async () => {
    const client = getDbClient();
    await saveCampaign(mkCampaign('camp-a'));
    await client.execute({
      sql: 'INSERT INTO highlights (id, user_id, campaign_id, character_id, character_name, summary, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['h1', null, 'camp-a', 'pj', 'Lyra', 'Crítica épica', 'crit', Date.now()],
    });
    await client.execute({
      sql: 'INSERT INTO highlights (id, user_id, campaign_id, character_id, character_name, summary, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['h2', null, 'camp-b', 'pj', 'Lyra', 'Outra crônica', 'crit', Date.now()],
    });

    await deleteCampaign('camp-a');

    const remaining = await client.execute({ sql: 'SELECT id FROM highlights ORDER BY id', args: [] });
    expect(remaining.rows.map(r => r.id)).toEqual(['h2']);
  });

  it('idempotente — apagar uma crônica que não existe não quebra', async () => {
    await expect(deleteCampaign('inexistente')).resolves.toBeUndefined();
  });
});

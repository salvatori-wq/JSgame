// QW-3 — listRecentCampaignsByUserId só retorna crônicas com PJ do user na party.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient, saveCharacter, saveCampaign, listRecentCampaignsByUserId, listRecentCampaigns } from '../persistence.js';
import type { CharacterSheet, CampaignState } from '../../shared/types.js';

function mkChar(id: string, userId: string | null): CharacterSheet {
  return {
    id, userId: userId ?? undefined, ownerName: 'p', characterName: 'PJ',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 1, xp: 0,
    abilityScoresBase: { for: 10, des: 10, con: 10, int: 16, sab: 10, car: 10 },
    abilityScores: { for: 10, des: 10, con: 10, int: 16, sab: 10, car: 10 },
    maxHp: 6, currentHp: 6, tempHp: 0,
    hitDiceRemaining: 1, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: Date.now(), lastPlayedAt: Date.now(),
    deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

function mkCampaign(id: string, partyIds: string[]): CampaignState {
  return {
    id, name: 'Crônica ' + id, mode: 'exploration',
    partyCharacterIds: partyIds,
    currentLocation: 'Taverna', currentSceneDescription: '', worldFlags: {},
    npcsMet: [], recentEvents: [],
    sessionNumber: 1, startedAt: Date.now(), lastPlayedAt: Date.now(),
    pendingCheck: null, pendingSave: null, combat: null,
  };
}

describe('QW-3 — listRecentCampaignsByUserId', () => {
  beforeAll(async () => { await initPersistence(); });
  beforeEach(async () => {
    const client = getDbClient();
    await client.execute({ sql: 'DELETE FROM campaigns', args: [] });
    await client.execute({ sql: 'DELETE FROM characters', args: [] });
  });

  it('retorna apenas crônicas onde algum PJ pertence ao user', async () => {
    await saveCharacter(mkChar('char-A', 'user-1'));
    await saveCharacter(mkChar('char-B', 'user-2'));
    await saveCampaign(mkCampaign('camp-1', ['char-A']));         // user-1 owns
    await saveCampaign(mkCampaign('camp-2', ['char-B']));         // user-2 owns
    await saveCampaign(mkCampaign('camp-3', ['char-A', 'char-B'])); // coop

    const user1Camps = await listRecentCampaignsByUserId('user-1');
    expect(user1Camps.map(c => c.id).sort()).toEqual(['camp-1', 'camp-3']);

    const user2Camps = await listRecentCampaignsByUserId('user-2');
    expect(user2Camps.map(c => c.id).sort()).toEqual(['camp-2', 'camp-3']);
  });

  it('user sem PJs retorna lista vazia', async () => {
    await saveCharacter(mkChar('char-X', 'user-1'));
    await saveCampaign(mkCampaign('camp-1', ['char-X']));
    expect(await listRecentCampaignsByUserId('user-sem-pj')).toEqual([]);
  });

  it('PJ anônimo (userId null) NÃO aparece em listagem de nenhum user', async () => {
    await saveCharacter(mkChar('char-anon', null));
    await saveCampaign(mkCampaign('camp-1', ['char-anon']));
    expect(await listRecentCampaignsByUserId('user-1')).toEqual([]);
  });

  it('user anônimo (route não passa) ainda pode usar listRecentCampaigns (todas)', async () => {
    await saveCharacter(mkChar('char-A', 'user-1'));
    await saveCampaign(mkCampaign('camp-1', ['char-A']));
    await saveCampaign(mkCampaign('camp-2', ['char-A']));
    expect((await listRecentCampaigns()).length).toBe(2);
  });

  it('respeita limit', async () => {
    await saveCharacter(mkChar('char-A', 'user-1'));
    for (let i = 0; i < 5; i++) {
      await saveCampaign(mkCampaign(`camp-${i}`, ['char-A']));
    }
    expect((await listRecentCampaignsByUserId('user-1', 3)).length).toBe(3);
  });

  it('ordem cronológica descendente preservada (mais recente primeiro)', async () => {
    await saveCharacter(mkChar('char-A', 'user-1'));
    const c1 = mkCampaign('camp-old', ['char-A']);
    c1.lastPlayedAt = 1000;
    const c2 = mkCampaign('camp-new', ['char-A']);
    c2.lastPlayedAt = 5000;
    await saveCampaign(c1);
    await saveCampaign(c2);
    const result = await listRecentCampaignsByUserId('user-1');
    expect(result.map(c => c.id)).toEqual(['camp-new', 'camp-old']);
  });
});

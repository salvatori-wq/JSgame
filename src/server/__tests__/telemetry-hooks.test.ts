// Sprint 3 — Tests que validam HOOKS em pontos críticos do server disparam
// trackMetricEvent corretamente. Integração — não unit de cada hook.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initPersistence, getDbClient, saveCampaign, saveCharacter } from '../persistence.js';
import { applyValidatedToolToCampaign } from '../dm-tool-applier.js';
import { Campaign } from '../campaign.js';
import { createFriendInvite } from '../friends.js';
import { saveTombstone } from '../tombstones.js';
import type { CharacterSheet, CampaignState } from '../../shared/types.js';
import type { DMInterface } from '../dm/dm.js';

class MockDM {
  async narrate(): Promise<import('../dm/dm.js').DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
  async summarize(): Promise<string | null> { return null; }
  async generateRecap(): Promise<string | null> { return null; }
}

function mkPj(): CharacterSheet {
  return {
    id: 'pj-' + Math.random().toString(36).slice(2), userId: 'user-1', ownerName: 'p', characterName: 'PJ',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 3, xp: 900,
    abilityScoresBase: { for: 10, des: 12, con: 12, int: 16, sab: 10, car: 10 },
    abilityScores: { for: 10, des: 12, con: 12, int: 16, sab: 10, car: 10 },
    maxHp: 18, currentHp: 18, tempHp: 0,
    hitDiceRemaining: 3, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:4,used:0},2:{max:2,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: Date.now(), lastPlayedAt: Date.now(),
    deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

async function getEventsByKind(kind: string): Promise<unknown[]> {
  const r = await getDbClient().execute({
    sql: 'SELECT id, session_id, payload FROM metrics_events WHERE kind = ?',
    args: [kind],
  });
  return r.rows;
}

async function waitForEvent(kind: string, retries = 10): Promise<unknown[]> {
  // Trackers são fire-and-forget — esperar até event chegar no DB.
  for (let i = 0; i < retries; i++) {
    const rows = await getEventsByKind(kind);
    if (rows.length > 0) return rows;
    await new Promise(r => setTimeout(r, 50));
  }
  return [];
}

describe('Sprint 3 — Telemetria hooks', () => {
  beforeAll(async () => { await initPersistence(); });
  beforeEach(async () => {
    const c = getDbClient();
    await c.execute({ sql: 'DELETE FROM metrics_events', args: [] });
    await c.execute({ sql: 'DELETE FROM campaigns', args: [] });
    await c.execute({ sql: 'DELETE FROM characters', args: [] });
    await c.execute({ sql: 'DELETE FROM tombstones', args: [] });
    await c.execute({ sql: 'DELETE FROM friend_invites', args: [] });
    await c.execute({ sql: "DELETE FROM users WHERE id LIKE 'user-%'", args: [] });
  });

  it('start_combat tool dispara combat_started', async () => {
    const camp = new Campaign(new MockDM() as unknown as DMInterface, { id: 'c1', name: 'C1' });
    camp.addCharacter(mkPj());
    applyValidatedToolToCampaign(camp, {
      kind: 'start_combat',
      surprise: false,
      enemies: [{ name: 'Goblin', hp: 7, ac: 13, attackBonus: 4, damageDice: '1d6', damageBonus: 2, description: '', isBoss: false, xpAward: 50 }],
    });
    const rows = await waitForEvent('combat_started');
    expect(rows.length).toBe(1);
  });

  it('end_combat_with_outcome dispara combat_won quando victory', async () => {
    const camp = new Campaign(new MockDM() as unknown as DMInterface, { id: 'c2', name: 'C2' });
    camp.addCharacter(mkPj());
    applyValidatedToolToCampaign(camp, {
      kind: 'start_combat',
      surprise: false,
      enemies: [{ name: 'Orc', hp: 10, ac: 13, attackBonus: 4, damageDice: '1d8', damageBonus: 2, description: '', isBoss: false, xpAward: 75 }],
    });
    applyValidatedToolToCampaign(camp, { kind: 'end_combat_with_outcome', outcome: 'victory', reason: 'Mataram o orc' });
    expect((await waitForEvent('combat_won')).length).toBe(1);
    expect((await waitForEvent('combat_lost')).length).toBe(0);
  });

  // M1 — bug: vitória narrada pelo DM (rendição/fuga/intervenção) zerava o
  // combate sem conceder XP. Só o kill mecânico dava XP. Agora ambos concedem.
  it('M1 — end_combat_with_outcome victory concede XP à party (lastCombatXpAwards)', async () => {
    const camp = new Campaign(new MockDM() as unknown as DMInterface, { id: 'c2xp', name: 'C2XP' });
    const pj = mkPj();
    const xpBefore = pj.xp;
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, {
      kind: 'start_combat', surprise: false,
      enemies: [{ name: 'Orc', hp: 10, ac: 13, attackBonus: 4, damageDice: '1d8', damageBonus: 2, description: '', isBoss: false, xpAward: 75 }],
    });
    applyValidatedToolToCampaign(camp, { kind: 'end_combat_with_outcome', outcome: 'victory', reason: 'O orc se rendeu' });
    expect(camp.lastCombatXpAwards.length).toBe(1);
    expect(camp.lastCombatXpAwards[0]!.xpAwarded).toBe(75);
    expect(camp.party[0]!.xp).toBe(xpBefore + 75);
  });

  it('M1 — end_combat_with_outcome defeat NÃO concede XP (lastCombatXpAwards vazio)', async () => {
    const camp = new Campaign(new MockDM() as unknown as DMInterface, { id: 'c3xp', name: 'C3XP' });
    const pj = mkPj();
    const xpBefore = pj.xp;
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, {
      kind: 'start_combat', surprise: false,
      enemies: [{ name: 'Dragão', hp: 200, ac: 18, attackBonus: 11, damageDice: '2d10', damageBonus: 6, description: '', isBoss: true, xpAward: 1800 }],
    });
    applyValidatedToolToCampaign(camp, { kind: 'end_combat_with_outcome', outcome: 'defeat', reason: 'Tomaram bola de fogo' });
    expect(camp.lastCombatXpAwards.length).toBe(0);
    expect(camp.party[0]!.xp).toBe(xpBefore);
  });

  it('end_combat_with_outcome dispara combat_lost quando defeat', async () => {
    const camp = new Campaign(new MockDM() as unknown as DMInterface, { id: 'c3', name: 'C3' });
    camp.addCharacter(mkPj());
    applyValidatedToolToCampaign(camp, {
      kind: 'start_combat',
      surprise: false,
      enemies: [{ name: 'Dragão', hp: 200, ac: 18, attackBonus: 11, damageDice: '2d10', damageBonus: 6, description: '', isBoss: true, xpAward: 1800 }],
    });
    applyValidatedToolToCampaign(camp, { kind: 'end_combat_with_outcome', outcome: 'defeat', reason: 'Foram destroçados' });
    expect((await waitForEvent('combat_lost')).length).toBe(1);
  });

  it('createFriendInvite dispara friend_invited', async () => {
    // Precisa de user pra FK
    await getDbClient().execute({
      sql: 'INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)',
      args: ['user-friend', 'sender@test.com', Date.now()],
    });
    await createFriendInvite('user-friend', 'target@test.com', 'LOBBY1');
    const rows = await waitForEvent('friend_invited');
    expect(rows.length).toBe(1);
  });

  it('saveTombstone dispara character_died', async () => {
    const sheet = mkPj();
    sheet.id = 'char-died-1';
    sheet.currentHp = 0;
    await saveTombstone({ sheet, campaignId: 'c1', campaignName: 'Test', cause: 'goblin crítico' });
    const rows = await waitForEvent('character_died');
    expect(rows.length).toBe(1);
  });
});

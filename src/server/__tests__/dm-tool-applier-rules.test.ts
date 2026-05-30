// Fase 6 — backlog de regras no tool-applier.
//  Rank 11 (coop) — playerId:'active' resolve pro player CERTO (turno de combate
//    atual → quem disparou a vez do Mestre → party[0]), não sempre party[0].
//  Rank 12 — apply_damage em PJ já caído (0 HP) conta FALHA de morte (golpe de
//    misericórdia); dano >= máximo de HP = morte instantânea.

import { describe, it, expect } from 'vitest';
import { Campaign } from '../campaign.js';
import { applyValidatedToolToCampaign } from '../dm-tool-applier.js';
import type { CharacterSheet, CombatState } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> { return { narration: '', speaker: 'Mestre', toolCalls: [], raw: '' }; },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string, name: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    abilityScores:     { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    maxHp: 40, currentHp: 40, tempHp: 0, hitDiceRemaining: 5, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
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

describe("Rank 11 — playerId:'active' mira o player certo (coop)", () => {
  it('resolve pra quem disparou a vez do Mestre (lastActingPlayerId), não party[0]', () => {
    const camp = new Campaign(fakeDM, { id: 'c11a', name: 'T' });
    camp.addCharacter(makePJ('pj-a', 'Aragorn')); // party[0]
    camp.addCharacter(makePJ('pj-b', 'Legolas'));
    camp.lastActingPlayerId = 'pj-b';
    applyValidatedToolToCampaign(camp, { kind: 'request_skill_check', skill: 'percepcao', dc: 12, reason: 'notar', playerId: 'active' });
    expect(camp.state.pendingCheck?.playerId).toBe('pj-b');
  });

  it('em combate, mira o player do TURNO atual (prioridade sobre lastActing)', () => {
    const camp = new Campaign(fakeDM, { id: 'c11b', name: 'T' });
    camp.addCharacter(makePJ('pj-a', 'Aragorn'));
    camp.addCharacter(makePJ('pj-b', 'Legolas'));
    camp.lastActingPlayerId = 'pj-a';
    camp.state.combat = {
      active: true, round: 1, currentTurnIndex: 0,
      initiativeOrder: [{ id: 'pj-b', kind: 'player', initiative: 18, name: 'Legolas' }],
      enemies: [], actionEconomy: {}, log: [],
    } as unknown as CombatState;
    applyValidatedToolToCampaign(camp, { kind: 'request_saving_throw', ability: 'des', dc: 14, reason: 'desviar', playerId: 'active' });
    expect(camp.state.pendingSave?.playerId).toBe('pj-b');
  });

  it('sem ator conhecido e fora de combate, cai pra party[0] (compat)', () => {
    const camp = new Campaign(fakeDM, { id: 'c11c', name: 'T' });
    camp.addCharacter(makePJ('pj-a', 'Aragorn'));
    camp.addCharacter(makePJ('pj-b', 'Legolas'));
    camp.lastActingPlayerId = null;
    applyValidatedToolToCampaign(camp, { kind: 'grant_inspiration', playerId: 'active', reason: 'boa ideia' });
    expect(camp.party.find((p) => p.id === 'pj-a')!.inspirations).toBe(1);
    expect(camp.party.find((p) => p.id === 'pj-b')!.inspirations ?? 0).toBe(0);
  });
});

describe('Rank 12 — golpe de misericórdia (apply_damage em PJ caído)', () => {
  it('dano em PJ a 0 HP conta UMA falha de morte', () => {
    const camp = new Campaign(fakeDM, { id: 'c12a', name: 'T' });
    const pj = makePJ('pj-1', 'Borin');
    pj.currentHp = 0; pj.deathSaveFailures = 0; pj.conditions = ['inconsciente'];
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-1', damage: 6, type: 'cortante', reason: 'golpe no caído' });
    expect(pj.deathSaveFailures).toBe(1);
    expect(pj.currentHp).toBe(0);
  });

  it('dano >= máximo de HP em PJ caído = morte instantânea (3 falhas)', () => {
    const camp = new Campaign(fakeDM, { id: 'c12b', name: 'T' });
    const pj = makePJ('pj-1', 'Borin');
    pj.maxHp = 12; pj.currentHp = 0; pj.deathSaveFailures = 0; pj.conditions = ['inconsciente'];
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-1', damage: 15, type: 'cortante', reason: 'execução' });
    expect(pj.deathSaveFailures).toBe(3);
  });

  it('dano que DERRUBA (HP>0 → 0) NÃO conta falha (primeira queda = só inconsciente)', () => {
    const camp = new Campaign(fakeDM, { id: 'c12c', name: 'T' });
    const pj = makePJ('pj-1', 'Borin');
    pj.maxHp = 40; pj.currentHp = 8; pj.deathSaveFailures = 0;
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-1', damage: 20, type: 'cortante', reason: 'pancada' });
    expect(pj.currentHp).toBe(0);
    expect(pj.deathSaveFailures).toBe(0);
    expect(pj.conditions).toContain('inconsciente');
  });

  it('PJ já morto (3 falhas) não acumula além de 3', () => {
    const camp = new Campaign(fakeDM, { id: 'c12d', name: 'T' });
    const pj = makePJ('pj-1', 'Borin');
    pj.currentHp = 0; pj.deathSaveFailures = 3; pj.conditions = ['inconsciente'];
    camp.addCharacter(pj);
    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-1', damage: 5, type: 'cortante', reason: 'chute' });
    expect(pj.deathSaveFailures).toBe(3);
  });
});

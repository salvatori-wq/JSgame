// Rank 1 fix — o d20 do skill-check tem que ser emitido (diceRollResult) ASSIM
// QUE rolado, ANTES do await dm.narrate (LLM 3-12s). Antes, resolveSkillCheck
// só retornava depois da narração, então o dado ficava congelado em "?" os
// segundos todos da latência do Mestre, e quando enfim animava, o broadcastState
// seguinte (pendingCheck=null) arrancava o overlay em ~64ms. Aqui cobrimos a
// metade server: o callback onRoll dispara antes da narração.

import { describe, it, expect } from 'vitest';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

function makePJ(id: string, name: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: name,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: ['atletismo'], proficientSavingThrows: ['for', 'con'],
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

describe('Rank 1 — resolveSkillCheck emite o dado ANTES da narração', () => {
  it('onRoll dispara ANTES de dm.narrate (dado anima na hora, não espera o LLM)', async () => {
    const order: string[] = [];
    const dm = {
      async narrate(): Promise<DMResponse> {
        order.push('narrate');
        return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
      },
      async summarize(): Promise<string | null> { return null; },
    } as unknown as DMInterface;

    const camp = new Campaign(dm, { id: 'c-order', name: 'T' });
    const pj = makePJ('pj-1', 'Borin');
    camp.addCharacter(pj);
    camp.state.pendingCheck = { skill: 'atletismo', dc: 10, reason: 'escalar', playerId: 'pj-1' };

    let early: { roll: { total: number } } | null = null;
    const result = await camp.resolveSkillCheck('pj-1', {}, (e) => {
      order.push('onRoll');
      early = e;
    });

    expect(order).toEqual(['onRoll', 'narrate']);
    expect(early).not.toBeNull();
    // mesmo roll emitido cedo e retornado no fim
    expect(early!.roll.total).toBe(result?.roll.total);
  });

  it('onRoll NÃO dispara quando não há pending (resolve null sem emitir dado fantasma)', async () => {
    const dm = {
      async narrate(): Promise<DMResponse> {
        return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
      },
      async summarize(): Promise<string | null> { return null; },
    } as unknown as DMInterface;

    const camp = new Campaign(dm, { id: 'c-nopending', name: 'T' });
    camp.addCharacter(makePJ('pj-1', 'Borin'));
    // sem pendingCheck

    let called = false;
    const result = await camp.resolveSkillCheck('pj-1', {}, () => { called = true; });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it('onRoll opcional: resolveSkillCheck sem callback segue funcionando', async () => {
    const dm = {
      async narrate(): Promise<DMResponse> {
        return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
      },
      async summarize(): Promise<string | null> { return null; },
    } as unknown as DMInterface;

    const camp = new Campaign(dm, { id: 'c-nocb', name: 'T' });
    camp.addCharacter(makePJ('pj-1', 'Borin'));
    camp.state.pendingCheck = { skill: 'atletismo', dc: 10, reason: 'X', playerId: 'pj-1' };

    const result = await camp.resolveSkillCheck('pj-1');
    expect(result).not.toBeNull();
    expect(typeof result?.roll.total).toBe('number');
  });
});

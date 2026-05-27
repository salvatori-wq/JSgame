// α.2 — Tests item rarity (validator + handler).

import { describe, it, expect } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: id,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
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

describe('α.2 — validateToolCall give_item with rarity', () => {
  it('aceita rarity válida', () => {
    const r = validateToolCall({
      name: 'give_item',
      input: { playerId: 'pj-1', itemName: 'Espada +1', type: 'arma', rarity: 'raro' },
    });
    expect(r?.kind === 'give_item' && r.rarity).toBe('raro');
  });

  it('default rarity é comum quando omitido', () => {
    const r = validateToolCall({
      name: 'give_item',
      input: { playerId: 'pj-1', itemName: 'Adaga', type: 'arma' },
    });
    expect(r?.kind === 'give_item' && r.rarity).toBe('comum');
  });

  it('rarity inválida cai pra comum', () => {
    const r = validateToolCall({
      name: 'give_item',
      input: { playerId: 'pj-1', itemName: 'X', type: 'arma', rarity: 'super-secreto' },
    });
    expect(r?.kind === 'give_item' && r.rarity).toBe('comum');
  });

  it('aceita todas as 5 rarities oficiais', () => {
    for (const rarity of ['comum', 'incomum', 'raro', 'muito-raro', 'lendario']) {
      const r = validateToolCall({
        name: 'give_item',
        input: { playerId: 'pj-1', itemName: 'X', type: 'arma', rarity },
      });
      expect(r?.kind === 'give_item' && r.rarity).toBe(rarity);
    }
  });

  it('case-insensitive', () => {
    const r = validateToolCall({
      name: 'give_item',
      input: { playerId: 'pj-1', itemName: 'X', type: 'arma', rarity: 'LENDARIO' },
    });
    expect(r?.kind === 'give_item' && r.rarity).toBe('lendario');
  });
});

describe('α.2 — Campaign give_item handler persiste rarity + isNew', () => {
  it('item recebido carrega rarity no inventory', () => {
    const camp = new Campaign(fakeDM, { id: 'c1', name: 'T' });
    const pj = makePJ('pj-1');
    camp.addCharacter(pj);

    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'give_item',
      playerId: 'pj-1',
      itemName: 'Cajado Arcano',
      type: 'arma',
      quantity: 1,
      description: 'pulsando luz azul',
      rarity: 'muito-raro',
    });

    expect(pj.inventory).toHaveLength(1);
    expect(pj.inventory[0]!.rarity).toBe('muito-raro');
    expect(pj.inventory[0]!.isNew).toBe(true);
    expect(pj.inventory[0]!.name).toBe('Cajado Arcano');
  });

  it('items default a "comum" quando handler recebe rarity comum', () => {
    const camp = new Campaign(fakeDM, { id: 'c1', name: 'T' });
    const pj = makePJ('pj-1');
    camp.addCharacter(pj);

    (camp as unknown as { applyValidatedTool: (t: unknown) => void }).applyValidatedTool({
      kind: 'give_item',
      playerId: 'pj-1',
      itemName: 'Saco de aniagem',
      type: 'misc',
      quantity: 1,
      description: '',
      rarity: 'comum',
    });

    expect(pj.inventory[0]!.rarity).toBe('comum');
  });
});

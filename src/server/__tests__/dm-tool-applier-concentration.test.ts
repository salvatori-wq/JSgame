// Rank 9 fix — dano narrado pelo Mestre via apply_damage (trapa, AoE, queda,
// rockfall fora do turno inimigo) agora força save de concentração (PHB p.203).
// Antes só o ataque inimigo em combate quebrava concentração, então o caster
// segurava Bless/Hold Person depois de um trap hit grande — e o chip de
// concentração no mobile ficava aceso (lia como bug).

import { describe, it, expect, vi } from 'vitest';
import { Campaign } from '../campaign.js';
import { applyValidatedToolToCampaign } from '../dm-tool-applier.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: '', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string, name: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: name,
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores:     { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 100, currentHp: 100, tempHp: 0, hitDiceRemaining: 5, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
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

describe('Rank 9 — apply_damage força save de concentração', () => {
  it('dano que zera o HP → perde concentração automaticamente (inconsciente)', () => {
    const camp = new Campaign(fakeDM, { id: 'c-conc-1', name: 'T' });
    const pj = makePJ('pj-1', 'Elara');
    pj.currentHp = 5;
    pj.concentratingOn = 'bless';
    camp.addCharacter(pj);

    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-1', damage: 10, type: 'fogo', reason: 'trapa' });

    expect(pj.currentHp).toBe(0);
    expect(pj.concentratingOn).toBeNull();
  });

  it('dano com HP>0 força CON save; roll baixo (d20=1) quebra concentração', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // d20 = 1 → falha o save
    const camp = new Campaign(fakeDM, { id: 'c-conc-2', name: 'T' });
    const pj = makePJ('pj-2', 'Elara');
    pj.concentratingOn = 'hold-person';
    camp.addCharacter(pj);

    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-2', damage: 30, type: 'fogo', reason: 'AoE' });

    expect(pj.currentHp).toBe(70);
    expect(pj.concentratingOn).toBeNull(); // save falhou
    spy.mockRestore();
  });

  it('sem concentração: apply_damage só tira HP (sem efeito colateral)', () => {
    const camp = new Campaign(fakeDM, { id: 'c-conc-3', name: 'T' });
    const pj = makePJ('pj-3', 'Borin');
    pj.concentratingOn = null;
    camp.addCharacter(pj);

    applyValidatedToolToCampaign(camp, { kind: 'apply_damage', playerId: 'pj-3', damage: 10, type: 'cortante', reason: 'x' });

    expect(pj.currentHp).toBe(90);
    expect(pj.concentratingOn).toBeNull();
  });
});

// Tests pra M4 — Item use por catálogo (id-based) com fallback name-match.

import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { NarrationContext } from '../dm/prompts.js';
import type { CharacterSheet } from '../../shared/types.js';
import { getConsumable, inferConsumableEffectFromName, CONSUMABLES } from '../../dnd/consumables.js';

class MockDM {
  async narrate(_ctx: NarrationContext): Promise<DMResponse> {
    return { narration: 'mock', speaker: 'Mestre', toolCalls: [], raw: '' };
  }
}

function mkPj(): CharacterSheet {
  return {
    id: 'pj', ownerName: 'p', characterName: 'Borin',
    raceId: 'anao-montanha', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 16, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 16, des: 12, con: 16, int: 10, sab: 10, car: 10 },
    maxHp: 50, currentHp: 10, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
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

describe('M4 — Consumables catalog (id-based)', () => {
  it('getConsumable retorna def pra pocao-cura', () => {
    const c = getConsumable('pocao-cura');
    expect(c).toBeTruthy();
    expect(c?.effect.kind).toBe('heal');
  });

  it('getConsumable retorna null pra id desconhecido', () => {
    expect(getConsumable('xpto')).toBeNull();
  });

  it('4 rarities de poção cura cobertas', () => {
    expect(CONSUMABLES['pocao-cura']?.rarity).toBe('comum');
    expect(CONSUMABLES['pocao-cura-maior']?.rarity).toBe('incomum');
    expect(CONSUMABLES['pocao-cura-superior']?.rarity).toBe('raro');
    expect(CONSUMABLES['pocao-cura-suprema']?.rarity).toBe('épico');
  });

  it('inferConsumableEffectFromName: "Poção de Cura" detecta heal', () => {
    const e = inferConsumableEffectFromName('Poção de Cura');
    expect(e?.kind).toBe('heal');
    expect(e?.heal?.dice).toBe('2d4');
  });

  it('inferConsumableEffectFromName: variações maior/superior', () => {
    expect(inferConsumableEffectFromName('Poção de Cura Maior')?.heal?.dice).toBe('4d4');
    expect(inferConsumableEffectFromName('Poção de Cura Superior')?.heal?.dice).toBe('8d4');
    expect(inferConsumableEffectFromName('Poção de Cura Suprema')?.heal?.dice).toBe('10d4');
  });

  it('inferConsumableEffectFromName: Antídoto remove envenenado', () => {
    const e = inferConsumableEffectFromName('Antídoto');
    expect(e?.kind).toBe('remove-condition');
    expect(e?.removesConditions).toContain('envenenado');
  });

  it('inferConsumableEffectFromName: desconhecido = null', () => {
    expect(inferConsumableEffectFromName('Pedra Bizarra')).toBeNull();
  });
});

describe('M4 — Campaign.useItem usa catálogo por ID', () => {
  let camp: Campaign;
  let pj: CharacterSheet;
  beforeEach(() => {
    camp = new Campaign(new MockDM() as unknown as DMInterface);
    pj = mkPj();
    camp.addCharacter(pj);
  });

  it('id "pocao-cura" cura via catálogo (2d4+2 = 4-10 HP)', async () => {
    pj.inventory.push({ id: 'pocao-cura', name: 'Whatever name', type: 'consumivel', quantity: 1 });
    const r = await camp.useItem(pj.id, 'pocao-cura');
    expect(r.ok).toBe(true);
    expect(r.effectApplied).toMatch(/Curou \d+ HP/);
    const healed = camp.party[0]!.currentHp - 10;
    expect(healed).toBeGreaterThanOrEqual(4);
    expect(healed).toBeLessThanOrEqual(10);
  });

  it('id desconhecido cai em fallback name-match', async () => {
    pj.inventory.push({ id: 'whatever-xpto', name: 'Poção de Cura', type: 'consumivel', quantity: 1 });
    const r = await camp.useItem(pj.id, 'whatever-xpto');
    expect(r.ok).toBe(true);
    expect(r.effectApplied).toMatch(/Curou/);
  });

  it('antídoto remove envenenado via catálogo', async () => {
    pj.conditions = ['envenenado'];
    pj.inventory.push({ id: 'antidoto', name: 'Bottle', type: 'consumivel', quantity: 1 });
    const r = await camp.useItem(pj.id, 'antidoto');
    expect(r.ok).toBe(true);
    expect(camp.party[0]!.conditions).not.toContain('envenenado');
  });

  it('temp-hp aplica corretamente', async () => {
    pj.tempHp = 0;
    pj.inventory.push({ id: 'pocao-heroismo', name: 'Heroism', type: 'consumivel', quantity: 1 });
    const r = await camp.useItem(pj.id, 'pocao-heroismo');
    expect(r.ok).toBe(true);
    expect(camp.party[0]!.tempHp).toBe(10);
  });

  it('temp-hp NÃO acumula (usa o maior)', async () => {
    pj.tempHp = 15;  // já tem mais que 10
    pj.inventory.push({ id: 'pocao-heroismo', name: 'Heroism', type: 'consumivel', quantity: 1 });
    await camp.useItem(pj.id, 'pocao-heroismo');
    expect(camp.party[0]!.tempHp).toBe(15);  // manteve 15, não somou
  });

  it('item sem catalog match nem nome match = narrative', async () => {
    pj.inventory.push({ id: 'xpto-bizarro', name: 'Cristal Espelhado', type: 'consumivel', quantity: 1 });
    const r = await camp.useItem(pj.id, 'xpto-bizarro');
    expect(r.ok).toBe(true);
    expect(r.effectApplied).toContain('narrado pelo Mestre');
  });

  it('consome quantity ao usar', async () => {
    pj.inventory.push({ id: 'pocao-cura', name: 'Poção', type: 'consumivel', quantity: 2 });
    await camp.useItem(pj.id, 'pocao-cura');
    expect(camp.party[0]!.inventory.find((i) => i.id === 'pocao-cura')?.quantity).toBe(1);
  });

  it('remove item quando quantity = 0', async () => {
    pj.inventory.push({ id: 'pocao-cura', name: 'Poção', type: 'consumivel', quantity: 1 });
    await camp.useItem(pj.id, 'pocao-cura');
    expect(camp.party[0]!.inventory.find((i) => i.id === 'pocao-cura')).toBeUndefined();
  });
});

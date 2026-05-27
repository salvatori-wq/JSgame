// β.3 — Tests Vendor/Shop (validator + handler).

import { describe, it, expect, beforeEach } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { Campaign } from '../campaign.js';
import { handleBuyShopItem, handleSellShopItem, estimateSellPrice } from '../campaign-handlers/shop-handler.js';
import type { CharacterSheet, OpenShop, InventoryItem } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: 'fake', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string, gold: number): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: id,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold,
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

function makeShop(): OpenShop {
  return {
    id: 'shop-1',
    npcName: 'Brogundo',
    shopType: 'general',
    items: [
      { id: 'it-1', name: 'Espada Longa', type: 'arma', priceGold: 15, rarity: 'comum' },
      { id: 'it-2', name: 'Poção de Cura', type: 'consumivel', priceGold: 50, rarity: 'incomum' },
      { id: 'it-3', name: 'Cajado Arcano', type: 'arma', priceGold: 200, rarity: 'raro', stock: 1 },
    ],
    acceptsSell: true,
    openedAt: Date.now(),
  };
}

describe('β.3 — validateToolCall open_shop', () => {
  it('valida estrutura mínima', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: {
        npcName: 'Brogundo', shopType: 'general',
        items: [{ name: 'Adaga', type: 'arma', priceGold: 2 }],
      },
    });
    expect(r?.kind).toBe('open_shop');
    if (r?.kind === 'open_shop') {
      expect(r.npcName).toBe('Brogundo');
      expect(r.items).toHaveLength(1);
      expect(r.items[0]!.priceGold).toBe(2);
      expect(r.items[0]!.rarity).toBe('comum');
      expect(r.acceptsSell).toBe(true);
    }
  });

  it('rejeita sem npcName', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { shopType: 'general', items: [{ name: 'A', type: 'arma', priceGold: 1 }] },
    });
    expect(r).toBeNull();
  });

  it('rejeita items vazio', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { npcName: 'X', shopType: 'general', items: [] },
    });
    expect(r).toBeNull();
  });

  it('clampa a 12 items', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ name: `A${i}`, type: 'arma', priceGold: 1 }));
    const r = validateToolCall({ name: 'open_shop', input: { npcName: 'X', shopType: 'general', items } });
    expect(r?.kind === 'open_shop' && r.items).toHaveLength(12);
  });

  it('shopType inválido cai pra general', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { npcName: 'X', shopType: 'weirdo', items: [{ name: 'A', type: 'arma', priceGold: 1 }] },
    });
    expect(r?.kind === 'open_shop' && r.shopType).toBe('general');
  });

  it('acceptsSell default true', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { npcName: 'X', shopType: 'general', items: [{ name: 'A', type: 'arma', priceGold: 1 }] },
    });
    expect(r?.kind === 'open_shop' && r.acceptsSell).toBe(true);
  });

  it('acceptsSell false explícito respeitado', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { npcName: 'X', shopType: 'general', acceptsSell: false, items: [{ name: 'A', type: 'arma', priceGold: 1 }] },
    });
    expect(r?.kind === 'open_shop' && r.acceptsSell).toBe(false);
  });

  it('filtra item sem name', () => {
    const r = validateToolCall({
      name: 'open_shop',
      input: { npcName: 'X', shopType: 'general', items: [
        { name: 'OK', type: 'arma', priceGold: 1 },
        { name: '', type: 'arma', priceGold: 1 },
      ]},
    });
    expect(r?.kind === 'open_shop' && r.items).toHaveLength(1);
  });
});

describe('β.3 — handleBuyShopItem', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(fakeDM, { id: 'c-shop', name: 'T' });
    camp.addCharacter(makePJ('pj-1', 100));
    camp.state.openShop = makeShop();
  });

  it('compra com sucesso debita gold + adiciona ao inventário', async () => {
    const r = await handleBuyShopItem(camp, 'pj-1', 'shop-1', 'it-1');
    expect(r.ok).toBe(true);
    expect(r.goldDelta).toBe(-15);
    const pj = camp.party[0]!;
    expect(pj.gold).toBe(85);
    expect(pj.inventory).toHaveLength(1);
    expect(pj.inventory[0]!.name).toBe('Espada Longa');
    expect(pj.inventory[0]!.isNew).toBe(true);
  });

  it('rejeita se gold insuficiente', async () => {
    camp.party[0]!.gold = 10;
    const r = await handleBuyShopItem(camp, 'pj-1', 'shop-1', 'it-1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Faltam/);
    expect(camp.party[0]!.gold).toBe(10);
  });

  it('rejeita shopId errado', async () => {
    const r = await handleBuyShopItem(camp, 'pj-1', 'shop-wrong', 'it-1');
    expect(r.ok).toBe(false);
  });

  it('rejeita item sem estoque', async () => {
    camp.state.openShop!.items[2]!.stock = 0;
    const r = await handleBuyShopItem(camp, 'pj-1', 'shop-1', 'it-3');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/estoque/i);
  });

  it('decrementa stock após compra', async () => {
    camp.party[0]!.gold = 500; // gold suficiente pro Cajado (200po)
    await handleBuyShopItem(camp, 'pj-1', 'shop-1', 'it-3');
    expect(camp.state.openShop!.items[2]!.stock).toBe(0);
  });

  it('rejeita se loja não está aberta', async () => {
    camp.state.openShop = null;
    const r = await handleBuyShopItem(camp, 'pj-1', 'shop-1', 'it-1');
    expect(r.ok).toBe(false);
  });
});

describe('β.3 — handleSellShopItem', () => {
  let camp: Campaign;
  let item: InventoryItem;

  beforeEach(() => {
    camp = new Campaign(fakeDM, { id: 'c-sell', name: 'T' });
    camp.addCharacter(makePJ('pj-1', 0));
    camp.state.openShop = makeShop();
    item = { id: 'inv-1', name: 'Espada Longa', type: 'arma', quantity: 1 };
    camp.party[0]!.inventory.push(item);
  });

  it('vende match exato a 50% do preço', async () => {
    const r = await handleSellShopItem(camp, 'pj-1', 'shop-1', 'inv-1');
    expect(r.ok).toBe(true);
    expect(r.goldDelta).toBe(7); // 50% de 15 floor = 7
    expect(camp.party[0]!.gold).toBe(7);
    expect(camp.party[0]!.inventory).toHaveLength(0);
  });

  it('rejeita shop não aceita venda', async () => {
    camp.state.openShop!.acceptsSell = false;
    const r = await handleSellShopItem(camp, 'pj-1', 'shop-1', 'inv-1');
    expect(r.ok).toBe(false);
  });

  it('rejeita item equipado', async () => {
    camp.party[0]!.equippedWeapons = ['inv-1'];
    const r = await handleSellShopItem(camp, 'pj-1', 'shop-1', 'inv-1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/[Dd]esequipe/);
  });

  it('decrementa quantity ao invés de remover quando >1', async () => {
    const stack = { id: 'stack-1', name: 'Poção de Cura', type: 'consumivel' as const, quantity: 5 };
    camp.party[0]!.inventory.push(stack);
    const r = await handleSellShopItem(camp, 'pj-1', 'shop-1', 'stack-1');
    expect(r.ok).toBe(true);
    expect(stack.quantity).toBe(4);
  });
});

describe('β.3 — estimateSellPrice (pure)', () => {
  it('match exato = 50%', () => {
    const shopItems = [{ name: 'Espada Longa', priceGold: 15 }];
    expect(estimateSellPrice({ id: 'x', name: 'Espada Longa', type: 'arma', quantity: 1 }, shopItems)).toBe(7);
  });

  it('sem match: estimativa por type', () => {
    expect(estimateSellPrice({ id: 'x', name: 'Adaga Misteriosa', type: 'arma', quantity: 1 }, [])).toBe(10);
    expect(estimateSellPrice({ id: 'x', name: 'Capa Velha', type: 'armadura', quantity: 1 }, [])).toBe(20);
    expect(estimateSellPrice({ id: 'x', name: 'Frasco X', type: 'consumivel', quantity: 1 }, [])).toBe(25);
    expect(estimateSellPrice({ id: 'x', name: 'Anel Quebrado', type: 'misc', quantity: 1 }, [])).toBe(2);
  });

  it('mínimo de 1 po pra qualquer item', () => {
    expect(estimateSellPrice({ id: 'x', name: 'Pedra', type: 'arma', quantity: 1 }, [{ name: 'Pedra', priceGold: 0 }])).toBe(1);
  });
});

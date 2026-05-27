// β.3 — Shop/Vendor handler (extraído pra não inflar campaign.ts).
// Buy: valida shop ativo, item existe, gold suficiente, estoque > 0 → debita
// gold + adiciona ao inventário + decrementa stock.
// Sell: valida shop ativo, accepts_sell, item no inventário → remove item +
// credita gold (preço de venda = 50% do priceGold dos items "comparáveis", ou
// 10po default se item sem preço).

import type { Campaign } from '../campaign.js';
import type { InventoryItem } from '../../shared/types.js';

export interface ShopOpResult {
  ok: boolean;
  reason?: string;
  goldDelta?: number;     // mudança no gold (+ pra venda, - pra compra)
  itemName?: string;
}

// Sell price: default 50% do priceGold se item em shop tem ref pelo nome,
// senão estimativa por type. 100% pra tesouro/gold direto.
export function estimateSellPrice(item: InventoryItem, shopItems: Array<{ name: string; priceGold: number }>): number {
  // Match exato por nome → 50%
  const match = shopItems.find((s) => s.name === item.name);
  if (match) return Math.max(1, Math.floor(match.priceGold * 0.5));
  // Estimativa por type (PHB baseline)
  switch (item.type) {
    case 'arma':       return 10;
    case 'armadura':   return 20;
    case 'escudo':     return 5;
    case 'consumivel': return 25;
    case 'ferramenta': return 5;
    case 'tesouro':    return 1; // gold/gems já são valor direto
    case 'misc':
    default:           return 2;
  }
}

export async function handleBuyShopItem(
  camp: Campaign,
  playerId: string,
  shopId: string,
  shopItemId: string,
): Promise<ShopOpResult> {
  const shop = camp.state.openShop;
  if (!shop || shop.id !== shopId) return { ok: false, reason: 'Loja não está aberta.' };
  const item = shop.items.find((it) => it.id === shopItemId);
  if (!item) return { ok: false, reason: 'Item não está mais à venda.' };
  if (item.stock !== undefined && item.stock <= 0) return { ok: false, reason: 'Sem estoque.' };
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: 'PJ não encontrado.' };
  if (player.gold < item.priceGold) {
    return { ok: false, reason: `Faltam ${item.priceGold - player.gold} po.` };
  }

  // Debita gold
  player.gold -= item.priceGold;
  // Adiciona ao inventário
  const invItem: InventoryItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    type: item.type,
    quantity: 1,
    ...(item.rarity ? { rarity: item.rarity } : {}),
    ...(item.description ? { description: item.description } : {}),
    isNew: true,
  };
  player.inventory.push(invItem);
  // Decrementa stock se finito
  if (item.stock !== undefined) item.stock = Math.max(0, item.stock - 1);

  camp.pushRecentEvent(`${player.characterName} comprou ${item.name} por ${item.priceGold}po de ${shop.npcName}`);
  camp.indexFact({
    kind: 'inventory',
    text: `${player.characterName} comprou ${item.name} por ${item.priceGold} po de ${shop.npcName}.`,
    tags: `compra loja ${item.name.toLowerCase()} ${shop.npcName.toLowerCase()}`,
    importance: 1.0,
  });
  return { ok: true, goldDelta: -item.priceGold, itemName: item.name };
}

export async function handleSellShopItem(
  camp: Campaign,
  playerId: string,
  shopId: string,
  inventoryItemId: string,
): Promise<ShopOpResult> {
  const shop = camp.state.openShop;
  if (!shop || shop.id !== shopId) return { ok: false, reason: 'Loja não está aberta.' };
  if (!shop.acceptsSell) return { ok: false, reason: 'Esse mercador não compra.' };
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: 'PJ não encontrado.' };
  const idx = player.inventory.findIndex((it) => it.id === inventoryItemId);
  if (idx === -1) return { ok: false, reason: 'Item não está no inventário.' };
  const item = player.inventory[idx]!;
  // Bloqueia venda de items equipados
  if (player.equippedWeapons.includes(item.id) || player.equippedArmor === item.id || player.equippedShield === item.id) {
    return { ok: false, reason: 'Desequipe antes de vender.' };
  }

  const sellPrice = estimateSellPrice(item, shop.items);
  player.gold += sellPrice;
  if (item.quantity > 1) {
    item.quantity--;
  } else {
    player.inventory.splice(idx, 1);
  }

  camp.pushRecentEvent(`${player.characterName} vendeu ${item.name} por ${sellPrice}po pra ${shop.npcName}`);
  return { ok: true, goldDelta: sellPrice, itemName: item.name };
}

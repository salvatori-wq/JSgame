// β.3 — Shop modal: compra/venda de itens com vendor.
// Abre quando state.openShop !== null. Cliente emite buyShopItem/sellShopItem;
// server valida gold/stock + atualiza state + broadcast partyUpdate.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CharacterSheet, OpenShop, ShopItem, InventoryItem,
} from '../../shared/types';
import { el, escapeHtml, onSwipeDown } from '../util';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ShopModalOpts {
  shop: OpenShop;
  character: CharacterSheet;
  socket: SocketT;
  onClose: () => void;
}

let currentEl: HTMLDivElement | null = null;
let lastShopId: string | null = null;

export function openShopModal(opts: ShopModalOpts): void {
  // Idempotente: se mesmo shop já aberto, só re-renderiza
  if (currentEl && lastShopId === opts.shop.id) {
    renderInto(currentEl, opts);
    return;
  }
  closeShopModal();
  lastShopId = opts.shop.id;

  const overlay = document.createElement('div');
  overlay.className = 'shop-modal-overlay inv-modal-overlay';
  overlay.innerHTML = `<div class="inv-modal-backdrop"></div>`;

  const modal = el('div', { class: 'shop-modal inv-modal' });
  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  const close = (): void => {
    closeShopModal();
    opts.socket.emit('closeShop');
    opts.onClose();
  };
  overlay.querySelector('.inv-modal-backdrop')?.addEventListener('click', close);
  onSwipeDown(modal, close);

  renderInto(overlay, opts);
}

export function closeShopModal(): void {
  currentEl?.remove();
  currentEl = null;
  lastShopId = null;
}

function renderInto(overlay: HTMLDivElement, opts: ShopModalOpts): void {
  const modal = overlay.querySelector('.shop-modal') as HTMLDivElement | null;
  if (!modal) return;
  modal.innerHTML = '';

  const close = (): void => {
    closeShopModal();
    opts.socket.emit('closeShop');
    opts.onClose();
  };

  modal.appendChild(el('div', { class: 'inv-modal-header' }, [
    el('h3', { class: 'inv-modal-title', text: `🏪 ${opts.shop.npcName}` }),
    el('span', { class: 'shop-modal-sub', text: `${shopTypeLabel(opts.shop.shopType)} · 💰 ${opts.character.gold} po` }),
    el('button', { class: 'inv-modal-close', text: '✕', on: { click: close } }),
  ]));

  // Tabs Comprar / Vender
  const tabs = el('div', { class: 'shop-tabs' });
  const buyTab = el('button', { class: 'shop-tab is-active', attrs: { type: 'button' }, text: '🛒 Comprar' });
  const sellTab = el('button', { class: 'shop-tab', attrs: { type: 'button' }, text: `💰 Vender ${opts.shop.acceptsSell ? '' : '(N/D)'}` }) as HTMLButtonElement;
  if (!opts.shop.acceptsSell) sellTab.disabled = true;

  const content = el('div', { class: 'shop-content' });

  const renderBuy = (): void => {
    content.innerHTML = '';
    if (opts.shop.items.length === 0) {
      content.appendChild(el('div', { class: 'shop-empty', text: '💰 Esse mercador ainda não tem nada que valha.' }));
      return;
    }
    const grid = el('div', { class: 'shop-grid' });
    for (const item of opts.shop.items) {
      grid.appendChild(renderBuyCard(item, opts));
    }
    content.appendChild(grid);
  };

  const renderSell = (): void => {
    content.innerHTML = '';
    const sellableItems = opts.character.inventory.filter((it) =>
      !opts.character.equippedWeapons.includes(it.id)
      && opts.character.equippedArmor !== it.id
      && opts.character.equippedShield !== it.id,
    );
    if (sellableItems.length === 0) {
      content.appendChild(el('div', { class: 'shop-empty', text: '💰 Nada pra vender — desequipe armaduras/escudos primeiro.' }));
      return;
    }
    const grid = el('div', { class: 'shop-grid' });
    for (const item of sellableItems) {
      grid.appendChild(renderSellCard(item, opts));
    }
    content.appendChild(grid);
  };

  buyTab.addEventListener('click', () => {
    buyTab.classList.add('is-active');
    sellTab.classList.remove('is-active');
    renderBuy();
  });
  sellTab.addEventListener('click', () => {
    if (sellTab.disabled) return;
    sellTab.classList.add('is-active');
    buyTab.classList.remove('is-active');
    renderSell();
  });

  tabs.appendChild(buyTab);
  tabs.appendChild(sellTab);
  modal.appendChild(tabs);
  modal.appendChild(content);
  renderBuy();
}

function renderBuyCard(item: ShopItem, opts: ShopModalOpts): HTMLElement {
  const canAfford = opts.character.gold >= item.priceGold;
  const outOfStock = item.stock !== undefined && item.stock <= 0;
  const disabled = !canAfford || outOfStock;
  const rarity = item.rarity ?? 'comum';

  const card = el('div', { class: `shop-card rarity-${rarity} ${disabled ? 'is-disabled' : ''}` }, [
    el('div', { class: 'shop-card-head' }, [
      el('span', { class: 'shop-card-icon', text: iconFor(item.type) }),
      el('div', { class: 'shop-card-name', text: item.name }),
    ]),
    item.description ? el('div', { class: 'shop-card-desc', text: item.description }) : null,
    el('div', { class: 'shop-card-meta' }, [
      el('span', { class: 'shop-card-price', text: `💰 ${item.priceGold} po` }),
      item.stock !== undefined ? el('span', { class: 'shop-card-stock', text: `📦 ${item.stock}` }) : null,
    ].filter(Boolean) as HTMLElement[]),
    el('button', {
      class: 'shop-buy-btn',
      attrs: { type: 'button', ...(disabled ? { disabled: true } : {}) },
      text: outOfStock ? 'Sem estoque' : canAfford ? `Comprar` : `Falta ${item.priceGold - opts.character.gold}po`,
      on: {
        click: () => {
          if (disabled) return;
          opts.socket.emit('buyShopItem', { shopId: opts.shop.id, itemId: item.id });
        },
      },
    }),
  ].filter(Boolean) as HTMLElement[]);
  return card;
}

function renderSellCard(item: InventoryItem, opts: ShopModalOpts): HTMLElement {
  const sellPrice = estimateSellPriceClient(item, opts.shop.items);
  const rarity = item.rarity ?? 'comum';

  const card = el('div', { class: `shop-card rarity-${rarity}` }, [
    el('div', { class: 'shop-card-head' }, [
      el('span', { class: 'shop-card-icon', text: iconFor(item.type) }),
      el('div', { class: 'shop-card-name', text: item.name }),
    ]),
    el('div', { class: 'shop-card-meta' }, [
      el('span', { class: 'shop-card-price', text: `💰 ${sellPrice} po (venda)` }),
      item.quantity > 1 ? el('span', { class: 'shop-card-stock', text: `${item.quantity}x` }) : null,
    ].filter(Boolean) as HTMLElement[]),
    el('button', {
      class: 'shop-sell-btn',
      attrs: { type: 'button' },
      text: 'Vender',
      on: {
        click: () => {
          opts.socket.emit('sellShopItem', { shopId: opts.shop.id, inventoryItemId: item.id });
        },
      },
    }),
  ]);
  return card;
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (replicam server pra preview imediato no client)
// ════════════════════════════════════════════════════════════════════════════

export function estimateSellPriceClient(item: InventoryItem, shopItems: Array<{ name: string; priceGold: number }>): number {
  const match = shopItems.find((s) => s.name === item.name);
  if (match) return Math.max(1, Math.floor(match.priceGold * 0.5));
  switch (item.type) {
    case 'arma':       return 10;
    case 'armadura':   return 20;
    case 'escudo':     return 5;
    case 'consumivel': return 25;
    case 'ferramenta': return 5;
    case 'tesouro':    return 1;
    case 'misc':
    default:           return 2;
  }
}

export function shopTypeLabel(t: OpenShop['shopType']): string {
  switch (t) {
    case 'arms':    return '⚔ Armas e Armaduras';
    case 'alchemy': return '🧪 Alquimia';
    case 'magic':   return '🔮 Magia';
    case 'general': return '📦 Geral';
  }
}

function iconFor(type: ShopItem['type']): string {
  switch (type) {
    case 'arma':       return '⚔';
    case 'armadura':   return '🛡';
    case 'escudo':     return '🛡';
    case 'consumivel': return '🧪';
    case 'tesouro':    return '💰';
    case 'ferramenta': return '🔧';
    case 'misc':
    default:           return '📦';
  }
}

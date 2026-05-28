// Sprint Φ.4 — ItemCard com rarity glow D&D 5e.
// Cores oficiais DMG p.135 (Common/Uncommon/Rare/Very Rare/Legendary/Artifact)
// via tokens --dnd-rarity-*. Atunement badge dourado quando aplicável.

import { el } from '../util';
import type { InventoryItem, ItemRarity } from '../../shared/types';

export interface RenderItemCardOpts {
  isEquipped?: boolean;     // bordas/glow extra equipado
  isFresh?: boolean;        // animação loot-burst (item novo)
  actions?: HTMLElement;    // botão "Equipar / Usar / Descartar" embutido no rodapé
  onClick?: () => void;
}

export function renderItemCard(item: InventoryItem, opts: RenderItemCardOpts = {}): HTMLElement {
  const { isEquipped = false, isFresh = false, actions, onClick } = opts;
  const rarity: ItemRarity = item.rarity ?? 'comum';
  const equippedCls = isEquipped ? 'is-equipped' : '';
  const freshCls = isFresh ? 'is-new' : '';

  const card = el('div', {
    class: `ic-card ic-rarity-${rarity} ic-type-${item.type} ${equippedCls} ${freshCls}`,
    attrs: {
      'data-rarity': rarity,
      'data-type': item.type,
      'aria-label': `${item.name}, ${rarityLabel(rarity)}, ${typeLabel(item.type)}`,
    },
    on: onClick ? { click: onClick } : undefined,
  });

  // ── Header row: icon + name + rarity gem ──────────────────────────────
  const head = el('div', { class: 'ic-head' });
  head.appendChild(el('span', { class: 'ic-icon', text: iconFor(item.type) }));
  head.appendChild(el('div', { class: 'ic-name', text: item.name }));
  // Rarity gem indicator (small dot colored by rarity)
  head.appendChild(el('span', {
    class: 'ic-gem',
    attrs: { title: rarityLabel(rarity), 'aria-label': rarityLabel(rarity) },
  }));
  card.appendChild(head);

  // ── Meta row: rarity label + tipo + qty + attunement badge ────────────
  const meta = el('div', { class: 'ic-meta' });
  meta.appendChild(el('span', { class: 'ic-rarity-label', text: rarityLabel(rarity) }));
  meta.appendChild(el('span', { class: 'ic-meta-sep', text: '·' }));
  meta.appendChild(el('span', { class: 'ic-type-label', text: typeLabel(item.type) }));
  if (item.quantity > 1) {
    meta.appendChild(el('span', { class: 'ic-meta-sep', text: '·' }));
    meta.appendChild(el('span', { class: 'ic-qty', text: `${item.quantity}×` }));
  }
  if (item.requiresAttunement) {
    meta.appendChild(renderAttunementBadge(!!item.isAttuned));
  }
  card.appendChild(meta);

  // ── Description ───────────────────────────────────────────────────────
  if (item.description) {
    card.appendChild(el('p', { class: 'ic-desc', text: item.description }));
  }

  // ── Actions row (passado pelo caller, opcional) ───────────────────────
  if (actions) {
    actions.classList.add('ic-actions');
    card.appendChild(actions);
  }

  return card;
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers puros (testáveis sem DOM)
// ════════════════════════════════════════════════════════════════════════════

export function rarityLabel(r: ItemRarity): string {
  switch (r) {
    case 'comum':       return 'Comum';
    case 'incomum':     return 'Incomum';
    case 'raro':        return 'Raro';
    case 'muito-raro':  return 'Muito Raro';
    case 'lendario':    return 'Lendário';
  }
}

export function rarityToken(r: ItemRarity): string {
  switch (r) {
    case 'comum':       return '--dnd-rarity-common';
    case 'incomum':     return '--dnd-rarity-uncommon';
    case 'raro':        return '--dnd-rarity-rare';
    case 'muito-raro':  return '--dnd-rarity-very-rare';
    case 'lendario':    return '--dnd-rarity-legendary';
  }
}

export function typeLabel(type: InventoryItem['type']): string {
  switch (type) {
    case 'arma':         return 'Arma';
    case 'armadura':     return 'Armadura';
    case 'escudo':       return 'Escudo';
    case 'consumivel':   return 'Consumível';
    case 'tesouro':      return 'Tesouro';
    case 'ferramenta':   return 'Ferramenta';
    case 'misc':         return 'Diverso';
  }
}

export function iconFor(type: InventoryItem['type']): string {
  switch (type) {
    case 'arma':       return '⚔';
    case 'armadura':   return '🛡';
    case 'escudo':     return '🛡';
    case 'consumivel': return '🧪';
    case 'tesouro':    return '💎';
    case 'ferramenta': return '🛠';
    case 'misc':       return '📦';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Internal render helpers
// ════════════════════════════════════════════════════════════════════════════

function renderAttunementBadge(active: boolean): HTMLElement {
  return el('span', {
    class: `ic-attune ${active ? 'is-active' : ''}`,
    attrs: {
      title: active
        ? 'Sintonizado. Você desperta os poderes deste item.'
        : 'Requer sintonia. Faça um descanso curto pra desbloquear poderes.',
    },
    text: active ? '◈ Sintonizado' : '◇ Sintonia',
  });
}

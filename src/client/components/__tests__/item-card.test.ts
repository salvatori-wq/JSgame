// @vitest-environment happy-dom
// Sprint Φ.4 — Tests do ItemCard component.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderItemCard,
  rarityLabel,
  rarityToken,
  typeLabel,
  iconFor,
} from '../item-card';
import type { InventoryItem } from '../../../shared/types';

function baseItem(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'sword-001',
    name: 'Espada Longa',
    type: 'arma',
    quantity: 1,
    description: 'Espada de aço afiada.',
    rarity: 'comum',
    ...over,
  };
}

describe('Φ.4 — helpers puros', () => {
  it('rarityLabel cobre 5 raridades', () => {
    expect(rarityLabel('comum')).toBe('Comum');
    expect(rarityLabel('incomum')).toBe('Incomum');
    expect(rarityLabel('raro')).toBe('Raro');
    expect(rarityLabel('muito-raro')).toBe('Muito Raro');
    expect(rarityLabel('lendario')).toBe('Lendário');
  });

  it('rarityToken mapeia PT-BR → DMG token names', () => {
    expect(rarityToken('comum')).toBe('--dnd-rarity-common');
    expect(rarityToken('incomum')).toBe('--dnd-rarity-uncommon');
    expect(rarityToken('raro')).toBe('--dnd-rarity-rare');
    expect(rarityToken('muito-raro')).toBe('--dnd-rarity-very-rare');
    expect(rarityToken('lendario')).toBe('--dnd-rarity-legendary');
  });

  it('typeLabel + iconFor cobrem 7 tipos sem retorno default', () => {
    const types: InventoryItem['type'][] = ['arma', 'armadura', 'escudo', 'consumivel', 'tesouro', 'ferramenta', 'misc'];
    for (const t of types) {
      expect(typeLabel(t)).toBeTruthy();
      expect(iconFor(t)).toBeTruthy();
    }
  });
});

describe('Φ.4 — renderItemCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renderiza nome + ícone + descrição', () => {
    const card = renderItemCard(baseItem());
    expect(card.querySelector('.ic-name')?.textContent).toBe('Espada Longa');
    // Fase 1A — ícone agora é SVG (game-icons) com fallback emoji.
    const icon = card.querySelector('.ic-icon');
    expect(icon?.querySelector('svg') ?? icon?.textContent).toBeTruthy();
    expect(card.querySelector('.ic-desc')?.textContent).toBe('Espada de aço afiada.');
  });

  it('aplica classe ic-rarity-* pra cor da raridade', () => {
    const card = renderItemCard(baseItem({ rarity: 'lendario' }));
    expect(card.classList.contains('ic-rarity-lendario')).toBe(true);
    expect(card.getAttribute('data-rarity')).toBe('lendario');
  });

  it('expõe data-type pra css/automation', () => {
    const card = renderItemCard(baseItem({ type: 'consumivel' }));
    expect(card.getAttribute('data-type')).toBe('consumivel');
  });

  it('default rarity = comum quando não definida', () => {
    const card = renderItemCard(baseItem({ rarity: undefined }));
    expect(card.classList.contains('ic-rarity-comum')).toBe(true);
  });

  it('renderiza qty quando > 1', () => {
    const card = renderItemCard(baseItem({ quantity: 3, type: 'consumivel' }));
    const meta = card.querySelector('.ic-qty');
    expect(meta?.textContent).toBe('3×');
  });

  it('omite qty quando quantity === 1', () => {
    const card = renderItemCard(baseItem({ quantity: 1 }));
    expect(card.querySelector('.ic-qty')).toBeNull();
  });

  it('renderiza badge "Sintonia" quando requiresAttunement', () => {
    const card = renderItemCard(baseItem({ requiresAttunement: true }));
    const badge = card.querySelector('.ic-attune');
    expect(badge?.textContent).toContain('Sintonia');
    expect(badge?.classList.contains('is-active')).toBe(false);
  });

  it('renderiza badge "Sintonizado" quando isAttuned=true', () => {
    const card = renderItemCard(baseItem({ requiresAttunement: true, isAttuned: true }));
    const badge = card.querySelector('.ic-attune');
    expect(badge?.textContent).toContain('Sintonizado');
    expect(badge?.classList.contains('is-active')).toBe(true);
  });

  it('omite badge quando não requer sintonia', () => {
    const card = renderItemCard(baseItem({ requiresAttunement: false }));
    expect(card.querySelector('.ic-attune')).toBeNull();
  });

  it('aplica classe is-equipped quando opts.isEquipped', () => {
    const card = renderItemCard(baseItem(), { isEquipped: true });
    expect(card.classList.contains('is-equipped')).toBe(true);
  });

  it('aplica classe is-new quando opts.isFresh (loot-burst)', () => {
    const card = renderItemCard(baseItem(), { isFresh: true });
    expect(card.classList.contains('is-new')).toBe(true);
  });

  it('chama onClick quando clicado', () => {
    const onClick = vi.fn();
    const card = renderItemCard(baseItem(), { onClick });
    card.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aria-label inclui nome + rarity + tipo', () => {
    const card = renderItemCard(baseItem({ rarity: 'raro' }));
    const aria = card.getAttribute('aria-label') ?? '';
    expect(aria).toContain('Espada Longa');
    expect(aria).toContain('Raro');
    expect(aria).toContain('Arma');
  });

  it('renderiza gem indicator (.ic-gem) com cor da raridade', () => {
    const card = renderItemCard(baseItem({ rarity: 'lendario' }));
    const gem = card.querySelector('.ic-gem');
    expect(gem).not.toBeNull();
    expect(gem?.getAttribute('title')).toBe('Lendário');
  });

  it('inclui actions passados via opts', () => {
    const actions = document.createElement('div');
    actions.appendChild(document.createTextNode('Botões aqui'));
    const card = renderItemCard(baseItem(), { actions });
    expect(card.contains(actions)).toBe(true);
    expect(actions.classList.contains('ic-actions')).toBe(true);
  });
});

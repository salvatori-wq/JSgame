// JSgame · Inventory modal — equip/unequip/use items.
// Acessível do campaign-screen via botão 🎒 Inventário.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CharacterSheet, InventoryItem,
} from '../../shared/types';
import { el, escapeHtml, onSwipeDown } from '../util';
import { renderItemCard as renderItemCardComponent } from '../components/item-card';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface InventoryModalOpts {
  character: CharacterSheet;
  socket: SocketT;
  onClose: () => void;
}

let currentEl: HTMLDivElement | null = null;
// α.2 — IDs de items já mostrados nesta sessão de cliente. Evita re-disparar
// loot-burst toda vez que o modal abrir. In-memory; reset em F5.
const seenItemIds = new Set<string>();

export function openInventoryModal(opts: InventoryModalOpts): void {
  closeInventoryModal();
  const { character, socket, onClose } = opts;

  const overlay = document.createElement('div');
  overlay.className = 'inv-modal-overlay';
  overlay.innerHTML = `<div class="inv-modal-backdrop"></div>`;

  const modal = el('div', { class: 'inv-modal' });

  // Header
  modal.appendChild(el('div', { class: 'inv-modal-header' }, [
    el('h3', { class: 'inv-modal-title', text: `🎒 ${character.characterName}` }),
    el('span', { class: 'inv-modal-stats', text: `CA ${character.armorClass} · HP ${character.currentHp}/${character.maxHp} · ${character.gold} po` }),
    el('button', { class: 'inv-modal-close', text: '✕', on: { click: () => { closeInventoryModal(); onClose(); } } }),
  ]));

  // Equipped section
  modal.appendChild(renderEquipped(character, socket));

  // Inventory list
  const listEl = el('div', { class: 'inv-modal-list' });
  listEl.appendChild(el('h4', { class: 'inv-section-title', text: 'Itens' }));
  if (character.inventory.length === 0) {
    // P5 — Empty state estruturado: ícone grande + título + dica didática
    listEl.appendChild(el('div', { class: 'inv-empty' }, [
      el('div', { class: 'inv-empty-icon', text: '🎒' }),
      el('div', { class: 'inv-empty-title', text: 'Bolsa vazia' }),
      el('div', { class: 'inv-empty-sub', text: 'O Mestre concede itens via aventura. Saqueie inimigos, abra baús, ou compre numa cidade.' }),
    ]));
  } else {
    const grid = el('div', { class: 'inv-grid' });
    for (const item of character.inventory) {
      grid.appendChild(renderItemCard(item, character, socket));
    }
    listEl.appendChild(grid);
  }
  modal.appendChild(listEl);

  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.inv-modal-backdrop')?.addEventListener('click', () => {
    closeInventoryModal();
    onClose();
  });

  // Swipe down no modal (mobile) — fecha
  onSwipeDown(modal, () => {
    closeInventoryModal();
    onClose();
  });
}

export function closeInventoryModal(): void {
  currentEl?.remove();
  currentEl = null;
}

function renderEquipped(character: CharacterSheet, socket: SocketT): HTMLElement {
  const section = el('div', { class: 'inv-equipped' });
  section.appendChild(el('h4', { class: 'inv-section-title', text: 'Equipado' }));

  const findItem = (id: string | undefined): InventoryItem | undefined =>
    id ? character.inventory.find((i) => i.id === id) : undefined;

  const weapons = character.equippedWeapons.map(findItem).filter((i): i is InventoryItem => !!i);
  const armor = findItem(character.equippedArmor);
  const shield = findItem(character.equippedShield);

  const slotsGrid = el('div', { class: 'inv-equipped-grid' }, [
    el('div', { class: 'inv-slot inv-slot-weapons' }, [
      el('div', { class: 'inv-slot-label', text: '⚔ Armas (2)' }),
      weapons.length === 0
        ? el('div', { class: 'inv-slot-empty', text: '—' })
        : el('div', { class: 'inv-slot-items' }, weapons.map((w) => el('div', { class: 'inv-equipped-item' }, [
            el('span', { text: w.name }),
            el('button', {
              class: 'inv-mini-btn',
              text: '✕',
              attrs: { title: 'Desequipar' },
              on: { click: () => socket.emit('unequipItem', { slot: 'weapon', itemId: w.id }) },
            }),
          ]))),
    ]),
    el('div', { class: 'inv-slot' }, [
      el('div', { class: 'inv-slot-label', text: '🛡 Armadura' }),
      armor
        ? el('div', { class: 'inv-equipped-item' }, [
            el('span', { text: armor.name }),
            el('button', { class: 'inv-mini-btn', text: '✕', on: { click: () => socket.emit('unequipItem', { slot: 'armor' }) } }),
          ])
        : el('div', { class: 'inv-slot-empty', text: '—' }),
    ]),
    el('div', { class: 'inv-slot' }, [
      el('div', { class: 'inv-slot-label', text: '🛡 Escudo' }),
      shield
        ? el('div', { class: 'inv-equipped-item' }, [
            el('span', { text: shield.name }),
            el('button', { class: 'inv-mini-btn', text: '✕', on: { click: () => socket.emit('unequipItem', { slot: 'shield' }) } }),
          ])
        : el('div', { class: 'inv-slot-empty', text: '—' }),
    ]),
  ]);
  section.appendChild(slotsGrid);
  return section;
}

function renderItemCard(item: InventoryItem, character: CharacterSheet, socket: SocketT): HTMLElement {
  const isEquipped =
    character.equippedWeapons.includes(item.id) ||
    character.equippedArmor === item.id ||
    character.equippedShield === item.id;

  // Loot-burst só dispara na PRIMEIRA renderização desse item no cliente,
  // independente de re-abrir o modal. Server seta isNew quando cria; client
  // gateia via seenItemIds in-memory.
  const isFresh = !!(item.isNew && !seenItemIds.has(item.id));
  if (isFresh) seenItemIds.add(item.id);

  // Φ.4 — Delega render ao componente novo (ic-card + rarity glow + attune badge).
  // Mantém classe legacy inv-item-card no card pra compat com CSS antigo.
  const card = renderItemCardComponent(item, {
    isEquipped,
    isFresh,
    actions: renderActions(item, isEquipped, socket),
  });
  card.classList.add('inv-item-card', `inv-type-${item.type}`, `rarity-${item.rarity ?? 'comum'}`);
  return card;
}

function renderActions(item: InventoryItem, isEquipped: boolean, socket: SocketT): HTMLElement {
  const actions = el('div', { class: 'inv-item-actions' });

  if (item.type === 'consumivel') {
    actions.appendChild(el('button', {
      class: 'inv-action-btn inv-use',
      text: '🍶 Usar',
      on: { click: () => socket.emit('useItem', { itemId: item.id }) },
    }));
  } else if (item.type === 'arma' && !isEquipped) {
    actions.appendChild(el('button', {
      class: 'inv-action-btn inv-equip',
      text: '⚔ Equipar',
      on: { click: () => socket.emit('equipItem', { itemId: item.id, slot: 'weapon' }) },
    }));
  } else if (item.type === 'armadura' && !isEquipped) {
    actions.appendChild(el('button', {
      class: 'inv-action-btn inv-equip',
      text: '🛡 Vestir',
      on: { click: () => socket.emit('equipItem', { itemId: item.id, slot: 'armor' }) },
    }));
  } else if (item.type === 'escudo' && !isEquipped) {
    actions.appendChild(el('button', {
      class: 'inv-action-btn inv-equip',
      text: '🛡 Empunhar',
      on: { click: () => socket.emit('equipItem', { itemId: item.id, slot: 'shield' }) },
    }));
  } else if (isEquipped) {
    actions.appendChild(el('span', { class: 'inv-badge', text: '✓ Equipado' }));
  }
  // P1 — Acessorio (anéis, amuletos, etc) com requiresAttunement mostra estado
  // de sintonia + dica pra player. Sem socket novo: server decide sintonização
  // via DM tool call (player pede via ação livre "sintonizo o anel").
  if (item.requiresAttunement) {
    if (item.isAttuned) {
      actions.appendChild(el('span', {
        class: 'inv-badge inv-attuned',
        text: '✨ Sintonizado',
        attrs: { title: 'Item ativo — efeito mágico disponível' },
      }));
    } else {
      actions.appendChild(el('span', {
        class: 'inv-badge inv-needs-attunement',
        text: '◇ Pede pra sintonizar',
        attrs: { title: 'Item mágico — peça ao Mestre pra sintonizar (ação livre durante descanso curto)' },
      }));
    }
  }

  return actions;
}

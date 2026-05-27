// JSgame · Inventory modal — equip/unequip/use items.
// Acessível do campaign-screen via botão 🎒 Inventário.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CharacterSheet, InventoryItem,
} from '../../shared/types';
import { el, escapeHtml, onSwipeDown } from '../util';

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
    listEl.appendChild(el('div', { class: 'inv-empty', text: 'Inventário vazio.' }));
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

  // α.2 — Raridade visual (CSS classes rarity-comum/incomum/raro/muito-raro/lendario)
  const rarity = item.rarity ?? 'comum';
  // Loot-burst só dispara na PRIMEIRA renderização desse item no cliente,
  // independente de re-abrir o modal. Server seta isNew quando cria; client
  // gateia via seenItemIds in-memory.
  const isFresh = item.isNew && !seenItemIds.has(item.id);
  const newClass = isFresh ? 'is-new' : '';
  if (isFresh) seenItemIds.add(item.id);

  const meta = rarityMetaLabel(rarity);
  const card = el('div', {
    class: `inv-item-card inv-type-${item.type} rarity-${rarity} ${isEquipped ? 'is-equipped' : ''} ${newClass}`,
  }, [
    el('div', { class: 'inv-item-row' }, [
      el('span', { class: 'inv-item-icon', text: iconFor(item.type) }),
      el('div', { class: 'inv-item-name', text: item.name }),
    ]),
    el('div', { class: 'inv-item-meta', text: `${meta} · ${item.type} · ${item.quantity}${item.quantity > 1 ? 'x' : ''}` }),
    item.description ? el('div', { class: 'inv-item-desc', text: item.description }) : null,
    renderActions(item, isEquipped, socket),
  ].filter(Boolean) as HTMLElement[]);
  return card;
}

// α.2 — Mapping rarity → label PT-BR pra meta
function rarityMetaLabel(r: NonNullable<InventoryItem['rarity']>): string {
  switch (r) {
    case 'incomum': return 'Incomum';
    case 'raro': return 'Raro';
    case 'muito-raro': return 'Muito Raro';
    case 'lendario': return 'Lendário';
    case 'comum':
    default: return 'Comum';
  }
}

// α.2 — Mapping type → emoji pra visual rápido
function iconFor(type: InventoryItem['type']): string {
  switch (type) {
    case 'arma': return '⚔';
    case 'armadura': return '🛡';
    case 'escudo': return '🛡';
    case 'consumivel': return '🧪';
    case 'tesouro': return '💰';
    case 'ferramenta': return '🔧';
    case 'misc':
    default: return '📦';
  }
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

  return actions;
}

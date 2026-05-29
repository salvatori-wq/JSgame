// JSgame · Modal de Lançar Magia.
// Lista magias preparadas agrupadas por nível, mostra slots disponíveis,
// pede alvo (party member pra heal, enemy pra dmg, etc) e emit castSpell.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CharacterSheet, CombatState, EnemySnapshot,
} from '../../shared/types';
import { SPELLS, type SpellId } from '../../dnd/spells';
import { isSpellcaster } from '../../dnd/spell-slots';
import { el, escapeHtml, onSwipeDown } from '../util';
import { renderSpellCard } from '../components/spell-card';
import { toastWarn } from '../toast';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface CastSpellModalOpts {
  caster: CharacterSheet;
  party: CharacterSheet[];
  combat: CombatState | null;
  socket: SocketT;
  onClose: () => void;
}

let currentEl: HTMLDivElement | null = null;

export function openCastSpellModal(opts: CastSpellModalOpts): void {
  closeCastSpellModal();

  const { caster, party, combat, socket, onClose } = opts;

  const overlay = document.createElement('div');
  overlay.className = 'cs-modal-overlay';
  overlay.innerHTML = `<div class="cs-modal-backdrop"></div>`;

  const modal = el('div', { class: 'cs-modal' });

  modal.appendChild(renderHeader(caster, () => { closeCastSpellModal(); onClose(); }));
  modal.appendChild(renderSlotsRow(caster));

  // Lista de spells agrupada por nível
  const spellsList = el('div', { class: 'cs-modal-list' });
  const spellsByLevel = new Map<number, SpellId[]>();
  for (const id of caster.spellsPrepared) {
    const sp = SPELLS[id as SpellId];
    if (!sp) continue;
    if (!sp.classes.includes(caster.classId)) continue;
    const arr = spellsByLevel.get(sp.level) ?? [];
    arr.push(id as SpellId);
    spellsByLevel.set(sp.level, arr);
  }

  if (spellsByLevel.size === 0) {
    // P4 — Empty state com CTA inline pra descanso longo (fecha loop sem
    // exigir fechar modal → procurar dock → menu Mais → Descanso Longo).
    spellsList.appendChild(el('div', { class: 'cs-modal-empty' }, [
      el('div', { class: 'cs-modal-empty-icon', text: '📜' }),
      el('div', { class: 'cs-modal-empty-title', text: 'Magias gastas' }),
      el('div', { class: 'cs-modal-empty-sub', text: 'O grimório está em silêncio. Um descanso longo restaura todos os slots.' }),
      el('button', {
        class: 'cs-modal-empty-cta',
        text: '🏕 Descansar 8h',
        attrs: { type: 'button' },
        on: {
          click: () => {
            socket.emit('longRest');
            closeCastSpellModal();
            onClose();
          },
        },
      }),
    ]));
  } else {
    const levels = [...spellsByLevel.keys()].sort();
    for (const lvl of levels) {
      const ids = spellsByLevel.get(lvl)!;
      spellsList.appendChild(el('div', { class: 'cs-modal-level-title', text: lvl === 0 ? 'TRUQUES (sem gastar magia)' : `NÍVEL ${lvl}` }));
      const grid = el('div', { class: 'cs-modal-grid' });
      for (const id of ids) {
        const sp = SPELLS[id];
        const canCast = lvl === 0 || hasSlotFor(caster, lvl);
        grid.appendChild(renderSpellCardLocal(sp, canCast, () => {
          handleSpellSelection(sp, caster, party, combat, socket, () => { closeCastSpellModal(); onClose(); });
        }));
      }
      spellsList.appendChild(grid);
    }
  }

  modal.appendChild(spellsList);
  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  // Click fora fecha
  const backdrop = overlay.querySelector('.cs-modal-backdrop');
  backdrop?.addEventListener('click', () => { closeCastSpellModal(); onClose(); });

  // Swipe down (mobile) — fecha
  onSwipeDown(modal, () => { closeCastSpellModal(); onClose(); });
}

export function closeCastSpellModal(): void {
  currentEl?.remove();
  currentEl = null;
}

function renderHeader(caster: CharacterSheet, onClose: () => void): HTMLElement {
  return el('div', { class: 'cs-modal-header' }, [
    el('h3', { class: 'cs-modal-title', text: `🔮 Grimório · ${caster.characterName}` }),
    el('button', { class: 'cs-modal-close', text: '✕', on: { click: onClose } }),
  ]);
}

function renderSlotsRow(caster: CharacterSheet): HTMLElement {
  const row = el('div', { class: 'cs-modal-slots' });
  row.appendChild(el('span', { class: 'cs-modal-slots-label', text: 'Slots:' }));
  const levels: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
  for (const lvl of levels) {
    const s = caster.spellSlots[lvl];
    if (!s || s.max === 0) continue;
    const avail = s.max - s.used;
    row.appendChild(el('span', { class: `cs-modal-slot ${avail === 0 ? 'is-empty' : ''}`, text: `Nv${lvl}: ${avail}/${s.max}` }));
  }
  return row;
}

// Φ.3 — Wrapper que delega ao componente novo SpellCard.
// Mantém assinatura antiga pra não exigir alterações no caller (open flow).
function renderSpellCardLocal(sp: typeof SPELLS[SpellId], canCast: boolean, onClick: () => void): HTMLElement {
  return renderSpellCard(sp, { compact: true, canCast, onClick });
}

function hasSlotFor(caster: CharacterSheet, level: number): boolean {
  if (level === 0) return true;
  if (level < 1 || level > 5) return false;
  const s = caster.spellSlots[level as 1 | 2 | 3 | 4 | 5];
  return !!s && s.used < s.max;
}

// Pega menor slot disponível >= spell.level
function smallestSlotFor(caster: CharacterSheet, spellLevel: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (spellLevel === 0) return 0;
  for (let l = spellLevel; l <= 5; l++) {
    const s = caster.spellSlots[l as 1 | 2 | 3 | 4 | 5];
    if (s && s.used < s.max) return l as 1 | 2 | 3 | 4 | 5;
  }
  return 0;
}

// Decide se a magia precisa de alvo e abre target picker ou casta direto.
function handleSpellSelection(
  sp: typeof SPELLS[SpellId],
  caster: CharacterSheet,
  party: CharacterSheet[],
  combat: CombatState | null,
  socket: SocketT,
  closeModal: () => void,
): void {
  const slotLevel = smallestSlotFor(caster, sp.level);
  const needsEnemyTarget = sp.effect.kind === 'damage' || (sp.effect.kind === 'condition' && (combat?.enemies.some((e) => e.currentHp > 0)));
  const needsPartyTarget = sp.effect.kind === 'heal';
  // Inimigos vivos disponíveis pra mirar (vazio fora de combate).
  const liveEnemies = combat ? combat.enemies.filter((e) => e.currentHp > 0) : [];

  if (needsEnemyTarget) {
    // Guard: magia hostil sem inimigo vivo NÃO deve cair no self-target (auto-dano)
    // nem abrir picker vazio. Avisa e mantém o modal aberto pra escolher outra.
    if (liveEnemies.length === 0) {
      toastWarn('Essa magia precisa de um inimigo pra mirar.');
      return;
    }
    openTargetPicker({
      title: `Alvo pra ${sp.name}`,
      targets: liveEnemies.map((e) => ({ id: e.id, label: `${e.name} (HP ${e.currentHp}/${e.maxHp})` })),
      onPick: (ids) => {
        socket.emit('castSpell', { spellId: sp.id, targetIds: ids, slotLevel });
        closeModal();
      },
      onCancel: closeModal,
      allowMultiple: !!('aoe' in sp.effect && sp.effect.aoe),
    });
  } else if (needsPartyTarget) {
    openTargetPicker({
      title: `Curar quem com ${sp.name}?`,
      targets: party.map((p) => ({ id: p.id, label: `${p.characterName} (HP ${p.currentHp}/${p.maxHp})` })),
      onPick: (ids) => {
        socket.emit('castSpell', { spellId: sp.id, targetIds: ids, slotLevel });
        closeModal();
      },
      onCancel: closeModal,
      allowMultiple: sp.id === 'mass-healing-word',
    });
  } else {
    // Self ou utility — castar sem target
    socket.emit('castSpell', { spellId: sp.id, targetIds: [caster.id], slotLevel });
    closeModal();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Target picker — sub-modal
// ════════════════════════════════════════════════════════════════════════════

let pickerEl: HTMLDivElement | null = null;

interface PickerOpts {
  title: string;
  targets: Array<{ id: string; label: string }>;
  onPick: (ids: string[]) => void;
  onCancel: () => void;
  allowMultiple: boolean;
}

function openTargetPicker(opts: PickerOpts): void {
  pickerEl?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'cs-picker-overlay';
  const picker = el('div', { class: 'cs-picker' });
  picker.appendChild(el('div', { class: 'cs-picker-title', text: opts.title }));
  if (opts.allowMultiple) {
    picker.appendChild(el('div', { class: 'cs-picker-hint', text: 'Clique pra adicionar/remover. Confirme abaixo.' }));
  }

  const selected = new Set<string>();
  const list = el('div', { class: 'cs-picker-list' });
  for (const t of opts.targets) {
    const btn = el('button', {
      class: 'cs-picker-btn',
      attrs: { 'data-id': t.id },
      on: {
        click: () => {
          if (opts.allowMultiple) {
            if (selected.has(t.id)) { selected.delete(t.id); btn.classList.remove('is-selected'); }
            else { selected.add(t.id); btn.classList.add('is-selected'); }
          } else {
            opts.onPick([t.id]);
            pickerEl?.remove();
            pickerEl = null;
          }
        },
      },
      text: t.label,
    });
    list.appendChild(btn);
  }
  picker.appendChild(list);

  if (opts.allowMultiple) {
    picker.appendChild(el('div', { class: 'cs-picker-actions' }, [
      el('button', { class: 'cs-picker-cancel', text: 'Cancelar', on: { click: () => { pickerEl?.remove(); pickerEl = null; opts.onCancel(); } } }),
      el('button', {
        class: 'cs-picker-confirm', text: 'Confirmar',
        on: {
          click: () => {
            opts.onPick(Array.from(selected));
            pickerEl?.remove();
            pickerEl = null;
          },
        },
      }),
    ]));
  } else {
    picker.appendChild(el('button', { class: 'cs-picker-cancel', text: 'Cancelar', on: { click: () => { pickerEl?.remove(); pickerEl = null; opts.onCancel(); } } }));
  }

  overlay.appendChild(picker);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  pickerEl = overlay;
}

// Helper exportado: mostra botão Lançar Magia se caster
export function shouldShowCastButton(caster: CharacterSheet | null): boolean {
  if (!caster) return false;
  if (!isSpellcaster(caster.classId)) return false;
  return caster.spellsPrepared.length > 0;
}

// JSgame · Modal pra adicionar classe adicional (multi-classe PHB cap 6).
// Mostra 12 classes em cards. Cada uma exibe se atende pré-req do PJ atual
// (verde ✓ + level 1) ou bloqueia (vermelho + razão).

import { ALL_CLASSES } from '../../dnd/classes';
import type { ClassId } from '../../dnd/classes';
import { canMulticlassInto } from '../../dnd/multiclass';
import { el, escapeHtml } from '../util';
import type { AbilityScores } from '../../shared/types';

export interface MulticlassModalOpts {
  currentClassId: ClassId;
  abilityScores: AbilityScores;
  alreadyAdded: ClassId[];
  onPick: (classId: ClassId) => void;
  onClose: () => void;
}

let currentEl: HTMLDivElement | null = null;

export function openMulticlassModal(opts: MulticlassModalOpts): void {
  closeMulticlassModal();

  const overlay = document.createElement('div');
  overlay.className = 'mc-modal-overlay';
  overlay.innerHTML = `<div class="mc-modal-backdrop"></div>`;

  const modal = el('div', { class: 'mc-modal' });

  modal.appendChild(el('div', { class: 'mc-modal-header' }, [
    el('h3', { class: 'mc-modal-title', text: '➕ Adicionar Classe (Multi-classe)' }),
    el('span', { class: 'mc-modal-sub', text: 'PHB cap 6 — precisa atender pré-req de ambas as classes' }),
    el('button', { class: 'mc-modal-close', text: '✕', on: { click: () => { closeMulticlassModal(); opts.onClose(); } } }),
  ]));

  const grid = el('div', { class: 'mc-class-grid' });
  for (const klass of ALL_CLASSES) {
    // Skip a primary (não pode dobrar) e classes já no PJ
    const alreadyHas = klass.id === opts.currentClassId || opts.alreadyAdded.includes(klass.id);
    const eligibility = alreadyHas
      ? { ok: false, reason: 'já é dessa classe' }
      : canMulticlassInto(opts.currentClassId, klass.id, opts.abilityScores);

    const card = el('article', {
      class: `mc-class-card ${eligibility.ok ? 'is-eligible' : 'is-blocked'}`,
      attrs: { role: 'button', tabindex: eligibility.ok ? 0 : -1 },
      on: {
        click: () => {
          if (eligibility.ok) {
            opts.onPick(klass.id);
            closeMulticlassModal();
          }
        },
      },
    });
    card.innerHTML = `
      <div class="mcc-head">
        <span class="mcc-name">${escapeHtml(klass.name)}</span>
        <span class="mcc-status">${eligibility.ok ? '✓' : '✕'}</span>
      </div>
      <div class="mcc-desc">${escapeHtml(klass.description)}</div>
      ${eligibility.ok
        ? `<div class="mcc-eligible-hint">Adquire nv 1 desta classe</div>`
        : `<div class="mcc-blocked-hint">${escapeHtml(eligibility.reason ?? 'bloqueado')}</div>`
      }
    `;
    grid.appendChild(card);
  }
  modal.appendChild(grid);

  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.mc-modal-backdrop')?.addEventListener('click', () => {
    closeMulticlassModal();
    opts.onClose();
  });
}

export function closeMulticlassModal(): void {
  currentEl?.remove();
  currentEl = null;
}

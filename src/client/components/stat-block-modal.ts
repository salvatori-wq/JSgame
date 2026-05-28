// Sprint Φ.2 — Modal wrapper pro StatBlock. Bottom-sheet em mobile,
// centered card em desktop. Fecha por ESC, backdrop click, swipe-down.

import { el, onSwipeDown } from '../util';
import { renderStatBlock, type StatBlockData } from './stat-block';

let currentEl: HTMLDivElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function openStatBlockModal(data: StatBlockData, onClose?: () => void): void {
  closeStatBlockModal();

  const overlay = document.createElement('div');
  overlay.className = 'stat-block-modal-overlay';
  overlay.innerHTML = `<div class="stat-block-modal-backdrop"></div>`;

  const sheet = el('div', { class: 'stat-block-modal-sheet' });
  const close = (): void => {
    closeStatBlockModal();
    onClose?.();
  };

  sheet.appendChild(el('button', {
    class: 'stat-block-modal-close',
    attrs: { 'aria-label': 'Fechar', type: 'button' },
    text: '✕',
    on: { click: close },
  }));
  sheet.appendChild(renderStatBlock(data));

  overlay.appendChild(sheet);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.stat-block-modal-backdrop')?.addEventListener('click', close);
  onSwipeDown(sheet, close);

  escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeStatBlockModal(): void {
  currentEl?.remove();
  currentEl = null;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
}

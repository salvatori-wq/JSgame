// JSgame · F17 — Toast de achievement unlocked.
// Animação slide-in canto superior direito. Fila pra múltiplos. Auto-close 4s.

import { el } from './util';

interface AchievementPayload {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const TOAST_DURATION_MS = 4500;
const queue: AchievementPayload[] = [];
let current: HTMLElement | null = null;

export function showAchievementToast(payload: AchievementPayload): void {
  queue.push(payload);
  if (!current) renderNext();
}

function renderNext(): void {
  const next = queue.shift();
  if (!next) return;
  current = renderToast(next);
  document.body.appendChild(current);
  // SFX sutil — reuso playNpcSpeaks pra dar chime suave (mais discreto que levelUp)
  void import('./audio').then(({ playNpcSpeaks }) => {
    try { playNpcSpeaks(); } catch { /* mobile policy */ }
  });
  // Auto close
  setTimeout(() => closeCurrent(), TOAST_DURATION_MS);
}

function closeCurrent(): void {
  if (!current) return;
  current.classList.add('is-closing');
  setTimeout(() => {
    current?.remove();
    current = null;
    renderNext();
  }, 350);
}

function renderToast(p: AchievementPayload): HTMLElement {
  const root = el('div', { class: 'ach-toast', attrs: { role: 'status', 'aria-live': 'polite' } });
  root.appendChild(el('div', { class: 'ach-toast-icon', text: p.icon }));
  root.appendChild(el('div', { class: 'ach-toast-body' }, [
    el('div', { class: 'ach-toast-hdr', text: '🏆 Conquista desbloqueada' }),
    el('div', { class: 'ach-toast-name', text: p.name }),
    el('div', { class: 'ach-toast-desc', text: p.description }),
  ]));
  // Click pra fechar
  root.addEventListener('click', closeCurrent);
  return root;
}

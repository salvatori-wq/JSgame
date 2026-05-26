// JSgame · F16 — Overlay "🌟 LEVEL UP" mostrado após combate vitorioso.
// Bloqueia até user fechar (botão "Continuar"). SFX `playLevelUp()` toca na abertura.
// Animação CSS — pulse + scale-in.

import { el } from './util';
import { playLevelUp } from './audio';

interface LevelUpPayload {
  characterName: string;
  oldLevel: number;
  newLevel: number;
  hpGained: number;
  proficiencyBonusGained: boolean;
  slotsChanged: boolean;
  level4ChoiceApplied: boolean;
  notes: string[];
}

// Queue: múltiplos level-ups (do mesmo combate ou de PJs diferentes) viram fila.
// Só um overlay ao mesmo tempo. Próximo abre quando atual fecha.
const queue: LevelUpPayload[] = [];
let currentOverlay: HTMLElement | null = null;

export function enqueueLevelUp(payload: LevelUpPayload): void {
  queue.push(payload);
  if (!currentOverlay) showNext();
}

function showNext(): void {
  const next = queue.shift();
  if (!next) return;
  currentOverlay = renderOverlay(next);
  document.body.appendChild(currentOverlay);
  // SFX dispara junto da abertura (Web Audio precisa gesture já gravado anteriormente)
  try { playLevelUp(); } catch { /* mobile policy might block */ }
}

function closeOverlay(): void {
  if (!currentOverlay) return;
  currentOverlay.classList.add('is-closing');
  setTimeout(() => {
    currentOverlay?.remove();
    currentOverlay = null;
    showNext();
  }, 200);
}

function renderOverlay(p: LevelUpPayload): HTMLElement {
  const root = el('div', { class: 'lvlup-backdrop' });
  const card = el('div', { class: 'lvlup-card' });

  card.appendChild(el('div', { class: 'lvlup-stars', text: '✨ 🌟 ✨' }));
  card.appendChild(el('h2', { class: 'lvlup-title', text: 'LEVEL UP' }));
  card.appendChild(el('div', { class: 'lvlup-sub', text: p.characterName }));
  card.appendChild(el('div', { class: 'lvlup-jump', text: `Nv ${p.oldLevel} → Nv ${p.newLevel}` }));

  const notesEl = el('ul', { class: 'lvlup-notes' });
  for (const n of p.notes) {
    notesEl.appendChild(el('li', { text: n }));
  }
  if (p.level4ChoiceApplied) {
    notesEl.appendChild(el('li', { class: 'lvlup-highlight', text: 'Escolha de nv 4 (ASI/Feat) aplicada' }));
  }
  card.appendChild(notesEl);

  const btn = el('button', {
    class: 'lvlup-cta',
    text: 'Continuar →',
    attrs: { type: 'button' },
    on: { click: closeOverlay },
  });
  card.appendChild(btn);

  root.appendChild(card);

  // Auto-focus pra Enter fechar
  setTimeout(() => btn.focus(), 50);
  root.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' || (e as KeyboardEvent).key === 'Enter') closeOverlay();
  });

  return root;
}

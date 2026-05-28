// JSgame · Sprint Y.B2 — Reward juice: confetti dourado + item reveal animation.
//
// Consultor Mobile #2: "Marvel Snap ganha em moment-of-glory. JSgame tem
// playLevelUp arpeggio mas falta confetti dourado + card reveal pra item.
// Único gap claro vs 9.5". Esse módulo fecha esse gap.
//
// API:
//   playConfetti({ count?, durationMs?, origin? })  — burst de partículas douradas
//   showItemReveal({ item, onDismiss? })            — bottom-sheet "✨ Você ganhou"
//
// Ambas respeitam prefers-reduced-motion (confetti reduz pra 8 partículas,
// item-reveal pula scale-in).

import { el } from './util';
import type { InventoryItem } from '../shared/types';
import { renderItemCard } from './components/item-card';

interface ConfettiOpts {
  /** Quantidade de partículas. Default 60 (8 em reduced-motion). */
  count?: number;
  /** Duração total em ms. Default 2200. */
  durationMs?: number;
  /** De onde nascem: 'top' (chove de cima), 'center' (burst do centro). Default 'top'. */
  origin?: 'top' | 'center';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** Y.B2 — Confetti dourado em level-up. Cleanup automático após durationMs. */
export function playConfetti(opts: ConfettiOpts = {}): void {
  if (typeof document === 'undefined') return;
  const reduced = prefersReducedMotion();
  const count = opts.count ?? (reduced ? 8 : 60);
  const duration = opts.durationMs ?? 2200;
  const origin = opts.origin ?? 'top';

  const container = el('div', {
    class: `rj-confetti-container rj-origin-${origin}`,
    attrs: { 'aria-hidden': 'true' },
  });

  for (let i = 0; i < count; i++) {
    const angle = origin === 'center' ? (i / count) * 360 : 0;
    const driftX = (Math.random() - 0.5) * 200; // -100 a +100 px
    const startX = origin === 'center'
      ? 50  // centro
      : Math.random() * 100;  // espalhado top
    const delay = origin === 'top' ? Math.random() * 400 : Math.random() * 100;
    const size = 6 + Math.random() * 6; // 6-12px
    const rotation = Math.random() * 720; // até 2 voltas
    // Paleta gold variada
    const hueShift = Math.floor((Math.random() - 0.5) * 20);
    const bg = i % 3 === 0
      ? `hsl(${42 + hueShift}, 85%, 65%)`  // gold claro
      : i % 3 === 1
        ? `hsl(${38 + hueShift}, 78%, 50%)` // gold médio
        : `hsl(${30 + hueShift}, 70%, 42%)`; // gold escuro/marrom

    const particle = el('span', {
      class: `rj-confetti-particle rj-confetti-${origin}`,
      attrs: {
        style: [
          `left: ${startX}%`,
          `width: ${size}px`,
          `height: ${size}px`,
          `background: ${bg}`,
          `animation-delay: ${delay}ms`,
          `animation-duration: ${duration}ms`,
          `--rj-drift-x: ${driftX}px`,
          `--rj-rotate-end: ${rotation}deg`,
          origin === 'center' ? `--rj-angle: ${angle}deg` : '',
        ].filter(Boolean).join('; '),
      },
    });
    container.appendChild(particle);
  }

  (document.getElementById('app') ?? document.body).appendChild(container);
  window.setTimeout(() => container.remove(), duration + 400);
}

interface ItemRevealOpts {
  item: InventoryItem;
  /** Disparado quando user dismiss (tap, ESC, ou auto após 4s). */
  onDismiss?: () => void;
  /** Auto-dismiss após N ms. Default 4500. Set 0 pra desabilitar. */
  autoDismissMs?: number;
}

let currentRevealEl: HTMLElement | null = null;

/**
 * Y.B2 — Item reveal animation: card desce do topo com glow + scale-in,
 * fica visível 4s ou até tap, dismiss com fade. Tem que esperar interação
 * pra fechar (consultor: "moment-of-glory precisa de ar").
 */
export function showItemReveal(opts: ItemRevealOpts): void {
  closeItemReveal();
  const reduced = prefersReducedMotion();

  const overlay = el('div', { class: 'rj-item-reveal-overlay' });
  const backdrop = el('div', { class: 'rj-item-reveal-backdrop' });
  backdrop.addEventListener('click', () => {
    closeItemReveal();
    opts.onDismiss?.();
  });

  const card = el('div', { class: `rj-item-reveal-card${reduced ? ' is-reduced' : ''}` });
  // Header
  card.appendChild(el('div', { class: 'rj-item-reveal-head', text: '✨ Você ganhou' }));
  // Item card
  const itemCardEl = renderItemCard(opts.item);
  itemCardEl.classList.add('rj-item-reveal-card-inner');
  card.appendChild(itemCardEl);
  // Hint
  card.appendChild(el('button', {
    class: 'rj-item-reveal-dismiss',
    attrs: { type: 'button' },
    text: 'Toque pra continuar',
    on: {
      click: () => {
        closeItemReveal();
        opts.onDismiss?.();
      },
    },
  }));

  overlay.appendChild(backdrop);
  overlay.appendChild(card);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentRevealEl = overlay;

  // Auto-dismiss
  const auto = opts.autoDismissMs ?? 4500;
  if (auto > 0) {
    window.setTimeout(() => {
      if (currentRevealEl === overlay) {
        closeItemReveal();
        opts.onDismiss?.();
      }
    }, auto);
  }

  // ESC fecha
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      closeItemReveal();
      opts.onDismiss?.();
    }
  };
  document.addEventListener('keydown', onKey);
  (overlay as unknown as { __cleanup?: () => void }).__cleanup = () => {
    document.removeEventListener('keydown', onKey);
  };
}

export function closeItemReveal(): void {
  if (!currentRevealEl) return;
  const cleanup = (currentRevealEl as unknown as { __cleanup?: () => void }).__cleanup;
  cleanup?.();
  currentRevealEl.remove();
  currentRevealEl = null;
}

export function isItemRevealOpen(): boolean {
  return currentRevealEl !== null;
}

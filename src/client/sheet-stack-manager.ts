// JSgame · ο.5 — Sheet Stack Manager (singleton).
// Gerencia stack de bottom-sheets (max 2 layers). Cada layer empilha visualmente
// com backdrop mais escuro. Swipe-down em topmost pop; swipe-down em layer 1
// fecha tudo. Esc fecha topmost. Backdrop click fecha topmost.

import { attachSwipeDown } from './m-swipe-down';

export interface SheetEntry {
  id: string;
  element: HTMLElement;
  /** Chamado quando sheet é fechado (pop ou substituído ou popAll). */
  onClose: () => void;
  /** Se true, permite swipe-up de 60% pra 100% (V2 — V1 só fecha). */
  allowFullExpand?: boolean;
  /** Inteiro pra zIndex relativo dentro do stack (calculado automaticamente). */
  layer?: number;
}

const MAX_LAYERS = 2;
const BASE_Z = 9300;
const stack: SheetEntry[] = [];
let backdropEl: HTMLDivElement | null = null;

function ensureBackdrop(): HTMLDivElement {
  if (backdropEl && document.body.contains(backdropEl)) return backdropEl;
  backdropEl = document.createElement('div');
  backdropEl.className = 'sheet-stack-backdrop';
  backdropEl.setAttribute('aria-hidden', 'true');
  backdropEl.addEventListener('click', () => {
    pop();
  });
  document.body.appendChild(backdropEl);
  return backdropEl;
}

function updateBackdrop(): void {
  if (stack.length === 0) {
    if (backdropEl) {
      backdropEl.classList.remove('is-visible');
      // remove após transição
      setTimeout(() => {
        if (backdropEl && stack.length === 0) {
          backdropEl.remove();
          backdropEl = null;
        }
      }, 220);
    }
    return;
  }
  const bd = ensureBackdrop();
  bd.classList.add('is-visible');
  // Opacity escala com layer count: 1 layer = 0.45, 2 layers = 0.7
  bd.style.opacity = stack.length === 1 ? '0.45' : '0.7';
  bd.style.zIndex = String(BASE_Z + stack.length * 10 - 5);
}

/** Adiciona uma nova sheet por cima das atuais. Se stack já no max, substitui topmost. */
export function push(entry: SheetEntry): void {
  if (stack.length >= MAX_LAYERS) {
    // Substitui topmost (replaceTop): chama onClose do antigo, remove DOM
    const top = stack[stack.length - 1]!;
    try { top.onClose(); } catch (err) { console.warn('[sheet-stack] onClose failed:', err); }
    if (top.element.parentElement) top.element.remove();
    stack.pop();
  }

  const layer = stack.length;
  entry.layer = layer;

  // Posiciona z-index
  entry.element.style.zIndex = String(BASE_Z + layer * 10);
  entry.element.classList.add('is-stacked-sheet');
  entry.element.dataset.stackLayer = String(layer);

  // Anima entrada
  entry.element.classList.add('is-entering');
  requestAnimationFrame(() => {
    entry.element.classList.remove('is-entering');
    entry.element.classList.add('is-active');
  });

  // Swipe-down close
  attachSwipeDown(entry.element, () => pop(), {
    threshold: 80,
    minVelocity: 0.3,
    horizTolerance: 60,
  });

  document.body.appendChild(entry.element);
  stack.push(entry);
  updateBackdrop();
}

/** Remove a topmost sheet. Se nenhuma, no-op. */
export function pop(): void {
  if (stack.length === 0) return;
  const top = stack.pop()!;
  try { top.onClose(); } catch (err) { console.warn('[sheet-stack] onClose failed:', err); }
  top.element.classList.add('is-leaving');
  top.element.classList.remove('is-active');
  setTimeout(() => {
    if (top.element.parentElement) top.element.remove();
  }, 220);
  updateBackdrop();
}

/** Fecha todas. Útil em route change ou logout. */
export function popAll(): void {
  while (stack.length > 0) pop();
}

/** Retorna a sheet topmost ou null. */
export function getTop(): SheetEntry | null {
  return stack[stack.length - 1] ?? null;
}

/** Inspeção pra tests. */
export function getStackSize(): number {
  return stack.length;
}

export function isSheetOpen(id: string): boolean {
  return stack.some((s) => s.id === id);
}

/** Reset pra tests. */
export function resetSheetStackForTest(): void {
  while (stack.length > 0) {
    const s = stack.pop()!;
    if (s.element.parentElement) s.element.remove();
  }
  if (backdropEl) {
    backdropEl.remove();
    backdropEl = null;
  }
}

// ESC fecha topmost
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length > 0) {
      e.stopPropagation();
      pop();
    }
  });
}

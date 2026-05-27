// JSgame · ο.6 — Toast / Peek System Unificado.
// Legacy B6: showToast / toastError / toastWarn / toastInfo / toastSuccess preservados.
// Novo ο.6: kind 'achievement', actions[] (múltiplos botões), queue max 3 visíveis,
// peek() pra notifs curtas (XP, quest aceita), tap pra expand mini-modal.

import { el } from './util';

export type ToastKind = 'error' | 'warn' | 'info' | 'success' | 'achievement';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOpts {
  message: string;
  kind?: ToastKind;
  durationMs?: number;          // override default 4500 (ou 3000 pra peek)
  actionLabel?: string;          // legacy single-action — preservado
  onAction?: () => void;
  /** ο.6 — múltiplos botões inline (ex: "Borin caiu" + [💉 Curar] [🎲 Death Save]). */
  actions?: ToastAction[];
  /** ο.6 — tap no corpo do toast → expande mini-modal in-place (V1: só dispara onAction[0]). */
  onExpand?: () => void;
  /** ο.6 — id estável pra dedup (não empilha mesmo evento 2x). */
  dedupKey?: string;
}

const DEFAULT_DURATION_MS = 4500;
const PEEK_DURATION_MS = 3000;
const MAX_VISIBLE = 3;
const KIND_ICONS: Record<ToastKind, string> = {
  error: '⨯',
  warn: '⚠',
  info: 'ℹ',
  success: '✓',
  achievement: '🏆',
};

let container: HTMLElement | null = null;
const activeKeys = new Set<string>();

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = el('div', { class: 'toast-container', attrs: { 'aria-live': 'polite', role: 'region', 'aria-label': 'Notificações' } });
  document.body.appendChild(container);
  return container;
}

/** Core: showToast original mantido + extensões ο.6. */
export function showToast(opts: ToastOpts): void {
  // Dedup
  if (opts.dedupKey && activeKeys.has(opts.dedupKey)) return;
  if (opts.dedupKey) activeKeys.add(opts.dedupKey);

  const root = ensureContainer();
  const kind = opts.kind ?? 'info';
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;

  // Queue max 3 — remove o mais antigo silenciosamente
  while (root.children.length >= MAX_VISIBLE) {
    const oldest = root.firstElementChild as HTMLElement | null;
    if (oldest) closeImmediate(oldest);
    else break;
  }

  const toast = el('div', { class: `toast toast-${kind}`, attrs: { role: 'status' } });
  toast.dataset.dedupKey = opts.dedupKey ?? '';

  toast.appendChild(el('span', { class: 'toast-icon', text: KIND_ICONS[kind] }));
  toast.appendChild(el('span', { class: 'toast-msg', text: opts.message }));

  // Legacy single action
  if (opts.actionLabel && opts.onAction) {
    toast.appendChild(el('button', {
      class: 'toast-action-btn',
      attrs: { type: 'button' },
      text: opts.actionLabel,
      on: {
        click: (e) => {
          e.stopPropagation();
          try { opts.onAction!(); } catch (err) { console.warn('[toast] onAction failed:', err); }
          close(toast);
        },
      },
    }));
  }

  // ο.6 multi-actions
  if (opts.actions && opts.actions.length > 0) {
    const actionsWrap = el('div', { class: 'toast-actions' });
    for (const act of opts.actions.slice(0, 3)) {
      actionsWrap.appendChild(el('button', {
        class: 'toast-action-btn',
        attrs: { type: 'button' },
        text: act.label,
        on: {
          click: (e) => {
            e.stopPropagation();
            try { act.onClick(); } catch (err) { console.warn('[toast] action click failed:', err); }
            close(toast);
          },
        },
      }));
    }
    toast.appendChild(actionsWrap);
  }

  // ο.6 tap pra expand (se onExpand)
  if (opts.onExpand) {
    toast.classList.add('is-expandable');
    toast.addEventListener('click', (e) => {
      // só dispara se NÃO foi click em botão
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      try { opts.onExpand!(); } catch (err) { console.warn('[toast] onExpand failed:', err); }
      close(toast);
    });
  }

  toast.appendChild(el('button', {
    class: 'toast-close-btn',
    attrs: { type: 'button', 'aria-label': 'Fechar' },
    text: '×',
    on: { click: (e) => { e.stopPropagation(); close(toast); } },
  }));

  root.appendChild(toast);

  const timer = window.setTimeout(() => close(toast), duration);
  toast.dataset.timer = String(timer);
}

function close(toast: HTMLElement): void {
  const timer = Number(toast.dataset.timer ?? '0');
  if (timer) clearTimeout(timer);
  const key = toast.dataset.dedupKey;
  if (key) activeKeys.delete(key);
  toast.classList.add('is-closing');
  setTimeout(() => toast.remove(), 280);
}

function closeImmediate(toast: HTMLElement): void {
  const timer = Number(toast.dataset.timer ?? '0');
  if (timer) clearTimeout(timer);
  const key = toast.dataset.dedupKey;
  if (key) activeKeys.delete(key);
  toast.remove();
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers de conveniência — legacy (B6) preservados
// ════════════════════════════════════════════════════════════════════════════
export const toastError = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'error', ...opts });
export const toastWarn = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'warn', ...opts });
export const toastInfo = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'info', ...opts });
export const toastSuccess = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'success', ...opts });

// ════════════════════════════════════════════════════════════════════════════
// ο.6 — Novos helpers
// ════════════════════════════════════════════════════════════════════════════

/** Toast curto (3s) pra eventos não-críticos: +XP, quest aceita, item picked, etc. */
export function peek(message: string, kind: ToastKind = 'info', opts?: Partial<ToastOpts>): void {
  showToast({ message, kind, durationMs: PEEK_DURATION_MS, ...opts });
}

/** Toast de achievement com glow dourado + duração mais longa. */
export function toastAchievement(message: string, opts?: Partial<ToastOpts>): void {
  showToast({ message, kind: 'achievement', durationMs: 5000, ...opts });
}

/** Toast com ações inline. Ex: Borin caiu → [💉 Curar] [🎲 Death Save]. */
export function toastWithActions(message: string, actions: ToastAction[], opts?: Partial<ToastOpts>): void {
  showToast({ message, kind: opts?.kind ?? 'warn', actions, durationMs: 8000, ...opts });
}

/** Inspeção pra tests — retorna número de toasts visíveis no container. */
export function getActiveToastCount(): number {
  return container?.children.length ?? 0;
}

/** Reset pra tests — limpa container e dedup keys. */
export function resetToastsForTest(): void {
  if (container) {
    container.innerHTML = '';
  }
  activeKeys.clear();
}

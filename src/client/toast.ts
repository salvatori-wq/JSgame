// JSgame · B6 — Toast UI genérico pra erros + info + sucesso.
// Substitui alert() e console.error() user-facing. Stack inferior right canto,
// auto-close 4.5s, click pra dismiss, queue se múltiplos disparam juntos.

import { el } from './util';

export type ToastKind = 'error' | 'warn' | 'info' | 'success';

interface ToastOpts {
  message: string;
  kind?: ToastKind;
  durationMs?: number;          // override default 4500
  actionLabel?: string;          // botão action opcional (ex: "Tentar de novo")
  onAction?: () => void;
}

const DEFAULT_DURATION_MS = 4500;
const KIND_ICONS: Record<ToastKind, string> = {
  error: '❌',
  warn: '⚠',
  info: 'ℹ',
  success: '✓',
};

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = el('div', { class: 'toast-container', attrs: { 'aria-live': 'polite' } });
  document.body.appendChild(container);
  return container;
}

export function showToast(opts: ToastOpts): void {
  const root = ensureContainer();
  const kind = opts.kind ?? 'info';
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;
  const toast = el('div', { class: `toast toast-${kind}`, attrs: { role: 'status' } });
  toast.appendChild(el('span', { class: 'toast-icon', text: KIND_ICONS[kind] }));
  toast.appendChild(el('span', { class: 'toast-msg', text: opts.message }));
  if (opts.actionLabel && opts.onAction) {
    toast.appendChild(el('button', {
      class: 'toast-action-btn',
      attrs: { type: 'button' },
      text: opts.actionLabel,
      on: { click: () => {
        try { opts.onAction!(); } catch (err) { console.warn('[toast] onAction failed:', err); }
        close(toast);
      } },
    }));
  }
  toast.appendChild(el('button', {
    class: 'toast-close-btn',
    attrs: { type: 'button', 'aria-label': 'Fechar' },
    text: '×',
    on: { click: () => close(toast) },
  }));
  root.appendChild(toast);
  // Auto-close
  const timer = window.setTimeout(() => close(toast), duration);
  toast.dataset.timer = String(timer);
}

function close(toast: HTMLElement): void {
  const timer = Number(toast.dataset.timer ?? '0');
  if (timer) clearTimeout(timer);
  toast.classList.add('is-closing');
  setTimeout(() => toast.remove(), 280);
}

// Helpers de conveniência
export const toastError = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'error', ...opts });
export const toastWarn = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'warn', ...opts });
export const toastInfo = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'info', ...opts });
export const toastSuccess = (msg: string, opts?: Partial<ToastOpts>) => showToast({ message: msg, kind: 'success', ...opts });

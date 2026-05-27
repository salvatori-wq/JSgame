// JSgame · ο.2 — Chat Pill flutuante (canto inferior direito, coop only).
// Tap abre chat-sheet. Badge contador unread. Auto-hide após 10s inativo
// quando narration scroll está ativo (V2 — V1 sempre visível).

import { el } from '../util';

export interface ChatPillContext {
  unreadCount: number;
  onClick: () => void;
}

export interface ChatPillHandle {
  element: HTMLElement;
  setUnreadCount: (n: number) => void;
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

/**
 * Cria pill flutuante. Caller posiciona, conecta socket bind, gerencia ciclo de vida.
 * Retorna handle pra controle externo (badge, show/hide, destroy).
 */
export function createChatPill(ctx: ChatPillContext): ChatPillHandle {
  const root = el('button', {
    class: 'chat-pill',
    attrs: {
      type: 'button',
      'aria-label': 'Abrir chat da party',
      title: 'Chat da Party',
    },
    on: { click: () => ctx.onClick() },
  });

  const glyph = el('span', { class: 'chat-pill-glyph', text: '💬' });
  const badge = el('span', {
    class: 'chat-pill-badge',
    text: ctx.unreadCount > 0 ? String(ctx.unreadCount) : '',
    attrs: ctx.unreadCount > 0 ? {} : { hidden: 'true' },
  });

  root.appendChild(glyph);
  root.appendChild(badge);

  return {
    element: root,
    setUnreadCount: (n: number) => {
      if (n > 0) {
        badge.removeAttribute('hidden');
        badge.textContent = n > 99 ? '99+' : String(n);
        root.classList.add('has-unread');
      } else {
        badge.setAttribute('hidden', 'true');
        badge.textContent = '';
        root.classList.remove('has-unread');
      }
    },
    show: () => {
      root.classList.remove('is-hidden');
      root.removeAttribute('hidden');
    },
    hide: () => {
      root.classList.add('is-hidden');
    },
    destroy: () => {
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}

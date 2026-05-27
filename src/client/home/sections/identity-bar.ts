// JSgame · Ω.2 — Identity bar sticky.
// Avatar + nome do owner (input editável) + streak + login button.
// Sticky top: sempre visível enquanto faz scroll.

import { el } from '../../util';
import { getOwnerName, setOwnerName } from '../../util';
import { getStreak, logout, type AuthUser } from '../../api';

export interface IdentityBarOpts {
  currentUser: AuthUser | null;
  onLoginClick: () => void;
  onAchievementsClick: () => void;
  onLogout: () => Promise<void>;
  /** Disparado quando owner muda (debounced 200ms — usado pra refresh char list). */
  onOwnerChange: (value: string) => void;
}

export function renderIdentityBar(opts: IdentityBarOpts): HTMLElement {
  const owner = getOwnerName();
  const bar = el('section', { class: 'home-identity', attrs: { role: 'banner' } });

  // Avatar emoji genérico
  bar.appendChild(el('div', { class: 'home-id-avatar', text: '👤', attrs: { 'aria-hidden': 'true' } }));

  // Nome editável inline (input discreto)
  let ownerDebounce: number | null = null;
  const ownerInput = el('input', {
    class: 'home-id-owner-input',
    attrs: {
      type: 'text',
      placeholder: 'Seu nome…',
      maxlength: '32',
      value: owner,
      'aria-label': 'Seu nome de jogador',
    },
    on: {
      input: (e) => {
        const value = (e.target as HTMLInputElement).value;
        setOwnerName(value);
        if (ownerDebounce !== null) clearTimeout(ownerDebounce);
        ownerDebounce = window.setTimeout(() => opts.onOwnerChange(value), 200);
      },
    },
  }) as HTMLInputElement;
  bar.appendChild(ownerInput);

  // Streak badge (logado only) — populated async
  if (opts.currentUser) {
    const streakBadge = el('span', { class: 'home-id-streak', text: '', attrs: { 'aria-live': 'polite' } });
    getStreak().then((s) => {
      if (s && s.currentStreak > 0) {
        streakBadge.textContent = `🔥 ${s.currentStreak}d`;
        streakBadge.setAttribute('title', `Streak: ${s.currentStreak}d · Recorde: ${s.longestStreak}d · Total: ${s.totalDays}d`);
      }
    }).catch(() => { /* silent */ });
    bar.appendChild(streakBadge);
  }

  // Actions à direita
  const actions = el('div', { class: 'home-id-actions' });
  if (opts.currentUser) {
    actions.appendChild(el('button', {
      class: 'home-id-btn',
      text: '🏆',
      attrs: { type: 'button', title: 'Suas conquistas', 'aria-label': 'Conquistas' },
      on: { click: opts.onAchievementsClick },
    }));
    actions.appendChild(el('button', {
      class: 'home-id-btn',
      text: 'Sair',
      attrs: { type: 'button', title: `Sair (${opts.currentUser.email})` },
      on: {
        click: async () => {
          await logout().catch(() => { /* ignore */ });
          await opts.onLogout();
        },
      },
    }));
  } else {
    actions.appendChild(el('button', {
      class: 'home-id-btn home-id-btn-primary',
      text: 'Entrar',
      attrs: { type: 'button', title: 'Login / criar conta' },
      on: { click: opts.onLoginClick },
    }));
  }
  bar.appendChild(actions);

  return bar;
}

/** Helper: força focus + highlight no input do identity bar.
 * Usado quando user tenta jogar sem nome — chama o focus do input dentro do bar. */
export function focusOwnerInput(bar: HTMLElement): void {
  const input = bar.querySelector('.home-id-owner-input') as HTMLInputElement | null;
  if (!input) return;
  input.focus();
  input.classList.add('is-needs-name');
  window.setTimeout(() => input.classList.remove('is-needs-name'), 1800);
}

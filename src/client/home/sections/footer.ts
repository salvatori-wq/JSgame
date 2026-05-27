// JSgame · Ω.2 — Footer minimal.
// Links discretos: ⚙ Tela & Preferências · 📖 Glossário · perfil/login.

import { el } from '../../util';
import { openUxSettingsModal } from '../../ux-settings-modal';
import { openGlossaryModal } from '../../glossary-modal';
import type { AuthUser } from '../../api';

export interface HomeFooterOpts {
  currentUser: AuthUser | null;
  onProfileClick: () => void;
  onLoginClick: () => void;
}

export function renderHomeFooter(opts: HomeFooterOpts): HTMLElement {
  return el('footer', { class: 'home-footer', attrs: { 'aria-label': 'Atalhos rodapé' } }, [
    el('button', {
      class: 'home-footer-link',
      text: '⚙ Tela',
      attrs: { type: 'button', title: 'Densidade, fonte, animações' },
      on: { click: () => openUxSettingsModal() },
    }),
    el('button', {
      class: 'home-footer-link',
      text: '📖 Glossário',
      attrs: { type: 'button', title: 'Termos D&D em pt-BR' },
      on: { click: () => openGlossaryModal() },
    }),
    opts.currentUser
      ? el('button', {
          class: 'home-footer-link',
          text: '👤 Perfil',
          attrs: { type: 'button', title: opts.currentUser.email },
          on: { click: opts.onProfileClick },
        })
      : el('button', {
          class: 'home-footer-link',
          text: '👤 Entrar',
          attrs: { type: 'button', title: 'Login / criar conta' },
          on: { click: opts.onLoginClick },
        }),
  ]);
}

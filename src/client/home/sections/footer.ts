// JSgame · Ω.10 — Footer bottom-tab navigation (fixo bottom).
// 3 ícones grandes com label: Perfil / Glossário / Tela. Estilo de bottom nav
// de jogo mobile sério (icon + label, hit target 50px+).

import { el } from '../../util';
import { openUxSettingsModal } from '../../ux-settings-modal';
import { openGlossaryModal } from '../../glossary-modal';
import type { AuthUser } from '../../api';

export interface HomeFooterOpts {
  currentUser: AuthUser | null;
  onProfileClick: () => void;
  onLoginClick: () => void;
}

function renderTabLink(icon: string, label: string, onClick: () => void, title?: string): HTMLElement {
  return el('button', {
    class: 'home-footer-link',
    attrs: { type: 'button', title: title ?? label },
    on: { click: onClick },
  }, [
    el('span', { class: 'home-footer-link-icon', text: icon, attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'home-footer-link-label', text: label }),
  ]);
}

// Round 2 fix (Beatriz/Henrique) — labels reescritas:
// "Entrar" no footer também → "Login" (mesmo motivo do header).
// "Tela" → "Ajustes" (vago "TELA" → "AJUSTES" é nome real do que abre: UX settings).
// S1.1 (Henrique) — Footer "🔑 Login" virou "💾 Salvar" pra casar com identity bar
// (Q3). Antes: identity bar dizia "Salvar" e footer dizia "Login" na MESMA tela —
// 2 nomes pra mesma ação confundia. Logado: footer mostra 👤 Perfil normal.
export function renderHomeFooter(opts: HomeFooterOpts): HTMLElement {
  return el('footer', { class: 'home-footer', attrs: { 'aria-label': 'Navegação principal' } }, [
    opts.currentUser
      ? renderTabLink('👤', 'Perfil', opts.onProfileClick, opts.currentUser.email)
      : renderTabLink('💾', 'Salvar', opts.onLoginClick, 'Salvar progresso entre dispositivos (opcional)'),
    renderTabLink('📖', 'Glossário', () => openGlossaryModal(), 'Termos D&D pt-BR'),
    renderTabLink('⚙', 'Ajustes', () => openUxSettingsModal(), 'Densidade · fonte · animações'),
  ]);
}

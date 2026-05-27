// JSgame · γ.5 — Header overflow menu.
// Em mobile (≤480px), header com 10 botões vira soup. Solução: 5 primários
// visíveis (Sair, Quest, Achievements, NPCs, Share) + 1 botão "⋯" que abre
// popover com secundários (SFX, Music, Notifs, TTS, Memória, Difficulty).
//
// Em desktop (>480px), CSS pode mostrar tudo inline OR expandir o popover —
// começamos com popover compacto também pra consistência visual.

import { el } from '../util';

export interface OverflowMenuItem {
  icon: string;
  label: string;
  title?: string;
  /** Estado checkbox-like (toggle). undefined = pure button. */
  active?: boolean;
  onClick: () => void;
}

let currentMenu: HTMLDivElement | null = null;

export function openOverflowMenu(anchor: HTMLElement, items: OverflowMenuItem[]): void {
  closeOverflowMenu();

  const menu = el('div', { class: 'overflow-menu', attrs: { role: 'menu' } }) as HTMLDivElement;

  // Posiciona embaixo do botão âncora
  const rect = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  // Alinha pelo lado direito do anchor (botão fica no topo-direita do header)
  menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

  for (const item of items) {
    const btn = el('button', {
      class: `om-item ${item.active === true ? 'is-active' : item.active === false ? 'is-inactive' : ''}`,
      attrs: { type: 'button', role: 'menuitem', title: item.title ?? item.label },
      on: {
        click: () => {
          item.onClick();
          closeOverflowMenu();
        },
      },
    }, [
      el('span', { class: 'om-icon', text: item.icon }),
      el('span', { class: 'om-label', text: item.label }),
    ]);
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  currentMenu = menu;

  // Fecha ao clicar fora ou apertar Esc
  const onDocClick = (e: MouseEvent): void => {
    if (currentMenu && !currentMenu.contains(e.target as Node) && e.target !== anchor) {
      closeOverflowMenu();
    }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeOverflowMenu();
  };
  // Delay pra não capturar o próprio click que abriu o menu
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  }, 0);

  // Cleanup quando fechar
  (menu as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}

export function closeOverflowMenu(): void {
  if (!currentMenu) return;
  const cleanup = (currentMenu as HTMLDivElement & { _cleanup?: () => void })._cleanup;
  cleanup?.();
  currentMenu.remove();
  currentMenu = null;
}

/** Helper visible to tests: retorna o elemento atualmente aberto (ou null). */
export function _testGetCurrentMenu(): HTMLDivElement | null {
  return currentMenu;
}

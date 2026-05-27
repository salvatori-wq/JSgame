// JSgame · π.1 — Bottom Tab Bar Uber Native.
// Pegada "Uber" valida pegada Wash Me: tab bar persistente bottom com
// 5 ferramentas primárias. Substitui os ícones secundários do header
// (📜🏆👥🔗) que viraram chips dispersos em mobile. Tap dispara callback
// que abre o modal/sheet correspondente.
//
// Solo: slot 4 vira Share (clipboard copy do campId).
// Coop: slot 4 vira Chat (badge unread).
// Slot 5 "Mais" abre o overflow menu existente (sons/música/voz/glossário/etc).

import { el } from '../util';

export type BottomTabId = 'quests' | 'achievements' | 'npcs' | 'chat' | 'share' | 'more';

export interface BottomTabBarContext {
  /** True se mais de um PJ no party — afeta slot 4 (Chat vs Share). */
  isCoop: boolean;
  /** Unread inicial (caller mantém este número via setUnreadCount). */
  unreadChatCount: number;
  /** Tap em qualquer tab. Caller decide o que abrir. */
  onTabClick: (tab: BottomTabId, anchor: HTMLElement) => void;
}

export interface BottomTabBarHandle {
  element: HTMLElement;
  setUnreadCount: (n: number) => void;
  setActiveTab: (tab: BottomTabId | null) => void;
  setQuestBadge: (count: number) => void;
  setAchievementsBadge: (count: number) => void;
  /** Atualiza modo coop/solo — re-renderiza slot 4 (Chat ↔ Share). */
  setCoop: (isCoop: boolean) => void;
  destroy: () => void;
}

interface TabDef {
  id: BottomTabId;
  glyph: string;
  label: string;
  title: string;
}

// π refino — Ícones tunados pra clareza + D&D feel + menos "config":
// 🗺 missões (mapa de aventura, mais visual que pergaminho)
// 🏆 conquistas (universal)
// 👥 NPCs (universal)
// 💬 chat (universal)
// 🤝 convite (aperto de mão > corrente, convite mais quente)
// ⋯ mais (consistência com overflow menu pattern, menos "config")
const TAB_QUESTS: TabDef = { id: 'quests', glyph: '🗺', label: 'Missões', title: 'Missões ativas e completadas' };
const TAB_ACH: TabDef = { id: 'achievements', glyph: '🏆', label: 'Glórias', title: 'Conquistas desbloqueadas' };
const TAB_NPCS: TabDef = { id: 'npcs', glyph: '👥', label: 'NPCs', title: 'NPCs conhecidos' };
const TAB_CHAT: TabDef = { id: 'chat', glyph: '💬', label: 'Chat', title: 'Chat da party' };
const TAB_SHARE: TabDef = { id: 'share', glyph: '🤝', label: 'Convite', title: 'Copiar ID da crônica pra convidar aliado' };
const TAB_MORE: TabDef = { id: 'more', glyph: '⋯', label: 'Mais', title: 'Mais opções (sons, glossário, tela, dificuldade)' };

function tabsForCoop(isCoop: boolean): TabDef[] {
  return [TAB_QUESTS, TAB_ACH, TAB_NPCS, isCoop ? TAB_CHAT : TAB_SHARE, TAB_MORE];
}

/**
 * Cria a tab bar. Caller appenda o `element` no DOM (geralmente no slot
 * `.ch-slot-bottom-tabs` do shell). Tap dispara `onTabClick(tab, anchor)`.
 * Active state é externo — caller chama `setActiveTab(tab)` quando o modal
 * abre, e `setActiveTab(null)` no close.
 */
export function createBottomTabBar(ctx: BottomTabBarContext): BottomTabBarHandle {
  const root = el('nav', {
    class: 'bottom-tab-bar',
    attrs: { role: 'tablist', 'aria-label': 'Ferramentas da campanha' },
  });

  let activeTab: BottomTabId | null = null;
  let unreadCount = Math.max(0, ctx.unreadChatCount | 0);
  let questBadge = 0;
  let achievementsBadge = 0;
  let isCoop = !!ctx.isCoop;
  const tabEls = new Map<BottomTabId, HTMLButtonElement>();
  const badgeEls = new Map<BottomTabId, HTMLSpanElement>();

  // π refino — Slide indicator único (substitui pseudo-element por tab).
  const indicator = el('span', {
    class: 'btb-active-indicator',
    attrs: { 'aria-hidden': 'true' },
  });

  function buildTab(def: TabDef): HTMLButtonElement {
    const btn = el('button', {
      class: 'btb-tab',
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-label': def.title,
        title: def.title,
        'data-tab': def.id,
      },
      on: {
        click: (e: Event) => {
          const target = e.currentTarget as HTMLButtonElement;
          // π.5 — haptic feedback (mobile com suporte)
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(10);
            }
          } catch { /* ignore */ }
          ctx.onTabClick(def.id, target);
        },
      },
    }) as HTMLButtonElement;

    const glyph = el('span', { class: 'btb-tab-glyph', text: def.glyph, attrs: { 'aria-hidden': 'true' } });
    const label = el('span', { class: 'btb-tab-label', text: def.label });
    const badge = el('span', {
      class: 'btb-tab-badge',
      attrs: { hidden: 'true', 'aria-hidden': 'true' },
    });

    btn.appendChild(glyph);
    btn.appendChild(label);
    btn.appendChild(badge);

    badgeEls.set(def.id, badge);
    return btn;
  }

  function renderTabs(): void {
    root.replaceChildren();
    tabEls.clear();
    badgeEls.clear();
    const defs = tabsForCoop(isCoop);
    for (const def of defs) {
      const btn = buildTab(def);
      tabEls.set(def.id, btn);
      root.appendChild(btn);
    }
    // π refino — Indicator slide DOM element fica como último filho.
    root.appendChild(indicator);
    applyActiveState();
    applyBadges();
  }

  function applyActiveState(): void {
    for (const [tab, btn] of tabEls.entries()) {
      btn.classList.toggle('is-active', tab === activeTab);
      if (tab === activeTab) {
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.removeAttribute('aria-selected');
      }
    }
    // π refino — Posiciona slide indicator no tab ativo. Usa offsetLeft/Width
    // (não getBoundingClientRect) pra evitar layout thrashing em scroll.
    if (activeTab) {
      const activeBtn = tabEls.get(activeTab);
      if (activeBtn) {
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        // 60% width do tab, centralizado (left + 20%)
        const indicatorWidth = width * 0.6;
        const indicatorLeft = left + width * 0.2;
        indicator.style.width = `${indicatorWidth}px`;
        indicator.style.transform = `translateX(${indicatorLeft}px)`;
        indicator.classList.add('is-visible');
      }
    } else {
      indicator.classList.remove('is-visible');
    }
  }

  function applyBadges(): void {
    const chatTab = isCoop ? 'chat' : null;
    if (chatTab) updateBadge(chatTab, unreadCount);
    updateBadge('quests', questBadge);
    updateBadge('achievements', achievementsBadge);
  }

  function updateBadge(tab: BottomTabId, count: number, popOnIncrement = false): void {
    const badge = badgeEls.get(tab);
    const btn = tabEls.get(tab);
    if (!badge || !btn) return;
    const prevCount = parseInt(badge.textContent || '0', 10) || 0;
    if (count > 0) {
      badge.removeAttribute('hidden');
      badge.textContent = count > 99 ? '99+' : String(count);
      btn.classList.add('has-badge');
      // π refino — Pop-in animation quando count incrementa.
      if (popOnIncrement && count > prevCount) {
        badge.classList.remove('is-popping');
        // Force reflow pra reiniciar animação
        void badge.offsetWidth;
        badge.classList.add('is-popping');
        setTimeout(() => badge.classList.remove('is-popping'), 320);
      }
    } else {
      badge.setAttribute('hidden', 'true');
      badge.textContent = '';
      btn.classList.remove('has-badge');
      badge.classList.remove('is-popping');
    }
  }

  renderTabs();

  return {
    element: root,
    setUnreadCount: (n: number) => {
      const next = Math.max(0, n | 0);
      // π refino — pop-in se incrementou
      const popOnIncrement = next > unreadCount;
      unreadCount = next;
      if (isCoop) updateBadge('chat', unreadCount, popOnIncrement);
    },
    setActiveTab: (tab: BottomTabId | null) => {
      activeTab = tab;
      applyActiveState();
    },
    setQuestBadge: (count: number) => {
      const next = Math.max(0, count | 0);
      const popOnIncrement = next > questBadge;
      questBadge = next;
      updateBadge('quests', questBadge, popOnIncrement);
    },
    setAchievementsBadge: (count: number) => {
      const next = Math.max(0, count | 0);
      const popOnIncrement = next > achievementsBadge;
      achievementsBadge = next;
      updateBadge('achievements', achievementsBadge, popOnIncrement);
    },
    setCoop: (next: boolean) => {
      if (next === isCoop) return;
      isCoop = next;
      renderTabs();
    },
    destroy: () => {
      if (root.parentElement) root.parentElement.removeChild(root);
      tabEls.clear();
      badgeEls.clear();
    },
  };
}

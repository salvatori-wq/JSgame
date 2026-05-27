// π.1 — Tests pro Bottom Tab Bar.
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBottomTabBar, type BottomTabId } from '../bottom-tab-bar';

describe('createBottomTabBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renderiza 5 tabs em coop (chat slot ativo)', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const tabs = bar.element.querySelectorAll('.btb-tab');
    expect(tabs.length).toBe(5);
    const ids = Array.from(tabs).map((b) => (b as HTMLElement).dataset['tab']);
    expect(ids).toEqual(['quests', 'achievements', 'npcs', 'chat', 'more']);
  });

  it('renderiza 5 tabs em solo (share slot em vez de chat)', () => {
    const bar = createBottomTabBar({
      isCoop: false,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const ids = Array.from(bar.element.querySelectorAll('.btb-tab'))
      .map((b) => (b as HTMLElement).dataset['tab']);
    expect(ids).toEqual(['quests', 'achievements', 'npcs', 'share', 'more']);
  });

  it('tab role=tab e nav role=tablist', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    expect(bar.element.getAttribute('role')).toBe('tablist');
    const firstTab = bar.element.querySelector('.btb-tab')!;
    expect(firstTab.getAttribute('role')).toBe('tab');
  });

  it('badge unread chat aparece em coop quando count > 0', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 3,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const chatTab = bar.element.querySelector('[data-tab="chat"]')!;
    const badge = chatTab.querySelector('.btb-tab-badge') as HTMLElement;
    expect(badge.hasAttribute('hidden')).toBe(false);
    expect(badge.textContent).toBe('3');
    expect(chatTab.classList.contains('has-badge')).toBe(true);
  });

  it('badge esconde quando setUnreadCount(0)', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 5,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setUnreadCount(0);
    const chatTab = bar.element.querySelector('[data-tab="chat"]')!;
    const badge = chatTab.querySelector('.btb-tab-badge') as HTMLElement;
    expect(badge.hasAttribute('hidden')).toBe(true);
    expect(chatTab.classList.contains('has-badge')).toBe(false);
  });

  it('badge 99+ quando count > 99', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setUnreadCount(150);
    const chatTab = bar.element.querySelector('[data-tab="chat"]')!;
    const badge = chatTab.querySelector('.btb-tab-badge') as HTMLElement;
    expect(badge.textContent).toBe('99+');
  });

  it('click dispara onTabClick com tab id e anchor', () => {
    const handler = vi.fn();
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: handler,
    });
    document.body.appendChild(bar.element);
    const questsTab = bar.element.querySelector('[data-tab="quests"]') as HTMLButtonElement;
    questsTab.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const [tab, anchor] = handler.mock.calls[0]!;
    expect(tab).toBe('quests');
    expect(anchor).toBe(questsTab);
  });

  it('setActiveTab marca tab is-active e aria-selected', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setActiveTab('npcs');
    const npcsTab = bar.element.querySelector('[data-tab="npcs"]') as HTMLElement;
    expect(npcsTab.classList.contains('is-active')).toBe(true);
    expect(npcsTab.getAttribute('aria-selected')).toBe('true');
    // Outras tabs sem is-active
    const questsTab = bar.element.querySelector('[data-tab="quests"]') as HTMLElement;
    expect(questsTab.classList.contains('is-active')).toBe(false);
    expect(questsTab.getAttribute('aria-selected')).toBeNull();
  });

  it('setActiveTab(null) limpa active', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setActiveTab('quests');
    bar.setActiveTab(null);
    const tabs = bar.element.querySelectorAll('.btb-tab.is-active');
    expect(tabs.length).toBe(0);
  });

  it('setCoop alterna chat ↔ share slot', () => {
    const bar = createBottomTabBar({
      isCoop: false,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    // Solo: tem share, não tem chat
    expect(bar.element.querySelector('[data-tab="share"]')).not.toBeNull();
    expect(bar.element.querySelector('[data-tab="chat"]')).toBeNull();
    bar.setCoop(true);
    expect(bar.element.querySelector('[data-tab="chat"]')).not.toBeNull();
    expect(bar.element.querySelector('[data-tab="share"]')).toBeNull();
  });

  it('setQuestBadge mostra badge no slot quests', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setQuestBadge(2);
    const questsTab = bar.element.querySelector('[data-tab="quests"]')!;
    const badge = questsTab.querySelector('.btb-tab-badge') as HTMLElement;
    expect(badge.hasAttribute('hidden')).toBe(false);
    expect(badge.textContent).toBe('2');
  });

  it('setAchievementsBadge mostra badge no slot achievements', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setAchievementsBadge(1);
    const achTab = bar.element.querySelector('[data-tab="achievements"]')!;
    const badge = achTab.querySelector('.btb-tab-badge') as HTMLElement;
    expect(badge.textContent).toBe('1');
  });

  it('destroy remove element do DOM', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    expect(bar.element.parentElement).toBe(document.body);
    bar.destroy();
    expect(bar.element.parentElement).toBeNull();
  });

  it('multiple onTabClick handlers preservam ordem e id correto', () => {
    const calls: BottomTabId[] = [];
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: (tab) => { calls.push(tab); },
    });
    document.body.appendChild(bar.element);
    (bar.element.querySelector('[data-tab="quests"]') as HTMLButtonElement).click();
    (bar.element.querySelector('[data-tab="chat"]') as HTMLButtonElement).click();
    (bar.element.querySelector('[data-tab="more"]') as HTMLButtonElement).click();
    expect(calls).toEqual(['quests', 'chat', 'more']);
  });

  it('setCoop preserva badges em re-render', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setQuestBadge(3);
    bar.setAchievementsBadge(2);
    bar.setCoop(false); // re-render
    const questsBadge = bar.element.querySelector('[data-tab="quests"] .btb-tab-badge') as HTMLElement;
    const achBadge = bar.element.querySelector('[data-tab="achievements"] .btb-tab-badge') as HTMLElement;
    expect(questsBadge.textContent).toBe('3');
    expect(achBadge.textContent).toBe('2');
  });

  it('slide active indicator existe como filho do nav', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const indicator = bar.element.querySelector('.btb-active-indicator') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
  });

  it('setActiveTab marca indicator visível e setActiveTab(null) esconde', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 0,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const indicator = bar.element.querySelector('.btb-active-indicator') as HTMLElement;
    bar.setActiveTab('npcs');
    expect(indicator.classList.contains('is-visible')).toBe(true);
    bar.setActiveTab(null);
    expect(indicator.classList.contains('is-visible')).toBe(false);
  });

  it('setUnreadCount com increment dispara is-popping na badge', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 2,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    const badge = bar.element.querySelector('[data-tab="chat"] .btb-tab-badge') as HTMLElement;
    bar.setUnreadCount(5); // increment 2→5
    expect(badge.classList.contains('is-popping')).toBe(true);
  });

  it('setUnreadCount decrement NÃO dispara pop', () => {
    const bar = createBottomTabBar({
      isCoop: true,
      unreadChatCount: 5,
      onTabClick: () => { /* noop */ },
    });
    document.body.appendChild(bar.element);
    bar.setUnreadCount(2); // decrement 5→2
    const badge = bar.element.querySelector('[data-tab="chat"] .btb-tab-badge') as HTMLElement;
    expect(badge.classList.contains('is-popping')).toBe(false);
  });
});

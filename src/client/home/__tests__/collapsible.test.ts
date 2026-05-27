// @vitest-environment happy-dom
// Ω.2 — Tests do Collapsible section reusável.

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  const memStore: Record<string, string> = {};
  const stub = {
    getItem: (k: string) => Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null,
    setItem: (k: string, v: string) => { memStore[k] = String(v); },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  vi.stubGlobal('localStorage', stub);
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('makeCollapsibleSection', () => {
  it('renderiza header com icon + title + chevron', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'test-1',
      title: 'Meus PJs',
      icon: '📚',
      renderContent: () => document.createElement('div'),
    });
    expect(sec.querySelector('.hc-icon')?.textContent).toBe('📚');
    expect(sec.querySelector('.hc-title')?.textContent).toBe('Meus PJs');
    expect(sec.querySelector('.hc-chevron')).toBeTruthy();
  });

  it('count badge aparece quando passa count', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'test-2',
      title: 'PJs',
      icon: '📚',
      count: 3,
      renderContent: () => document.createElement('div'),
    });
    expect(sec.querySelector('.hc-count')?.textContent).toBe('(3)');
  });

  it('badge texto aparece quando passa badge', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'test-3',
      title: 'PJs',
      icon: '📚',
      badge: '⚠ em risco',
      renderContent: () => document.createElement('div'),
    });
    expect(sec.querySelector('.hc-badge')?.textContent).toBe('⚠ em risco');
  });

  it('defaultOpen=true renderiza conteúdo já visível', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const content = document.createElement('div');
    content.textContent = 'CONTEÚDO';
    const sec = makeCollapsibleSection({
      id: 'test-4',
      title: 'PJs',
      icon: '📚',
      defaultOpen: true,
      renderContent: () => content,
    });
    document.body.appendChild(sec);
    expect(sec.classList.contains('is-open')).toBe(true);
    expect(sec.querySelector('.hc-chevron')?.textContent).toBe('▲');
    // Lazy render dispara imediatamente quando open
    await new Promise((r) => setTimeout(r, 0));
    expect(sec.querySelector('.hc-body')?.textContent).toContain('CONTEÚDO');
  });

  it('defaultOpen=false não carrega conteúdo até expand', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const renderSpy = vi.fn(() => {
      const d = document.createElement('div');
      d.textContent = 'LAZY';
      return d;
    });
    const sec = makeCollapsibleSection({
      id: 'test-5',
      title: 'PJs',
      icon: '📚',
      defaultOpen: false,
      renderContent: renderSpy,
    });
    document.body.appendChild(sec);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(sec.classList.contains('is-open')).toBe(false);
  });

  it('click no header expande/colapsa', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'test-6',
      title: 'PJs',
      icon: '📚',
      renderContent: () => {
        const d = document.createElement('div');
        d.textContent = 'X';
        return d;
      },
    });
    document.body.appendChild(sec);
    const header = sec.querySelector('.hc-header') as HTMLButtonElement;
    expect(sec.classList.contains('is-open')).toBe(false);
    header.click();
    expect(sec.classList.contains('is-open')).toBe(true);
    expect(sec.querySelector('.hc-chevron')?.textContent).toBe('▲');
    header.click();
    expect(sec.classList.contains('is-open')).toBe(false);
    expect(sec.querySelector('.hc-chevron')?.textContent).toBe('▼');
  });

  it('estado collapsed persiste em localStorage', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'persist-1',
      title: 'X',
      icon: '📚',
      defaultOpen: true,
      renderContent: () => document.createElement('div'),
    });
    document.body.appendChild(sec);
    const header = sec.querySelector('.hc-header') as HTMLButtonElement;
    expect(sec.classList.contains('is-open')).toBe(true);
    header.click(); // close
    expect(localStorage.getItem('home.section.persist-1.collapsed')).toBe('true');
    header.click(); // open
    expect(localStorage.getItem('home.section.persist-1.collapsed')).toBe('false');
  });

  it('aria-expanded reflete estado', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const sec = makeCollapsibleSection({
      id: 'aria-1',
      title: 'X',
      icon: '📚',
      defaultOpen: false,
      renderContent: () => document.createElement('div'),
    });
    document.body.appendChild(sec);
    const header = sec.querySelector('.hc-header') as HTMLButtonElement;
    expect(header.getAttribute('aria-expanded')).toBe('false');
    header.click();
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('lazy render: conteúdo só carrega no primeiro expand, não nos subsequentes', async () => {
    const { makeCollapsibleSection } = await import('../sections/collapsible');
    const renderSpy = vi.fn(() => {
      const d = document.createElement('div');
      d.textContent = 'lazy';
      return d;
    });
    const sec = makeCollapsibleSection({
      id: 'lazy-1',
      title: 'X',
      icon: '📚',
      defaultOpen: false,
      renderContent: renderSpy,
    });
    document.body.appendChild(sec);
    const header = sec.querySelector('.hc-header') as HTMLButtonElement;
    header.click(); // open
    await new Promise((r) => setTimeout(r, 0));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    header.click(); // close
    header.click(); // re-open
    await new Promise((r) => setTimeout(r, 0));
    // Não recria — content já existe
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});

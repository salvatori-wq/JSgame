// @vitest-environment happy-dom
// Y.B2 — Sprint Y: Tests pro reward-juice (confetti + item reveal).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('playConfetti — Y.B2 visual smoke', async () => {
  const { playConfetti } = await import('../reward-juice');

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });
  afterEach(() => {
    document.querySelectorAll('.rj-confetti-container').forEach((el) => el.remove());
  });

  it('cria container .rj-confetti-container com origem top default', () => {
    playConfetti();
    const c = document.querySelector('.rj-confetti-container');
    expect(c).toBeTruthy();
    expect(c?.classList.contains('rj-origin-top')).toBe(true);
  });

  it('renderiza count partículas', () => {
    playConfetti({ count: 12 });
    const particles = document.querySelectorAll('.rj-confetti-particle');
    expect(particles.length).toBe(12);
  });

  it('cada partícula tem inline style com left + animation-duration', () => {
    playConfetti({ count: 3, durationMs: 1000 });
    const p = document.querySelector('.rj-confetti-particle') as HTMLElement;
    expect(p.style.cssText).toMatch(/left:/);
    expect(p.style.cssText).toMatch(/animation-duration:\s*1000ms/);
  });

  it('origin center cria class rj-origin-center', () => {
    playConfetti({ origin: 'center', count: 5 });
    const c = document.querySelector('.rj-confetti-container');
    expect(c?.classList.contains('rj-origin-center')).toBe(true);
  });
});

describe('showItemReveal — Y.B2 reveal modal', async () => {
  const { showItemReveal, closeItemReveal, isItemRevealOpen } = await import('../reward-juice');

  const makeItem = (overrides: Partial<import('../../shared/types').InventoryItem> = {}): import('../../shared/types').InventoryItem => ({
    id: 'i1',
    name: 'Espada Reluzente',
    type: 'arma',
    quantity: 1,
    description: 'Brilha mesmo em escuridão.',
    rarity: 'incomum',
    ...overrides,
  } as import('../../shared/types').InventoryItem);

  beforeEach(() => {
    closeItemReveal();
    document.body.innerHTML = '<div id="app"></div>';
  });
  afterEach(() => {
    closeItemReveal();
  });

  it('cria overlay com card + head "Você ganhou" + dismiss btn', () => {
    showItemReveal({ item: makeItem(), autoDismissMs: 0 });
    expect(isItemRevealOpen()).toBe(true);
    expect(document.querySelector('.rj-item-reveal-overlay')).toBeTruthy();
    expect(document.querySelector('.rj-item-reveal-card')).toBeTruthy();
    expect(document.querySelector('.rj-item-reveal-head')?.textContent).toContain('Você ganhou');
    expect(document.querySelector('.rj-item-reveal-dismiss')).toBeTruthy();
  });

  it('click no dismiss btn dispara onDismiss + fecha', () => {
    let dismissed = false;
    showItemReveal({ item: makeItem(), onDismiss: () => { dismissed = true; }, autoDismissMs: 0 });
    const btn = document.querySelector('.rj-item-reveal-dismiss') as HTMLButtonElement;
    btn.click();
    expect(dismissed).toBe(true);
    expect(isItemRevealOpen()).toBe(false);
  });

  it('click no backdrop fecha', () => {
    showItemReveal({ item: makeItem(), autoDismissMs: 0 });
    const backdrop = document.querySelector('.rj-item-reveal-backdrop') as HTMLElement;
    backdrop.click();
    expect(isItemRevealOpen()).toBe(false);
  });

  it('ESC fecha', () => {
    showItemReveal({ item: makeItem(), autoDismissMs: 0 });
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    expect(isItemRevealOpen()).toBe(false);
  });

  it('abrir 2x fecha primeiro (idempotente)', () => {
    showItemReveal({ item: makeItem({ id: 'a' }), autoDismissMs: 0 });
    showItemReveal({ item: makeItem({ id: 'b', name: 'Outro' }), autoDismissMs: 0 });
    const overlays = document.querySelectorAll('.rj-item-reveal-overlay');
    expect(overlays.length).toBe(1);
    expect(document.querySelector('.rj-item-reveal-head')).toBeTruthy();
  });
});

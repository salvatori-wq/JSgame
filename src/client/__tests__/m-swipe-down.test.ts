// MP1 — Tests pra attachSwipeDown.
// Verifica threshold + velocity + horizTolerance + handlebar + teardown.
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachSwipeDown } from '../m-swipe-down';

// Helper pra disparar TouchEvent compatível com happy-dom.
function touch(target: HTMLElement, type: 'touchstart' | 'touchend' | 'touchcancel', x: number, y: number): void {
  const t = { clientX: x, clientY: y, identifier: 0, target } as unknown as Touch;
  const ev = new Event(type, { bubbles: true }) as TouchEvent & { touches: Touch[]; changedTouches: Touch[] };
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [t], configurable: true });
  Object.defineProperty(ev, 'changedTouches', { value: [t], configurable: true });
  target.dispatchEvent(ev);
}

describe('attachSwipeDown', () => {
  let el: HTMLElement;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = document.createElement('div');
    document.body.appendChild(el);
    onClose = vi.fn();
  });

  it('dispara onClose quando drag vertical > threshold com velocidade alta', async () => {
    attachSwipeDown(el, onClose, { threshold: 80, minVelocity: 0.1 });
    touch(el, 'touchstart', 100, 100);
    // Pequeno delay pra velocity ser calculável
    await new Promise<void>((r) => setTimeout(r, 50));
    touch(el, 'touchend', 100, 250); // dy=150 > 80
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NÃO dispara quando drag vertical é pequeno (< threshold)', async () => {
    attachSwipeDown(el, onClose, { threshold: 80 });
    touch(el, 'touchstart', 100, 100);
    await new Promise<void>((r) => setTimeout(r, 30));
    touch(el, 'touchend', 100, 140); // dy=40 < 80
    expect(onClose).not.toHaveBeenCalled();
  });

  it('NÃO dispara quando velocidade é muito baixa (gesture lento)', async () => {
    attachSwipeDown(el, onClose, { threshold: 80, minVelocity: 1.0 });
    touch(el, 'touchstart', 100, 100);
    // Espera muito → velocity baixa
    await new Promise<void>((r) => setTimeout(r, 500));
    touch(el, 'touchend', 100, 250); // dy=150 mas dt=500 → velocity=0.3 < 1.0
    expect(onClose).not.toHaveBeenCalled();
  });

  it('NÃO dispara quando há drag horizontal grande (provavel scroll-x)', async () => {
    attachSwipeDown(el, onClose, { threshold: 80, horizTolerance: 30, minVelocity: 0.1 });
    touch(el, 'touchstart', 100, 100);
    await new Promise<void>((r) => setTimeout(r, 30));
    touch(el, 'touchend', 200, 250); // dy=150 ok, mas dx=100 > 30
    expect(onClose).not.toHaveBeenCalled();
  });

  it('insere handlebar quando addHandlebar=true', () => {
    attachSwipeDown(el, onClose, { addHandlebar: true });
    const handlebar = el.querySelector('.m-handlebar');
    expect(handlebar).not.toBeNull();
    expect(handlebar?.getAttribute('aria-hidden')).toBe('true');
  });

  it('teardown remove listeners + handlebar inserido', async () => {
    const detach = attachSwipeDown(el, onClose, { addHandlebar: true, threshold: 80, minVelocity: 0.1 });
    expect(el.querySelector('.m-handlebar')).not.toBeNull();
    detach();
    expect(el.querySelector('.m-handlebar')).toBeNull();
    // Após detach, gesture não dispara mais
    touch(el, 'touchstart', 100, 100);
    await new Promise<void>((r) => setTimeout(r, 30));
    touch(el, 'touchend', 100, 250);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('touchcancel limpa tracking — drag subsequente não dispara', async () => {
    attachSwipeDown(el, onClose, { threshold: 80, minVelocity: 0.1 });
    touch(el, 'touchstart', 100, 100);
    touch(el, 'touchcancel', 100, 100);
    // touchend após cancel não conta
    touch(el, 'touchend', 100, 250);
    expect(onClose).not.toHaveBeenCalled();
  });
});

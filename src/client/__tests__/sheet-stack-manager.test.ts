// @vitest-environment happy-dom
// ο.5 — Tests do Sheet Stack Manager.

import { describe, it, expect, beforeEach } from 'vitest';
import { push, pop, popAll, getStackSize, isSheetOpen, resetSheetStackForTest } from '../sheet-stack-manager';

function makeSheet(id: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset.test = id;
  return el;
}

describe('Sheet Stack Manager ο.5', () => {
  beforeEach(() => {
    resetSheetStackForTest();
  });

  it('push abre uma sheet', () => {
    let closed = 0;
    push({ id: 's1', element: makeSheet('s1'), onClose: () => { closed++; } });
    expect(getStackSize()).toBe(1);
    expect(isSheetOpen('s1')).toBe(true);
  });

  it('push x 2 empilha 2 layers', () => {
    push({ id: 's1', element: makeSheet('s1'), onClose: () => {} });
    push({ id: 's2', element: makeSheet('s2'), onClose: () => {} });
    expect(getStackSize()).toBe(2);
    expect(isSheetOpen('s1')).toBe(true);
    expect(isSheetOpen('s2')).toBe(true);
  });

  it('pop remove topmost', () => {
    let closed1 = 0;
    let closed2 = 0;
    push({ id: 's1', element: makeSheet('s1'), onClose: () => { closed1++; } });
    push({ id: 's2', element: makeSheet('s2'), onClose: () => { closed2++; } });
    pop();
    expect(getStackSize()).toBe(1);
    expect(isSheetOpen('s2')).toBe(false);
    expect(isSheetOpen('s1')).toBe(true);
    expect(closed2).toBe(1);
    expect(closed1).toBe(0);
  });

  it('push 3ª layer substitui topmost (max 2)', () => {
    let closed2 = 0;
    push({ id: 's1', element: makeSheet('s1'), onClose: () => {} });
    push({ id: 's2', element: makeSheet('s2'), onClose: () => { closed2++; } });
    push({ id: 's3', element: makeSheet('s3'), onClose: () => {} });
    expect(getStackSize()).toBe(2);
    expect(isSheetOpen('s1')).toBe(true);
    expect(isSheetOpen('s2')).toBe(false); // substituído
    expect(isSheetOpen('s3')).toBe(true);
    expect(closed2).toBe(1);
  });

  it('popAll fecha tudo', () => {
    push({ id: 's1', element: makeSheet('s1'), onClose: () => {} });
    push({ id: 's2', element: makeSheet('s2'), onClose: () => {} });
    popAll();
    expect(getStackSize()).toBe(0);
  });

  it('Escape key fecha topmost', () => {
    push({ id: 's1', element: makeSheet('s1'), onClose: () => {} });
    push({ id: 's2', element: makeSheet('s2'), onClose: () => {} });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(getStackSize()).toBe(1);
    expect(isSheetOpen('s2')).toBe(false);
  });

  it('sheets ganham z-index escalonado', () => {
    const e1 = makeSheet('s1');
    const e2 = makeSheet('s2');
    push({ id: 's1', element: e1, onClose: () => {} });
    push({ id: 's2', element: e2, onClose: () => {} });
    const z1 = parseInt(e1.style.zIndex, 10);
    const z2 = parseInt(e2.style.zIndex, 10);
    expect(z2).toBeGreaterThan(z1);
  });

  it('sheet recebe classe is-stacked-sheet', () => {
    const e = makeSheet('s1');
    push({ id: 's1', element: e, onClose: () => {} });
    expect(e.classList.contains('is-stacked-sheet')).toBe(true);
  });
});

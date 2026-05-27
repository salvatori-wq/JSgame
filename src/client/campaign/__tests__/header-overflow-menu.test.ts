// γ.5 — Tests pro overflow menu do header.
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openOverflowMenu, closeOverflowMenu, _testGetCurrentMenu } from '../header-overflow-menu';

describe('openOverflowMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    closeOverflowMenu();
  });

  it('cria menu com items + role=menu', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    openOverflowMenu(anchor, [
      { icon: '🔊', label: 'Sons ON', active: true, onClick: () => { /* */ } },
      { icon: '🎵', label: 'Música OFF', active: false, onClick: () => { /* */ } },
    ]);
    const menu = _testGetCurrentMenu();
    expect(menu).not.toBeNull();
    expect(menu!.getAttribute('role')).toBe('menu');
    expect(menu!.querySelectorAll('.om-item').length).toBe(2);
  });

  it('items marcam is-active / is-inactive conforme prop', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    openOverflowMenu(anchor, [
      { icon: '🔊', label: 'Sons ON', active: true, onClick: () => { /* */ } },
      { icon: '🔕', label: 'Notif OFF', active: false, onClick: () => { /* */ } },
      { icon: '🧠', label: 'Memória', onClick: () => { /* */ } }, // sem active
    ]);
    const items = _testGetCurrentMenu()!.querySelectorAll('.om-item');
    expect(items[0]!.classList.contains('is-active')).toBe(true);
    expect(items[1]!.classList.contains('is-inactive')).toBe(true);
    expect(items[2]!.classList.contains('is-active')).toBe(false);
    expect(items[2]!.classList.contains('is-inactive')).toBe(false);
  });

  it('click no item dispara onClick e fecha o menu', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const clicked = vi.fn();
    openOverflowMenu(anchor, [
      { icon: '🔊', label: 'Test', onClick: clicked },
    ]);
    const item = _testGetCurrentMenu()!.querySelector('.om-item') as HTMLButtonElement;
    item.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(_testGetCurrentMenu()).toBeNull();
  });

  it('closeOverflowMenu remove o menu', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    openOverflowMenu(anchor, [
      { icon: 'X', label: 'foo', onClick: () => { /* */ } },
    ]);
    expect(_testGetCurrentMenu()).not.toBeNull();
    closeOverflowMenu();
    expect(_testGetCurrentMenu()).toBeNull();
  });

  it('abrir menu novo fecha o anterior (idempotente)', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    openOverflowMenu(anchor, [
      { icon: '1', label: 'A', onClick: () => { /* */ } },
    ]);
    const first = _testGetCurrentMenu();
    openOverflowMenu(anchor, [
      { icon: '2', label: 'B', onClick: () => { /* */ } },
      { icon: '3', label: 'C', onClick: () => { /* */ } },
    ]);
    const second = _testGetCurrentMenu();
    expect(second).not.toBe(first);
    expect(second!.querySelectorAll('.om-item').length).toBe(2);
  });
});

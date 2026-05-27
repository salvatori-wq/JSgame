// @vitest-environment happy-dom
// ο.8 — Tests do UX Prefs.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getUxPrefs, setUxPrefs, resetUxPrefs, applyUxPrefs, initUxPrefs, DEFAULT_PREFS, _resetCacheForTest } from '../ux-prefs';

// Mock localStorage explicit pra evitar pollution cross-file no single-fork.
// Em happy-dom localStorage default às vezes vira proxy quebrado dependendo da
// ordem em que test files carregam. Garantimos in-memory simples.
beforeAll(() => {
  const memStore: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null,
      setItem: (k: string, v: string) => { memStore[k] = String(v); },
      removeItem: (k: string) => { delete memStore[k]; },
      clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
      key: (i: number) => Object.keys(memStore)[i] ?? null,
      get length() { return Object.keys(memStore).length; },
    },
  });
});

describe('UX Prefs ο.8', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTest();
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('style');
      document.body.className = '';
    }
  });

  it('defaults retorna DEFAULT_PREFS', () => {
    const prefs = getUxPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it('setUxPrefs salva no localStorage', () => {
    setUxPrefs({ density: 'compact', fontScale: 1.15 });
    const raw = localStorage.getItem('jsgame.uxPrefs');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.density).toBe('compact');
    expect(parsed.fontScale).toBe(1.15);
  });

  it('setUxPrefs aplica CSS vars em documentElement', () => {
    setUxPrefs({ fontScale: 1.3 });
    expect(document.documentElement.style.getPropertyValue('--ux-font-scale')).toBe('1.3');
  });

  it('applyUxPrefs aplica density class no body', () => {
    applyUxPrefs({ ...DEFAULT_PREFS, density: 'compact' });
    expect(document.body.classList.contains('ux-density-compact')).toBe(true);
    applyUxPrefs({ ...DEFAULT_PREFS, density: 'comfortable' });
    expect(document.body.classList.contains('ux-density-compact')).toBe(false);
    expect(document.body.classList.contains('ux-density-comfortable')).toBe(true);
  });

  it('contrastBoost adiciona classe body', () => {
    setUxPrefs({ contrastBoost: true });
    expect(document.body.classList.contains('ux-contrast-boost')).toBe(true);
    setUxPrefs({ contrastBoost: false });
    expect(document.body.classList.contains('ux-contrast-boost')).toBe(false);
  });

  it('hitTargetBoost ajusta --ux-hit-min', () => {
    setUxPrefs({ hitTargetBoost: false });
    expect(document.documentElement.style.getPropertyValue('--ux-hit-min')).toBe('44px');
    setUxPrefs({ hitTargetBoost: true });
    expect(document.documentElement.style.getPropertyValue('--ux-hit-min')).toBe('56px');
  });

  it('animSpeed instant zera multiplier', () => {
    setUxPrefs({ animSpeed: 'instant' });
    expect(document.documentElement.style.getPropertyValue('--ux-anim-multiplier')).toBe('0');
  });

  it('initUxPrefs carrega + aplica em uma chamada', () => {
    localStorage.setItem('jsgame.uxPrefs', JSON.stringify({ density: 'comfortable', fontScale: 0.9 }));
    initUxPrefs();
    expect(document.documentElement.style.getPropertyValue('--ux-font-scale')).toBe('0.9');
    expect(document.body.classList.contains('ux-density-comfortable')).toBe(true);
  });

  it('sanitize ignora valores inválidos', () => {
    setUxPrefs({ density: 'invalid' as any, fontScale: 99 as any });
    const prefs = getUxPrefs();
    expect(prefs.density).toBe(DEFAULT_PREFS.density);
    expect(prefs.fontScale).toBe(DEFAULT_PREFS.fontScale);
  });

  it('resetUxPrefs limpa localStorage', () => {
    setUxPrefs({ density: 'compact' });
    expect(localStorage.getItem('jsgame.uxPrefs')).toBeTruthy();
    resetUxPrefs();
    expect(localStorage.getItem('jsgame.uxPrefs')).toBeNull();
    expect(getUxPrefs()).toEqual(DEFAULT_PREFS);
  });
});

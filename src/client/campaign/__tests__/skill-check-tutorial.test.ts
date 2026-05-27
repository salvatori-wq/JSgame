// POLISH α.4 — tests pro tutorial flag do skill check overlay.
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hasSeenSkillCheckTutorial,
  markSkillCheckTutorialSeen,
  resetSkillCheckTutorial,
} from '../skill-check-overlay';

describe('POLISH α.4 — skill check tutorial flag', () => {
  // Mock localStorage isolado pra cada test — substitui window.localStorage
  // inteiro pra evitar cross-contamination de outros test files (single-fork).
  let store: Record<string, string>;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    store = {};
    originalLocalStorage = window.localStorage;
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    };
    Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
  });

  it('hasSeenSkillCheckTutorial retorna false inicialmente', () => {
    expect(hasSeenSkillCheckTutorial()).toBe(false);
  });

  it('markSkillCheckTutorialSeen faz hasSeen retornar true', () => {
    markSkillCheckTutorialSeen();
    expect(hasSeenSkillCheckTutorial()).toBe(true);
  });

  it('persiste entre chamadas (simula refresh)', () => {
    markSkillCheckTutorialSeen();
    expect(hasSeenSkillCheckTutorial()).toBe(true);
  });

  it('resetSkillCheckTutorial limpa o flag', () => {
    markSkillCheckTutorialSeen();
    expect(hasSeenSkillCheckTutorial()).toBe(true);
    resetSkillCheckTutorial();
    expect(hasSeenSkillCheckTutorial()).toBe(false);
  });

  it('mark é idempotente (chamar 2x não quebra)', () => {
    markSkillCheckTutorialSeen();
    markSkillCheckTutorialSeen();
    expect(hasSeenSkillCheckTutorial()).toBe(true);
  });
});

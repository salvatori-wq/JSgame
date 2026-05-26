// Chat refactor — tests pras helpers puras do narration-log.
// O componente NarrationLog em si depende de DOM, mas as funções de decisão
// (isDegradedNarration, shouldAutoRetrySilent, shouldTtsSpeak) são puras.

import { describe, it, expect, vi } from 'vitest';
import { isDegradedNarration, shouldAutoRetrySilent } from '../narration-log';

describe('isDegradedNarration', () => {
  it('reconhece "Mestre (degradado)"', () => {
    expect(isDegradedNarration('Mestre (degradado)')).toBe(true);
  });
  it('reconhece "Mestre (offline)"', () => {
    expect(isDegradedNarration('Mestre (offline)')).toBe(true);
  });
  it('NÃO sinaliza "Mestre" puro', () => {
    expect(isDegradedNarration('Mestre')).toBe(false);
  });
  it('NÃO sinaliza NPCs', () => {
    expect(isDegradedNarration('Borin Forjarocha')).toBe(false);
    expect(isDegradedNarration('Sistema')).toBe(false);
  });
  it('NÃO sinaliza "Mestre (sombrio)" — personality, não fallback', () => {
    expect(isDegradedNarration('Mestre (sombrio)')).toBe(false);
  });
});

describe('shouldAutoRetrySilent', () => {
  const baseAction = { action: 'explore', timestamp: Date.now() };

  it('retry quando degradado + lastAction recente + não retry ainda', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(true);
  });

  it('NÃO retry se speaker for narração normal', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry se já tentou no ciclo', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: baseAction,
      alreadyRetried: true,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry sem lastAction (não sabemos o que reenviar)', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: null,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry se lastAction muito velha (>30s)', () => {
    const now = Date.now();
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: { action: 'explore', timestamp: now - 35_000 },
      alreadyRetried: false,
      nowMs: now,
    });
    expect(r).toBe(false);
  });

  it('retry borderline 29s atrás (dentro da janela)', () => {
    const now = Date.now();
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (offline)',
      lastAction: { action: 'attack', timestamp: now - 29_000 },
      alreadyRetried: false,
      nowMs: now,
    });
    expect(r).toBe(true);
  });

  it('reconhece variant "offline" também', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (offline)',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(true);
  });
});

describe('NarrationLog — DOM smoke (JSDOM)', () => {
  // Vitest default env é node — pulamos esses tests no CI atual.
  // Mas marcamos a expectativa: o componente é exercitado em e2e/preview.
  it.skip('append entries persistem entre updates', async () => {
    // Placeholder pra futura suite com @vitest/browser ou playwright.
  });
});

// @vitest-environment happy-dom
// Chat refactor — tests pras helpers puras do narration-log.
// O componente NarrationLog em si depende de DOM, mas as funções de decisão
// (isDegradedNarration, shouldAutoRetrySilent, shouldTtsSpeak) são puras.
// Sub-sprint C — happy-dom adicionado pra cobrir is-first-narration class.

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

// Sub-sprint C — Tests do is-first-narration usando happy-dom (não persiste,
// só smoke do build do entry el).
describe('NarrationLog — is-first-narration (DOM)', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — não tem DOM', () => {});
    return;
  }
  const { NarrationLog } = await import('../narration-log');
  const newLog = (): { log: InstanceType<typeof NarrationLog>; el: HTMLElement } => {
    const log = new NarrationLog();
    return { log, el: log.element };
  };

  it('primeira narração ganha .is-first-narration', () => {
    const { log, el } = newLog();
    log.appendNarration({ speaker: 'Mestre', text: 'A chuva cai. Você abre os olhos.' });
    const entry = el.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-first-narration')).toBe(true);
    log.destroy();
  });

  it('narrações seguintes NÃO ganham .is-first-narration', () => {
    const { log, el } = newLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Primeira.' });
    log.appendNarration({ speaker: 'Mestre', text: 'Segunda.' });
    const entries = el.querySelectorAll('.camp-narr-entry');
    expect(entries.length).toBe(2);
    expect(entries[0]?.classList.contains('is-first-narration')).toBe(true);
    expect(entries[1]?.classList.contains('is-first-narration')).toBe(false);
    log.destroy();
  });

  it('só a primeira entry de qualquer speaker recebe .is-first-narration', () => {
    const { log, el } = newLog();
    // primeira entry — não importa speaker, ganha is-first
    log.appendNarration({ speaker: 'TestPlayer', text: 'oi galera' });
    log.appendNarration({ speaker: 'Mestre', text: 'O Mestre olha.' });
    const entries = el.querySelectorAll('.camp-narr-entry');
    expect(entries[0]?.classList.contains('is-first-narration')).toBe(true);
    expect(entries[1]?.classList.contains('is-first-narration')).toBe(false);
    log.destroy();
  });
});

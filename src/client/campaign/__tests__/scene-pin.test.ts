// Sprint X.B3 — Tests pro scene pin sticky (última narração visível durante decisão).

import { describe, it, expect } from 'vitest';
import { previewText } from '../narration-log';

describe('previewText — X.B3 truncate pra scene pin', () => {
  it('texto curto retorna intacto', () => {
    expect(previewText('Curto.')).toBe('Curto.');
  });

  it('texto exatamente no limite retorna intacto (default 120)', () => {
    const t = 'a'.repeat(120);
    expect(previewText(t)).toBe(t);
    expect(previewText(t).length).toBe(120);
  });

  it('texto longo trunca em palavra completa + ellipsis', () => {
    const t = 'Chuva fina cai sobre a estrada de pedra musgosa. Borin Forjarocha reconhece o caminho — passou por aqui há anos, em outra vida cheia de violência e arrependimento.';
    const out = previewText(t);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(122); // 120 + '…'
    // Garante que o texto ANTES do … corresponde a um prefixo do original
    // (não inventou palavras, não cortou no meio de outra língua):
    const beforeEllipsis = out.slice(0, -1).trimEnd();
    expect(t.startsWith(beforeEllipsis)).toBe(true);
  });

  it('respeita maxChars customizado', () => {
    const t = 'um dois tres quatro cinco seis sete oito nove dez';
    const out = previewText(t, 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(22);
  });

  it('texto sem espaços longos cai pra hard cut + ellipsis', () => {
    const t = 'a'.repeat(200);
    const out = previewText(t);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('NarrationLog — X.B3 scene pin lifecycle', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — sem DOM', () => {});
    return;
  }
  const { NarrationLog } = await import('../narration-log');

  it('primeira narração de Mestre cria scene pin com texto', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'A chuva começa a cair sobre a estrada.' });
    expect(log.element.querySelector('.cn-scene-pin')).toBeTruthy();
    expect(log.getLastSceneText()).toBe('A chuva começa a cair sobre a estrada.');
    expect(log.getLastSceneSpeaker()).toBe('Mestre');
    log.destroy();
  });

  it('narração subsequente de Mestre atualiza scene pin (não cria nova)', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Cena 1.' });
    log.appendNarration({ speaker: 'Mestre', text: 'Cena 2.' });
    const pins = log.element.querySelectorAll('.cn-scene-pin');
    expect(pins.length).toBe(1);
    expect(log.getLastSceneText()).toBe('Cena 2.');
    log.destroy();
  });

  it('echo de roll NÃO atualiza scene pin (não é narração de Mestre)', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Cena narrada.' });
    log.appendNarration({ speaker: '🎲 Borin', text: 'percepção DC 12 → SUCESSO' });
    expect(log.getLastSceneText()).toBe('Cena narrada.');
    log.destroy();
  });

  it('player echo (▶) NÃO atualiza scene pin', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Cena base.' });
    log.appendNarration({ speaker: '▶ Borin', text: 'sneak' });
    expect(log.getLastSceneText()).toBe('Cena base.');
    log.destroy();
  });

  it('toggle expande/colapsa pin', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Cena.' });
    const head = log.element.querySelector('.cn-scene-pin-head') as HTMLButtonElement;
    const pin = log.element.querySelector('.cn-scene-pin') as HTMLElement;
    expect(pin.classList.contains('is-expanded')).toBe(false);
    head.click();
    expect(pin.classList.contains('is-expanded')).toBe(true);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    head.click();
    expect(pin.classList.contains('is-expanded')).toBe(false);
    log.destroy();
  });

  it('pin sticky position via CSS data check', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Cena.' });
    const pin = log.element.querySelector('.cn-scene-pin') as HTMLElement;
    expect(pin).toBeTruthy();
    // CSS é injetado em runtime via styles.css; checa só que a class existe
    expect(pin.classList.contains('cn-scene-pin')).toBe(true);
    log.destroy();
  });
});

// @vitest-environment happy-dom
// Fase 2d — guards da PRÉVIA de streaming do NarrationLog. A prévia é DOM puro
// (fora de this.entries); o dmNarration final substitui via clear + appendNarration.

import { describe, it, expect } from 'vitest';
import { NarrationLog } from '../narration-log';

describe('NarrationLog — prévia de streaming (Fase 2d)', () => {
  it('begin/append cria prévia que cresce; clear remove; final via appendNarration', () => {
    const log = new NarrationLog();
    expect(log.hasStreamingPreview()).toBe(false);

    log.beginStreamingPreview('Mestre');
    expect(log.hasStreamingPreview()).toBe(true);
    log.appendStreamingPreview('Você ');
    log.appendStreamingPreview('vê o orc.');
    const prev = log.element.querySelector('.cn-streaming-preview .cnn-text');
    expect(prev?.textContent).toBe('Você vê o orc.');

    log.clearStreamingPreview();
    expect(log.hasStreamingPreview()).toBe(false);
    expect(log.element.querySelector('.cn-streaming-preview')).toBeNull();

    // final autoritativo (sanitizado) entra pela appendNarration normal
    log.appendNarration({ speaker: 'Mestre', text: 'Você vê o orc girar o machado.' });
    expect(log.element.textContent).toContain('girar o machado');
    log.destroy();
  });

  it('beginStreamingPreview 2x mantém só 1 prévia (idempotente)', () => {
    const log = new NarrationLog();
    log.beginStreamingPreview();
    log.appendStreamingPreview('parcial');
    log.beginStreamingPreview();
    expect(log.element.querySelectorAll('.cn-streaming-preview').length).toBe(1);
    log.destroy();
  });

  it('append sem prévia ativa é no-op seguro', () => {
    const log = new NarrationLog();
    expect(() => log.appendStreamingPreview('x')).not.toThrow();
    expect(log.hasStreamingPreview()).toBe(false);
    log.destroy();
  });
});

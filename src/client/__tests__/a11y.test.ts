// POLISH ε — tests pro a11y helper.
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initA11yEnhancements, initEscapeKeyHandler, initGlobalErrorBoundary } from '../a11y';

describe('POLISH ε — a11y helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('enhanceButtonsAria (via initA11yEnhancements)', () => {
    it('aplica aria-label baseado em title em botão icon-only', () => {
      document.body.innerHTML = '<button title="Fechar inventário">✕</button>';
      initA11yEnhancements();
      const btn = document.querySelector('button')!;
      expect(btn.getAttribute('aria-label')).toBe('Fechar inventário');
    });

    it('NÃO sobrescreve aria-label existente', () => {
      document.body.innerHTML = '<button title="Foo" aria-label="Bar">✕</button>';
      initA11yEnhancements();
      const btn = document.querySelector('button')!;
      expect(btn.getAttribute('aria-label')).toBe('Bar');
    });

    it('NÃO toca em botões com texto longo (não-icon)', () => {
      document.body.innerHTML = '<button title="ignored">Confirmar pedido</button>';
      initA11yEnhancements();
      const btn = document.querySelector('button')!;
      expect(btn.getAttribute('aria-label')).toBeNull();
    });

    it('aplica fallback "Fechar" pra botão ✕ sem title', () => {
      document.body.innerHTML = '<button>✕</button>';
      initA11yEnhancements();
      const btn = document.querySelector('button')!;
      expect(btn.getAttribute('aria-label')).toBe('Fechar');
    });

    it('aplica fallback "Mais opções" pra botão ⋯', () => {
      document.body.innerHTML = '<button>⋯</button>';
      initA11yEnhancements();
      expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Mais opções');
    });

    it('aplica fallback pra emojis conhecidos (🎒 → Inventário)', () => {
      document.body.innerHTML = '<button>🎒</button>';
      initA11yEnhancements();
      expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Inventário');
    });

    // Observação: MutationObserver não é polyfill confiável em happy-dom — teste
    // de DOM dinâmico fica como integration em browser real (preview manual).
    // Os 6 tests acima cobrem o helper de enhance que o observer usa.
  });

  describe('enhanceLandmarksAria', () => {
    it('aplica role=dialog em overlay de modal', () => {
      document.body.innerHTML = '<div class="inv-modal-overlay"></div>';
      initA11yEnhancements();
      const m = document.querySelector('.inv-modal-overlay')!;
      expect(m.getAttribute('role')).toBe('dialog');
      expect(m.getAttribute('aria-modal')).toBe('true');
    });

    it('aplica role=status em .skeleton', () => {
      document.body.innerHTML = '<div class="skeleton"></div>';
      initA11yEnhancements();
      const s = document.querySelector('.skeleton')!;
      expect(s.getAttribute('role')).toBe('status');
      expect(s.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('initEscapeKeyHandler', () => {
    it('ESC dispara click no botão de fechar visível', () => {
      let clicked = false;
      document.body.innerHTML = '<button class="inv-modal-close">✕</button>';
      const btn = document.querySelector('.inv-modal-close')!;
      btn.addEventListener('click', () => { clicked = true; });
      // JSDOM: offsetParent é null por padrão — mock pra simular visibilidade
      Object.defineProperty(btn, 'offsetParent', { get: () => document.body, configurable: true });
      initEscapeKeyHandler();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(clicked).toBe(true);
    });

    it('ESC NÃO faz nada se não há modal aberto', () => {
      document.body.innerHTML = '<button>Outra coisa</button>';
      initEscapeKeyHandler();
      // Não deve lançar
      expect(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }).not.toThrow();
    });
  });

  describe('initGlobalErrorBoundary', () => {
    it('listeners são registrados sem lançar', () => {
      expect(() => initGlobalErrorBoundary()).not.toThrow();
    });
  });
});

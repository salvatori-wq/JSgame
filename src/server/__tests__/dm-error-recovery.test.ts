// POLISH γ.4 — tests pro classifyError + makeGracefulFallback.

import { describe, it, expect } from 'vitest';
import { classifyError, makeGracefulFallback } from '../dm/dm.js';

describe('POLISH γ.4 — error recovery', () => {
  describe('classifyError', () => {
    it('detecta timeout', () => {
      expect(classifyError('LLM timeout após 55000ms')).toBe('timeout');
      expect(classifyError('Request timeout')).toBe('timeout');
    });

    it('detecta rate_limit', () => {
      expect(classifyError('429 Too Many Requests')).toBe('rate_limit');
      expect(classifyError('rate limit exceeded')).toBe('rate_limit');
      expect(classifyError('quota exhausted')).toBe('rate_limit');
    });

    it('detecta auth', () => {
      expect(classifyError('401 Unauthorized')).toBe('auth');
      expect(classifyError('403 Forbidden')).toBe('auth');
      expect(classifyError('Invalid API key')).toBe('auth');
    });

    it('detecta parse', () => {
      expect(classifyError('JSON parse error')).toBe('parse');
      expect(classifyError('malformed response')).toBe('parse');
    });

    it('detecta empty', () => {
      expect(classifyError('LLM retornou narração vazia')).toBe('empty');
      expect(classifyError('Empty response')).toBe('empty');
    });

    it('fallback unknown pra erros não classificados', () => {
      expect(classifyError('Some weird error xpto')).toBe('unknown');
      expect(classifyError('')).toBe('unknown');
    });
  });

  describe('makeGracefulFallback', () => {
    it('popula errorMeta completo', () => {
      const err = new Error('timeout');
      const r = makeGracefulFallback(err, ['cerebras', 'gemini', 'groq'], 'groq');
      expect(r.errorMeta).toBeDefined();
      expect(r.errorMeta?.providersAttempted).toEqual(['cerebras', 'gemini', 'groq']);
      expect(r.errorMeta?.lastProvider).toBe('groq');
      expect(r.errorMeta?.errorKind).toBe('timeout');
      expect(r.errorMeta?.canRetry).toBe(true);
    });

    it('auth fail tem canRetry=false', () => {
      const r = makeGracefulFallback(new Error('401 Unauthorized'), ['gemini'], 'gemini');
      expect(r.errorMeta?.errorKind).toBe('auth');
      expect(r.errorMeta?.canRetry).toBe(false);
    });

    it('rate_limit tem canRetry=true (aguardar resolve)', () => {
      const r = makeGracefulFallback(new Error('429 quota'), ['gemini'], 'gemini');
      expect(r.errorMeta?.errorKind).toBe('rate_limit');
      expect(r.errorMeta?.canRetry).toBe(true);
    });

    it('mensagem narration muda baseado em timeout vs outro erro', () => {
      const timeoutR = makeGracefulFallback(new Error('LLM timeout 55000ms'));
      const otherR = makeGracefulFallback(new Error('Internal server error'));
      expect(timeoutR.narration).toContain('lento');
      expect(otherR.narration).toContain('travou');
    });

    it('speaker sempre "Mestre (degradado)"', () => {
      const r = makeGracefulFallback(new Error('any'));
      expect(r.speaker).toBe('Mestre (degradado)');
    });

    it('toolCalls sempre vazio em fallback', () => {
      const r = makeGracefulFallback(new Error('any'));
      expect(r.toolCalls).toEqual([]);
    });

    it('errorMsg truncado em 160 chars', () => {
      const longMsg = 'a'.repeat(500);
      const r = makeGracefulFallback(new Error(longMsg));
      expect(r.errorMeta?.errorMsg.length).toBeLessThanOrEqual(160);
    });

    it('providersAttempted default vazio + lastProvider default "unknown"', () => {
      const r = makeGracefulFallback(new Error('any'));
      expect(r.errorMeta?.providersAttempted).toEqual([]);
      expect(r.errorMeta?.lastProvider).toBe('unknown');
    });
  });
});

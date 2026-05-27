// POLISH α.6 — tests pra thinking-tips.

import { describe, it, expect } from 'vitest';
import { pickRandomTip, getThinkingPhase } from '../thinking-tips';

describe('POLISH α.6 — thinking tips', () => {
  describe('pickRandomTip', () => {
    it('retorna string não-vazia', () => {
      const tip = pickRandomTip();
      expect(tip.length).toBeGreaterThan(0);
    });

    it('em 20 calls produz pelo menos 5 tips diferentes', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) seen.add(pickRandomTip());
      expect(seen.size).toBeGreaterThanOrEqual(5);
    });

    it('NUNCA retorna mesma dica 2x em sequência (anti-repetição)', () => {
      let last = pickRandomTip();
      for (let i = 0; i < 10; i++) {
        const cur = pickRandomTip();
        expect(cur).not.toBe(last);
        last = cur;
      }
    });
  });

  describe('getThinkingPhase', () => {
    it('<8s: mostra "Mestre escrevendo"', () => {
      expect(getThinkingPhase(0, 'Bob', 'explorar')).toContain('escrevendo');
      expect(getThinkingPhase(7, 'Bob', 'explorar')).toContain('escrevendo');
    });

    it('8-17s: mostra "demorando"', () => {
      expect(getThinkingPhase(8, 'Bob', 'atacar')).toContain('demorando');
      expect(getThinkingPhase(17, 'Bob', 'atacar')).toContain('demorando');
    });

    it('18-29s: mostra "Trocando provedor"', () => {
      expect(getThinkingPhase(18, 'Bob', 'rolar')).toContain('provedor');
      expect(getThinkingPhase(29, 'Bob', 'rolar')).toContain('provedor');
    });

    it('30s+: mostra "Resposta lenta"', () => {
      expect(getThinkingPhase(30, 'Bob', 'rolar')).toContain('lenta');
      expect(getThinkingPhase(60, 'Bob', 'rolar')).toContain('lenta');
    });

    it('inclui playerName e action quando ainda em fase normal', () => {
      const phase = getThinkingPhase(3, 'Aldric', 'lançar magia');
      expect(phase).toContain('Aldric');
      expect(phase).toContain('lançar magia');
    });
  });
});

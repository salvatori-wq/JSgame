// POLISH β.4 — Tests pra condition-icons.

import { describe, it, expect } from 'vitest';
import { getConditionIcon, getConditionDescription, formatConditionLabel } from '../condition-icons';

describe('POLISH β.4 — condition icons', () => {
  describe('getConditionIcon', () => {
    it('retorna emoji esperado pra conditions PHB conhecidas', () => {
      expect(getConditionIcon('inconsciente')).toBe('💀');
      expect(getConditionIcon('paralisado')).toBe('⏸');
      expect(getConditionIcon('envenenado')).toBe('🧪');
      expect(getConditionIcon('caido')).toBe('🔻');
      expect(getConditionIcon('agarrado')).toBe('🤝');
      expect(getConditionIcon('cego')).toBe('👁');
    });

    it('case-insensitive', () => {
      expect(getConditionIcon('Envenenado')).toBe('🧪');
      expect(getConditionIcon('INCONSCIENTE')).toBe('💀');
    });

    it('retorna fallback "•" pra condition desconhecida', () => {
      expect(getConditionIcon('xpto')).toBe('•');
      expect(getConditionIcon('')).toBe('•');
    });
  });

  describe('getConditionDescription', () => {
    it('retorna descrição pra conditions conhecidas', () => {
      const desc = getConditionDescription('envenenado');
      expect(desc.length).toBeGreaterThan(0);
      expect(desc.toLowerCase()).toContain('desvantagem');
    });

    it('retorna string vazia pra unknown', () => {
      expect(getConditionDescription('xpto')).toBe('');
    });

    it('descrições são curtas (cabem em tooltip mobile, ≤120 chars)', () => {
      const conditions = ['inconsciente', 'paralisado', 'envenenado', 'agarrado', 'caido'];
      for (const c of conditions) {
        const desc = getConditionDescription(c);
        expect(desc.length).toBeLessThanOrEqual(120);
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe('formatConditionLabel', () => {
    it('combina ícone + label', () => {
      expect(formatConditionLabel('envenenado')).toBe('🧪 envenenado');
      expect(formatConditionLabel('caido')).toBe('🔻 caido');
    });
  });
});

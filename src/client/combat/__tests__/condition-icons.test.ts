// POLISH β.4 — Tests pra condition-icons.

import { describe, it, expect } from 'vitest';
import { getConditionIcon, getConditionDescription, formatConditionLabel, getConditionName } from '../condition-icons';

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

  // QA-lançamento (Ciclo Combate) — o pill do inimigo vazava o slug cru
  // ("caido", "enfeiticado", "invisivel", "restrito") em vez do nome PT-BR.
  describe('getConditionName', () => {
    it('retorna o nome PT-BR canônico (acento + capitalização)', () => {
      expect(getConditionName('caido')).toBe('Caído');
      expect(getConditionName('enfeiticado')).toBe('Enfeitiçado');
      expect(getConditionName('invisivel')).toBe('Invisível');
      expect(getConditionName('restrito')).toBe('Restrito');
      expect(getConditionName('envenenado')).toBe('Envenenado');
      expect(getConditionName('amedrontado')).toBe('Amedrontado');
    });

    it('case-insensitive', () => {
      expect(getConditionName('CAIDO')).toBe('Caído');
      expect(getConditionName('Invisivel')).toBe('Invisível');
    });

    it('fallback capitaliza a 1ª letra do slug desconhecido (nunca vaza minúsculo cru)', () => {
      expect(getConditionName('xpto')).toBe('Xpto');
    });
  });

  describe('formatConditionLabel', () => {
    it('combina ícone + nome PT-BR (não o slug cru)', () => {
      expect(formatConditionLabel('envenenado')).toBe('🧪 Envenenado');
      expect(formatConditionLabel('caido')).toBe('🔻 Caído');
    });
  });
});

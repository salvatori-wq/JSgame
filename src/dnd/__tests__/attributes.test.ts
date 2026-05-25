import { describe, it, expect } from 'vitest';
import {
  abilityModifier, formatModifier, proficiencyBonus,
  pointBuyCost, totalPointBuyCost, isValidPointBuy,
  defaultPointBuyScores, applyRacialBonuses,
} from '../attributes';

describe('attributes', () => {
  describe('abilityModifier', () => {
    it.each([
      [1, -5], [3, -4], [8, -1], [9, -1], [10, 0], [11, 0], [12, 1],
      [13, 1], [14, 2], [15, 2], [16, 3], [18, 4], [20, 5], [22, 6],
    ])('score %i → modifier %i', (score, expected) => {
      expect(abilityModifier(score)).toBe(expected);
    });
  });

  describe('formatModifier', () => {
    it('positivo com +', () => expect(formatModifier(3)).toBe('+3'));
    it('zero com +', () => expect(formatModifier(0)).toBe('+0'));
    it('negativo só com -', () => expect(formatModifier(-2)).toBe('-2'));
  });

  describe('proficiencyBonus', () => {
    it.each([
      [1, 2], [2, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4],
      [13, 5], [16, 5], [17, 6], [20, 6],
    ])('nível %i → bonus %i', (level, expected) => {
      expect(proficiencyBonus(level)).toBe(expected);
    });
  });

  describe('pointBuyCost', () => {
    it.each([
      [8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9],
    ])('score %i custa %i pts', (score, expected) => {
      expect(pointBuyCost(score)).toBe(expected);
    });

    it('retorna null pra scores fora do range', () => {
      expect(pointBuyCost(7)).toBeNull();
      expect(pointBuyCost(16)).toBeNull();
    });
  });

  describe('totalPointBuyCost', () => {
    it('default scores (todos 8) custam 0', () => {
      expect(totalPointBuyCost(defaultPointBuyScores())).toBe(0);
    });

    it('build padrão (15/14/13/12/10/8) custa 27', () => {
      const cost = totalPointBuyCost({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 });
      expect(cost).toBe(9 + 7 + 5 + 4 + 2 + 0); // = 27
    });
  });

  describe('isValidPointBuy', () => {
    it('aceita build de 27pts', () => {
      const r = isValidPointBuy({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 });
      expect(r.ok).toBe(true);
    });

    it('rejeita score acima de 15', () => {
      const r = isValidPointBuy({ for: 16, des: 8, con: 8, int: 8, sab: 8, car: 8 });
      expect(r.ok).toBe(false);
    });

    it('rejeita budget excedido', () => {
      const r = isValidPointBuy({ for: 15, des: 15, con: 15, int: 8, sab: 8, car: 8 });
      // 9+9+9+0+0+0 = 27 — passa
      expect(r.ok).toBe(true);
      const r2 = isValidPointBuy({ for: 15, des: 15, con: 15, int: 10, sab: 8, car: 8 });
      // 9+9+9+2+0+0 = 29 — falha
      expect(r2.ok).toBe(false);
    });
  });

  describe('applyRacialBonuses', () => {
    it('soma corretamente', () => {
      const base = defaultPointBuyScores();  // todos 8
      const result = applyRacialBonuses(base, { for: 2, con: 1 });
      expect(result.for).toBe(10);
      expect(result.con).toBe(9);
      expect(result.des).toBe(8);
    });

    it('aplica humano (+1 em todos)', () => {
      const base = { for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 };
      const result = applyRacialBonuses(base, { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 });
      expect(result.for).toBe(16);
      expect(result.des).toBe(15);
      expect(result.car).toBe(9);
    });
  });
});

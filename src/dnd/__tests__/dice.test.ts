import { describe, it, expect } from 'vitest';
import { rollDie, rollDice, rollD20, rollDamage, parseDiceNotation, rollNotation } from '../dice';

describe('dice', () => {
  describe('rollDie', () => {
    it('retorna valor entre 1 e N', () => {
      for (let i = 0; i < 50; i++) {
        const r = rollDie(20);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('rollDice', () => {
    it('soma N dados + modifier', () => {
      const r = rollDice(3, 6, 2);
      expect(r.rolls).toHaveLength(3);
      expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0) + 2);
      expect(r.notation).toBe('3d6+2');
    });

    it('modifier negativo na notação', () => {
      const r = rollDice(1, 20, -3);
      expect(r.notation).toBe('1d20-3');
      expect(r.total).toBe(r.rolls[0]! - 3);
    });
  });

  describe('rollD20', () => {
    it('com advantage rola 2x e pega maior', () => {
      // Stat test: 100 rolls com vantagem deve estar acima da média de 100 normais
      let sumAdv = 0, sumNormal = 0;
      for (let i = 0; i < 200; i++) {
        sumAdv += rollD20({ advantage: true }).total;
        sumNormal += rollD20({}).total;
      }
      expect(sumAdv / 200).toBeGreaterThan(sumNormal / 200);
    });

    it('com disadvantage rola 2x e pega menor', () => {
      let sumDis = 0, sumNormal = 0;
      for (let i = 0; i < 200; i++) {
        sumDis += rollD20({ disadvantage: true }).total;
        sumNormal += rollD20({}).total;
      }
      expect(sumDis / 200).toBeLessThan(sumNormal / 200);
    });

    it('advantage + disadvantage cancelam (normal)', () => {
      const r = rollD20({ advantage: true, disadvantage: true });
      expect(r.withAdvantage).toBe('normal');
      expect(r.bothRolls).toBeUndefined();
    });

    it('marca nat20 e nat1', () => {
      // Forçar nat 20 via mock seria invasivo. Em vez disso: stat test que algum
      // dos 200 rolls dispara nat20 ou nat1.
      let foundNat20 = false, foundNat1 = false;
      for (let i = 0; i < 200; i++) {
        const r = rollD20({});
        if (r.nat20) foundNat20 = true;
        if (r.nat1) foundNat1 = true;
      }
      // Chance binomial: ~99.99% pra cada um aparecer em 200 rolls
      expect(foundNat20).toBe(true);
      expect(foundNat1).toBe(true);
    });
  });

  describe('rollDamage', () => {
    it('crítico dobra a contagem de dados (não o modifier)', () => {
      // 2d6+3 normal vs crit
      const normal = rollDamage(2, 6, 3, false);
      const crit = rollDamage(2, 6, 3, true);
      expect(normal.rolls).toHaveLength(2);
      expect(crit.rolls).toHaveLength(4);
      expect(normal.modifier).toBe(3);
      expect(crit.modifier).toBe(3);
    });
  });

  describe('parseDiceNotation', () => {
    it('parse 3d6', () => {
      const r = parseDiceNotation('3d6');
      expect(r).toEqual({ count: 3, kind: 6, modifier: 0 });
    });

    it('parse 1d20+5', () => {
      const r = parseDiceNotation('1d20+5');
      expect(r).toEqual({ count: 1, kind: 20, modifier: 5 });
    });

    it('parse 2d8-1', () => {
      const r = parseDiceNotation('2d8-1');
      expect(r).toEqual({ count: 2, kind: 8, modifier: -1 });
    });

    it('rejeita notação inválida', () => {
      expect(parseDiceNotation('foo')).toBeNull();
      expect(parseDiceNotation('1d7')).toBeNull();  // d7 não existe
      expect(parseDiceNotation('d20')).toBeNull();
    });
  });

  describe('rollNotation', () => {
    it('rola a partir de string', () => {
      const r = rollNotation('1d20+3');
      expect(r).not.toBeNull();
      expect(r!.total).toBeGreaterThanOrEqual(4);
      expect(r!.total).toBeLessThanOrEqual(23);
    });

    it('null em notação inválida', () => {
      expect(rollNotation('xpto')).toBeNull();
    });
  });
});

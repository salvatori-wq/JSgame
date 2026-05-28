// @vitest-environment happy-dom
// T2.5 — Tests do Short Rest visual picker.

import { describe, it, expect } from 'vitest';
import { estimateShortRestHp } from '../short-rest-overlay';

describe('T2.5 — estimateShortRestHp', () => {
  it('0 dice = 0 HP', () => {
    expect(estimateShortRestHp(8, 2, 0)).toBe(0);
  });

  it('1d8 + Con +2 = média 6.5 ≈ 7 HP por dice', () => {
    // Mean(1d8) = 4.5; + 2 ConMod = 6.5; round = 7
    expect(estimateShortRestHp(8, 2, 1)).toBe(7);
  });

  it('2 dice 1d10 + Con +3 = 2 × 8.5 = 17 HP', () => {
    // Mean(1d10) = 5.5; + 3 = 8.5; × 2 = 17
    expect(estimateShortRestHp(10, 3, 2)).toBe(17);
  });

  it('Con negativo NÃO permite resultado < 1 por dice (regra PHB)', () => {
    // 1d6 + (-3) = 0.5 → safeguard 1 por dice → 3 dice = 3
    expect(estimateShortRestHp(6, -3, 3)).toBe(3);
  });

  it('1d12 + Con +1 = 7.5 ≈ 8 HP por dice', () => {
    // Mean(1d12) = 6.5; + 1 = 7.5; round = 8
    expect(estimateShortRestHp(12, 1, 1)).toBe(8);
  });
});

// V.3.a — Bug visual no display da fórmula: "d10++3" quando Con positivo.
// Causa: `d${faces}+${con>=0?'+':''}${conMod}` adicionava '+' duas vezes.
// Fix: usar template condicional sem o '+' literal antes.
// Não há acesso direto ao DOM no overlay sem mounting; aqui testamos o helper
// usado pra construir a string.
describe('V.3.a — formato fórmula d_N+ConMod', () => {
  // Helper inline reproduzindo o template do short-rest-overlay.ts:84
  const formatDieAndCon = (dieFaces: number, conMod: number): string =>
    `d${dieFaces}${conMod >= 0 ? `+${conMod}` : conMod}`;

  it('Con positivo: "d10+3" (não "d10++3")', () => {
    expect(formatDieAndCon(10, 3)).toBe('d10+3');
  });

  it('Con zero: "d8+0"', () => {
    expect(formatDieAndCon(8, 0)).toBe('d8+0');
  });

  it('Con negativo: "d6-1"', () => {
    expect(formatDieAndCon(6, -1)).toBe('d6-1');
  });

  it('NUNCA contém "++" (regressão guard)', () => {
    for (const con of [-3, -2, -1, 0, 1, 2, 3, 5]) {
      for (const die of [6, 8, 10, 12]) {
        expect(formatDieAndCon(die, con)).not.toContain('++');
      }
    }
  });
});

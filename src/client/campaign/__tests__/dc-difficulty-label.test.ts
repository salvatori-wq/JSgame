// N2.3 — Tests pra dcDifficultyLabel — tabela DC referência PHB DMG p.238.
// Função pura — sem dep DOM. Cobre fronteiras de cada faixa.

import { describe, it, expect } from 'vitest';
import { dcDifficultyLabel } from '../skill-check-overlay';

describe('N2.3 — dcDifficultyLabel (PHB DMG p.238)', () => {
  it('DC 5 e abaixo = Muito fácil', () => {
    expect(dcDifficultyLabel(1)).toContain('Muito fácil');
    expect(dcDifficultyLabel(5)).toContain('Muito fácil');
  });

  it('DC 6-10 = Fácil', () => {
    expect(dcDifficultyLabel(6)).toContain('Fácil');
    expect(dcDifficultyLabel(10)).toContain('Fácil');
    // Não vaza pra "Muito fácil"
    expect(dcDifficultyLabel(10)).not.toContain('Muito fácil');
  });

  it('DC 11-14 = Média', () => {
    expect(dcDifficultyLabel(11)).toContain('Média');
    expect(dcDifficultyLabel(12)).toContain('Média');
    expect(dcDifficultyLabel(14)).toContain('Média');
  });

  it('DC 15-19 = Difícil', () => {
    expect(dcDifficultyLabel(15)).toContain('Difícil');
    expect(dcDifficultyLabel(19)).toContain('Difícil');
    // Não vaza pra "Muito difícil"
    expect(dcDifficultyLabel(19)).not.toContain('Muito difícil');
  });

  it('DC 20-24 = Muito difícil (heroico)', () => {
    expect(dcDifficultyLabel(20)).toContain('Muito difícil');
    expect(dcDifficultyLabel(24)).toContain('Muito difícil');
    expect(dcDifficultyLabel(20)).toContain('heroico');
  });

  it('DC 25+ = Quase impossível (lendário)', () => {
    expect(dcDifficultyLabel(25)).toContain('Quase impossível');
    expect(dcDifficultyLabel(30)).toContain('lendário');
  });

  it('label sempre começa com "DC X — "', () => {
    expect(dcDifficultyLabel(12)).toMatch(/^DC 12 — /);
    expect(dcDifficultyLabel(20)).toMatch(/^DC 20 — /);
  });
});

// Y.A1 — Sprint Y: Tests pro fog of war linter server-side.

import { describe, it, expect } from 'vitest';
import { lintNarrationForOpponentNumbers, correctionPromptForNarration } from '../dm/narration-linter';

describe('lintNarrationForOpponentNumbers — Y.A1 detection', () => {
  it('"O orc tem 23 HP" → violation', () => {
    const r = lintNarrationForOpponentNumbers('O orc tem 23 HP e te encara.');
    expect(r.hasViolation).toBe(true);
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.sanitized).not.toContain('23 HP');
  });

  it('"está com 12/45 HP" → violation', () => {
    const r = lintNarrationForOpponentNumbers('O bandido está com 12/45 HP e sangra.');
    expect(r.hasViolation).toBe(true);
    expect(r.sanitized).not.toMatch(/12\/45/);
  });

  it('"CA 16" → violation', () => {
    const r = lintNarrationForOpponentNumbers('A armadura é pesada — CA 16. Difícil acertar.');
    expect(r.hasViolation).toBe(true);
    expect(r.sanitized).not.toContain('CA 16');
  });

  it('"AC 14" → violation (inglês)', () => {
    const r = lintNarrationForOpponentNumbers('AC 14. Watch out.');
    expect(r.hasViolation).toBe(true);
  });

  it('"DC 15 vs Constituição" → violation', () => {
    const r = lintNarrationForOpponentNumbers('Você sente o veneno — DC 15 vs Constituição.');
    expect(r.hasViolation).toBe(true);
    expect(r.sanitized).not.toContain('DC 15');
  });

  it('"+5 de ataque" → violation', () => {
    const r = lintNarrationForOpponentNumbers('Ele acerta com +5 de ataque.');
    expect(r.hasViolation).toBe(true);
    expect(r.sanitized).not.toContain('+5 de ataque');
  });

  it('"1d8+3 cortante" → violation (fórmula de dano)', () => {
    const r = lintNarrationForOpponentNumbers('A lâmina causa 1d8+3 cortante no impacto.');
    expect(r.hasViolation).toBe(true);
    expect(r.sanitized).not.toContain('1d8+3');
  });

  it('"30 pés" / "60 ft" → violation', () => {
    const r1 = lintNarrationForOpponentNumbers('Aproxima a 30 pés de você.');
    expect(r1.hasViolation).toBe(true);
    const r2 = lintNarrationForOpponentNumbers('Distance: 60 ft.');
    expect(r2.hasViolation).toBe(true);
  });

  it('múltiplos matches no mesmo texto → todos detectados', () => {
    const r = lintNarrationForOpponentNumbers('O orc tem 23 HP, CA 14, DC 15 contra você.');
    expect(r.hasViolation).toBe(true);
    expect(r.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('texto LIMPO (só adjetivos) → sem violação', () => {
    const r = lintNarrationForOpponentNumbers('O orc respira pesado, ferido. Você sente que ele está à beira.');
    expect(r.hasViolation).toBe(false);
    expect(r.matches.length).toBe(0);
    expect(r.sanitized).toBe('O orc respira pesado, ferido. Você sente que ele está à beira.');
  });

  it('contagem de turnos ACEITA (não viola)', () => {
    const r = lintNarrationForOpponentNumbers('Restam 3 turnos pro ritual completar.');
    expect(r.hasViolation).toBe(false);
  });

  it('nome de spell/arma ACEITO', () => {
    const r = lintNarrationForOpponentNumbers('Ele invoca Misty Step e some.');
    expect(r.hasViolation).toBe(false);
  });

  it('sanitized substitui por adjetivo neutro PT-BR', () => {
    const r = lintNarrationForOpponentNumbers('O orc tem 23 HP.');
    // Sanitized contém algum adjetivo da lista permitida
    expect(r.sanitized).toMatch(/ferido|machucado|parece/);
  });
});

describe('correctionPromptForNarration — Y.A1 retry prompt', () => {
  it('inclui texto original e violações na lista', () => {
    const prompt = correctionPromptForNarration('O orc tem 23 HP.', ['23 HP']);
    expect(prompt).toContain('O orc tem 23 HP.');
    expect(prompt).toContain('23 HP');
    expect(prompt).toMatch(/REESCREVA/i);
    expect(prompt).toMatch(/intacto|ferido|à beira/);
  });

  it('múltiplas violações listadas com bullet', () => {
    const prompt = correctionPromptForNarration('orig text', ['23 HP', 'CA 16', '+5 ataque']);
    expect(prompt).toContain('23 HP');
    expect(prompt).toContain('CA 16');
    expect(prompt).toContain('+5 ataque');
  });

  it('pede JSON response no fim', () => {
    const prompt = correctionPromptForNarration('texto', ['DC 14']);
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('narration');
  });
});

// T3.2 — Tests parsePreviewParts pra quebrar "Ataque: d20+5 vs CA 13" em chips.

import { describe, it, expect } from 'vitest';
import { parsePreviewParts } from '../dice-roll-overlay';

describe('T3.2 — parsePreviewParts', () => {
  it('parse "Ataque: d20+5 vs CA 13" completo', () => {
    const p = parsePreviewParts('Ataque: d20+5 vs CA 13');
    expect(p.prefix).toBe('Ataque');
    expect(p.die).toBe('d20');
    expect(p.bonus).toBe('+5');
    expect(p.vs).toBe('CA 13');
    expect(p.fallback).toBeNull();
  });

  it('parse sem prefix: "d20+3 vs CD 12"', () => {
    const p = parsePreviewParts('d20+3 vs CD 12');
    expect(p.prefix).toBeNull();
    expect(p.die).toBe('d20');
    expect(p.bonus).toBe('+3');
    expect(p.vs).toBe('CD 12');
  });

  it('parse com bonus negativo: "Save: d20-1 vs CD 14"', () => {
    const p = parsePreviewParts('Save: d20-1 vs CD 14');
    expect(p.prefix).toBe('Save');
    expect(p.die).toBe('d20');
    expect(p.bonus).toBe('-1');
    expect(p.vs).toBe('CD 14');
  });

  it('parse sem bonus: "d20 vs CA 12"', () => {
    const p = parsePreviewParts('d20 vs CA 12');
    expect(p.die).toBe('d20');
    expect(p.bonus).toBeNull();
    expect(p.vs).toBe('CA 12');
  });

  it('parse sem vs: "Dano: d6+2"', () => {
    const p = parsePreviewParts('Dano: d6+2');
    expect(p.prefix).toBe('Dano');
    expect(p.die).toBe('d6');
    expect(p.bonus).toBe('+2');
    expect(p.vs).toBeNull();
  });

  it('fallback pra texto livre: "Veneno passou direto"', () => {
    const p = parsePreviewParts('Veneno passou direto');
    expect(p.fallback).toBe('Veneno passou direto');
    expect(p.die).toBeNull();
  });

  it('parse aceita d6/d8/d10/d12 (não só d20)', () => {
    expect(parsePreviewParts('Dano: d8+4').die).toBe('d8');
    expect(parsePreviewParts('d12+3').die).toBe('d12');
    expect(parsePreviewParts('d6').die).toBe('d6');
  });

  it('parse aceita espaços no bonus: "d20 + 5"', () => {
    const p = parsePreviewParts('d20 + 5');
    expect(p.die).toBe('d20');
    expect(p.bonus).toBe('+5');
  });
});

// @vitest-environment happy-dom
// λ.2 — Tests Spell VFX detector.

import { describe, it, expect } from 'vitest';
import { detectSpellSchool } from '../spell-vfx-detector';

describe('detectSpellSchool λ.2', () => {
  it('detecta fogo (fireball/queima)', () => {
    expect(detectSpellSchool('Lyra lança Bola de Fogo')).toBe('has-spell-vfx-fire');
    expect(detectSpellSchool('chamas envolvem o orc')).toBe('has-spell-vfx-fire');
  });

  it('detecta cura', () => {
    expect(detectSpellSchool('Borin é curado e volta')).toBe('has-spell-vfx-heal');
    expect(detectSpellSchool('restaura HP da party')).toBe('has-spell-vfx-heal');
  });

  it('detecta frio/gelo', () => {
    expect(detectSpellSchool('o cone de frio congela tudo')).toBe('has-spell-vfx-cold');
    expect(detectSpellSchool('ice storm cai')).toBe('has-spell-vfx-cold');
  });

  it('detecta divino', () => {
    expect(detectSpellSchool('chama sagrada queima')).toBe('has-spell-vfx-divine');
    expect(detectSpellSchool('bless dá +1d4')).toBe('has-spell-vfx-divine');
  });

  it('detecta arcano', () => {
    expect(detectSpellSchool('lança magic missile')).toBe('has-spell-vfx-arcane');
    expect(detectSpellSchool('shield ergue-se')).toBe('has-spell-vfx-arcane');
  });

  it('null pra narração sem magia', () => {
    expect(detectSpellSchool('Borin avança e ataca o orc com a espada')).toBe(null);
    expect(detectSpellSchool('o guarda anda na ponte')).toBe(null);
  });

  it('prioriza fogo > arcano (ambíguo)', () => {
    // "magic" estaria em arcane mas "fogo" em fire — fire vence (ordem)
    expect(detectSpellSchool('lança magic missile de fogo')).toBe('has-spell-vfx-fire');
  });
});

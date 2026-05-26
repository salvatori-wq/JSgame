// Tests pra 1A — Racial damage profile (PHB cap 2).
// Tiefling resist fogo, Anão resist veneno, Halfling Robusto resist veneno.

import { describe, it, expect } from 'vitest';
import { RACES, getRace, ALL_RACES } from '../races.js';

describe('1A — Racial damage profile', () => {
  it('Tiefling tem defaultResistances=["fogo"]', () => {
    expect(RACES.tiefling.defaultResistances).toEqual(['fogo']);
  });

  it('Anão da Colina tem defaultResistances=["veneno"]', () => {
    expect(RACES['anao-colina'].defaultResistances).toEqual(['veneno']);
  });

  it('Anão da Montanha tem defaultResistances=["veneno"]', () => {
    expect(RACES['anao-montanha'].defaultResistances).toEqual(['veneno']);
  });

  it('Halfling Robusto tem defaultResistances=["veneno"]', () => {
    expect(RACES['halfling-robusto'].defaultResistances).toEqual(['veneno']);
  });

  it('Humano NÃO tem defaultResistances', () => {
    expect(RACES.humano.defaultResistances).toBeUndefined();
  });

  it('Alto Elfo NÃO tem defaultResistances (vant vs encant mas não dano)', () => {
    expect(RACES['alto-elfo'].defaultResistances).toBeUndefined();
  });

  it('Halfling Pés-Leve NÃO tem defaultResistances (só Robusto tem)', () => {
    expect(RACES['halfling-pes-leve'].defaultResistances).toBeUndefined();
  });

  it('Draconato ainda sem default (ancestry dinâmico, TODO próximo passo)', () => {
    // Quando step-race adicionar dropdown ancestry, esse test será atualizado.
    expect(RACES.draconato.defaultResistances).toBeUndefined();
  });

  it('getRace returns same data', () => {
    expect(getRace('tiefling').defaultResistances).toEqual(['fogo']);
  });

  it('nenhuma raça tem defaultImmunities (PHB 5e core)', () => {
    for (const race of ALL_RACES) {
      expect(race.defaultImmunities).toBeUndefined();
    }
  });

  it('nenhuma raça tem defaultVulnerabilities (PHB 5e core)', () => {
    for (const race of ALL_RACES) {
      expect(race.defaultVulnerabilities).toBeUndefined();
    }
  });
});

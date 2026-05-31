// Onda 4 — Tests das camadas adaptativas: curvas de intensidade, step-map,
// completude das configs de mood e API de intensidade.
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { layerLevel, computeLayers, intensityToBrightness } from '../audio/intensity';
import { buildStepMap, RHYTHMS } from '../audio/composer';

describe('intensity — curvas de camadas', () => {
  it('layerLevel: 0 antes do onAt, max a partir do fullAt, clampado', () => {
    expect(layerLevel(0.1, 0.22, 0.52, 0.8)).toBe(0);     // antes
    expect(layerLevel(0.52, 0.22, 0.52, 0.8)).toBeCloseTo(0.8, 5); // no full
    expect(layerLevel(0.9, 0.22, 0.52, 0.8)).toBe(0.8);   // clampa no max
    expect(layerLevel(0.37, 0.22, 0.52, 0.8)).toBeCloseTo(0.4, 5); // meio
  });
  it('computeLayers: drone sempre presente, sobe com intensidade', () => {
    const lo = computeLayers(0);
    const hi = computeLayers(1);
    expect(lo.drone).toBeGreaterThan(0);
    expect(hi.drone).toBeGreaterThan(lo.drone);
  });
  it('computeLayers: ritmo entra na tensão, harmonia só no auge', () => {
    expect(computeLayers(0.1).rhythm).toBe(0);     // exploração calma = sem percussão
    expect(computeLayers(0.6).rhythm).toBeGreaterThan(0);
    expect(computeLayers(0.3).harmony).toBe(0);    // sem organum cedo
    expect(computeLayers(0.9).harmony).toBeGreaterThan(0);
  });
  it('computeLayers: caps reduzem camadas (ex.: rest sem percussão)', () => {
    const capped = computeLayers(0.9, { rhythm: 0 });
    expect(capped.rhythm).toBe(0);
    const half = computeLayers(0.9, { harmony: 0.5 });
    expect(half.harmony).toBeCloseTo(computeLayers(0.9).harmony * 0.5, 5);
  });
  it('intensityToBrightness clampa em [0,1] e é monotônico', () => {
    expect(intensityToBrightness(0)).toBeGreaterThanOrEqual(0);
    expect(intensityToBrightness(1)).toBeLessThanOrEqual(1);
    expect(intensityToBrightness(1)).toBeGreaterThan(intensityToBrightness(0));
  });
});

describe('composer — buildStepMap', () => {
  it('mapa tem length = soma das durações, onsets nas posições certas', () => {
    const map = buildStepMap([
      { degree: 0, durSteps: 2 }, { degree: 4, durSteps: 1 }, { degree: 2, durSteps: 3 },
    ]);
    expect(map.length).toBe(6);
    expect(map[0]).not.toBeNull();   // onset nota 1
    expect(map[1]).toBeNull();       // sustain
    expect(map[2]).not.toBeNull();   // onset nota 2
    expect(map[3]).not.toBeNull();   // onset nota 3
    expect(map[4]).toBeNull();
    expect(map[5]).toBeNull();
  });
  it('lista vazia → mapa vazio', () => {
    expect(buildStepMap([]).length).toBe(0);
  });
});

describe('ambient — configs de mood e API de intensidade', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => '1', setItem: vi.fn(), removeItem: vi.fn() },
      writable: true,
    });
  });

  it('todo mood tocável (exceto victory) tem config válida', async () => {
    const { MOOD_CONFIGS, LISTED_MOODS } = await import('../audio/ambient');
    for (const mood of LISTED_MOODS) {
      if (mood === 'victory') continue;
      const cfg = MOOD_CONFIGS[mood];
      expect(cfg, `config faltando: ${mood}`).toBeDefined();
      expect(RHYTHMS[cfg!.form], `forma inválida: ${cfg!.form}`).toBeDefined();
      expect(typeof cfg!.melody).toBe('function');
      expect(cfg!.baseIntensity).toBeGreaterThanOrEqual(0);
      expect(cfg!.baseIntensity).toBeLessThanOrEqual(1);
      expect(typeof cfg!.seed).toBe('number');
    }
  });
  it('LISTED_MOODS cobre os principais', async () => {
    const { LISTED_MOODS } = await import('../audio/ambient');
    for (const m of ['exploration-calm', 'combat-boss', 'danger-low-hp', 'tavern', 'sacred', 'victory']) {
      expect(LISTED_MOODS).toContain(m);
    }
  });
  it('setAmbientIntensity clampa e getAmbientIntensity reflete', async () => {
    const { setAmbientIntensity, getAmbientIntensity } = await import('../audio/ambient');
    setAmbientIntensity(3); expect(getAmbientIntensity()).toBe(1);
    setAmbientIntensity(-1); expect(getAmbientIntensity()).toBe(0);
    setAmbientIntensity(0.55); expect(getAmbientIntensity()).toBeCloseTo(0.55, 5);
  });
  it('setAmbient não lança pra nenhum mood listado (sem AudioContext)', async () => {
    const { setAmbient, LISTED_MOODS } = await import('../audio/ambient');
    for (const m of [...LISTED_MOODS, 'silence', 'exploration', 'combat'] as const) {
      expect(() => setAmbient(m), `throw em ${m}`).not.toThrow();
    }
  });
});

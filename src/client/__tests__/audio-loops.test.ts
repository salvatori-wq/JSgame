// Tests pra trilha por loops (Fase 2). Cobre a lógica PURA — mapeamento de mood,
// URL, ganho por intensidade, e a flag. A reprodução em si (Web Audio) não roda
// no env node, então fica fora (verificada no preview).

import { describe, it, expect, afterEach } from 'vitest';
import {
  MOOD_TO_LOOP, LOOP_KEYS, loopKeyForMood, loopUrlForKey,
  intensityToLoopGain, isLoopsEnabled, setLoopsEnabled,
  _hasActiveLoop, _resetLoopState,
} from '../audio/loops';
import type { AmbientMood } from '../audio/ambient';

afterEach(() => {
  setLoopsEnabled(false); // não vaza a flag pros outros testes (singleFork)
  _resetLoopState();
});

describe('loops — mapeamento mood → loop', () => {
  it('mapeia os moods de exploração pro mesmo loop', () => {
    expect(loopKeyForMood('exploration-calm')).toBe('exploration');
    expect(loopKeyForMood('travel')).toBe('exploration');
    expect(loopKeyForMood('exploration')).toBe('exploration');
  });

  it('mapeia tensão/perigo, combate, descanso, mistério, taverna', () => {
    expect(loopKeyForMood('exploration-tension')).toBe('tension');
    expect(loopKeyForMood('danger-low-hp')).toBe('tension');
    expect(loopKeyForMood('combat-skirmish')).toBe('combat');
    expect(loopKeyForMood('combat-boss')).toBe('combat');
    expect(loopKeyForMood('rest')).toBe('rest');
    expect(loopKeyForMood('sacred')).toBe('rest');
    expect(loopKeyForMood('mystery')).toBe('mystery');
    expect(loopKeyForMood('shop')).toBe('tavern');
    expect(loopKeyForMood('tavern')).toBe('tavern');
    expect(loopKeyForMood('victory')).toBe('tavern');
  });

  it('mood sem mapeamento → null (silêncio gracioso)', () => {
    expect(loopKeyForMood('silence')).toBeNull();
    expect(loopKeyForMood('mood-inexistente' as AmbientMood)).toBeNull();
  });

  it('todo valor de MOOD_TO_LOOP é uma LOOP_KEY válida (4-6 arquivos)', () => {
    const keys = new Set<string>(LOOP_KEYS);
    for (const v of Object.values(MOOD_TO_LOOP)) {
      expect(keys.has(v)).toBe(true);
    }
    expect(LOOP_KEYS.length).toBeLessThanOrEqual(6);
  });
});

describe('loops — URL e ganho', () => {
  it('loopUrlForKey aponta pra public/audio servido em /audio', () => {
    expect(loopUrlForKey('exploration')).toBe('/audio/exploration.ogg');
    expect(loopUrlForKey('combat')).toBe('/audio/combat.ogg');
  });

  it('intensityToLoopGain é clampeado e monotônico (0.12 → 0.42)', () => {
    expect(intensityToLoopGain(0)).toBeCloseTo(0.12, 5);
    expect(intensityToLoopGain(1)).toBeCloseTo(0.42, 5);
    expect(intensityToLoopGain(-5)).toBeCloseTo(0.12, 5);   // clamp baixo
    expect(intensityToLoopGain(99)).toBeCloseTo(0.42, 5);   // clamp alto
    expect(intensityToLoopGain(0.5)).toBeGreaterThan(intensityToLoopGain(0.2));
  });
});

describe('loops — flag (default OFF)', () => {
  it('setLoopsEnabled faz round-trip em memória', () => {
    setLoopsEnabled(true);
    expect(isLoopsEnabled()).toBe(true);
    setLoopsEnabled(false);
    expect(isLoopsEnabled()).toBe(false);
  });

  it('nenhum loop ativo no estado inicial (sem Web Audio)', () => {
    expect(_hasActiveLoop()).toBe(false);
  });
});

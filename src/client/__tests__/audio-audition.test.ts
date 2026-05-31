// Onda 7 — Tests do harness de audição DEV (window.__audio).
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { installAudioAudition, type AudioAudition } from '../audio/audition';

function api(): AudioAudition {
  return (window as unknown as { __audio: AudioAudition }).__audio;
}

describe('Onda 7 — harness de audição', () => {
  beforeEach(() => { installAudioAudition(); });

  it('instala window.__audio com a API esperada', () => {
    const a = api();
    expect(typeof a.list).toBe('function');
    expect(typeof a.mood).toBe('function');
    expect(typeof a.intensity).toBe('function');
    expect(typeof a.stinger).toBe('function');
    expect(typeof a.inst).toBe('function');
    expect(typeof a.measure).toBe('function');
  });
  it('list() retorna moods + instrumentos', () => {
    const { moods, instruments } = api().list();
    expect(moods).toContain('combat-boss');
    expect(moods).toContain('tavern');
    expect(instruments).toEqual(expect.arrayContaining(['lute', 'shawm', 'tabor', 'churchBell']));
  });
  it('mood/intensity/stinger/inst não lançam sem AudioContext', () => {
    const a = api();
    expect(() => a.mood('combat-skirmish')).not.toThrow();
    expect(() => a.stinger('level-up')).not.toThrow();
    expect(() => a.inst('lute', 440)).not.toThrow();
    expect(() => a.inst('inexistente')).not.toThrow();
    expect(typeof a.intensity(0.5)).toBe('number');
  });
  it('measure() resolve {rms,peak} (0 sem AudioContext)', async () => {
    const m = await api().measure(10);
    expect(m.rms).toBe(0);
    expect(m.peak).toBe(0);
  });
});

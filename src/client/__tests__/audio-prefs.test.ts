// Onda 6 — Tests dos controles de mix do jogador (volume música/efeitos/reverb).
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_PREFS, getUxPrefs, setUxPrefs, _resetCacheForTest } from '../ux-prefs';
import { getMusicVolume, getReverbAmount, _resetMixer } from '../audio/mixer';
import { getSfxVolume } from '../audio';

beforeEach(() => {
  _resetCacheForTest();
  try { localStorage.clear(); } catch { /* */ }
  _resetMixer();
});

describe('Onda 6 — prefs de áudio', () => {
  it('defaults: música/efeitos 1.0, reverb 0.3', () => {
    expect(DEFAULT_PREFS.musicVolume).toBe(1.0);
    expect(DEFAULT_PREFS.sfxVolume).toBe(1.0);
    expect(DEFAULT_PREFS.reverbAmount).toBe(0.3);
  });
  it('setUxPrefs persiste e clampa (música/efeitos 0..1.5, reverb 0..1)', () => {
    expect(setUxPrefs({ musicVolume: 5 }).musicVolume).toBe(1.5);
    expect(setUxPrefs({ sfxVolume: -3 }).sfxVolume).toBe(0);
    expect(setUxPrefs({ reverbAmount: 9 }).reverbAmount).toBe(1);
    expect(setUxPrefs({ reverbAmount: 0.45 }).reverbAmount).toBeCloseTo(0.45, 5);
  });
  it('applyUxPrefs propaga música + reverb pro mixer', () => {
    setUxPrefs({ musicVolume: 0.7, reverbAmount: 0.6 });
    expect(getMusicVolume()).toBeCloseTo(0.7, 5);
    expect(getReverbAmount()).toBeCloseTo(0.6, 5);
  });
  it('applyUxPrefs propaga efeitos pro bus de SFX', () => {
    setUxPrefs({ sfxVolume: 0.85 });
    expect(getSfxVolume()).toBeCloseTo(0.85, 5);
  });
  it('persiste em localStorage entre leituras', () => {
    setUxPrefs({ musicVolume: 0.5 });
    _resetCacheForTest();
    expect(getUxPrefs().musicVolume).toBe(0.5);
  });
});

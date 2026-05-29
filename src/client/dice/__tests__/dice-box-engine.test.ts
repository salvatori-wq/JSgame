// @vitest-environment happy-dom
// Dado físico (@3d-dice/dice-box) — gating + fallback. NÃO testa a física real
// (precisa WebGL/WASM); testa que o wrapper decide certo e cai pro CSS quando deve.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock da lib: o import real puxa BabylonJS (não roda em happy-dom).
vi.mock('@3d-dice/dice-box', () => ({ default: class { init() { return Promise.resolve(); } roll() { return Promise.resolve(); } clear() {} hide() {} show() {} } }));

import { physicalDiceEnabled, rollPhysicalDie, __resetDiceBoxEngineForTest } from '../dice-box-engine';
import { setUxPrefs, _resetCacheForTest } from '../../ux-prefs';

beforeEach(() => {
  __resetDiceBoxEngineForTest();
  _resetCacheForTest();
  try { localStorage.clear(); } catch { /* noop */ }
  document.body.classList.remove('force-motion');
});

describe('physicalDiceEnabled — gating', () => {
  it('default ON quando pref não setada e há force-motion', () => {
    document.body.classList.add('force-motion'); // vence reduced-motion
    expect(physicalDiceEnabled()).toBe(true);
  });

  it('OFF quando pref physicalDice=false', () => {
    document.body.classList.add('force-motion');
    setUxPrefs({ physicalDice: false });
    expect(physicalDiceEnabled()).toBe(false);
  });

  it('OFF em reduced-motion sem force-motion (usa dado CSS leve)', () => {
    // sem force-motion + happy-dom matchMedia default → reduced pode ser false;
    // garantimos via stub que reduced-motion desliga o físico.
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    document.body.classList.remove('force-motion');
    expect(physicalDiceEnabled()).toBe(false);
    spy.mockRestore();
  });
});

describe('rollPhysicalDie — fallback seguro', () => {
  it('resolve false (fallback CSS) quando desabilitado, sem lançar', async () => {
    document.body.classList.add('force-motion');
    setUxPrefs({ physicalDice: false });
    await expect(rollPhysicalDie({ kind: 'd20', final: 15 })).resolves.toBe(false);
  });

  it('resolve false quando WebGL ausente (happy-dom não tem canvas.getContext webgl)', async () => {
    document.body.classList.add('force-motion');
    setUxPrefs({ physicalDice: true });
    // happy-dom getContext('webgl') → null, então hasWebGL()=false → unsupported → false.
    await expect(rollPhysicalDie({ kind: 'd20', final: 15 })).resolves.toBe(false);
  });
});

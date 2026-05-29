// @vitest-environment happy-dom
// Dado físico (@3d-dice/dice-box) — gating + fallback. NÃO testa a física real
// (precisa WebGL/WASM); testa que o wrapper decide certo e cai pro CSS quando deve.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock da lib: o import real puxa BabylonJS (não roda em happy-dom).
vi.mock('@3d-dice/dice-box', () => ({ default: class { init() { return Promise.resolve(); } roll() { return Promise.resolve(); } clear() {} hide() {} show() {} } }));

import { physicalDiceEnabled, rollPhysicalDie, clearPhysicalDice, prewarmPhysicalDice, __resetDiceBoxEngineForTest } from '../dice-box-engine';
import { setUxPrefs, _resetCacheForTest } from '../../ux-prefs';

beforeEach(() => {
  __resetDiceBoxEngineForTest();
  _resetCacheForTest();
  try { localStorage.clear(); } catch { /* noop */ }
  document.body.classList.remove('force-motion');
});

// Higiene: vários testes aqui adicionam body.force-motion mas não removiam
// depois — em singleFork isso VAZAVA pro próximo arquivo (long-rest-ritual
// passava a ver force-motion e não tomava o caminho reduced-motion). Limpa.
afterEach(() => {
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

describe('clearPhysicalDice — D1 (mount não fica órfão acima dos overlays)', () => {
  it('esconde o #dice-box-mount (display:none) ao fechar o overlay', () => {
    const mount = document.createElement('div');
    mount.id = 'dice-box-mount';
    mount.style.display = 'block';
    document.body.appendChild(mount);
    clearPhysicalDice();
    expect(mount.style.display).toBe('none');
    mount.remove();
  });

  it('não lança quando não há mount nem engine inicializada', () => {
    document.getElementById('dice-box-mount')?.remove();
    expect(() => clearPhysicalDice()).not.toThrow();
  });
});

describe('prewarmPhysicalDice — D2 (gated, idle, não lança)', () => {
  // Fake timers: o warm agenda um setTimeout/idle real que, sem isso, vazaria
  // pra outros testes no singleFork (dispara ensureReady tardio). clearAllTimers
  // descarta o agendamento — testamos só o gating + que a chamada não lança.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('no-op sem lançar quando físico off', () => {
    document.body.classList.add('force-motion');
    setUxPrefs({ physicalDice: false });
    expect(() => prewarmPhysicalDice()).not.toThrow();
  });

  it('não lança quando físico on (agenda warm em idle)', () => {
    document.body.classList.add('force-motion');
    setUxPrefs({ physicalDice: true });
    expect(() => prewarmPhysicalDice()).not.toThrow();
  });
});

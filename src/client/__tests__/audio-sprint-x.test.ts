// Sprint X.A1+A2+A3 — Tests pra reforços de audio + page-turn + ambient default ON.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as audio from '../audio';

describe('Sprint X.A1 — playDiceLand 3 camadas (reforço Slay-the-Spire-feel)', () => {
  it('playDiceLand existe e é função', () => {
    expect(typeof audio.playDiceLand).toBe('function');
  });

  it('playDiceLand executa sem throw mesmo sem AudioContext (env vitest sem gesture)', () => {
    expect(() => audio.playDiceLand()).not.toThrow();
  });
});

describe('Sprint X.A3 — playPageTurn SFX no read-aloud', () => {
  it('playPageTurn exportado e callable', () => {
    expect(typeof audio.playPageTurn).toBe('function');
    expect(() => audio.playPageTurn()).not.toThrow();
  });
});

// Fase 0 (estabilização) — música ambiente agora é default OFF (era ON no Sprint
// X). A trilha generativa soava grating no 1º contato; OFF para de fazer o jogo
// soar mal de cara. Quem quiser, liga em Ajustes. Efeitos seguem ON.
describe('Ambient — toggle ON/OFF (default OFF na Fase 0)', () => {
  beforeEach(() => {
    try { localStorage.removeItem('jsgame.ambient.enabled'); } catch { /* */ }
  });
  afterEach(() => {
    try { localStorage.removeItem('jsgame.ambient.enabled'); } catch { /* */ }
  });

  it('isAmbientEnabled() existe e retorna boolean', async () => {
    const ambientModule = await import('../audio/ambient');
    expect(typeof ambientModule.isAmbientEnabled).toBe('function');
    expect(typeof ambientModule.isAmbientEnabled()).toBe('boolean');
  });

  it('toggle: setAmbientEnabled(true/false) persiste e reflete em isAmbientEnabled()', async () => {
    const { setAmbientEnabled, isAmbientEnabled } = await import('../audio/ambient');
    setAmbientEnabled(false);
    expect(isAmbientEnabled()).toBe(false);
    setAmbientEnabled(true);
    expect(isAmbientEnabled()).toBe(true);
    setAmbientEnabled(false); // deixa OFF (default da Fase 0)
    expect(isAmbientEnabled()).toBe(false);
  });
});

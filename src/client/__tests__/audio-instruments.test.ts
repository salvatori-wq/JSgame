// Onda 2 — Tests da orquestra medieval expandida (instruments.ts).
// AudioContext via fake que conta criação de nós (happy-dom não tem Web Audio).
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  lute, vielle, recorder, shawm, psaltery, harp, harpGliss,
  tabor, bodhran, nakers, churchBell, hurdyBuzz,
  graceNote, trill, mordent,
  type InstrumentCtx, type MelodicVoice,
} from '../audio/instruments';

interface Counts { osc: number; buf: number; filter: number; gain: number; }

function makeCtx(): { ic: InstrumentCtx; counts: Counts } {
  const counts: Counts = { osc: 0, buf: 0, filter: 0, gain: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => {
    const n: Record<string, unknown> = {};
    n.connect = vi.fn((t: unknown) => t);
    n.disconnect = vi.fn();
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createOscillator: () => { counts.osc++; const n = node(); n.type = 'sine'; n.frequency = param(); n.start = vi.fn(); n.stop = vi.fn(); return n; },
    createGain: () => { counts.gain++; const n = node(); n.gain = param(); return n; },
    createBiquadFilter: () => { counts.filter++; const n = node(); n.type = 'lowpass'; n.frequency = param(); n.Q = param(); return n; },
    createBufferSource: () => { counts.buf++; const n = node(); n.buffer = null; n.start = vi.fn(); n.stop = vi.fn(); return n; },
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  } as unknown as AudioContext;
  const dest = node() as unknown as AudioNode;
  return { ic: { ctx, dest }, counts };
}

describe('Onda 2 — instrumentos melódicos', () => {
  let env: ReturnType<typeof makeCtx>;
  beforeEach(() => { env = makeCtx(); });

  it('lute: 2 osciladores (corda dupla), sem throw', () => {
    expect(() => lute(env.ic, 220, 0)).not.toThrow();
    expect(env.counts.osc).toBe(2);
    expect(env.counts.filter).toBeGreaterThanOrEqual(1);
  });
  it('vielle: osc + LFO de vibrato, sem throw', () => {
    expect(() => vielle(env.ic, 330, 0)).not.toThrow();
    expect(env.counts.osc).toBeGreaterThanOrEqual(2);
  });
  it('recorder: osc + sopro (bufferSource), sem throw', () => {
    expect(() => recorder(env.ic, 440, 0)).not.toThrow();
    expect(env.counts.osc).toBeGreaterThanOrEqual(1);
    expect(env.counts.buf).toBe(1);
  });
  it('shawm: múltiplos osc (saws + lfo + tremolo) + bandpass', () => {
    expect(() => shawm(env.ic, 262, 0)).not.toThrow();
    expect(env.counts.osc).toBeGreaterThanOrEqual(3);
    expect(env.counts.filter).toBeGreaterThanOrEqual(1);
  });
  it('psaltery: 3 vozes detune', () => {
    expect(() => psaltery(env.ic, 523, 0)).not.toThrow();
    expect(env.counts.osc).toBe(3);
  });
  it('harp: 2 osc (triangle + sine)', () => {
    expect(() => harp(env.ic, 392, 0)).not.toThrow();
    expect(env.counts.osc).toBe(2);
  });
  it('harpGliss([3 notas]): chama harp 3× → 6 osc', () => {
    expect(() => harpGliss(env.ic, [262, 330, 392], 0)).not.toThrow();
    expect(env.counts.osc).toBe(6);
  });
});

describe('Onda 2 — percussão e sino', () => {
  let env: ReturnType<typeof makeCtx>;
  beforeEach(() => { env = makeCtx(); });

  it('tabor: corpo (osc) + thwack (bufferSource)', () => {
    expect(() => tabor(env.ic, 0)).not.toThrow();
    expect(env.counts.osc).toBeGreaterThanOrEqual(1);
    expect(env.counts.buf).toBeGreaterThanOrEqual(1);
  });
  it('bodhran: corpo + ruído, tone afeta sem throw', () => {
    expect(() => bodhran(env.ic, 0, 0.35, 0)).not.toThrow();
    expect(() => bodhran(env.ic, 0.5, 0.35, 1)).not.toThrow();
    expect(env.counts.buf).toBeGreaterThanOrEqual(1);
  });
  it('nakers: 3 parciais (osc) afinados', () => {
    expect(() => nakers(env.ic, 147, 0)).not.toThrow();
    expect(env.counts.osc).toBe(3);
  });
  it('churchBell: 7 parciais inarmônicos + clique de badalo', () => {
    expect(() => churchBell(env.ic, 196, 0)).not.toThrow();
    expect(env.counts.osc).toBe(7);
    expect(env.counts.buf).toBe(1); // clique do badalo (drumHat)
  });
  it('hurdyBuzz: transiente de ruído (bufferSource + bandpass)', () => {
    expect(() => hurdyBuzz(env.ic, 0)).not.toThrow();
    expect(env.counts.buf).toBe(1);
    expect(env.counts.filter).toBe(1);
  });
});

describe('Onda 2 — ornamentos (operam sobre qualquer MelodicVoice)', () => {
  let env: ReturnType<typeof makeCtx>;
  beforeEach(() => { env = makeCtx(); });

  it('graceNote: 2 chamadas (apojatura curta + nota principal)', () => {
    const voice = vi.fn() as unknown as MelodicVoice;
    graceNote(voice, env.ic, 440, 392, 0, 0.6, 0.16);
    expect(voice).toHaveBeenCalledTimes(2);
    // 1ª = grace curtíssima
    expect((voice as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![3]).toBeLessThan(0.1);
  });
  it('trill: alterna 2 notas várias vezes na duração', () => {
    const calls: number[] = [];
    const voice: MelodicVoice = (_ic, freq) => { calls.push(freq); };
    trill(voice, env.ic, 440, 494, 0, 0.6, 0.14, 0.07);
    expect(calls.length).toBeGreaterThanOrEqual(6);
    expect(calls[0]).toBe(440);
    expect(calls[1]).toBe(494); // alternou
  });
  it('mordent: 3 chamadas (principal → auxiliar → principal)', () => {
    const calls: number[] = [];
    const voice: MelodicVoice = (_ic, freq) => { calls.push(freq); };
    mordent(voice, env.ic, 392, 440, 0, 0.5, 0.15);
    expect(calls).toEqual([392, 440, 392]);
  });
});

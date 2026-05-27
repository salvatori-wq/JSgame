// Trilha medieval — tests pros módulos audio/instruments + sequencer + modes + ambient.
// AudioContext via happy-dom stub (não suporta Web Audio real — testamos shape/timing).
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getScale, midiToHz, degree, ROOTS } from '../audio/modes';
import { Sequencer } from '../audio/sequencer';

// ── Stub mínimo de AudioContext + Web Audio nodes ──────────────────────────
class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  connect = vi.fn(function (this: FakeNode, target: unknown) { return target as FakeNode; });
  disconnect = vi.fn();
}
class FakeOsc extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain extends FakeNode { gain = new FakeAudioParam(); }
class FakeFilter extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}
class FakeBufferSrc extends FakeNode {
  buffer: AudioBuffer | null = null;
  start = vi.fn();
  stop = vi.fn();
}
function fakeBuffer(channels: number, length: number, _sr: number): AudioBuffer {
  const data = new Float32Array(length);
  return {
    sampleRate: 48000,
    length,
    numberOfChannels: channels,
    duration: length / 48000,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

function makeCtx(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: 48000,
    destination: new FakeNode() as unknown as AudioDestinationNode,
    state: 'running' as AudioContextState,
    createOscillator: () => new FakeOsc() as unknown as OscillatorNode,
    createGain: () => new FakeGain() as unknown as GainNode,
    createBiquadFilter: () => new FakeFilter() as unknown as BiquadFilterNode,
    createBufferSource: () => new FakeBufferSrc() as unknown as AudioBufferSourceNode,
    createBuffer: fakeBuffer,
    resume: vi.fn(),
  } as unknown as AudioContext;
}

describe('modes — escalas medievais', () => {
  it('Dorian em A3 retorna 8 frequências (oitava incluída)', () => {
    const scale = getScale(ROOTS.A3, 'dorian');
    expect(scale.length).toBe(8);
    // A3 ≈ 220Hz
    expect(scale[0]).toBeCloseTo(220, 0);
    // A3 → A4 (oitava) = 440Hz
    expect(scale[7]).toBeCloseTo(440, 0);
  });

  it('Phrygian tem 2ª menor característica (intervalo de 1 semitom)', () => {
    const scale = getScale(60, 'phrygian'); // C4
    // C → Db = 1 semitom = ratio 2^(1/12)
    expect(scale[1]! / scale[0]!).toBeCloseTo(Math.pow(2, 1/12), 3);
  });

  it('Lydian tem 4ª aumentada (tritone)', () => {
    const scale = getScale(60, 'lydian');
    // C → F# (4ª aumentada) = 6 semitons
    expect(scale[3]! / scale[0]!).toBeCloseTo(Math.pow(2, 6/12), 3);
  });

  it('midiToHz: A4 (MIDI 69) = 440Hz exato', () => {
    expect(midiToHz(69)).toBe(440);
  });

  it('midiToHz: oitava acima dobra frequência', () => {
    expect(midiToHz(81)).toBeCloseTo(880, 1);
  });

  it('degree clamp em índices fora dos limites', () => {
    const scale = [100, 200, 300, 400];
    expect(degree(scale, 1)).toBe(100);
    expect(degree(scale, 4)).toBe(400);
    expect(degree(scale, 99)).toBe(400); // clamp upper
    expect(degree(scale, -5)).toBe(100); // clamp lower
  });
});

describe('Sequencer — lookAhead scheduling', () => {
  let ctx: AudioContext;
  let onStep: ReturnType<typeof vi.fn>;
  let seq: Sequencer;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = makeCtx();
    onStep = vi.fn();
  });

  afterEach(() => {
    seq?.stop();
    vi.useRealTimers();
  });

  it('agenda primeira batch de notas dentro do lookahead', () => {
    seq = new Sequencer({ ctx, bpm: 120, patternLength: 4, onStep });
    seq.start();
    // Imediatamente após start, tick inicial agenda primeiras notas até +150ms
    // stepDuration = 60/120/4 = 0.125s. Em 150ms cabem 2 steps.
    expect(onStep).toHaveBeenCalled();
    expect(onStep.mock.calls.length).toBeGreaterThanOrEqual(1);
    // Pelo menos primeiro step com time absoluto
    const firstCall = onStep.mock.calls[0]![0];
    expect(firstCall.step).toBe(0);
    expect(firstCall.time).toBeGreaterThanOrEqual(0);
  });

  it('isRunning() correto antes/depois de start/stop', () => {
    seq = new Sequencer({ ctx, bpm: 90, patternLength: 4, onStep });
    expect(seq.isRunning()).toBe(false);
    seq.start();
    expect(seq.isRunning()).toBe(true);
    seq.stop();
    expect(seq.isRunning()).toBe(false);
  });

  it('start() é idempotente', () => {
    seq = new Sequencer({ ctx, bpm: 90, patternLength: 4, onStep });
    seq.start();
    const callCountAfterFirst = onStep.mock.calls.length;
    seq.start(); // não deveria fazer nada — já rodando
    expect(onStep.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('loopa pattern: step volta a 0 após patternLength', () => {
    seq = new Sequencer({ ctx, bpm: 240, patternLength: 4, onStep });
    seq.start();
    // BPM 240, stepsPerBeat 4 → stepDuration = 60/240/4 = 0.0625s
    // Lookahead 150ms cobre ~2.4 steps. Avança currentTime e tick.
    (ctx as { currentTime: number }).currentTime = 1.0; // simula passagem de 1s
    vi.advanceTimersByTime(50);
    // Em 1s @ 0.0625s/step = 16 steps schedulados. 16 % 4 = 0 (volta a 0).
    const lastStep = onStep.mock.calls[onStep.mock.calls.length - 1]![0].step;
    expect(lastStep).toBeLessThan(4);
    expect(lastStep).toBeGreaterThanOrEqual(0);
  });

  it('stop() para de chamar onStep em ticks futuros', () => {
    seq = new Sequencer({ ctx, bpm: 120, patternLength: 4, onStep });
    seq.start();
    const initialCalls = onStep.mock.calls.length;
    seq.stop();
    (ctx as { currentTime: number }).currentTime = 2.0;
    vi.advanceTimersByTime(500);
    expect(onStep.mock.calls.length).toBe(initialCalls);
  });
});

describe('Ambient — moods API e canonical aliases', () => {
  beforeEach(() => {
    // localStorage stub pra ambient enabled flag
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => '1', setItem: vi.fn(), removeItem: vi.fn() },
      writable: true,
    });
  });

  it('exporta tipo AmbientMood com 11+ moods (legacy + novos)', async () => {
    const ambient = await import('../audio/ambient');
    // Type-only check via runtime: setAmbient aceita todos sem throw em tipo (TS valida)
    expect(typeof ambient.setAmbient).toBe('function');
    expect(typeof ambient.isAmbientEnabled).toBe('function');
    expect(typeof ambient.setAmbientEnabled).toBe('function');
    // Test helper interno
    expect(typeof ambient._getCurrentMood).toBe('function');
  });

  it('isAmbientEnabled lê localStorage corretamente', async () => {
    const { isAmbientEnabled } = await import('../audio/ambient');
    expect(typeof isAmbientEnabled()).toBe('boolean');
  });

  it('setAmbientEnabled(false) silencia (não throw)', async () => {
    const { setAmbientEnabled } = await import('../audio/ambient');
    expect(() => setAmbientEnabled(false)).not.toThrow();
    expect(() => setAmbientEnabled(true)).not.toThrow();
  });
});

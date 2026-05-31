// Onda 1 — Tests pra teoria musical (puro) + mixer (reverb IR + compressor).
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  noteToMidi, midiToNote, transpose, organum, harmonize, openFifth,
  cadenceTargetDegree, cadenceDegrees, isStableDegree, makeRng, weightedNextDegree,
} from '../audio/theory';

// ── Fake AudioContext compartilhado (suporta convolver + compressor) ──────────
const h = vi.hoisted(() => {
  class FakeParam {
    value: number;
    constructor(v = 0) { this.value = v; }
    setValueAtTime = vi.fn();
    linearRampToValueAtTime = vi.fn();
    exponentialRampToValueAtTime = vi.fn();
    cancelScheduledValues = vi.fn();
  }
  class FakeNode {
    connect = vi.fn(function (this: FakeNode, t: unknown) { return t; });
    disconnect = vi.fn();
  }
  class FakeGain extends FakeNode { gain = new FakeParam(1); }
  class FakeConvolver extends FakeNode { normalize = false; buffer: unknown = null; }
  class FakeComp extends FakeNode {
    threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam();
    attack = new FakeParam(); release = new FakeParam();
  }
  class FakeFilter extends FakeNode {
    type = 'lowpass'; frequency = new FakeParam(14000); Q = new FakeParam(0.7);
  }
  function makeCtx(opts: { convolver?: boolean; comp?: boolean; filter?: boolean } = {}): AudioContext {
    const withConv = opts.convolver ?? true;
    const withComp = opts.comp ?? true;
    const withFilter = opts.filter ?? true;
    const ctx: Record<string, unknown> = {
      currentTime: 0,
      sampleRate: 48000,
      destination: new FakeNode(),
      state: 'running',
      createGain: () => new FakeGain(),
      createBuffer: (channels: number, length: number, sr: number) => {
        const chans: Float32Array[] = [];
        for (let i = 0; i < channels; i++) chans.push(new Float32Array(length));
        return {
          numberOfChannels: channels, length, sampleRate: sr,
          duration: length / sr,
          getChannelData: (c: number) => chans[c]!,
        };
      },
    };
    if (withConv) ctx.createConvolver = () => new FakeConvolver();
    if (withComp) ctx.createDynamicsCompressor = () => new FakeComp();
    if (withFilter) ctx.createBiquadFilter = () => new FakeFilter();
    return ctx as unknown as AudioContext;
  }
  const ctx = makeCtx();
  const master = new FakeGain();
  return { makeCtx, ctx: { value: ctx }, master };
});

vi.mock('../audio', () => ({
  _getAudioCtx: () => h.ctx.value,
  _getMasterGain: () => h.master,
}));

import {
  ensureMixer, getMusicInput, setReverbKind, getReverbKind, setReverbAmount,
  getReverbAmount, setMusicVolume, getMusicVolume, setMusicBrightness,
  getMusicBrightness, buildImpulseResponse, _getMixer, _resetMixer,
} from '../audio/mixer';

// ════════════════════════════════════════════════════════════════════════════
describe('theory — nome ↔ MIDI', () => {
  it('noteToMidi convenção C4=60', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('A3')).toBe(57);
  });
  it('noteToMidi com acidentes', () => {
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('Db4')).toBe(61);
  });
  it('noteToMidi inválido throwa', () => {
    expect(() => noteToMidi('H9')).toThrow();
    expect(() => noteToMidi('xyz')).toThrow();
  });
  it('midiToNote inverte', () => {
    expect(midiToNote(60)).toBe('C4');
    expect(midiToNote(57)).toBe('A3');
    expect(midiToNote(69)).toBe('A4');
  });
  it('round-trip note→midi→note', () => {
    for (const n of ['C4', 'E3', 'G5', 'A2']) {
      expect(midiToNote(noteToMidi(n))).toBe(n);
    }
  });
  it('transpose soma semitons', () => {
    expect(transpose(60, 7)).toBe(67);
    expect(transpose(60, -12)).toBe(48);
  });
});

describe('theory — organum e drones', () => {
  it('organum fifth = ratio 2^(7/12)', () => {
    expect(organum(440, 'fifth') / 440).toBeCloseTo(Math.pow(2, 7 / 12), 4);
  });
  it('organum octave dobra', () => {
    expect(organum(440, 'octave')).toBeCloseTo(880, 1);
  });
  it('organum unison mantém', () => {
    expect(organum(440, 'unison')).toBe(440);
  });
  it('harmonize aplica em lista', () => {
    const out = harmonize([100, 200], 'octave');
    expect(out[0]).toBeCloseTo(200, 1);
    expect(out[1]).toBeCloseTo(400, 1);
  });
  it('openFifth retorna [root, 5ª]', () => {
    const [root, fifth] = openFifth(57); // A3 = 220
    expect(root).toBeCloseTo(220, 0);
    expect(fifth / root).toBeCloseTo(Math.pow(2, 7 / 12), 3);
  });
});

describe('theory — cadências e graus estáveis', () => {
  it('clos resolve na tônica, ouvert abre na 5ª', () => {
    expect(cadenceTargetDegree('clos')).toBe(0);
    expect(cadenceTargetDegree('ouvert')).toBe(4);
  });
  it('cadenceDegrees retorna par de 2', () => {
    expect(cadenceDegrees('clos')).toEqual([1, 0]);
    expect(cadenceDegrees('ouvert')).toEqual([3, 4]);
  });
  it('isStableDegree: tônica/3ª/5ª/oitava estáveis', () => {
    expect(isStableDegree(0)).toBe(true);  // tônica
    expect(isStableDegree(2)).toBe(true);  // 3ª
    expect(isStableDegree(4)).toBe(true);  // 5ª
    expect(isStableDegree(7)).toBe(true);  // oitava (dobra → tônica)
    expect(isStableDegree(1)).toBe(false);
    expect(isStableDegree(3)).toBe(false);
    expect(isStableDegree(5)).toBe(false);
  });
});

describe('theory — RNG seedável', () => {
  it('mesmo seed → mesma sequência', () => {
    const a = makeRng(42); const b = makeRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
  it('seeds diferentes divergem', () => {
    const a = makeRng(1); const b = makeRng(2);
    expect(a()).not.toBe(b());
  });
  it('saída em [0,1)', () => {
    const r = makeRng(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('theory — walk modal ponderado', () => {
  it('sempre retorna índice em [0, scaleLen)', () => {
    const r = makeRng(7);
    let cur = 0;
    for (let i = 0; i < 500; i++) {
      cur = weightedNextDegree(cur, 8, r);
      expect(cur).toBeGreaterThanOrEqual(0);
      expect(cur).toBeLessThan(8);
    }
  });
  it('determinístico com seed', () => {
    const r1 = makeRng(99); const r2 = makeRng(99);
    const seq1: number[] = []; const seq2: number[] = [];
    let c1 = 3; let c2 = 3;
    for (let i = 0; i < 30; i++) {
      c1 = weightedNextDegree(c1, 8, r1); seq1.push(c1);
      c2 = weightedNextDegree(c2, 8, r2); seq2.push(c2);
    }
    expect(seq1).toEqual(seq2);
  });
  it('viés stepwise: passo médio pequeno (< 2.2 graus)', () => {
    const r = makeRng(2024);
    let cur = 4;
    let sumStep = 0; const N = 2000;
    for (let i = 0; i < N; i++) {
      const next = weightedNextDegree(cur, 8, r);
      sumStep += Math.abs(next - cur);
      cur = next;
    }
    expect(sumStep / N).toBeLessThan(2.2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('mixer — Impulse Response procedural', () => {
  it('gera buffer estéreo com length = sr*dur', () => {
    const ir = buildImpulseResponse(h.ctx.value, 'hall');
    expect(ir.numberOfChannels).toBe(2);
    expect(ir.length).toBe(Math.floor(48000 * 1.8));
  });
  it('IR determinística (mesmo kind → mesmas amostras)', () => {
    const a = buildImpulseResponse(h.ctx.value, 'cave');
    const b = buildImpulseResponse(h.ctx.value, 'cave');
    expect(a.getChannelData(0)[500]).toBe(b.getChannelData(0)[500]);
    expect(a.getChannelData(1)[1000]).toBe(b.getChannelData(1)[1000]);
  });
  it('canais L/R descorrelacionados (largura estéreo)', () => {
    const ir = buildImpulseResponse(h.ctx.value, 'cathedral');
    expect(ir.getChannelData(0)[800]).not.toBe(ir.getChannelData(1)[800]);
  });
  it('kinds diferentes → durações diferentes', () => {
    const tavern = buildImpulseResponse(h.ctx.value, 'tavern');
    const cathedral = buildImpulseResponse(h.ctx.value, 'cathedral');
    expect(cathedral.length).toBeGreaterThan(tavern.length);
  });
});

describe('mixer — grafo e controles', () => {
  beforeEach(() => {
    _resetMixer();
    h.ctx.value = h.makeCtx();
  });

  it('ensureMixer monta o grafo (input + convolver + comp + toneFilter)', () => {
    expect(ensureMixer()).toBe(true);
    const m = _getMixer();
    expect(m).not.toBeNull();
    expect(m!.convolver).not.toBeNull();
    expect(m!.comp).not.toBeNull();
    expect(m!.toneFilter).not.toBeNull();
  });
  it('getMusicInput retorna o nó de entrada', () => {
    const input = getMusicInput();
    expect(input).not.toBeNull();
    expect(input).toBe(_getMixer()!.input);
  });
  it('ensureMixer é idempotente', () => {
    ensureMixer();
    const first = _getMixer();
    ensureMixer();
    expect(_getMixer()).toBe(first);
  });
  it('setReverbAmount clampa 0..1', () => {
    setReverbAmount(2); expect(getReverbAmount()).toBe(1);
    setReverbAmount(-1); expect(getReverbAmount()).toBe(0);
    setReverbAmount(0.5); expect(getReverbAmount()).toBe(0.5);
  });
  it('setMusicVolume clampa 0..1.5', () => {
    setMusicVolume(9); expect(getMusicVolume()).toBe(1.5);
    setMusicVolume(-3); expect(getMusicVolume()).toBe(0);
    setMusicVolume(0.8); expect(getMusicVolume()).toBe(0.8);
  });
  it('setReverbKind troca sem throw', () => {
    ensureMixer();
    expect(() => setReverbKind('cathedral')).not.toThrow();
    expect(getReverbKind()).toBe('cathedral');
  });
  it('setMusicBrightness clampa 0..1', () => {
    ensureMixer();
    setMusicBrightness(5); expect(getMusicBrightness()).toBe(1);
    setMusicBrightness(-2); expect(getMusicBrightness()).toBe(0);
    setMusicBrightness(0.4); expect(getMusicBrightness()).toBeCloseTo(0.4, 5);
    expect(() => setMusicBrightness(0.7)).not.toThrow();
  });

  it('browser sem ConvolverNode → música seca (convolver null), ainda monta', () => {
    _resetMixer();
    h.ctx.value = h.makeCtx({ convolver: false });
    expect(ensureMixer()).toBe(true);
    expect(_getMixer()!.convolver).toBeNull();
  });
  it('browser sem BiquadFilter → sem toneFilter, ainda monta', () => {
    _resetMixer();
    h.ctx.value = h.makeCtx({ filter: false });
    expect(ensureMixer()).toBe(true);
    expect(_getMixer()!.toneFilter).toBeNull();
  });
});

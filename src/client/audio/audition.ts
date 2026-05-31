// Trilha Medieval — Harness de audição DEV-only (Onda 7).
// Instala window.__audio pro João (e pro QA no preview) AUDICIONAR cada mood,
// instrumento e stinger sem precisar jogar, e MEDIR o sinal via AnalyserNode
// (prova objetiva de que há som, sem clipping). Gated por import.meta.env.DEV
// no main.ts → zero custo em produção.

import { _getAudioCtx, _getMasterGain } from '../audio';
import {
  setAmbient, setAmbientIntensity, getAmbientIntensity, playStinger,
  LISTED_MOODS, type AmbientMood, type StingerKind,
} from './ambient';
import {
  lute, vielle, recorder, shawm, psaltery, harp, churchBell, tabor, nakers,
  type MelodicVoice,
} from './instruments';

const INSTRUMENTS: Record<string, MelodicVoice> = {
  lute, vielle, recorder, shawm, psaltery, harp, churchBell,
  // percussão tem assinatura própria — wrappers pra audição:
  tabor: (ic, _f, t, _d, g) => tabor(ic, t, g ?? 0.4),
  nakers: (ic, f, t, _d, g) => nakers(ic, f, t, g ?? 0.4),
};

let analyser: AnalyserNode | null = null;
function ensureAnalyser(): AnalyserNode | null {
  if (analyser) return analyser;
  const ctx = _getAudioCtx();
  const master = _getMasterGain();
  if (!ctx || !master || typeof ctx.createAnalyser !== 'function') return null;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(analyser); // tap paralelo — analyser lê o sinal sem afetar a saída
  return analyser;
}

export interface AudioAudition {
  list(): { moods: AmbientMood[]; instruments: string[] };
  resume(): Promise<void>;
  mood(name: AmbientMood): void;
  intensity(x: number): number;
  stinger(kind: StingerKind): void;
  inst(name: string, freq?: number): void;
  measure(ms?: number): Promise<{ rms: number; peak: number }>;
  instNames: string[];
}

/** Mede RMS + pico do master por `ms` (prova de sinal sem clipping). Usa timers
 *  (não rAF — rAF pausa em aba não-visível/headless). Amostra ≥1 vez garantido. */
function measure(ms: number): Promise<{ rms: number; peak: number }> {
  return new Promise((resolve) => {
    const a = ensureAnalyser();
    if (!a) { resolve({ rms: 0, peak: 0 }); return; }
    const buf = new Float32Array(a.fftSize);
    let peak = 0; let sumSq = 0; let n = 0;
    const sample = (): void => {
      a.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]!);
        if (v > peak) peak = v;
        sumSq += buf[i]! * buf[i]!;
        n++;
      }
    };
    const interval = setInterval(sample, 50);
    setTimeout(() => {
      clearInterval(interval);
      sample(); // amostra final garantida mesmo se o interval foi throttled
      resolve({ rms: Math.sqrt(sumSq / Math.max(1, n)), peak });
    }, ms);
  });
}

export function installAudioAudition(): void {
  if (typeof window === 'undefined') return;
  const api: AudioAudition = {
    instNames: Object.keys(INSTRUMENTS),
    list: () => ({ moods: LISTED_MOODS, instruments: Object.keys(INSTRUMENTS) }),
    resume: async () => {
      const ctx = _getAudioCtx();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
    },
    mood: (name) => setAmbient(name),
    intensity: (x) => { setAmbientIntensity(x); return getAmbientIntensity(); },
    stinger: (kind) => playStinger(kind),
    inst: (name, freq = 330) => {
      const ctx = _getAudioCtx();
      const master = _getMasterGain();
      const voice = INSTRUMENTS[name];
      if (!ctx || !master || !voice) return;
      const g = ctx.createGain();
      g.gain.value = 0.8;
      g.connect(master);
      voice({ ctx, dest: g }, freq, ctx.currentTime + 0.01, 1.2, 0.2);
      setTimeout(() => { try { g.disconnect(); } catch { /* */ } }, 3000);
    },
    measure: (ms = 400) => measure(ms),
  };
  (window as unknown as { __audio: AudioAudition }).__audio = api;
}

// Trilha Medieval — Mixer de música (reverb de salão + compressor de cola).
// A música ambiente roteia por aqui ANTES de chegar ao masterGain do audio.ts.
// Sinal: [stems] → input → (dry ∥ convolver→wet) → mixSum → comp → musicVol → master.
// SFX continuam diretos no masterGain (punch seco, sem reverb).
//
// Reverb via ConvolverNode com Impulse Response gerada proceduralmente (ruído com
// decay colorido) — zero asset, zero fetch. 4 salões: hall/cave/tavern/cathedral.
// Tudo guardado atrás de feature-detection: browser sem ConvolverNode → música seca.

import { _getAudioCtx, _getMasterGain } from '../audio';
import { makeRng } from './theory';

export type ReverbKind = 'hall' | 'cave' | 'tavern' | 'cathedral' | 'dry';

interface ReverbProfile {
  /** Duração da cauda em segundos. */
  dur: number;
  /** Expoente do decay — maior = decai mais rápido. */
  decay: number;
  /** Damping do one-pole lowpass (0..1) — perto de 1 = mais brilhante. */
  damp: number;
  /** Pré-delay em ms (early reflection). */
  preDelay: number;
}

const PROFILES: Record<ReverbKind, ReverbProfile> = {
  // Salão de pedra de tamanho médio — o default acolhedor.
  hall:      { dur: 1.8, decay: 2.6, damp: 0.55, preDelay: 12 },
  // Caverna — cauda longa, escura, com eco discreto.
  cave:      { dur: 2.8, decay: 1.9, damp: 0.38, preDelay: 28 },
  // Taverna — curta, amadeirada, seca.
  tavern:    { dur: 0.55, decay: 5.2, damp: 0.8,  preDelay: 6 },
  // Catedral — cauda enorme, brilhante, sagrada.
  cathedral: { dur: 3.6, decay: 1.4, damp: 0.72, preDelay: 22 },
  // Praticamente seco (quase sem reverb).
  dry:       { dur: 0.08, decay: 8,  damp: 1,    preDelay: 0 },
};

const KIND_SEED: Record<ReverbKind, number> = {
  hall: 0x4a11, cave: 0xca7e, tavern: 0x7a73, cathedral: 0xca7d, dry: 0x0001,
};

interface MusicMixer {
  input: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  convolver: ConvolverNode | null;
  mixSum: GainNode;
  toneFilter: BiquadFilterNode | null;
  comp: DynamicsCompressorNode | null;
  musicVol: GainNode;
}

let mixer: MusicMixer | null = null;
let currentReverb: ReverbKind = 'hall';
let reverbAmount = 0.3;     // nível do envio wet (0..1)
let musicVolume = 1.0;      // controle do jogador (Onda 6)
let musicBrightness = 1.0;  // botão de energia (Onda 5 dirige via intensidade)
const irCache = new Map<ReverbKind, AudioBuffer>();

/** Brilho 0..1 → cutoff do lowpass mestre (escala log perceptual, 1.8k..14kHz). */
function brightnessToCutoff(b: number): number {
  const lo = 1800, hi = 14000;
  const t = Math.max(0, Math.min(1, b));
  return lo * Math.pow(hi / lo, t);
}

/**
 * Gera uma Impulse Response procedural (ruído estéreo com decay colorido + early
 * reflection). Determinística por `kind` (seed fixo) → testável e estável.
 */
export function buildImpulseResponse(ctx: AudioContext, kind: ReverbKind): AudioBuffer {
  const p = PROFILES[kind];
  const sr = ctx.sampleRate || 48000;
  const length = Math.max(1, Math.floor(sr * p.dur));
  const buffer = ctx.createBuffer(2, length, sr);
  const preDelaySamples = Math.floor((p.preDelay / 1000) * sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    // Seed levemente diferente por canal → estéreo descorrelacionado (largura).
    const rng = makeRng(KIND_SEED[kind] + ch * 0x9e37);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, p.decay);
      const white = rng() * 2 - 1;
      // One-pole lowpass → escurece a cauda (salão de pedra absorve agudos).
      lp += (white - lp) * p.damp;
      let s = lp * env;
      // Early reflection discreta no pré-delay (presença do salão).
      if (preDelaySamples > 0 && i > preDelaySamples && i < preDelaySamples + 64) {
        s += (rng() * 2 - 1) * 0.5 * Math.pow(1 - (i - preDelaySamples) / 64, 2);
      }
      data[i] = s;
    }
  }
  return buffer;
}

function getIR(ctx: AudioContext, kind: ReverbKind): AudioBuffer {
  let ir = irCache.get(kind);
  if (!ir) {
    ir = buildImpulseResponse(ctx, kind);
    irCache.set(kind, ir);
  }
  return ir;
}

/** Constrói o grafo do mixer de música (idempotente). Retorna true se pronto. */
export function ensureMixer(): boolean {
  if (mixer) return true;
  const ctx = _getAudioCtx();
  const master = _getMasterGain();
  if (!ctx || !master) return false;

  const input = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const mixSum = ctx.createGain();
  const musicVol = ctx.createGain();

  dryGain.gain.value = 1;
  wetGain.gain.value = reverbAmount;
  mixSum.gain.value = 1;
  musicVol.gain.value = musicVolume;

  // Caminho seco.
  input.connect(dryGain).connect(mixSum);

  // Caminho molhado (reverb) — só se ConvolverNode existir.
  let convolver: ConvolverNode | null = null;
  if (typeof ctx.createConvolver === 'function') {
    try {
      convolver = ctx.createConvolver();
      convolver.normalize = true;
      convolver.buffer = getIR(ctx, currentReverb);
      input.connect(convolver).connect(wetGain).connect(mixSum);
    } catch {
      convolver = null;
    }
  }

  // Filtro de brilho mestre (lowpass) — "botão de energia" barato: música fica
  // abafada/distante em baixa intensidade e brilhante/presente no auge (pesquisa
  // adaptive §5). A intensidade do gameplay (Onda 5) dirige setMusicBrightness().
  let toneFilter: BiquadFilterNode | null = null;
  if (typeof ctx.createBiquadFilter === 'function') {
    try {
      toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = brightnessToCutoff(musicBrightness);
      toneFilter.Q.value = 0.7;
    } catch { toneFilter = null; }
  }

  // Compressor de cola na música (gentil) — só se existir.
  let comp: DynamicsCompressorNode | null = null;
  if (typeof ctx.createDynamicsCompressor === 'function') {
    try {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 2.5;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
    } catch { comp = null; }
  }

  // Encadeia: mixSum → [toneFilter] → [comp] → musicVol → master.
  let node: AudioNode = mixSum;
  if (toneFilter) { node.connect(toneFilter); node = toneFilter; }
  if (comp) { node.connect(comp); node = comp; }
  node.connect(musicVol);
  musicVol.connect(master);

  mixer = { input, dryGain, wetGain, convolver, mixSum, toneFilter, comp, musicVol };
  return true;
}

/** Nó onde a música conecta. Null se não há AudioContext (caller cai no master). */
export function getMusicInput(): AudioNode | null {
  if (!ensureMixer()) return null;
  return mixer!.input;
}

/** Troca o salão de reverb (swap do buffer do convolver). */
export function setReverbKind(kind: ReverbKind): void {
  currentReverb = kind;
  if (!mixer || !mixer.convolver) return;
  const ctx = _getAudioCtx();
  if (!ctx) return;
  try { mixer.convolver.buffer = getIR(ctx, kind); } catch { /* */ }
}

export function getReverbKind(): ReverbKind { return currentReverb; }

/** Nível do envio de reverb (0..1). */
export function setReverbAmount(amt: number): void {
  reverbAmount = Math.max(0, Math.min(1, amt));
  if (mixer) {
    const ctx = _getAudioCtx();
    const now = ctx ? ctx.currentTime : 0;
    mixer.wetGain.gain.setValueAtTime(reverbAmount, now);
  }
}

export function getReverbAmount(): number { return reverbAmount; }

/** Volume mestre da música (0..1.5) — controle do jogador. */
export function setMusicVolume(v: number): void {
  musicVolume = Math.max(0, Math.min(1.5, v));
  if (mixer) {
    const ctx = _getAudioCtx();
    const now = ctx ? ctx.currentTime : 0;
    mixer.musicVol.gain.setValueAtTime(musicVolume, now);
  }
}

export function getMusicVolume(): number { return musicVolume; }

/** Brilho da música 0..1 (lowpass mestre). 1 = brilhante/presente, 0 = abafado/distante. */
export function setMusicBrightness(b: number): void {
  musicBrightness = Math.max(0, Math.min(1, b));
  if (mixer && mixer.toneFilter) {
    const ctx = _getAudioCtx();
    const now = ctx ? ctx.currentTime : 0;
    const p = mixer.toneFilter.frequency;
    const target = brightnessToCutoff(musicBrightness);
    try {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(target, now + 0.4);
    } catch {
      p.value = target;
    }
  }
}

export function getMusicBrightness(): number { return musicBrightness; }

// ── Test helpers ─────────────────────────────────────────────────────────────
export function _getMixer(): MusicMixer | null { return mixer; }
export function _resetMixer(): void {
  mixer = null;
  irCache.clear();
  currentReverb = 'hall';
  reverbAmount = 0.3;
  musicVolume = 1.0;
  musicBrightness = 1.0;
}

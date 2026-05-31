// Trilha Medieval — Teoria musical (puro, sem AudioContext).
// Estende modes.ts com: nome↔MIDI, transposição, organum (4ªs/5ªs paralelas),
// cadências ouvert/clos, graus estáveis, walk modal ponderado e RNG seedável.
// Tudo função pura → 100% testável sem Web Audio.

import { midiToHz, type Mode } from './modes';

// ── Nome de nota ↔ MIDI ──────────────────────────────────────────────────────
// Convenção: C4 = MIDI 60, A4 = 69 (consistente com ROOTS em modes.ts).

const PITCH_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 'A3' → 57, 'C#4' → 61, 'Bb3' → 58. Aceita # e b. */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Nota inválida: ${name}`);
  const letter = m[1]!.toUpperCase();
  const accidental = m[2]!;
  const octave = parseInt(m[3]!, 10);
  let pc = PITCH_CLASS[letter]!;
  if (accidental === '#') pc += 1;
  else if (accidental === 'b') pc -= 1;
  return (octave + 1) * 12 + pc;
}

/** 57 → 'A3'. Usa sustenidos. */
export function midiToNote(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SHARP_NAMES[pc]}${octave}`;
}

/** Transpõe um MIDI por N semitons. */
export function transpose(midi: number, semitones: number): number {
  return midi + semitones;
}

// ── Organum — harmonização medieval por intervalos paralelos ─────────────────

export type OrganumInterval = 'unison' | 'third' | 'fourth' | 'fifth' | 'octave';

const ORGANUM_SEMITONES: Record<OrganumInterval, number> = {
  unison: 0, third: 4, fourth: 5, fifth: 7, octave: 12,
};

/** Frequência paralela a `freq` no intervalo dado (organum medieval). */
export function organum(freq: number, interval: OrganumInterval): number {
  return freq * Math.pow(2, ORGANUM_SEMITONES[interval] / 12);
}

/** Harmoniza uma lista de frequências por organum paralelo. */
export function harmonize(freqs: number[], interval: OrganumInterval): number[] {
  return freqs.map((f) => organum(f, interval));
}

/** Quinta aberta (root + 5ª) — drone medieval clássico. Retorna [Hz, Hz]. */
export function openFifth(rootMidi: number): [number, number] {
  return [midiToHz(rootMidi), midiToHz(rootMidi + 7)];
}

// ── Cadências ouvert (aberta/suspensa) e clos (fechada/resolvida) ────────────
// Em estampie medieval, cada punctum termina 2× : ouvert (não resolve, segue) e
// clos (resolve na final). Modelamos como o GRAU-alvo (índice 0-based na escala
// de 8 notas: 0=tônica, 4=quinta, 7=oitava).

export type CadenceType = 'ouvert' | 'clos';

/** Grau-alvo da cadência: clos resolve na tônica, ouvert "abre" na 5ª. */
export function cadenceTargetDegree(type: CadenceType): number {
  return type === 'clos' ? 0 : 4;
}

/** Sequência de graus (índices 0-based) de uma cadência curta de 2 notas. */
export function cadenceDegrees(type: CadenceType): [number, number] {
  // clos: sensível→tônica (grau 7→0 oitava abaixo = aproximação por cima → tônica)
  // ouvert: 3→4 (sobe pra 5ª, deixa suspenso)
  return type === 'clos' ? [1, 0] : [3, 4];
}

// ── Graus estáveis (pilares do modo) ─────────────────────────────────────────
/** Índices estáveis numa escala de 8 graus: tônica, 3ª, 5ª, oitava. */
export const STABLE_DEGREES = [0, 2, 4, 7] as const;

export function isStableDegree(idx: number): boolean {
  const norm = ((idx % 7) + 7) % 7; // dobra a oitava de volta no grau
  return norm === 0 || norm === 2 || norm === 4;
}

// ── RNG seedável (mulberry32) — composição reproduzível/testável ─────────────
/** Retorna um gerador determinístico [0,1) a partir de um seed inteiro. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Walk modal ponderado — base do gerador de melodia (Onda 3) ───────────────
export interface WalkOpts {
  /** Peso de repetir a mesma nota (0..1). Default baixo. */
  repeat?: number;
  /** Peso extra pra cair num grau estável. Default 0.8. */
  stableBias?: number;
  /** Alcance máximo do salto em graus. Default 4. */
  maxLeap?: number;
}

/**
 * Próximo grau (índice 0-based numa escala de `scaleLen` notas) a partir de
 * `current`, com viés stepwise (passos pequenos > saltos) + gravidade pros graus
 * estáveis. Determinístico dado `rng`. Sempre retorna índice em [0, scaleLen).
 */
export function weightedNextDegree(
  current: number,
  scaleLen: number,
  rng: () => number,
  opts: WalkOpts = {},
): number {
  const repeat = opts.repeat ?? 0.25;
  const stableBias = opts.stableBias ?? 0.8;
  const maxLeap = opts.maxLeap ?? 4;

  const weights: number[] = [];
  let total = 0;
  for (let j = 0; j < scaleLen; j++) {
    const dist = Math.abs(j - current);
    let w: number;
    if (j === current) {
      w = repeat;
    } else if (dist > maxLeap) {
      w = 0;
    } else {
      // Passo (dist 1-2) pesa muito mais que salto (dist 3-4).
      w = 1 / (dist * dist);
    }
    if (w > 0 && isStableDegree(j)) w += stableBias * (1 / (1 + dist));
    weights.push(w);
    total += w;
  }
  if (total <= 0) return current;

  let pick = rng() * total;
  for (let j = 0; j < scaleLen; j++) {
    pick -= weights[j]!;
    if (pick <= 0) return j;
  }
  return scaleLen - 1;
}

// Trilha Medieval — Motor de composição generativa (puro, sem AudioContext).
// Gera melodias modais coerentes + grooves de dança, para o ambient (Onda 4)
// agendar nos instrumentos. Determinístico via RNG seedável → testável.
//
// Princípios medievais (pesquisa): frase = motivo + repetição + variação; período
// = antecedente (cadência OUVERT, suspensa na 5ª) + consequente (cadência CLOS,
// resolve na tônica). Ritmo favorece a célula long-short-short. Dança = melodia
// monofônica sobre drone, com percussão improvisada por cima.

import { weightedNextDegree, cadenceTargetDegree, type CadenceType } from './theory';

// ── Notas (grau na escala + duração em steps) ────────────────────────────────
export interface Note {
  /** Índice 0-based na escala de 8 graus (0=tônica … 7=oitava). */
  degree: number;
  /** Duração em steps do sequencer. */
  durSteps: number;
}

/** Células rítmicas (durações em steps). Favorecem long-short-short (medieval).
 *  Comprimentos variados (2/3/4) → muitas combinações por compasso = não soa
 *  mecânico. */
export const RHYTHM_CELLS: number[][] = [
  [2, 1, 1],   // long-short-short — o gesto mais "dança medieval"
  [1, 1, 2],
  [3, 1],      // pontuado (dotted)
  [2, 2],
  [1, 1, 1, 1],
  [4],         // nota longa
  [2, 1],
  [1, 2],
  [3],
  [2],
];

export interface PhraseOpts {
  scaleLen?: number;
  bars?: number;
  stepsPerBar?: number;
  cadence: CadenceType;
  startDegree?: number;
}

/** Preenche UMA frase com células rítmicas + walk modal; força a cadência na
 *  última nota (clos→tônica, ouvert→5ª). Total = bars*stepsPerBar steps. */
export function generatePhrase(rng: () => number, opts: PhraseOpts): Note[] {
  const scaleLen = opts.scaleLen ?? 8;
  const bars = opts.bars ?? 2;
  const stepsPerBar = opts.stepsPerBar ?? 6;
  const notes: Note[] = [];
  let cur = opts.startDegree ?? 0;

  for (let b = 0; b < bars; b++) {
    let remaining = stepsPerBar;
    while (remaining > 0) {
      // Escolhe uma célula que caiba; se nenhuma couber, fecha o compasso.
      const fits = RHYTHM_CELLS.filter((c) => c.reduce((a, n) => a + n, 0) <= remaining);
      const cell = fits.length > 0
        ? fits[Math.floor(rng() * fits.length)]!
        : [remaining];
      for (const dur of cell) {
        cur = weightedNextDegree(cur, scaleLen, rng);
        notes.push({ degree: cur, durSteps: dur });
        remaining -= dur;
      }
    }
  }

  // Força a cadência na última nota.
  if (notes.length > 0) {
    notes[notes.length - 1]!.degree = cadenceTargetDegree(opts.cadence);
  }
  return notes;
}

/** Período completo: antecedente (ouvert) + consequente (clos). A clássica
 *  pergunta→resposta medieval. O consequente parte do grau onde a pergunta parou. */
export function generatePeriod(
  rng: () => number,
  opts: { scaleLen?: number; bars?: number; stepsPerBar?: number; startDegree?: number } = {},
): Note[] {
  const scaleLen = opts.scaleLen ?? 8;
  const bars = opts.bars ?? 2;
  const stepsPerBar = opts.stepsPerBar ?? 6;
  const antecedent = generatePhrase(rng, {
    scaleLen, bars, stepsPerBar, cadence: 'ouvert', startDegree: opts.startDegree ?? 0,
  });
  const lastDeg = antecedent[antecedent.length - 1]?.degree ?? 0;
  const consequent = generatePhrase(rng, {
    scaleLen, bars, stepsPerBar, cadence: 'clos', startDegree: lastDeg,
  });
  return [...antecedent, ...consequent];
}

/** Varia uma frase: mexe 1-2 notas internas (±1 grau ou troca a duração)
 *  PRESERVANDO a última nota (a cadência). Repetição+variação = ear-worm medieval. */
export function varyPhrase(notes: Note[], rng: () => number, scaleLen = 8): Note[] {
  const out = notes.map((n) => ({ ...n }));
  if (out.length <= 2) return out;
  const mutations = 1 + Math.floor(rng() * 2); // 1 ou 2
  for (let m = 0; m < mutations; m++) {
    const idx = Math.floor(rng() * (out.length - 1)); // nunca a última (cadência)
    if (rng() < 0.6) {
      // Nudge de grau ±1, clampado.
      const delta = rng() < 0.5 ? -1 : 1;
      out[idx]!.degree = Math.max(0, Math.min(scaleLen - 1, out[idx]!.degree + delta));
    }
    // Mantém a soma de durações estável (não embaralha o compasso).
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// Composer — forma de canção evolutiva A A' B A''. Encapsula motivo+variação pro
// ambient só pedir nextPhrase() a cada loop e a música NUNCA repetir idêntica
// (mas sempre coerente, com o leitmotif voltando).
// ════════════════════════════════════════════════════════════════════════════
export interface ComposerOpts {
  rng: () => number;
  scaleLen?: number;
  bars?: number;
  stepsPerBar?: number;
  /** Tema-semente opcional (ex.: leitmotif do JSgame) usado como base A. */
  seedTheme?: Note[];
}

export class Composer {
  private rng: () => number;
  private scaleLen: number;
  private bars: number;
  private stepsPerBar: number;
  private base: Note[];
  private pos = 0;

  constructor(opts: ComposerOpts) {
    this.rng = opts.rng;
    this.scaleLen = opts.scaleLen ?? 8;
    this.bars = opts.bars ?? 2;
    this.stepsPerBar = opts.stepsPerBar ?? 6;
    this.base = opts.seedTheme && opts.seedTheme.length > 0
      ? opts.seedTheme.map((n) => ({ ...n }))
      : this.freshPeriod();
  }

  private freshPeriod(): Note[] {
    return generatePeriod(this.rng, {
      scaleLen: this.scaleLen, bars: this.bars, stepsPerBar: this.stepsPerBar,
    });
  }

  /** Próxima frase no ciclo A · A' · B · A''. */
  nextPhrase(): Note[] {
    const slot = this.pos % 4;
    this.pos++;
    switch (slot) {
      case 0: return this.base.map((n) => ({ ...n }));            // A — tema
      case 1: return varyPhrase(this.base, this.rng, this.scaleLen); // A' — variação
      case 2: return this.freshPeriod();                          // B — contraste
      default: return varyPhrase(this.base, this.rng, this.scaleLen); // A'' — variação
    }
  }

  /** Total de steps de uma frase (pra o ambient saber o tamanho do loop). */
  phraseSteps(): number {
    // período = 2 frases (antecedente+consequente) de `bars` compassos cada.
    return 2 * this.bars * this.stepsPerBar;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Grooves de dança — percussão por step. Cada forma tem métrica + padrão.
// (Pesquisa §1: medieval é melodia+drone; percussão é convenção moderna, tunável.)
// ════════════════════════════════════════════════════════════════════════════
export type DanceForm =
  | 'estampie' | 'saltarello' | 'ductia' | 'basse-danse' | 'trotto' | 'war' | 'carole';

export type DrumName = 'kick' | 'tom' | 'hat' | 'tabor' | 'bodhran' | 'nakers';

export interface DrumHit { drum: DrumName; gain: number; }

export interface RhythmSpec {
  /** BPM default (tunável). */ bpm: number;
  /** Steps por tempo. */ stepsPerBeat: number;
  /** Comprimento do loop em steps. */ length: number;
}

export const RHYTHMS: Record<DanceForm, RhythmSpec> = {
  estampie:      { bpm: 108, stepsPerBeat: 3, length: 6 },  // 6/8 processional-enérgico
  saltarello:    { bpm: 146, stepsPerBeat: 3, length: 6 },  // 6/8 saltitante (saltare!)
  ductia:        { bpm: 112, stepsPerBeat: 3, length: 6 },  // leve/regular
  'basse-danse': { bpm: 70,  stepsPerBeat: 3, length: 6 },  // cortês/lenta
  trotto:        { bpm: 150, stepsPerBeat: 3, length: 12 }, // galope contínuo
  war:           { bpm: 132, stepsPerBeat: 4, length: 8 },  // marcial/boss
  carole:        { bpm: 100, stepsPerBeat: 3, length: 6 },  // dança de roda cantada
};

/** Hits de percussão num dado step (já feito o módulo pelo length). */
export function drumPattern(form: DanceForm, step: number): DrumHit[] {
  const len = RHYTHMS[form].length;
  const s = ((step % len) + len) % len;
  const hits: DrumHit[] = [];
  switch (form) {
    case 'estampie': // [1 0 0 1 0 0] dois tempos pontuados + hats
      if (s === 0) hits.push({ drum: 'tabor', gain: 0.42 });
      else if (s === 3) hits.push({ drum: 'tabor', gain: 0.3 });
      else hits.push({ drum: 'hat', gain: 0.08 });
      break;
    case 'saltarello': // [1 0 1 1 0 1] salto com taps off-beat
      if (s === 0) hits.push({ drum: 'tabor', gain: 0.42 });
      else if (s === 2) hits.push({ drum: 'tom', gain: 0.22 });
      else if (s === 3) hits.push({ drum: 'tabor', gain: 0.3 });
      else if (s === 5) hits.push({ drum: 'tom', gain: 0.2 });
      else hits.push({ drum: 'hat', gain: 0.06 });
      break;
    case 'ductia': // leve e regular
      if (s === 0) hits.push({ drum: 'tabor', gain: 0.34 });
      else if (s === 3) hits.push({ drum: 'tom', gain: 0.2 });
      else hits.push({ drum: 'hat', gain: 0.07 });
      break;
    case 'basse-danse': // estável, nakers no tempo forte
      if (s === 0) hits.push({ drum: 'nakers', gain: 0.34 });
      else if (s === 3) hits.push({ drum: 'hat', gain: 0.05 });
      break;
    case 'trotto': // galope: hats contínuos + kick nos tempos
      hits.push({ drum: 'hat', gain: 0.06 });
      if (s % 3 === 0) hits.push({ drum: 'tabor', gain: 0.3 });
      break;
    case 'war': // boss: nakers+kick pesados + toms
      if (s === 0 || s === 4) { hits.push({ drum: 'nakers', gain: 0.4 }); hits.push({ drum: 'kick', gain: 0.45 }); }
      else if (s === 2 || s === 6) hits.push({ drum: 'tom', gain: 0.3 });
      hits.push({ drum: 'hat', gain: 0.08 });
      break;
    case 'carole': // downbeat-driven, simples
      if (s === 0) hits.push({ drum: 'tabor', gain: 0.4 });
      else if (s === 3) hits.push({ drum: 'tabor', gain: 0.28 });
      else hits.push({ drum: 'hat', gain: 0.07 });
      break;
  }
  return hits;
}

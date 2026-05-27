// Trilha Medieval — Modos musicais característicos de música medieval/folk.
// Cada modo é uma sequência de intervalos em semitons a partir da fundamental.
// Helper getScale(root, mode) retorna as frequências de uma escala completa.

export type Mode = 'dorian' | 'phrygian' | 'mixolydian' | 'aeolian' | 'lydian' | 'major' | 'minor';

/** Intervalos em semitons de cada modo (do grau 1 ao 7, retorna 8 frequências com oitava). */
const INTERVALS: Record<Mode, number[]> = {
  // Modos eclesiásticos medievais
  dorian:     [0, 2, 3, 5, 7, 9, 10, 12], // melancólico mas não triste
  phrygian:   [0, 1, 3, 5, 7, 8, 10, 12], // exótico/oriental — mystery/danger
  mixolydian: [0, 2, 4, 5, 7, 9, 10, 12], // heroico — combat
  aeolian:    [0, 2, 3, 5, 7, 8, 10, 12], // minor natural — tensão
  lydian:     [0, 2, 4, 6, 7, 9, 11, 12], // místico elevado — victory/rest
  // Tonais modernos pra compatibilidade
  major:      [0, 2, 4, 5, 7, 9, 11, 12],
  minor:      [0, 2, 3, 5, 7, 8, 10, 12],
};

/** Frequência MIDI note (A4 = 69 = 440Hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Retorna escala completa (8 notas, oitava incluída) a partir de root MIDI + mode. */
export function getScale(rootMidi: number, mode: Mode): number[] {
  return INTERVALS[mode].map((semitones) => midiToHz(rootMidi + semitones));
}

/** Frequências MIDI úteis pra fundamentais medievais. */
export const ROOTS = {
  A2: 45, // baixa — bass drone
  D3: 50, // muito comum em folk
  E3: 52,
  G3: 55,
  A3: 57, // padrão de muitos modos
  C4: 60,
  D4: 62,
  E4: 64,
  G4: 67,
  A4: 69,
} as const;

/** Helper: pega grau N (1-7) de uma escala. Grau 1 = fundamental. */
export function degree(scale: number[], n: number): number {
  // n=1 → idx 0, n=8 → oitava (idx 7)
  return scale[Math.max(0, Math.min(scale.length - 1, n - 1))]!;
}

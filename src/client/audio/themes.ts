// Trilha Medieval — Temas assinatura (leitmotifs) compostos à mão.
// Notas como {degree, durSteps} relativas a uma escala de 8 graus → o root/modo
// escolhido pelo mood transpõe o tema. Composto seguindo as regras medievais
// (pesquisa §3b): modo dórico, motivo de 1 compasso, estrutura AABB com cadências
// ouvert/clos, cadência por grau conjunto, repetição+variação. Original — não
// copia trilha de jogo protegida.

import type { Note } from './composer';

/**
 * TEMA PRINCIPAL DO JSGAME — "A Estrada do Mestre".
 * Dórico, 8 compassos × 6 steps (feel 6/8). Contorno memorável:
 *  - Bars 1-2: motivo sobe à 5ª (grau 4) e fica SUSPENSO → ouvert.
 *  - Bars 3-4: contraste curto, desce e RESOLVE na tônica → clos.
 *  - Bars 5-6: variação que alcança a OITAVA (grau 7) e reabre na 5ª → ouvert.
 *  - Bars 7-8: retorno e cadência longa firme em casa (grau 1→0) → clos.
 * Cantarolável após uma escuta; termina "em casa". É o gancho do jogo.
 */
export const MAIN_THEME: Note[] = [
  // Bar 1
  { degree: 0, durSteps: 2 }, { degree: 4, durSteps: 1 }, { degree: 3, durSteps: 1 }, { degree: 2, durSteps: 2 },
  // Bar 2 (ouvert — pousa na 5ª)
  { degree: 2, durSteps: 1 }, { degree: 3, durSteps: 1 }, { degree: 4, durSteps: 2 }, { degree: 4, durSteps: 2 },
  // Bar 3
  { degree: 4, durSteps: 2 }, { degree: 5, durSteps: 1 }, { degree: 4, durSteps: 1 }, { degree: 2, durSteps: 2 },
  // Bar 4 (clos — resolve na tônica)
  { degree: 2, durSteps: 1 }, { degree: 1, durSteps: 1 }, { degree: 0, durSteps: 2 }, { degree: 0, durSteps: 2 },
  // Bar 5 (variação — alcança a oitava)
  { degree: 0, durSteps: 2 }, { degree: 4, durSteps: 1 }, { degree: 5, durSteps: 1 }, { degree: 7, durSteps: 2 },
  // Bar 6 (ouvert)
  { degree: 7, durSteps: 1 }, { degree: 5, durSteps: 1 }, { degree: 4, durSteps: 2 }, { degree: 4, durSteps: 2 },
  // Bar 7
  { degree: 4, durSteps: 1 }, { degree: 3, durSteps: 1 }, { degree: 2, durSteps: 1 }, { degree: 3, durSteps: 1 }, { degree: 2, durSteps: 2 },
  // Bar 8 (clos — tônica longa)
  { degree: 1, durSteps: 2 }, { degree: 0, durSteps: 4 },
];

/**
 * FANFARRA DE VITÓRIA — arpejo ascendente triunfal (1-3-5-8 + topo), curto.
 * Tocado em Lydian/Mixolydian no mood victory.
 */
export const VICTORY_FANFARE: Note[] = [
  { degree: 0, durSteps: 1 }, { degree: 2, durSteps: 1 }, { degree: 4, durSteps: 1 },
  { degree: 7, durSteps: 2 }, { degree: 4, durSteps: 1 }, { degree: 7, durSteps: 4 },
];

/**
 * LAMENTO — frase descendente solene (para danger/morte). Desce da 5ª à tônica
 * com suspensões. Dorian/Aeolian. Espelha o "Lamento di Tristano" (slow→rotta).
 */
export const LAMENT_THEME: Note[] = [
  { degree: 4, durSteps: 3 }, { degree: 3, durSteps: 1 }, { degree: 2, durSteps: 2 },
  { degree: 3, durSteps: 2 }, { degree: 1, durSteps: 2 }, { degree: 2, durSteps: 2 },
  { degree: 1, durSteps: 2 }, { degree: 0, durSteps: 4 },
];

/** Soma de durSteps de um tema. */
export function themeSteps(theme: Note[]): number {
  return theme.reduce((sum, n) => sum + n.durSteps, 0);
}

export interface FreqNote { freq: number; durSteps: number; }

/** Mapeia um tema (graus) para frequências usando uma escala (array de 8 Hz). */
export function themeToFreqs(theme: Note[], scale: number[]): FreqNote[] {
  const last = scale.length - 1;
  return theme.map((n) => ({
    freq: scale[Math.max(0, Math.min(last, n.degree))]!,
    durSteps: n.durSteps,
  }));
}

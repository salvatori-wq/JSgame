// Onda 3 — Tests do motor de composição generativa + temas (puro, sem AudioContext).

import { describe, it, expect } from 'vitest';
import { makeRng } from '../audio/theory';
import {
  generatePhrase, generatePeriod, varyPhrase, Composer,
  RHYTHM_CELLS, RHYTHMS, drumPattern, type Note,
} from '../audio/composer';
import {
  MAIN_THEME, VICTORY_FANFARE, LAMENT_THEME, themeSteps, themeToFreqs,
} from '../audio/themes';

const totalSteps = (notes: Note[]): number => notes.reduce((s, n) => s + n.durSteps, 0);
const inRange = (notes: Note[], len = 8): boolean =>
  notes.every((n) => n.degree >= 0 && n.degree < len && n.durSteps > 0);

describe('composer — generatePhrase', () => {
  it('preenche exatamente bars*stepsPerBar steps', () => {
    const p = generatePhrase(makeRng(1), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    expect(totalSteps(p)).toBe(12);
  });
  it('graus sempre na escala, durações positivas', () => {
    const p = generatePhrase(makeRng(7), { bars: 4, stepsPerBar: 6, cadence: 'ouvert' });
    expect(inRange(p)).toBe(true);
  });
  it('cadência clos termina na tônica (grau 0)', () => {
    const p = generatePhrase(makeRng(3), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    expect(p[p.length - 1]!.degree).toBe(0);
  });
  it('cadência ouvert termina na 5ª (grau 4)', () => {
    const p = generatePhrase(makeRng(3), { bars: 2, stepsPerBar: 6, cadence: 'ouvert' });
    expect(p[p.length - 1]!.degree).toBe(4);
  });
  it('determinístico com seed', () => {
    const a = generatePhrase(makeRng(42), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    const b = generatePhrase(makeRng(42), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    expect(a).toEqual(b);
  });
});

describe('composer — generatePeriod (antecedente + consequente)', () => {
  it('dobra o tamanho e resolve na tônica', () => {
    const p = generatePeriod(makeRng(5), { bars: 2, stepsPerBar: 6 });
    expect(totalSteps(p)).toBe(24);
    expect(p[p.length - 1]!.degree).toBe(0); // clos final
    expect(inRange(p)).toBe(true);
  });
});

describe('composer — varyPhrase', () => {
  it('preserva tamanho, total de steps e a cadência (última nota)', () => {
    const base = generatePhrase(makeRng(9), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    const varied = varyPhrase(base, makeRng(99), 8);
    expect(varied.length).toBe(base.length);
    expect(totalSteps(varied)).toBe(totalSteps(base));
    expect(varied[varied.length - 1]!.degree).toBe(base[base.length - 1]!.degree);
    expect(inRange(varied)).toBe(true);
  });
  it('determinístico', () => {
    const base = generatePhrase(makeRng(9), { bars: 2, stepsPerBar: 6, cadence: 'clos' });
    const a = varyPhrase(base, makeRng(11), 8);
    const b = varyPhrase(base, makeRng(11), 8);
    expect(a).toEqual(b);
  });
});

describe('composer — Composer (forma A A\' B A\'\')', () => {
  it('nextPhrase retorna frases válidas e evolui', () => {
    const c = new Composer({ rng: makeRng(2024), bars: 2, stepsPerBar: 6 });
    for (let i = 0; i < 8; i++) {
      const ph = c.nextPhrase();
      expect(inRange(ph)).toBe(true);
      expect(ph.length).toBeGreaterThan(0);
    }
  });
  it('phraseSteps reflete 2*bars*stepsPerBar', () => {
    const c = new Composer({ rng: makeRng(1), bars: 2, stepsPerBar: 6 });
    expect(c.phraseSteps()).toBe(24);
  });
  it('com seedTheme, a 1ª frase É o tema', () => {
    const c = new Composer({ rng: makeRng(1), seedTheme: MAIN_THEME });
    expect(c.nextPhrase()).toEqual(MAIN_THEME);
  });
  it('determinístico com mesmo seed', () => {
    const a = new Composer({ rng: makeRng(7), bars: 2, stepsPerBar: 6 });
    const b = new Composer({ rng: makeRng(7), bars: 2, stepsPerBar: 6 });
    for (let i = 0; i < 6; i++) expect(a.nextPhrase()).toEqual(b.nextPhrase());
  });
});

describe('composer — células e grooves de dança', () => {
  it('RHYTHM_CELLS: todas arrays não-vazias de inteiros positivos', () => {
    for (const cell of RHYTHM_CELLS) {
      expect(cell.length).toBeGreaterThan(0);
      expect(cell.every((d) => Number.isInteger(d) && d > 0)).toBe(true);
    }
  });
  it('RHYTHMS: 7 formas, todas com bpm/length positivos', () => {
    const forms = Object.keys(RHYTHMS);
    expect(forms.length).toBe(7);
    for (const f of forms) {
      expect(RHYTHMS[f as keyof typeof RHYTHMS].bpm).toBeGreaterThan(0);
      expect(RHYTHMS[f as keyof typeof RHYTHMS].length).toBeGreaterThan(0);
    }
  });
  it('saltarello é mais rápido que basse-danse', () => {
    expect(RHYTHMS.saltarello.bpm).toBeGreaterThan(RHYTHMS['basse-danse'].bpm);
  });
  it('drumPattern: estampie bate tabor no tempo forte (step 0)', () => {
    const hits = drumPattern('estampie', 0);
    expect(hits.some((h) => h.drum === 'tabor')).toBe(true);
  });
  it('drumPattern: war bate nakers + kick pesados no step 0', () => {
    const hits = drumPattern('war', 0);
    expect(hits.some((h) => h.drum === 'nakers')).toBe(true);
    expect(hits.some((h) => h.drum === 'kick')).toBe(true);
  });
  it('drumPattern: módulo pelo length (step len = step 0)', () => {
    const len = RHYTHMS.estampie.length;
    expect(drumPattern('estampie', len)).toEqual(drumPattern('estampie', 0));
  });
  it('drumPattern sempre retorna array', () => {
    for (const f of Object.keys(RHYTHMS) as Array<keyof typeof RHYTHMS>) {
      for (let s = 0; s < 12; s++) expect(Array.isArray(drumPattern(f, s))).toBe(true);
    }
  });
});

describe('themes — leitmotifs', () => {
  it('MAIN_THEME tem 48 steps (8 compassos de 6) e começa/termina na tônica', () => {
    expect(themeSteps(MAIN_THEME)).toBe(48);
    expect(MAIN_THEME[0]!.degree).toBe(0);
    expect(MAIN_THEME[MAIN_THEME.length - 1]!.degree).toBe(0); // clos
  });
  it('MAIN_THEME: todos os graus dentro da escala de 8', () => {
    expect(MAIN_THEME.every((n) => n.degree >= 0 && n.degree <= 7)).toBe(true);
  });
  it('VICTORY_FANFARE e LAMENT_THEME são válidos', () => {
    expect(themeSteps(VICTORY_FANFARE)).toBeGreaterThan(0);
    expect(themeSteps(LAMENT_THEME)).toBeGreaterThan(0);
    expect(LAMENT_THEME[LAMENT_THEME.length - 1]!.degree).toBe(0); // resolve
  });
  it('themeToFreqs mapeia graus → Hz da escala, preserva tamanho', () => {
    const scale = [220, 247, 262, 294, 330, 370, 392, 440];
    const fn = themeToFreqs(MAIN_THEME, scale);
    expect(fn.length).toBe(MAIN_THEME.length);
    expect(fn[0]!.freq).toBe(220);   // grau 0
    expect(fn[0]!.durSteps).toBe(MAIN_THEME[0]!.durSteps);
  });
  it('themeToFreqs clampa graus fora do range', () => {
    const scale = [100, 200, 300];
    const fn = themeToFreqs([{ degree: 9, durSteps: 1 }], scale);
    expect(fn[0]!.freq).toBe(300); // clampado ao último
  });
});

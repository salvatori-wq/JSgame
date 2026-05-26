// JSgame · F19 — Portrait combinatorial via emoji. Zero asset, zero bytes baixados.
// Cada combinação race × class produz uma "carinha" única.
//
// Filosofia: emoji = símbolo + cor culturalmente reconhecível. Ao combinar
// race-glyph + class-glyph, criamos visual distinto pra mesa de até 3 PJs
// reconhecer no Party Panel sem confusão.

import type { ClassId } from './classes';
import type { RaceId } from './races';

export const RACE_GLYPH: Record<RaceId, string> = {
  humano:               '👤',
  'anao-colina':        '🧔',
  'anao-montanha':      '🧔',
  'alto-elfo':          '🧝',
  'elfo-floresta':      '🧝',
  'halfling-pes-leve':  '🧒',
  'halfling-robusto':   '🧒',
  draconato:            '🐲',
  'gnomo-floresta':     '🎩',
  'gnomo-rochas':       '🎩',
  'meio-elfo':          '🧝‍♀️',
  'meio-orc':           '👹',
  tiefling:             '😈',
};

export const CLASS_GLYPH: Record<ClassId, string> = {
  barbaro:     '⚔',
  bardo:       '🎵',
  bruxo:       '🌀',
  clerigo:     '✝',
  druida:      '🌿',
  feiticeiro:  '✨',
  guerreiro:   '🛡',
  ladino:      '🗡',
  mago:        '🔮',
  monge:       '👊',
  paladino:    '⚜',
  patrulheiro: '🏹',
};

// Cor "aura" por classe — usada como background do portrait
export const CLASS_AURA: Record<ClassId, string> = {
  barbaro:     '#a05030',
  bardo:       '#c060b0',
  bruxo:       '#5030a0',
  clerigo:     '#c0a050',
  druida:      '#508030',
  feiticeiro:  '#a05080',
  guerreiro:   '#808080',
  ladino:      '#404040',
  mago:        '#4060c0',
  monge:       '#c08030',
  paladino:    '#e0c060',
  patrulheiro: '#406030',
};

export interface PortraitSpec {
  race: string;       // ex: '👤'
  class: string;      // ex: '🛡'
  aura: string;       // hex color
  combo: string;      // ex: '👤🛡'
}

export function portraitFor(opts: { raceId: RaceId; classId: ClassId }): PortraitSpec {
  const race = RACE_GLYPH[opts.raceId] ?? '👤';
  const klass = CLASS_GLYPH[opts.classId] ?? '⚔';
  const aura = CLASS_AURA[opts.classId] ?? '#666';
  return {
    race,
    class: klass,
    aura,
    combo: `${race}${klass}`,
  };
}

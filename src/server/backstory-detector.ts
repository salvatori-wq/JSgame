// JSgame · F4 — Detecta uso de trait/ideal/bond/flaw na narração do DM.
// Pure function — recebe narration text + profile do PJ ativo, retorna
// quais elementos foram citados. Usado pra telemetria dm_used_backstory.
//
// Heurística: extrai palavras significativas (>=4 chars, não stopword) de
// cada trait/ideal/bond/flaw, faz word-boundary regex match na narração.
// 1 match em qualquer palavra significativa = usado.

import type { ActiveCharacterProfile } from './dm/prompts.js';

export interface BackstoryUsage {
  traitMentioned: boolean;
  idealMentioned: boolean;
  bondMentioned: boolean;
  flawMentioned: boolean;
  total: number;
}

const STOP = new Set([
  'do', 'da', 'de', 'em', 'na', 'no', 'um', 'uma', 'os', 'as',
  'que', 'com', 'sem', 'para', 'por', 'pelo', 'pela',
  'meu', 'minha', 'seu', 'sua', 'eu', 'me', 'mim',
  'tem', 'ter', 'foi', 'era',
]);

/** Word-boundary match safe contra regex meta chars. */
function containsWord(text: string, word: string): boolean {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${safe}\\b`, 'i').test(text);
}

/** Extrai palavras significativas (>=4 chars, sem stopwords). */
function significantWords(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\-]/gu, '').toLowerCase())
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Match: pelo menos 1 palavra significativa de `phrase` aparece em `text`. */
function hasMatch(text: string, phrase: string | undefined): boolean {
  if (!phrase) return false;
  const words = significantWords(phrase);
  for (const w of words) {
    if (containsWord(text, w)) return true;
  }
  return false;
}

export function detectBackstoryUsage(
  narrationText: string,
  profile: ActiveCharacterProfile,
): BackstoryUsage {
  const text = narrationText.toLowerCase();
  const traitMentioned = hasMatch(text, profile.trait);
  const idealMentioned = hasMatch(text, profile.ideal);
  const bondMentioned = hasMatch(text, profile.bond);
  const flawMentioned = hasMatch(text, profile.flaw);
  const total =
    (traitMentioned ? 1 : 0) +
    (idealMentioned ? 1 : 0) +
    (bondMentioned ? 1 : 0) +
    (flawMentioned ? 1 : 0);
  return { traitMentioned, idealMentioned, bondMentioned, flawMentioned, total };
}

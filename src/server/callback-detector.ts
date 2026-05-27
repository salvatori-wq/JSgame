// JSgame · F3 — Detecta callbacks naturais na narração do DM.
// Pure function — recebe narration text + roster/quests/locations atuais e
// retorna quais foram CITADOS. Usado pra telemetria dm_callback_used que mede
// se a regra de callback do prompt está funcionando.

import type { NpcMemory, Quest } from '../shared/types.js';

export interface CallbackResult {
  npcCallbacks: string[];        // nomes citados
  questCallbacks: string[];      // titles citados
  locationCallbacks: string[];   // locations citadas
  total: number;
}

/**
 * Detecta callbacks na narração. Match case-insensitive, word-boundary
 * pra evitar falsos positivos (ex: "Borin" não casa em "Borinflower").
 * Considera só NPCs/quests/locations que JÁ EXISTEM (não inventa).
 *
 * @param narrationText texto da narração do DM
 * @param npcRoster lista de NPCs persistentes (β.1)
 * @param quests lista de quests da campanha
 * @param recentLocations lista de locations visitadas recentemente
 */
export function detectCallbacks(
  narrationText: string,
  npcRoster: NpcMemory[] = [],
  quests: Quest[] = [],
  recentLocations: string[] = [],
): CallbackResult {
  const text = narrationText.toLowerCase();
  const npcCallbacks: string[] = [];
  const questCallbacks: string[] = [];
  const locationCallbacks: string[] = [];

  for (const npc of npcRoster) {
    if (!npc.name || npc.name.length < 3) continue;
    if (containsWord(text, npc.name.toLowerCase())) {
      npcCallbacks.push(npc.name);
    }
  }

  for (const q of quests) {
    if (q.status !== 'active') continue;
    if (!q.title || q.title.length < 4) continue;
    // Match parcial do title (primeira palavra significativa)
    const sig = significantWords(q.title);
    for (const w of sig) {
      if (containsWord(text, w.toLowerCase())) {
        questCallbacks.push(q.title);
        break;
      }
    }
  }

  for (const loc of recentLocations) {
    if (!loc || loc.length < 4) continue;
    const sig = significantWords(loc);
    for (const w of sig) {
      if (containsWord(text, w.toLowerCase())) {
        locationCallbacks.push(loc);
        break;
      }
    }
  }

  return {
    npcCallbacks,
    questCallbacks,
    locationCallbacks,
    total: npcCallbacks.length + questCallbacks.length + locationCallbacks.length,
  };
}

/** Word-boundary match — evita "Borin" casando em "Borinflower". */
function containsWord(text: string, word: string): boolean {
  // Escape regex meta chars
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${safe}\\b`, 'i');
  return re.test(text);
}

/** Extrai palavras significativas (capitalizadas ou >4 chars, ignora stopwords). */
function significantWords(s: string): string[] {
  const STOP = new Set([
    'do', 'da', 'de', 'em', 'na', 'no', 'um', 'uma', 'os', 'as',
    'que', 'com', 'sem', 'para', 'por', 'pelo', 'pela',
  ]);
  return s
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\-]/gu, ''))
    .filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()));
}

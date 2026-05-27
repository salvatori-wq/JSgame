// JSgame · D&D 5e Leveling — XP por CR + thresholds + engine de level-up.
// PHB pág 15 (XP thresholds) + pág 275 (CR → XP). 5e RAW.
//
// Loop:
//   enemy morre → award XP por party (split entre players vivos no fim do combate)
//   sheet.xp += award → applyLevelUpsIfDue(sheet) sobe um ou mais níveis
//   level-up aplica: HP (avg hit die + CON mod), spell slots, prof bonus, planned choice nv 4.

import type { CharacterSheet } from '../shared/types.js';
import type { ClassId } from './classes.js';
import type { CR } from './monsters.js';
import { getClass } from './classes.js';
import { abilityModifier, proficiencyBonus } from './attributes.js';
import { getCombinedSpellSlots, type CombinedClassEntry } from './multiclass.js';

// ════════════════════════════════════════════════════════════════════════════
// Tabelas oficiais PHB
// ════════════════════════════════════════════════════════════════════════════

/** CR → XP de monstro derrotado. PHB pág 275. */
export const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000,
};

/** XP mínimo pra cada nível. PHB pág 15. Index = nível, 0 unused. */
export const XP_FOR_LEVEL: readonly number[] = [
  0,        // 0 — unused
  0,        // 1
  300,      // 2
  900,      // 3
  2700,     // 4
  6500,     // 5
  14000,    // 6
  23000,    // 7
  34000,    // 8
  48000,    // 9
  64000,    // 10
  85000,    // 11
  100000,   // 12
  120000,   // 13
  140000,   // 14
  165000,   // 15
  195000,   // 16
  225000,   // 17
  265000,   // 18
  305000,   // 19
  355000,   // 20
];

export const MAX_LEVEL = 20;

// ════════════════════════════════════════════════════════════════════════════
// XP queries
// ════════════════════════════════════════════════════════════════════════════

/** XP de uma kill por CR. Default 10 (CR 0) se CR não está na tabela. */
export function xpForCR(cr: CR | number): number {
  return CR_TO_XP[cr] ?? 10;
}

/** Calcula o nível correspondente a um XP total. */
export function levelFromXp(xp: number): number {
  if (xp < 0) return 1;
  for (let lvl = MAX_LEVEL; lvl >= 1; lvl--) {
    if (xp >= XP_FOR_LEVEL[lvl]!) return lvl;
  }
  return 1;
}

/** XP necessário pra atingir o próximo nível. Retorna 0 se já estiver no max. */
export function xpToNextLevel(xp: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0;
  const next = XP_FOR_LEVEL[currentLevel + 1] ?? Infinity;
  return Math.max(0, next - xp);
}

/** Progresso 0..1 dentro do nível atual (pra XP bar). 1 = pronto pra subir. */
export function xpProgressInLevel(xp: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 1;
  const cur = XP_FOR_LEVEL[currentLevel] ?? 0;
  const next = XP_FOR_LEVEL[currentLevel + 1] ?? cur + 1;
  if (next === cur) return 1;
  return Math.max(0, Math.min(1, (xp - cur) / (next - cur)));
}

/**
 * Divide XP de um encontro entre os players elegíveis (vivos).
 * PHB pág 83: XP é dividido igualmente entre party. Restos arredondam pra baixo (ninguém leva).
 * Se 0 elegíveis, retorna [].
 */
export function divideXpForParty(totalXp: number, elegibleCount: number): number {
  if (elegibleCount <= 0) return 0;
  return Math.floor(totalXp / elegibleCount);
}

// ════════════════════════════════════════════════════════════════════════════
// Level-up engine
// ════════════════════════════════════════════════════════════════════════════

export interface LevelUpResult {
  oldLevel: number;
  newLevel: number;
  hpGained: number;
  proficiencyBonusGained: boolean;
  slotsChanged: boolean;
  level4ChoiceApplied: boolean;
  notes: string[];
}

/**
 * Aplica TODOS os level-ups pendentes baseados em sheet.xp. Pode subir N níveis
 * de uma vez (raro mas possível em playthrough longa sem play).
 * Retorna array com 1 entry por nível subido (vazio se nenhum).
 *
 * Tudo aplicado in-place no sheet.
 *
 * Multi-classe: PHB pág 163 diz que XP é compartilhado entre classes mas player
 * escolhe em qual classe levelup vai. Pra simplificar (zero-budget), level-up
 * sempre vai pra classe primária (classId). Multi-classe via wizard manual.
 */
export function applyLevelUpsIfDue(sheet: CharacterSheet): LevelUpResult[] {
  const results: LevelUpResult[] = [];
  const target = levelFromXp(sheet.xp);

  while (sheet.level < target && sheet.level < MAX_LEVEL) {
    results.push(applySingleLevelUp(sheet));
  }
  return results;
}

function applySingleLevelUp(sheet: CharacterSheet): LevelUpResult {
  const oldLevel = sheet.level;
  const newLevel = oldLevel + 1;
  const klass = getClass(sheet.classId);
  const conMod = abilityModifier(sheet.abilityScores.con);
  const notes: string[] = [];

  // HP: average do hit die + CON mod (PHB pág 15, opção "average"). Min 1.
  //  d6=4, d8=5, d10=6, d12=7. Avg = (hitDie/2) + 1.
  const avgHpRoll = Math.floor(klass.hitDie / 2) + 1;
  const hpGained = Math.max(1, avgHpRoll + conMod);
  sheet.maxHp += hpGained;
  sheet.currentHp += hpGained; // cura também — comum em mesa de RPG
  sheet.hitDiceRemaining = Math.min(newLevel, sheet.hitDiceRemaining + 1);
  notes.push(`HP máx +${hpGained} (avg d${klass.hitDie} ${avgHpRoll} + CON ${conMod >= 0 ? '+' : ''}${conMod})`);

  // Proficiency bonus: muda nos níveis 5, 9, 13, 17
  const oldPb = proficiencyBonus(oldLevel);
  const newPb = proficiencyBonus(newLevel);
  const pbChanged = newPb !== oldPb;
  if (pbChanged) notes.push(`Bônus de proficiência +${newPb - oldPb} (→ +${newPb})`);

  // Atualiza level ANTES de calcular slots (combinedCasterLevel usa sheet.level)
  sheet.level = newLevel;

  // Spell slots: re-calcula baseado em level atual + additional classes
  const before = JSON.stringify(sheet.spellSlots);
  applySpellSlotProgression(sheet);
  const slotsChanged = JSON.stringify(sheet.spellSlots) !== before;
  if (slotsChanged) notes.push('Spell slots atualizados');

  // Level 4 choice (ASI ou Feat) — aplica plannedLevel4Choice quando PJ atinge nv 4
  let level4ChoiceApplied = false;
  if (newLevel === 4 && sheet.plannedLevel4Choice) {
    applyPlannedLevel4Choice(sheet);
    level4ChoiceApplied = true;
    notes.push('Escolha de nv 4 aplicada (ASI/Feat)');
  }

  return {
    oldLevel,
    newLevel,
    hpGained,
    proficiencyBonusGained: pbChanged,
    slotsChanged,
    level4ChoiceApplied,
    notes,
  };
}

/**
 * Re-deriva spell slots do sheet baseado em level atual + additionalClasses.
 * Preserva `used` por slot level — só ajusta `max`. Se max diminuir (improvável),
 * clampa used.
 */
export function applySpellSlotProgression(sheet: CharacterSheet): void {
  const entries: CombinedClassEntry[] = [
    { classId: sheet.classId, level: sheet.level },
    ...(sheet.additionalClasses ?? []).map((c) => ({ classId: c.classId, level: c.level })),
  ];
  const combined = getCombinedSpellSlots(entries);
  const levels: Array<keyof typeof sheet.spellSlots> = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const k of levels) {
    const newMax = combined[k] ?? 0;
    const slot = sheet.spellSlots[k] ?? { max: 0, used: 0 };
    slot.max = newMax;
    slot.used = Math.min(slot.used, newMax);
    sheet.spellSlots[k] = slot;
  }
}

/**
 * Aplica a escolha plannedLevel4Choice (ASI ou Feat) no sheet.
 * Limpa o campo depois pra evitar re-aplicar.
 */
function applyPlannedLevel4Choice(sheet: CharacterSheet): void {
  const choice = sheet.plannedLevel4Choice;
  if (!choice) return;

  if (choice.kind === 'asi') {
    // ASI: +2 num atributo, +1 em outro (ou +1/+1). Cap em 20.
    const plusTwo = choice.plusTwo;
    const plusOne = choice.plusOne;
    sheet.abilityScores[plusTwo] = Math.min(20, sheet.abilityScores[plusTwo] + 2);
    sheet.abilityScoresBase[plusTwo] = Math.min(20, sheet.abilityScoresBase[plusTwo] + 2);
    if (plusOne !== plusTwo) {
      sheet.abilityScores[plusOne] = Math.min(20, sheet.abilityScores[plusOne] + 1);
      sheet.abilityScoresBase[plusOne] = Math.min(20, sheet.abilityScoresBase[plusOne] + 1);
    }
  } else if (choice.kind === 'feat') {
    // η.1 — Feat aplica mecânica real via feat-effects-engine.
    // Import dinâmico pra evitar ciclo (server-only module ref em arquivo dnd/).
    // Em ambiente onde server-side não está disponível (test puro do dnd),
    // o try/catch protege. Em runtime do server, sempre roda.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engine = require('../server/feat-effects-engine.js') as typeof import('../server/feat-effects-engine.js');
      engine.applyFeatEffects(sheet, choice.featId, choice.resilientAbility);
    } catch {
      // Fallback: anexa marker no backstory (será migrado on-load depois)
      sheet.backstory = (sheet.backstory ? sheet.backstory + '\n' : '') + `[Feat nv 4: ${choice.featId}]`;
    }
  }

  // Limpa pra evitar re-aplicar em level-ups futuros
  sheet.plannedLevel4Choice = null;
}

/**
 * Quanto XP somar à sheet a partir de uma lista de enemies derrotados.
 * Caller passa os EnemySnapshot.xpAward que já vêm computados (ou recomputa via xpForCR).
 */
export function totalXpFromKills(xpAwards: number[]): number {
  return xpAwards.reduce((sum, x) => sum + x, 0);
}

// ════════════════════════════════════════════════════════════════════════════
// Helper combinado: aplica XP em players elegíveis + level-up em cada um.
// Usado no fim do combate vitorioso.
// ════════════════════════════════════════════════════════════════════════════

export interface AwardXpResult {
  characterId: string;
  characterName: string;
  xpAwarded: number;
  levelUps: LevelUpResult[];
}

/**
 * Distribui `totalXp` entre party (split por elegíveis vivos), aplica level-up
 * em cada PJ. Mutates sheets.
 *
 * elegibleFilter: opcionalmente filtra quem ganha XP. Default: PJs vivos
 * (currentHp > 0) E não-mortos (deathCount não importa aqui — PJs estabilizados
 * inconscientes ainda ganham via PHB; mas pra MVP, exigimos HP > 0 = "lúcido").
 */
export function awardXpToParty(
  party: CharacterSheet[],
  totalXp: number,
  elegibleFilter?: (sheet: CharacterSheet) => boolean,
): AwardXpResult[] {
  const filter = elegibleFilter ?? ((s: CharacterSheet) => s.currentHp > 0);
  const elegible = party.filter(filter);
  const per = divideXpForParty(totalXp, elegible.length);
  if (per === 0) return [];

  const results: AwardXpResult[] = [];
  for (const pj of elegible) {
    pj.xp += per;
    const levelUps = applyLevelUpsIfDue(pj);
    results.push({
      characterId: pj.id,
      characterName: pj.characterName,
      xpAwarded: per,
      levelUps,
    });
  }
  return results;
}

// JSgame · η.1 — Feat Effects Engine.
// Aplica mecânica server-side de cada feat PHB ao PJ. Substitui o fallback
// feio em leveling.ts:228 que apenas anexava string no backstory.
//
// Phase 1 (this sprint): feats com mecânica simples — Alert, Tough, Lucky,
// Resilient, Observant, War Caster, Tavern Brawler, Inspiring Leader,
// Heavy/Medium/Light Armored, Athlete/Actor/Linguist/Durable.
//
// Phase 2 (Sprint λ): GWM/Sharpshooter/Sentinel/Polearm — combat-tactical refactor.

import type { CharacterSheet } from '../shared/types.js';
import type { FeatId, FeatDef } from '../dnd/feats.js';
import type { AbilityKey } from '../dnd/attributes.js';
import { FEATS } from '../dnd/feats.js';

const LUCKY_POINTS_PER_LONG_REST = 3;

/**
 * Aplica os efeitos mecânicos de um feat ao sheet. Idempotente — checa
 * featsOwned pra não duplicar (ex: chamar 2x não dá +4 HP por Tough).
 *
 * @param sheet PJ mutável
 * @param featId Feat escolhido
 * @param resilientAbility Para Resilient: qual ability ganha +1 e save prof
 */
export function applyFeatEffects(
  sheet: CharacterSheet,
  featId: FeatId,
  resilientAbility?: AbilityKey,
): void {
  ensureFeatsOwnedInit(sheet);
  if (sheet.featsOwned!.includes(featId)) return; // idempotente
  sheet.featsOwned!.push(featId);

  const feat = FEATS[featId];

  // 1. Ability score increases declarativos (no FeatDef.abilityIncrease)
  applyAbilityIncrease(sheet, feat);

  // 2. Feat-specific effects
  switch (featId) {
    case 'tough':
      applyTough(sheet);
      break;
    case 'lucky':
      sheet.luckyPointsMax = LUCKY_POINTS_PER_LONG_REST;
      sheet.luckyPointsRemaining = LUCKY_POINTS_PER_LONG_REST;
      break;
    case 'resilient':
      applyResilient(sheet, resilientAbility);
      break;
    case 'lightly-armored':
      pushUnique(sheet.armorProficiencies, 'armaduras leves');
      break;
    case 'medium-armored':
      pushUnique(sheet.armorProficiencies, 'armaduras médias');
      pushUnique(sheet.armorProficiencies, 'escudos');
      break;
    case 'heavily-armored':
      pushUnique(sheet.armorProficiencies, 'armaduras pesadas');
      break;
    // Demais feats (Alert/Observant/War Caster/Inspiring Leader/etc) têm
    // efeito CONSULTIVO via getters (getInitiativeBonus, etc) — sem mutação
    // direta do sheet. featsOwned[] sinaliza presença e os getters fazem o resto.
    default:
      break;
  }
}

/** Bônus de initiative aplicado em startCombat. */
export function getInitiativeBonus(sheet: CharacterSheet): number {
  return owns(sheet, 'alert') ? 5 : 0;
}

/** +5 Perception passiva (Observant). */
export function getPassivePerceptionBonus(sheet: CharacterSheet): number {
  return owns(sheet, 'observant') ? 5 : 0;
}

/** +5 Investigation passiva (Observant). */
export function getPassiveInvestigationBonus(sheet: CharacterSheet): number {
  return owns(sheet, 'observant') ? 5 : 0;
}

/** War Caster → advantage em CON save pra manter concentração. */
export function hasWarCasterConcentrationAdvantage(sheet: CharacterSheet): boolean {
  return owns(sheet, 'war-caster');
}

/** Restaura luck points em long rest (chamado por rest-handler). */
export function restoreLuckyOnLongRest(sheet: CharacterSheet): void {
  if (owns(sheet, 'lucky')) {
    sheet.luckyPointsRemaining = sheet.luckyPointsMax ?? LUCKY_POINTS_PER_LONG_REST;
  }
}

/** Consome 1 ponto de Lucky. Retorna true se sucesso, false se sem pontos. */
export function consumeLuckyPoint(sheet: CharacterSheet): boolean {
  if (!owns(sheet, 'lucky')) return false;
  if ((sheet.luckyPointsRemaining ?? 0) <= 0) return false;
  sheet.luckyPointsRemaining = (sheet.luckyPointsRemaining ?? 0) - 1;
  return true;
}

/** Lê feats do PJ. Sempre array (nunca undefined). */
export function ownedFeats(sheet: CharacterSheet): FeatId[] {
  return sheet.featsOwned ?? [];
}

/**
 * Migration on-load: parseia backstory legacy "[Feat nv 4: X]" e popula featsOwned.
 * Idempotente — checa antes de aplicar. Aplicação retro de Tough HP feita uma vez.
 */
export function migrateLegacyFeats(sheet: CharacterSheet): void {
  if (sheet.featsOwned && sheet.featsOwned.length > 0) return; // já migrado
  if (!sheet.backstory) return;
  const match = sheet.backstory.match(/\[Feat nv 4: ([\w-]+)\]/);
  if (!match) return;
  const featId = match[1] as FeatId;
  if (!FEATS[featId]) return;
  applyFeatEffects(sheet, featId);
  // Mantém marca no backstory (não remove — registro narrativo)
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers internos
// ════════════════════════════════════════════════════════════════════════════

function ensureFeatsOwnedInit(sheet: CharacterSheet): void {
  if (!sheet.featsOwned) sheet.featsOwned = [];
}

function owns(sheet: CharacterSheet, featId: FeatId): boolean {
  return (sheet.featsOwned ?? []).includes(featId);
}

function pushUnique(arr: string[], item: string): void {
  if (!arr.includes(item)) arr.push(item);
}

function applyAbilityIncrease(sheet: CharacterSheet, feat: FeatDef): void {
  if (!feat.abilityIncrease) return;
  for (const [k, v] of Object.entries(feat.abilityIncrease)) {
    const key = k as AbilityKey;
    if (typeof v !== 'number') continue;
    sheet.abilityScores[key] = Math.min(20, sheet.abilityScores[key] + v);
    sheet.abilityScoresBase[key] = Math.min(20, sheet.abilityScoresBase[key] + v);
  }
}

function applyTough(sheet: CharacterSheet): void {
  // +2 HP por NÍVEL — retroativo + scope futuro
  const boost = 2 * sheet.level;
  sheet.maxHp += boost;
  sheet.currentHp = Math.min(sheet.maxHp, sheet.currentHp + boost);
}

function applyResilient(sheet: CharacterSheet, ability?: AbilityKey): void {
  if (!ability) return;
  // +1 ability + proficiência em save
  sheet.abilityScores[ability] = Math.min(20, sheet.abilityScores[ability] + 1);
  sheet.abilityScoresBase[ability] = Math.min(20, sheet.abilityScoresBase[ability] + 1);
  if (!sheet.proficientSavingThrows.includes(ability)) {
    sheet.proficientSavingThrows.push(ability);
  }
}

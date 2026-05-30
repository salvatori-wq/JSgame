// JSgame · B3 — Encounter builder PHB DMG-style.
// Server-side. Recebe party + dificuldade, retorna seleção balanceada de monstros
// do bestiary. Usado por DM tool start_combat_balanced.

import { MONSTERS, inferAbilityScores, type MonsterDef, type CR } from './monsters.js';
import { xpForCR } from './leveling.js';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// DMG pág 82 — XP threshold per player por dificuldade per nível.
// Aproximação compactada (interpolada lvl 1-20).
const XP_THRESHOLDS: Record<number, Record<Difficulty, number>> = {
  1:  { easy: 25,   medium: 50,   hard: 75,   deadly: 100 },
  2:  { easy: 50,   medium: 100,  hard: 150,  deadly: 200 },
  3:  { easy: 75,   medium: 150,  hard: 225,  deadly: 400 },
  4:  { easy: 125,  medium: 250,  hard: 375,  deadly: 500 },
  5:  { easy: 250,  medium: 500,  hard: 750,  deadly: 1100 },
  6:  { easy: 300,  medium: 600,  hard: 900,  deadly: 1400 },
  7:  { easy: 350,  medium: 750,  hard: 1100, deadly: 1700 },
  8:  { easy: 450,  medium: 900,  hard: 1400, deadly: 2100 },
  9:  { easy: 550,  medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600,  medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800,  medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

// Multiplier baseado em quantidade de monstros (DMG pág 82).
function encounterMultiplier(numMonsters: number): number {
  if (numMonsters === 1) return 1;
  if (numMonsters === 2) return 1.5;
  if (numMonsters <= 6) return 2;
  if (numMonsters <= 10) return 2.5;
  if (numMonsters <= 14) return 3;
  return 4;
}

export interface PartyComposition {
  level: number;
}

export interface EncounterPick {
  monster: MonsterDef;
  count: number;
}

export interface PickEncounterResult {
  picks: EncounterPick[];
  totalXp: number;
  adjustedXp: number;
  targetXp: number;
  difficulty: Difficulty;
}

/**
 * Seleciona encontro balanceado pra party + difficulty.
 * Heurística: pega target XP, escolhe 1-4 monstros do bestiary que somam próximo do alvo,
 * priorizando variedade (não repetir mesmo monster mais de 4x).
 */
export function pickEncounter(party: PartyComposition[], difficulty: Difficulty): PickEncounterResult {
  if (party.length === 0) {
    return { picks: [], totalXp: 0, adjustedXp: 0, targetXp: 0, difficulty };
  }

  // Soma thresholds pra dificuldade alvo
  let targetXp = 0;
  for (const p of party) {
    const lvl = Math.max(1, Math.min(20, p.level));
    const t = XP_THRESHOLDS[lvl];
    if (t) targetXp += t[difficulty];
  }

  // Lista monstros candidatos do bestiary, ordenados por CR
  const candidates = Object.values(MONSTERS)
    .filter((m) => xpForCR(m.cr) > 0)
    .sort((a, b) => xpForCR(a.cr) - xpForCR(b.cr));

  // Heurística simples: monta 1-3 picks (mix de "elite" + "minions")
  // Pra dificuldade easy/medium: prefere 1 monstro grande ou 2-3 médios.
  // Pra hard/deadly: prefere 1 boss + 2-3 minions.
  const picks: EncounterPick[] = [];
  let accumulatedXp = 0;
  let totalMonsters = 0;

  // Pra easy/medium: pick principal CR média
  if (difficulty === 'easy' || difficulty === 'medium') {
    const ideal = candidates.find((m) => xpForCR(m.cr) >= targetXp * 0.5 && xpForCR(m.cr) <= targetXp * 1.2);
    if (ideal) {
      const count = Math.min(3, Math.max(1, Math.floor(targetXp / xpForCR(ideal.cr))));
      picks.push({ monster: ideal, count });
      accumulatedXp += xpForCR(ideal.cr) * count;
      totalMonsters += count;
    }
  } else {
    // hard/deadly: 1 boss (~40% target) + minions
    const boss = candidates.reverse().find((m) => xpForCR(m.cr) <= targetXp * 0.6 && xpForCR(m.cr) >= targetXp * 0.25);
    candidates.reverse(); // reset
    if (boss) {
      picks.push({ monster: boss, count: 1 });
      accumulatedXp += xpForCR(boss.cr);
      totalMonsters += 1;
    }
    // Fill com minions até atingir adjustedXp >= targetXp
    const minionCandidates = candidates.filter((m) => xpForCR(m.cr) <= targetXp * 0.15 && xpForCR(m.cr) >= 25);
    const minion = minionCandidates[Math.floor(minionCandidates.length / 2)];
    if (minion) {
      const remaining = targetXp - accumulatedXp;
      const count = Math.max(1, Math.min(4, Math.floor(remaining / xpForCR(minion.cr))));
      picks.push({ monster: minion, count });
      accumulatedXp += xpForCR(minion.cr) * count;
      totalMonsters += count;
    }
  }

  // Fallback: se nada se encaixou, escolhe goblin × 2
  if (picks.length === 0) {
    const fallback = MONSTERS['goblin'];
    if (fallback) {
      picks.push({ monster: fallback, count: 2 });
      accumulatedXp = xpForCR(fallback.cr) * 2;
      totalMonsters = 2;
    }
  }

  const mult = encounterMultiplier(totalMonsters);
  const adjustedXp = Math.round(accumulatedXp * mult);

  return { picks, totalXp: accumulatedXp, adjustedXp, targetXp, difficulty };
}

// Helper: converte EncounterPick[] em formato esperado por StartCombatInput.
// Cada count gera um EnemySnapshot com nome sufixado se >1.
export function picksToEnemyInputs(picks: EncounterPick[]): Array<{
  name: string; hp: number; ac: number; attackBonus: number; damageDice: string; damageBonus: number;
  description?: string; xpAward: number; isBoss?: boolean;
  resistances?: import('./damage-types').DamageType[];
  immunities?: import('./damage-types').DamageType[];
  vulnerabilities?: import('./damage-types').DamageType[];
  attackDamageType?: import('./damage-types').DamageType;
  abilityScores?: { for: number; des: number; con: number; int: number; sab: number; car: number };
}> {
  const out: ReturnType<typeof picksToEnemyInputs> = [];
  for (const pick of picks) {
    const m = pick.monster;
    for (let i = 1; i <= pick.count; i++) {
      out.push({
        name: pick.count > 1 ? `${m.name} ${i}` : m.name,
        hp: m.hp,
        ac: m.ac,
        attackBonus: m.attackBonus,
        damageDice: m.damageDice,
        damageBonus: m.damageBonus,
        description: m.description,
        xpAward: xpForCR(m.cr),
        isBoss: m.isBoss,
        resistances: m.resistances,
        immunities: m.immunities,
        vulnerabilities: m.vulnerabilities,
        attackDamageType: m.attackDamageType,
        // Rank 8 — saves não-triviais também no encontro balanceado (era +0).
        abilityScores: inferAbilityScores(m),
      });
    }
  }
  return out;
}

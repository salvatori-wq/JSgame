// JSgame · Fase 3 — Balance de combate freeform.
//
// Problema (playtest): combate via `start_combat` (DM declara HP livre) arrasta.
// 1 PJ vs 3 bandidos (33 HP) levou 8 rounds. O `start_combat_balanced` usa XP
// budget, mas o LLM muitas vezes chama o freeform e infla HP.
//
// Solução: estimar o "dano por round" (DPR) aproximado da party e escalar o HP
// total dos inimigos pra mirar ~4 rounds de combate. SÓ reduz (nunca infla),
// só age quando está MUITO acima do alvo (evita micro-ajustes), respeita pisos
// (nunca trivializa, boss tem piso maior). Determinístico e testável — sem RNG.

import type { CharacterSheet } from '../shared/types';
import { abilityModifier } from './attributes';
import type { ClassId } from './classes';

export interface BalanceableEnemy {
  name: string;
  hp: number;
  isBoss?: boolean;
}

export interface BalanceResult<T extends BalanceableEnemy> {
  enemies: T[];
  adjusted: boolean;
  /** nota humana pro log/telemetria quando ajustou (vazio se não mexeu) */
  note: string;
  partyDpr: number;
  targetTotalHp: number;
  originalTotalHp: number;
  newTotalHp: number;
}

// Rounds-alvo: combate "respira" em ~4 rounds (consultor: 4-5 é o ponto doce).
const TARGET_ROUNDS = 4;
// Só age quando o HP total passa do alvo por essa margem (evita ajuste à toa).
const SLOG_THRESHOLD = 1.4;
// Ao reduzir, mira um pouco ACIMA do alvo (não trivializa).
const AIM_FACTOR = 1.2;
// Nunca reduz um inimigo abaixo desses pisos do valor declarado.
const MIN_FACTOR_NORMAL = 0.5;
const MIN_FACTOR_BOSS = 0.7;
const HIT_RATE = 0.6; // ~60% de acerto médio contra CA típica

// Dano médio de UM golpe por arquétipo de classe (dado + mod aproximado já
// embutido no número base; o mod real entra por cima via ability score).
function archetypeWeaponAvg(classId: ClassId): number {
  switch (classId) {
    case 'barbaro':     return 7;   // 2d6/1d12 médio sem mod
    case 'guerreiro':   return 6.5; // 1d10/1d8+escudo
    case 'paladino':    return 6.5;
    case 'patrulheiro': return 5.5; // 1d8 / arco
    case 'ladino':      return 5.5; // 1d8 + sneak entra à parte
    case 'monge':       return 5;   // dado marcial
    case 'mago':        return 5.5; // cantrip 1d10
    case 'feiticeiro':  return 5.5;
    case 'bruxo':       return 5.5; // eldritch blast 1d10
    case 'clerigo':     return 4.5; // sacred flame 1d8
    case 'druida':      return 4.5;
    case 'bardo':       return 4.5; // vicious mockery 1d4 / arma leve
    default:            return 5.5;
  }
}

// Ataques por round (martials ganham Extra Attack no nv 5).
function attacksPerRound(classId: ClassId, level: number): number {
  const martial = classId === 'guerreiro' || classId === 'barbaro'
    || classId === 'paladino' || classId === 'patrulheiro';
  if (martial && level >= 5) return 2;
  return 1;
}

// Melhor modificador ofensivo do PJ (STR/DEX pra marcial; mental pra caster).
function bestOffenseMod(pj: CharacterSheet): number {
  const a = pj.abilityScores;
  const caster = pj.classId === 'mago' || pj.classId === 'feiticeiro'
    || pj.classId === 'bruxo' || pj.classId === 'clerigo'
    || pj.classId === 'druida' || pj.classId === 'bardo';
  if (caster) return Math.max(abilityModifier(a.int), abilityModifier(a.sab), abilityModifier(a.car));
  return Math.max(abilityModifier(a.for), abilityModifier(a.des));
}

/** Dano-por-round estimado da party (vivos). Determinístico. */
export function estimatePartyDpr(party: CharacterSheet[]): number {
  let dpr = 0;
  for (const pj of party) {
    if (pj.currentHp <= 0) continue; // mortos/caídos não contam
    const perHit = archetypeWeaponAvg(pj.classId) + Math.max(0, bestOffenseMod(pj));
    const attacks = attacksPerRound(pj.classId, pj.level);
    // Ladino: sneak attack ~ (ceil(level/2))d6 médio 3.5 cada, ~1×/round.
    const sneak = pj.classId === 'ladino' ? Math.ceil(pj.level / 2) * 3.5 * HIT_RATE : 0;
    dpr += perHit * HIT_RATE * attacks + sneak;
  }
  return Math.max(1, Math.round(dpr * 10) / 10);
}

/**
 * Escala o HP dos inimigos freeform pra mirar ~TARGET_ROUNDS rounds.
 * Só reduz (nunca aumenta), só quando está bem acima do alvo. Preserva a
 * proporção entre inimigos. Boss tem piso maior. Puro/testável.
 */
export function balanceFreeformEnemies<T extends BalanceableEnemy>(
  party: CharacterSheet[],
  enemies: T[],
): BalanceResult<T> {
  const partyDpr = estimatePartyDpr(party);
  const targetTotalHp = Math.round(partyDpr * TARGET_ROUNDS);
  const originalTotalHp = enemies.reduce((s, e) => s + e.hp, 0);

  const base: Omit<BalanceResult<T>, 'enemies' | 'adjusted' | 'note' | 'newTotalHp'> = {
    partyDpr, targetTotalHp, originalTotalHp,
  };

  // Não age se já está dentro do orçamento (ou abaixo — combate curto é OK).
  if (originalTotalHp <= targetTotalHp * SLOG_THRESHOLD || originalTotalHp <= 0) {
    return { ...base, enemies, adjusted: false, note: '', newTotalHp: originalTotalHp };
  }

  const rawFactor = (targetTotalHp * AIM_FACTOR) / originalTotalHp; // < 1
  const scaled = enemies.map((e) => {
    const minF = e.isBoss ? MIN_FACTOR_BOSS : MIN_FACTOR_NORMAL;
    const f = Math.max(minF, Math.min(1, rawFactor));
    return { ...e, hp: Math.max(1, Math.round(e.hp * f)) };
  });
  const newTotalHp = scaled.reduce((s, e) => s + e.hp, 0);

  const note = `Combate calibrado: HP dos inimigos ${originalTotalHp}→${newTotalHp} `
    + `(party ~${partyDpr}/round, alvo ~${TARGET_ROUNDS} rounds).`;

  return { ...base, enemies: scaled, adjusted: true, note, newTotalHp };
}

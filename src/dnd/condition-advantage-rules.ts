// JSgame · η.4 — Condition → Advantage/Disadvantage automation (PHB Apêndice A).
//
// Regras automáticas aplicadas em rolls quando attacker/target tem condition.
// Cada teste de combate (attack roll), save throw e skill check consulta esse
// módulo pra determinar se rola advantage/disadvantage/normal.

import type { ConditionId } from './conditions.js';

export type AdvantageMode = 'advantage' | 'disadvantage' | 'normal';

/** Combina dois modos com regra PHB: vantagem + desvantagem = normal. */
export function combineAdvantage(a: AdvantageMode, b: AdvantageMode): AdvantageMode {
  if (a === b) return a;
  if (a === 'normal') return b;
  if (b === 'normal') return a;
  // a vs b é advantage vs disadvantage → cancela
  return 'normal';
}

/**
 * Verifica condições do attacker + target pra computar advantage em attack roll.
 *
 * Attacker tem ADVANTAGE se target está:
 *  - cego, inconsciente, paralisado, petrificado, atordoado, restrito
 *  - caído (apenas se ataque MELEE; ranged contra prone = disadvantage)
 *
 * Attacker tem DISADVANTAGE se:
 *  - attacker está cego, envenenado
 *  - target está invisível (não pode ver atacante)
 *  - attacker está caído (qualquer ataque)
 */
export interface AttackAdvantageContext {
  attackerConditions: ConditionId[];
  targetConditions: ConditionId[];
  isMelee: boolean;
}

export function attackAdvantageMode(ctx: AttackAdvantageContext): AdvantageMode {
  const { attackerConditions, targetConditions, isMelee } = ctx;
  let mode: AdvantageMode = 'normal';

  // Attacker advantage from target conditions
  const advFromTarget: ConditionId[] = ['cego', 'inconsciente', 'paralisado', 'petrificado', 'atordoado', 'restrito'];
  for (const c of advFromTarget) {
    if (targetConditions.includes(c)) {
      mode = combineAdvantage(mode, 'advantage');
    }
  }
  // Caído: melee ataca com advantage; ranged com disadvantage
  if (targetConditions.includes('caido')) {
    mode = combineAdvantage(mode, isMelee ? 'advantage' : 'disadvantage');
  }

  // Attacker disadvantage from self conditions
  const disadvFromSelf: ConditionId[] = ['cego', 'envenenado'];
  for (const c of disadvFromSelf) {
    if (attackerConditions.includes(c)) {
      mode = combineAdvantage(mode, 'disadvantage');
    }
  }
  // Attacker caído → disadvantage em qualquer ataque
  if (attackerConditions.includes('caido')) {
    mode = combineAdvantage(mode, 'disadvantage');
  }

  // Target invisible → attacker has disadvantage (não vê)
  if (targetConditions.includes('invisivel')) {
    mode = combineAdvantage(mode, 'disadvantage');
  }

  return mode;
}

/**
 * Skill checks: condition envenenado → disadvantage em testes de habilidade (PHB).
 */
export function skillCheckAdvantageMode(rollerConditions: ConditionId[]): AdvantageMode {
  let mode: AdvantageMode = 'normal';
  if (rollerConditions.includes('envenenado')) {
    mode = combineAdvantage(mode, 'disadvantage');
  }
  // Cego → falha automática em testes que dependem de visão (server narra,
  // não aplica disadvantage genérico — exige análise da skill específica).
  return mode;
}

/**
 * Saving throws: certas conditions afetam STR/DEX saves automaticamente.
 * PHB: paralisado/atordoado/inconsciente → falha auto STR e DEX. Aqui só
 * retornamos disadvantage pra outros saves; auto-fail caller trata separado.
 */
export function savingThrowAdvantageMode(rollerConditions: ConditionId[]): AdvantageMode {
  // V1: sem regras automáticas extra (auto-fail tratado em handler).
  // Caller cuida das exceções específicas.
  return 'normal';
}

/**
 * Auto-fail check: paralisado/atordoado/inconsciente/petrificado tem falha
 * automática em saves de FOR e DES.
 */
export function isAutoFailSave(rollerConditions: ConditionId[], saveAbility: 'for' | 'des' | 'con' | 'int' | 'sab' | 'car'): boolean {
  if (saveAbility !== 'for' && saveAbility !== 'des') return false;
  return rollerConditions.some((c) =>
    c === 'paralisado' || c === 'atordoado' || c === 'inconsciente' || c === 'petrificado',
  );
}

/**
 * Consome (delete) e retorna pending advantage do player se match com kind.
 * Mutates state. Retorna mode ('advantage'|'disadvantage') ou null.
 */
export function consumePendingAdvantage(
  state: { pendingAdvantages?: Record<string, { mode: 'advantage' | 'disadvantage'; targetRoll: string; reason: string; createdAt: number }> },
  playerId: string,
  kind: 'attack' | 'save' | 'skill',
): 'advantage' | 'disadvantage' | null {
  const pending = state.pendingAdvantages?.[playerId];
  if (!pending) return null;
  if (pending.targetRoll !== `next-${kind}`) return null;
  delete state.pendingAdvantages![playerId];
  return pending.mode;
}

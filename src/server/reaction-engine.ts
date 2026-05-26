// JSgame · 2A — Reaction engine (PHB pág 190 + 228).
// Cobre Counterspell e Dispel Magic — magias que cancelam outras.
// Funções puras testáveis. Server orquestra reactionUsedThisRound flag via combat-local.

import type { CharacterSheet, CombatState, CombatEvent, ActiveBuff } from '../shared/types.js';
import { rollD20 } from '../dnd/dice.js';
import { abilityModifier } from '../dnd/attributes.js';
import { getCastingAbilityMod } from '../dnd/spell-slots.js';
import { hasCombatFlag, setCombatFlag, clearCombatFlag } from './class-features-engine.js';

// ════════════════════════════════════════════════════════════════════════════
// Reaction tracking — combat-local flag por round.
// Padrão: cada PJ tem 1 reaction por round (PHB pág 190). Reset ao iniciar turno.
// ════════════════════════════════════════════════════════════════════════════

export function hasReactionAvailable(combat: CombatState, characterId: string): boolean {
  return !hasCombatFlag(combat, characterId, 'reaction-used-this-round');
}

export function consumeReaction(combat: CombatState, characterId: string): void {
  setCombatFlag(combat, characterId, 'reaction-used-this-round');
}

// Reset reactions ao começar round novo. Chamar em combat.ts no fim do round.
export function resetReactionsForRound(combat: CombatState, party: CharacterSheet[]): void {
  for (const p of party) {
    clearCombatFlag(combat, p.id, 'reaction-used-this-round');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// COUNTERSPELL — PHB pág 228.
// Reaction quando criatura conjura magia visível em 18m.
// Se slot ≥ spell sendo conjurada → auto-cancel.
// Se slot < spell → check de conjuração (d20 + ability mod + PB) vs DC 10 + spell.level.
// Sucesso = cancela. Falha = magia segue normal.
// ════════════════════════════════════════════════════════════════════════════

export interface CounterspellInput {
  caster: CharacterSheet;
  incomingSpellLevel: number;     // nível do spell sendo conjurado (1-9)
  slotLevel: 1 | 2 | 3 | 4 | 5;   // slot que o counterspell consumiu
  combat: CombatState;
}

export interface CounterspellResult {
  ok: boolean;
  cancelled: boolean;            // true = magia foi cancelada
  reason?: string;               // se !ok, explica
  rollTotal?: number;
  dc?: number;
  log: string;
  events: CombatEvent[];
}

export function resolveCounterspell(input: CounterspellInput): CounterspellResult {
  const { caster, incomingSpellLevel, slotLevel, combat } = input;
  const events: CombatEvent[] = [];

  // Validações server-side (LLM mente — clamp sempre).
  if (slotLevel < 3) {
    return { ok: false, cancelled: false, reason: 'Contramágica precisa slot ≥3', log: '', events };
  }
  if (incomingSpellLevel < 1 || incomingSpellLevel > 9) {
    return { ok: false, cancelled: false, reason: 'Nível de spell inválido', log: '', events };
  }
  if (!hasReactionAvailable(combat, caster.id)) {
    return { ok: false, cancelled: false, reason: `${caster.characterName} já usou reação esta rodada`, log: '', events };
  }
  const slot = caster.spellSlots[slotLevel];
  if (!slot || slot.used >= slot.max) {
    return { ok: false, cancelled: false, reason: `Sem slot nv ${slotLevel} disponível`, log: '', events };
  }

  // Gasta slot + reação
  slot.used += 1;
  consumeReaction(combat, caster.id);

  // Slot ≥ spell sendo conjurado = auto-cancel
  if (slotLevel >= incomingSpellLevel) {
    const log = `${caster.characterName} CONTRAMÁGICA! Magia nv ${incomingSpellLevel} dissipa antes de soltar.`;
    events.push({ type: 'spell-cast', sourceId: caster.id, text: log });
    return { ok: true, cancelled: true, log, events };
  }

  // Slot < spell — ability check vs DC 10 + spell.level (PHB pág 228).
  // RAW: ability check = d20 + casting ability mod (sem PB).
  const castingMod = getCastingAbilityMod(caster.classId, caster);
  const dc = 10 + incomingSpellLevel;
  const roll = rollD20({ modifier: castingMod });
  const succeeded = roll.total >= dc;

  if (succeeded) {
    const log = `${caster.characterName} contramágica check: ${roll.total} ≥ DC ${dc} → magia nv ${incomingSpellLevel} CANCELADA.`;
    events.push({ type: 'spell-cast', sourceId: caster.id, text: log });
    return { ok: true, cancelled: true, rollTotal: roll.total, dc, log, events };
  }

  const log = `${caster.characterName} tenta contramágica: ${roll.total} < DC ${dc} → magia nv ${incomingSpellLevel} passa.`;
  events.push({ type: 'spell-cast', sourceId: caster.id, text: log });
  return { ok: true, cancelled: false, rollTotal: roll.total, dc, log, events };
}

// ════════════════════════════════════════════════════════════════════════════
// DISPEL MAGIC — PHB pág 231.
// Ação (não reação). Slot ≥ buff = auto-dispel. Slot < = check vs DC 10+buff.level.
// MVP: cancela 1 buff aleatório do target. Buffs sem nível original tratados como nv 3.
// ════════════════════════════════════════════════════════════════════════════

export interface DispelMagicInput {
  caster: CharacterSheet;
  target: CharacterSheet;
  slotLevel: 1 | 2 | 3 | 4 | 5;
}

export interface DispelMagicResult {
  ok: boolean;
  dispelled: ActiveBuff[];       // buffs removidos
  reason?: string;
  log: string;
  events: CombatEvent[];
}

export function resolveDispelMagic(input: DispelMagicInput): DispelMagicResult {
  const { caster, target, slotLevel } = input;
  const events: CombatEvent[] = [];

  if (slotLevel < 3) {
    return { ok: false, dispelled: [], reason: 'Dissipar Magia precisa slot ≥3', log: '', events };
  }
  const slot = caster.spellSlots[slotLevel];
  if (!slot || slot.used >= slot.max) {
    return { ok: false, dispelled: [], reason: `Sem slot nv ${slotLevel}`, log: '', events };
  }

  const buffs = target.activeBuffs ?? [];
  if (buffs.length === 0 && !target.concentratingOn) {
    // Gasta slot mesmo assim — RAW (Dispel Magic ainda consome ação/slot).
    slot.used += 1;
    const log = `${caster.characterName} lança Dissipar Magia em ${target.characterName} — nenhuma magia ativa pra dissipar.`;
    events.push({ type: 'spell-cast', sourceId: caster.id, targetId: target.id, text: log });
    return { ok: true, dispelled: [], log, events };
  }

  slot.used += 1;

  // Estratégia simples: tenta dispelar TODOS buffs ativos um por um.
  // Buffs sem nível conhecido = assume nv 3 (PHB ambíguo, regra de mesa comum).
  const dispelled: ActiveBuff[] = [];
  const castingMod = getCastingAbilityMod(caster.classId, caster);

  const survivors: ActiveBuff[] = [];
  for (const buff of buffs) {
    const buffLevel = 3; // simplificação MVP — todos buffs assumidos nv 3
    if (slotLevel >= buffLevel) {
      dispelled.push(buff);
      continue;
    }
    // PHB pág 231: ability check com casting mod (sem PB) vs DC 10 + buff level.
    const roll = rollD20({ modifier: castingMod });
    const dc = 10 + buffLevel;
    if (roll.total >= dc) {
      dispelled.push(buff);
    } else {
      survivors.push(buff);
    }
  }

  target.activeBuffs = survivors;

  // Concentration spell também é alvo válido — slot ≥3 = auto-drop concentration.
  let droppedConcentration: string | null = null;
  if (target.concentratingOn && slotLevel >= 3) {
    droppedConcentration = target.concentratingOn;
    target.concentratingOn = null;
  }

  const partsLog: string[] = [];
  if (dispelled.length > 0) partsLog.push(`${dispelled.length} buff${dispelled.length > 1 ? 's' : ''} dissipado${dispelled.length > 1 ? 's' : ''}`);
  if (droppedConcentration) partsLog.push(`concentração em ${droppedConcentration} quebrada`);
  const summary = partsLog.length > 0 ? partsLog.join(' + ') : 'nada afetado';
  const log = `${caster.characterName} dissipa magia em ${target.characterName}: ${summary}.`;
  events.push({ type: 'spell-cast', sourceId: caster.id, targetId: target.id, text: log });

  return { ok: true, dispelled, log, events };
}

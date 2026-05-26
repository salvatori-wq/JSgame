// JSgame · A2 — Buff engine genérico.
// Antes desse módulo, buffs como Bardic Inspiration / Bless / Guidance / Shield
// eram só strings de texto sem efeito mecânico. Agora hookados nos rolls.

import type { ActiveBuff, BuffEffect, CharacterSheet } from '../shared/types.js';
import { rollNotation } from '../dnd/dice.js';

// Adiciona buff novo. Idempotente em source — substitui se já houver mesmo source.
export function addBuff(target: CharacterSheet, buff: ActiveBuff): void {
  if (!target.activeBuffs) target.activeBuffs = [];
  // Source único — drop previous se já existir (ex: re-cast Bless cancela anterior)
  target.activeBuffs = target.activeBuffs.filter((b) => b.source !== buff.source);
  target.activeBuffs.push(buff);
}

// Consome todos buffs aplicáveis a uma situação. Retorna modifier final.
// dice bonuses são rolled; charges são decrementados; advantage/disadvantage retornados.
export interface ConsumeBuffsResult {
  flatBonus: number;
  diceBonus: number;
  advantage: boolean;
  disadvantage: boolean;
  consumedSources: string[];   // pro log: "Bless +3, Bardic +4"
}

export function consumeBuffs(
  target: CharacterSheet,
  appliesTo: ActiveBuff['appliesTo'],
): ConsumeBuffsResult {
  const result: ConsumeBuffsResult = {
    flatBonus: 0, diceBonus: 0, advantage: false, disadvantage: false, consumedSources: [],
  };
  if (!target.activeBuffs || target.activeBuffs.length === 0) return result;

  const remaining: ActiveBuff[] = [];
  for (const buff of target.activeBuffs) {
    if (buff.appliesTo !== appliesTo) {
      remaining.push(buff);
      continue;
    }
    applyBuffEffect(buff.effect, result);
    result.consumedSources.push(buff.source);

    // Decremento de charges
    if (typeof buff.charges === 'number') {
      buff.charges -= 1;
      if (buff.charges > 0) remaining.push(buff);
      // senão remove (esgotado)
    } else {
      // Sem charges — buff persiste até turnsLeft acabar (decrementado por tickBuffs)
      remaining.push(buff);
    }
  }
  target.activeBuffs = remaining;
  return result;
}

// AC bonus é "passive read" — não consome, só soma.
export function readAcBonus(target: CharacterSheet): { flatBonus: number; sources: string[] } {
  const sources: string[] = [];
  let flatBonus = 0;
  if (!target.activeBuffs) return { flatBonus, sources };
  for (const b of target.activeBuffs) {
    if (b.appliesTo !== 'ac') continue;
    if (b.effect.kind === 'flat-bonus') {
      flatBonus += b.effect.value;
      sources.push(b.source);
    }
  }
  return { flatBonus, sources };
}

function applyBuffEffect(effect: BuffEffect, result: ConsumeBuffsResult): void {
  switch (effect.kind) {
    case 'dice-bonus': {
      const roll = rollNotation(effect.dice);
      if (roll) result.diceBonus += roll.total;
      break;
    }
    case 'flat-bonus':
      result.flatBonus += effect.value;
      break;
    case 'advantage':
      result.advantage = true;
      break;
    case 'disadvantage':
      result.disadvantage = true;
      break;
  }
}

// Decrementa turnsLeft de todos buffs ao fim de turno do owner.
// Remove os que zeraram.
export function tickBuffsEndOfTurn(target: CharacterSheet): { expired: string[] } {
  if (!target.activeBuffs) return { expired: [] };
  const expired: string[] = [];
  target.activeBuffs = target.activeBuffs.filter((b) => {
    if (typeof b.turnsLeft !== 'number') return true;
    b.turnsLeft -= 1;
    if (b.turnsLeft <= 0) {
      expired.push(b.source);
      return false;
    }
    return true;
  });
  return { expired };
}

// Limpa todos buffs (e.g., long rest, morte).
export function clearAllBuffs(target: CharacterSheet): void {
  target.activeBuffs = [];
}

// Helpers de factory pra buffs comuns (DRY pros chamadores).
// M2 — sourceSpellLevel populado pra Dispel Magic calcular DC corretamente.
export function makeBardicInspiration(sourceName: string): ActiveBuff {
  return {
    id: `bardic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: `Bardic Inspiration (${sourceName})`,
    appliesTo: 'attack',
    effect: { kind: 'dice-bonus', dice: '1d6' },
    charges: 1,
    sourceSpellLevel: 1,  // class feature — tratada como nv 1
  };
}

export function makeBless(slotLevel = 1): ActiveBuff[] {
  // Bless aplica em attack rolls + saving throws. PHB nv 1.
  // Sources distintos pra addBuff não desduplicar entre eles.
  return [
    {
      id: `bless-atk-${Date.now()}`,
      source: 'Bless (attack)',
      appliesTo: 'attack',
      effect: { kind: 'dice-bonus', dice: '1d4' },
      turnsLeft: 10,
      sourceSpellLevel: slotLevel,
    },
    {
      id: `bless-save-${Date.now()}`,
      source: 'Bless (save)',
      appliesTo: 'save',
      effect: { kind: 'dice-bonus', dice: '1d4' },
      turnsLeft: 10,
      sourceSpellLevel: slotLevel,
    },
  ];
}

export function makeGuidance(): ActiveBuff {
  return {
    id: `guidance-${Date.now()}`,
    source: 'Guidance',
    appliesTo: 'skill-check',
    effect: { kind: 'dice-bonus', dice: '1d4' },
    charges: 1,
    sourceSpellLevel: 0,  // cantrip
  };
}

export function makeShield(): ActiveBuff {
  return {
    id: `shield-${Date.now()}`,
    source: 'Shield',
    appliesTo: 'ac',
    effect: { kind: 'flat-bonus', value: 5 },
    turnsLeft: 1,
    sourceSpellLevel: 1,
  };
}

export function makeFaerieFire(slotLevel = 1): ActiveBuff {
  return {
    id: `faerie-fire-${Date.now()}`,
    source: 'Faerie Fire',
    appliesTo: 'attack',
    effect: { kind: 'advantage' },
    turnsLeft: 10,
    sourceSpellLevel: slotLevel,
  };
}

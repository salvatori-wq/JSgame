// JSgame · M4 — Catálogo de consumíveis com efeitos mecânicos estruturados.
// Substitui match-por-nome em campaign.useItem.
// Item.id no inventário deve corresponder a uma chave aqui pra ganhar effect.
// Fallback (item.id desconhecido): match por nome (legado / homebrew do DM).

import type { ConditionId } from './conditions.js';

export type ConsumableEffectKind = 'heal' | 'remove-condition' | 'temp-hp' | 'narrative';

export interface ConsumableEffect {
  kind: ConsumableEffectKind;
  // heal: dice notation
  heal?: { dice: string; bonus?: number };
  // remove-condition: lista de conditions removidas
  removesConditions?: ConditionId[];
  // temp-hp
  tempHp?: { dice: string; bonus?: number };
  // narrative (DM narra livre, sem efeito mecânico)
  description?: string;
}

export interface ConsumableDef {
  id: string;
  name: string;
  description: string;
  rarity: 'comum' | 'incomum' | 'raro' | 'épico' | 'lendário';
  effect: ConsumableEffect;
}

export const CONSUMABLES: Record<string, ConsumableDef> = {
  'pocao-cura': {
    id: 'pocao-cura', name: 'Poção de Cura', rarity: 'comum',
    description: 'Líquido vermelho. Cura 2d4+2 HP ao beber.',
    effect: { kind: 'heal', heal: { dice: '2d4', bonus: 2 } },
  },
  'pocao-cura-maior': {
    id: 'pocao-cura-maior', name: 'Poção de Cura Maior', rarity: 'incomum',
    description: 'Cura 4d4+4 HP.',
    effect: { kind: 'heal', heal: { dice: '4d4', bonus: 4 } },
  },
  'pocao-cura-superior': {
    id: 'pocao-cura-superior', name: 'Poção de Cura Superior', rarity: 'raro',
    description: 'Cura 8d4+8 HP.',
    effect: { kind: 'heal', heal: { dice: '8d4', bonus: 8 } },
  },
  'pocao-cura-suprema': {
    id: 'pocao-cura-suprema', name: 'Poção de Cura Suprema', rarity: 'épico',
    description: 'Cura 10d4+20 HP.',
    effect: { kind: 'heal', heal: { dice: '10d4', bonus: 20 } },
  },
  'antidoto': {
    id: 'antidoto', name: 'Antídoto', rarity: 'comum',
    description: 'Remove condição envenenado.',
    effect: { kind: 'remove-condition', removesConditions: ['envenenado'] },
  },
  'pocao-heroismo': {
    id: 'pocao-heroismo', name: 'Poção do Heroísmo', rarity: 'incomum',
    description: 'Concede 10 HP temporários por 1 hora.',
    effect: { kind: 'temp-hp', tempHp: { dice: '10' } },
  },
  'pocao-resistencia': {
    id: 'pocao-resistencia', name: 'Poção da Resistência', rarity: 'incomum',
    description: 'Concede 4d4 HP temporários por 8 horas.',
    effect: { kind: 'temp-hp', tempHp: { dice: '4d4' } },
  },
};

export function getConsumable(id: string): ConsumableDef | null {
  return CONSUMABLES[id] ?? null;
}

// Match por nome (fallback pra itens legacy/homebrew sem id no catálogo).
// Retorna o effect inferido ou null se nada bater.
export function inferConsumableEffectFromName(name: string): ConsumableEffect | null {
  const n = name.toLowerCase();
  // Cura básica
  if (/cura\s+suprema|healing\s+supreme/.test(n)) return { kind: 'heal', heal: { dice: '10d4', bonus: 20 } };
  if (/cura\s+superior|healing\s+superior/.test(n)) return { kind: 'heal', heal: { dice: '8d4', bonus: 8 } };
  if (/cura\s+maior|healing\s+greater/.test(n)) return { kind: 'heal', heal: { dice: '4d4', bonus: 4 } };
  if (/cura|poção.*cura|healing/.test(n)) return { kind: 'heal', heal: { dice: '2d4', bonus: 2 } };
  // Antídotos / cura de condition
  if (/antídoto|veneno.*cura|poison.*cure/.test(n)) return { kind: 'remove-condition', removesConditions: ['envenenado'] };
  // Temp HP
  if (/heroísmo|heroism/.test(n)) return { kind: 'temp-hp', tempHp: { dice: '10' } };
  if (/resistência|resistance/.test(n)) return { kind: 'temp-hp', tempHp: { dice: '4d4' } };
  return null;
}

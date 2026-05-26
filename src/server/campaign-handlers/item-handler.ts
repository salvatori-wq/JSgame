// JSgame · A5 — Item handlers (extraídos de campaign.ts).
// useItem / equipItem / unequipItem como funções top-level que aceitam Campaign.
// Mantém comportamento idêntico — só extração.

import type { Campaign } from '../campaign.js';
import { getConsumable, inferConsumableEffectFromName } from '../../dnd/consumables.js';
import { parseDiceNotation, rollDice } from '../../dnd/dice.js';

export interface UseItemResult {
  ok: boolean;
  message: string;
  effectApplied?: string;
}

export interface EquipUnequipResult {
  ok: boolean;
  message: string;
}

export async function handleUseItem(camp: Campaign, playerId: string, itemId: string): Promise<UseItemResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, message: 'jogador não encontrado' };
  const idx = player.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return { ok: false, message: 'item não está no inventário' };
  const item = player.inventory[idx]!;

  if (item.type !== 'consumivel') {
    return { ok: false, message: `${item.name} não é consumível` };
  }

  // M4 — Resolve effect via catálogo (id-based) ou fallback name-match.
  const fromCatalog = getConsumable(item.id);
  const effect = fromCatalog
    ? fromCatalog.effect
    : (inferConsumableEffectFromName(item.name) ?? { kind: 'narrative' as const });

  let effectApplied = '';
  switch (effect.kind) {
    case 'heal': {
      const dice = effect.heal!.dice;
      const numericConst = /^\d+$/.test(dice) ? parseInt(dice, 10) : null;
      const rollTotal = numericConst !== null
        ? numericConst
        : (parseDiceNotation(dice)
          ? rollDice(parseDiceNotation(dice)!.count, parseDiceNotation(dice)!.kind, parseDiceNotation(dice)!.modifier).total
          : 0);
      const total = rollTotal + (effect.heal!.bonus ?? 0);
      const oldHp = player.currentHp;
      player.currentHp = Math.min(player.maxHp, player.currentHp + total);
      const healed = player.currentHp - oldHp;
      if (healed > 0 && player.conditions.includes('inconsciente')) {
        player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
      }
      effectApplied = `Curou ${healed} HP`;
      break;
    }
    case 'remove-condition': {
      const removed: string[] = [];
      for (const c of effect.removesConditions ?? []) {
        if (player.conditions.includes(c)) {
          player.conditions = player.conditions.filter((x) => x !== c);
          removed.push(c);
        }
      }
      effectApplied = removed.length > 0 ? `Removeu: ${removed.join(', ')}` : 'Nada a remover';
      break;
    }
    case 'temp-hp': {
      const dice = effect.tempHp!.dice;
      const numericConst = /^\d+$/.test(dice) ? parseInt(dice, 10) : null;
      const rollTotal = numericConst !== null
        ? numericConst
        : (parseDiceNotation(dice)
          ? rollDice(parseDiceNotation(dice)!.count, parseDiceNotation(dice)!.kind, parseDiceNotation(dice)!.modifier).total
          : 0);
      const total = rollTotal + (effect.tempHp!.bonus ?? 0);
      // Temp HP NÃO se acumula — usa o MAIOR (PHB pág 198)
      player.tempHp = Math.max(player.tempHp, total);
      effectApplied = `+${total} HP temporário`;
      break;
    }
    case 'narrative':
    default:
      effectApplied = `Usou ${item.name} (efeito narrado pelo Mestre)`;
  }

  // Consome quantity
  item.quantity -= 1;
  if (item.quantity <= 0) {
    player.inventory.splice(idx, 1);
  }
  camp.pushRecentEvent(`${player.characterName} usou ${item.name}: ${effectApplied}`);
  return { ok: true, message: `${player.characterName} usou ${item.name}`, effectApplied };
}

export async function handleEquipItem(
  camp: Campaign,
  playerId: string,
  itemId: string,
  slot: 'weapon' | 'armor' | 'shield',
): Promise<EquipUnequipResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, message: 'jogador não encontrado' };
  const item = player.inventory.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: 'item não está no inventário' };

  if (slot === 'weapon' && item.type !== 'arma') return { ok: false, message: `${item.name} não é arma` };
  if (slot === 'armor' && item.type !== 'armadura') return { ok: false, message: `${item.name} não é armadura` };
  if (slot === 'shield' && item.type !== 'escudo') return { ok: false, message: `${item.name} não é escudo` };

  if (slot === 'weapon') {
    if (!player.equippedWeapons.includes(itemId)) {
      if (player.equippedWeapons.length >= 2) player.equippedWeapons.shift();
      player.equippedWeapons.push(itemId);
    }
  } else if (slot === 'armor') {
    player.equippedArmor = itemId;
    // Re-calcula AC: leve = 11 + DEX; média = 13 + min(2, DEX); pesada = 18 fixo; default 12 + DEX.
    // Match por nome enquanto não há catálogo de armaduras.
    const conMod = Math.floor((player.abilityScores.des - 10) / 2);
    const armorName = item.name.toLowerCase();
    if (/couro/.test(armorName)) player.armorClass = 11 + conMod;
    else if (/cota.*malha|chain/.test(armorName)) player.armorClass = 13 + Math.min(2, conMod);
    else if (/cota.*placas|plate/.test(armorName)) player.armorClass = 18;
    else player.armorClass = 12 + conMod;
  } else if (slot === 'shield') {
    player.equippedShield = itemId;
    player.armorClass += 2;
  }
  camp.pushRecentEvent(`${player.characterName} equipou ${item.name}`);
  return { ok: true, message: `${player.characterName} equipou ${item.name}` };
}

export async function handleUnequipItem(
  camp: Campaign,
  playerId: string,
  slot: 'weapon' | 'armor' | 'shield',
  itemId?: string,
): Promise<EquipUnequipResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, message: 'jogador não encontrado' };

  if (slot === 'weapon') {
    if (itemId) {
      player.equippedWeapons = player.equippedWeapons.filter((w) => w !== itemId);
    } else {
      player.equippedWeapons = [];
    }
  } else if (slot === 'armor') {
    player.equippedArmor = undefined;
    const conMod = Math.floor((player.abilityScores.des - 10) / 2);
    player.armorClass = 10 + conMod;
    if (player.equippedShield) player.armorClass += 2;
  } else if (slot === 'shield') {
    if (player.equippedShield) {
      player.equippedShield = undefined;
      player.armorClass -= 2;
    }
  }
  camp.pushRecentEvent(`${player.characterName} desequipou ${slot}`);
  return { ok: true, message: `${player.characterName} desequipou ${slot}` };
}

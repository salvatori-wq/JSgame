// JSgame · A5 — Rest + death-save handlers (extraídos de campaign.ts).
// shortRest / longRest / rollDeathSave como funções top-level.

import type { Campaign } from '../campaign.js';
import { getClass } from '../../dnd/classes.js';
import { rollDice, rollD20 } from '../../dnd/dice.js';
import { restoreAllSlots, isPactMagicClass } from '../../dnd/spell-slots.js';
import { restoreOnShortRest, restoreOnLongRest } from '../class-features-engine.js';
import { clearAllBuffs } from '../buff-engine.js';

export interface ShortRestResult {
  ok: boolean;
  healed: number;
  diceSpent: number;
  reason?: string;
}

export interface LongRestResult {
  ok: boolean;
  healed: number;
  reason?: string;
}

export interface DeathSaveResult {
  ok: boolean;
  rollTotal?: number;
  success?: boolean;
  nat20?: boolean;
  nat1?: boolean;
  stabilized?: boolean;
  died?: boolean;
  successes?: number;
  failures?: number;
  reason?: string;
}

export async function handleShortRest(camp: Campaign, playerId: string, hitDiceToSpend: number): Promise<ShortRestResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, healed: 0, diceSpent: 0, reason: 'jogador não encontrado' };
  if (camp.state.combat?.active) return { ok: false, healed: 0, diceSpent: 0, reason: 'sem descanso durante combate' };

  const spend = Math.max(0, Math.min(hitDiceToSpend, player.hitDiceRemaining));
  if (spend === 0) return { ok: false, healed: 0, diceSpent: 0, reason: 'sem hit dice disponíveis' };

  const klass = getClass(player.classId);
  const conMod = Math.floor((player.abilityScores.con - 10) / 2);
  const roll = rollDice(spend, klass.hitDie, conMod * spend);
  const healed = Math.max(spend, roll.total);  // pelo menos N pontos (1 por die)
  const oldHp = player.currentHp;
  player.currentHp = Math.min(player.maxHp, player.currentHp + healed);
  const actual = player.currentHp - oldHp;
  player.hitDiceRemaining = Math.max(0, player.hitDiceRemaining - spend);

  if (actual > 0 && player.conditions.includes('inconsciente')) {
    player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
    player.deathSaveSuccesses = 0;
    player.deathSaveFailures = 0;
  }

  // F23 — restaura features short-rest (action-surge, second-wind, channel-divinity, ki, wild-shape)
  restoreOnShortRest(player);

  // BUG-005 fix (Sprint 4): Pact Magic (Bruxo) regenera spell slots em SHORT rest.
  // PHB pág 107. Antes os slots só voltavam no long rest — Bruxo perdia feature de classe.
  // Nota MVP: PJ single-class Bruxo only. Multiclasse Mago/Bruxo (não suportado no
  // wizard atual) precisaria slots separados conforme PHB pág 165.
  let slotsRegenerated = false;
  if (isPactMagicClass(player.classId)) {
    restoreAllSlots(player);
    slotsRegenerated = true;
  }

  const slotsNote = slotsRegenerated ? ' + slots pact magic regenerados' : '';
  camp.pushRecentEvent(`${player.characterName} descansou curto: gastou ${spend} hit dice, curou ${actual} HP${slotsNote}`);
  return { ok: true, healed: actual, diceSpent: spend };
}

export async function handleLongRest(camp: Campaign, playerId: string): Promise<LongRestResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, healed: 0, reason: 'jogador não encontrado' };
  if (camp.state.combat?.active) return { ok: false, healed: 0, reason: 'sem descanso durante combate' };

  const oldHp = player.currentHp;
  player.currentHp = player.maxHp;
  // Hit dice: recupera metade do total max (min 1)
  const totalDice = player.level;
  const recovered = Math.max(1, Math.floor(totalDice / 2));
  player.hitDiceRemaining = Math.min(totalDice, player.hitDiceRemaining + recovered);
  // Spell slots full restore
  restoreAllSlots(player);
  // Cura conditions de batalha
  player.conditions = player.conditions.filter((c) => c !== 'inconsciente' && c !== 'envenenado' && c !== 'amedrontado');
  player.deathSaveSuccesses = 0;
  player.deathSaveFailures = 0;
  // Long rest reduz exaustão em 1
  player.exhaustion = Math.max(0, player.exhaustion - 1);
  // F23 — restaura todas as features
  restoreOnLongRest(player);
  // F25 — sai de concentration
  player.concentratingOn = null;
  // A2 — long rest limpa buffs ativos
  clearAllBuffs(player);

  camp.pushRecentEvent(`${player.characterName} descansou longo: HP cheio, slots resetados, ${recovered} hit dice voltam`);
  // F17 — achievement event long_rest
  camp.pushAchievementEvent(player.id, { kind: 'long_rest' });
  return { ok: true, healed: player.currentHp - oldHp };
}

export async function handleRollDeathSave(camp: Campaign, playerId: string): Promise<DeathSaveResult> {
  const player = camp.party.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: 'jogador não encontrado' };
  if (player.currentHp > 0) return { ok: false, reason: 'só precisa de death save em HP=0' };
  if (player.deathSaveSuccesses >= 3) return { ok: false, reason: 'já estabilizou' };
  if (player.deathSaveFailures >= 3) return { ok: false, reason: 'já morreu' };

  const roll = rollD20();
  const total = roll.total;
  let stabilized = false;
  let died = false;

  if (roll.nat20) {
    player.currentHp = 1;
    player.conditions = player.conditions.filter((c) => c !== 'inconsciente');
    player.deathSaveSuccesses = 0;
    player.deathSaveFailures = 0;
    camp.pushRecentEvent(`${player.characterName} rolou NAT 20 no death save — recupera 1 HP`);
  } else if (roll.nat1) {
    player.deathSaveFailures = Math.min(3, player.deathSaveFailures + 2);
    camp.pushRecentEvent(`${player.characterName} rolou NAT 1 — duas falhas (${player.deathSaveFailures}/3)`);
  } else if (total >= 10) {
    player.deathSaveSuccesses += 1;
    if (player.deathSaveSuccesses >= 3) {
      stabilized = true;
      player.deathSaveSuccesses = 0;
      player.deathSaveFailures = 0;
      camp.pushRecentEvent(`${player.characterName} estabilizou (3 sucessos)`);
    } else {
      camp.pushRecentEvent(`${player.characterName} death save sucesso (${player.deathSaveSuccesses}/3)`);
    }
  } else {
    player.deathSaveFailures += 1;
    if (player.deathSaveFailures >= 3) {
      died = true;
      player.deathCount += 1;
      camp.pushRecentEvent(`${player.characterName} morreu (3 falhas)`);
    } else {
      camp.pushRecentEvent(`${player.characterName} death save falha (${player.deathSaveFailures}/3)`);
    }
  }

  // F17 — emite death_save event pra creditar survivor/first_death etc.
  camp.pushAchievementEvent(player.id, {
    kind: 'death_save',
    success: total >= 10 || !!roll.nat20,
    nat20: !!roll.nat20,
    nat1: !!roll.nat1,
    stabilized,
    died,
  });

  return {
    ok: true,
    rollTotal: total,
    success: total >= 10 || !!roll.nat20,
    nat20: !!roll.nat20,
    nat1: !!roll.nat1,
    stabilized,
    died,
    successes: player.deathSaveSuccesses,
    failures: player.deathSaveFailures,
  };
}

// JSgame · Validação de tool calls do DM antes de aplicar no estado.
// Server NUNCA confia direto no LLM — clamp/sanitize TUDO.

import type { DMToolCall } from './providers/base.js';
import type { SkillId } from '../../dnd/skills.js';
import type { ConditionId } from '../../dnd/conditions.js';
import { SKILLS } from '../../dnd/skills.js';
import { CONDITIONS } from '../../dnd/conditions.js';

export type ValidatedTool =
  | { kind: 'request_skill_check'; skill: SkillId; dc: number; reason: string; playerId: string }
  | { kind: 'start_combat'; enemies: Array<{ name: string; hp: number; ac: number; attackBonus: number; damageDice: string; damageBonus: number; description?: string }>; surprise: boolean }
  | { kind: 'apply_damage'; playerId: string; damage: number; type: string; reason: string }
  | { kind: 'apply_condition'; targetId: string; condition: ConditionId; reason: string }
  | { kind: 'end_combat_with_outcome'; outcome: 'victory' | 'defeat' | 'fled'; reason: string }
  | { kind: 'npc_speaks'; name: string; archetype: string; attitude: 'amigavel' | 'neutro' | 'hostil' | 'misterioso' }
  | { kind: 'give_item'; playerId: string; itemName: string; type: 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc'; quantity: number; description: string }
  | { kind: 'advance_time'; amount: string; reason: string }
  | { kind: 'describe_scene'; location: string; description: string };

const VALID_SKILL_IDS = new Set(Object.keys(SKILLS));
const VALID_CONDITION_IDS = new Set(Object.keys(CONDITIONS));
const VALID_NPC_ATTITUDES = new Set(['amigavel', 'neutro', 'hostil', 'misterioso']);
const VALID_ITEM_TYPES = new Set(['arma', 'armadura', 'escudo', 'consumivel', 'tesouro', 'ferramenta', 'misc']);
const VALID_OUTCOMES = new Set(['victory', 'defeat', 'fled']);
const DICE_NOTATION_RE = /^\d+d(4|6|8|10|12|20|100)([+-]\d+)?$/i;

export function validateToolCall(tc: DMToolCall): ValidatedTool | null {
  const input = tc.input;

  switch (tc.name) {
    case 'request_skill_check': {
      const skill = String(input.skill ?? '').toLowerCase();
      if (!VALID_SKILL_IDS.has(skill)) return null;
      const dc = clamp(Number(input.dc) || 15, 5, 30);
      const reason = String(input.reason ?? 'teste de perícia').slice(0, 200);
      const playerId = String(input.playerId ?? 'active');
      return { kind: 'request_skill_check', skill: skill as SkillId, dc, reason, playerId };
    }

    case 'start_combat': {
      if (!Array.isArray(input.enemies)) return null;
      const enemies = input.enemies
        .filter((e: unknown): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => {
          const rawDice = String(e.damageDice ?? '1d6').replace(/\s+/g, '');
          const damageDice = DICE_NOTATION_RE.test(rawDice) ? rawDice : '1d6';
          return {
            name: String(e.name ?? 'Inimigo').slice(0, 60),
            hp: clamp(Number(e.hp) || 10, 1, 999),
            ac: clamp(Number(e.ac) || 12, 5, 30),
            attackBonus: clamp(Number(e.attackBonus) || 3, -2, 15),
            damageDice,
            damageBonus: clamp(Number(e.damageBonus) || 0, -2, 20),
            description: e.description ? String(e.description).slice(0, 200) : undefined,
          };
        })
        .slice(0, 12); // cap em 12 inimigos
      if (enemies.length === 0) return null;
      return { kind: 'start_combat', enemies, surprise: !!input.surprise };
    }

    case 'apply_damage': {
      const playerId = String(input.playerId ?? '');
      if (!playerId) return null;
      const damage = clamp(Number(input.damage) || 0, 1, 100);
      const type = String(input.type ?? 'contundente').slice(0, 30);
      const reason = String(input.reason ?? 'dano').slice(0, 200);
      return { kind: 'apply_damage', playerId, damage, type, reason };
    }

    case 'apply_condition': {
      const targetId = String(input.targetId ?? '');
      const condition = String(input.condition ?? '').toLowerCase();
      if (!targetId || !VALID_CONDITION_IDS.has(condition)) return null;
      const reason = String(input.reason ?? '').slice(0, 200);
      return { kind: 'apply_condition', targetId, condition: condition as ConditionId, reason };
    }

    case 'end_combat_with_outcome': {
      const outcome = String(input.outcome ?? 'victory').toLowerCase();
      if (!VALID_OUTCOMES.has(outcome)) return null;
      const reason = String(input.reason ?? '').slice(0, 200);
      return { kind: 'end_combat_with_outcome', outcome: outcome as 'victory' | 'defeat' | 'fled', reason };
    }

    case 'npc_speaks': {
      const name = String(input.name ?? '').slice(0, 60);
      if (!name) return null;
      const archetype = String(input.archetype ?? 'desconhecido').slice(0, 40);
      const attitude = VALID_NPC_ATTITUDES.has(String(input.attitude ?? '').toLowerCase())
        ? (String(input.attitude).toLowerCase() as 'amigavel' | 'neutro' | 'hostil' | 'misterioso')
        : 'neutro';
      return { kind: 'npc_speaks', name, archetype, attitude };
    }

    case 'give_item': {
      const playerId = String(input.playerId ?? '');
      const itemName = String(input.itemName ?? '').slice(0, 60);
      if (!playerId || !itemName) return null;
      const type = VALID_ITEM_TYPES.has(String(input.type ?? '').toLowerCase())
        ? (String(input.type).toLowerCase() as 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc')
        : 'misc';
      const quantity = clamp(Number(input.quantity) || 1, 1, 99);
      const description = String(input.description ?? '').slice(0, 200);
      return { kind: 'give_item', playerId, itemName, type, quantity, description };
    }

    case 'advance_time': {
      const amount = String(input.amount ?? '').slice(0, 30);
      if (!amount) return null;
      const reason = String(input.reason ?? '').slice(0, 200);
      return { kind: 'advance_time', amount, reason };
    }

    case 'describe_scene': {
      const location = String(input.location ?? '').slice(0, 80);
      if (!location) return null;
      const description = String(input.description ?? '').slice(0, 400);
      return { kind: 'describe_scene', location, description };
    }

    default:
      return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Re-export pra conveniência
export { SKILLS, CONDITIONS };
export type { SkillId, ConditionId };

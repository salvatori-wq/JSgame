// JSgame · D&D 5e Multiclass (PHB cap 6 pág 163-165).
//
// Regras-chave:
// - Pré-req de atributo: precisa atender requisito tanto da classe atual
//   quanto da nova classe pra adquirir multi-classe.
// - Hit dice acumulam (Guerreiro 3 + Ladino 2 = 3d10 + 2d8).
// - Proficiências adquiridas ao multi-classe são REDUZIDAS (lista própria).
// - Spell slots combinados via "caster level": full casters somam integral,
//   half casters /2 floor, third casters /3 floor, soma vira input da tabela
//   full caster (PHB pág 165). Pact magic (Bruxo) NÃO combina — slots separados.
// - Spells known/prepared continuam por classe (cada classe gerencia sua lista).
// - ASI/Feat continua por classe individual (não por level total).

import type { ClassId } from './classes';
import type { AbilityKey } from './attributes';
import type { SubclassId } from './subclasses';

export interface MulticlassEntry {
  classId: ClassId;
  subclassId?: SubclassId | null;
  level: number;
}

// Pré-requisitos PHB pág 163. Algumas classes precisam UM atributo, outras OU (lógico).
export const MULTICLASS_PREREQ: Record<ClassId, Array<{ key: AbilityKey; min: number }>> = {
  barbaro:     [{ key: 'for', min: 13 }],
  bardo:       [{ key: 'car', min: 13 }],
  bruxo:       [{ key: 'car', min: 13 }],
  clerigo:     [{ key: 'sab', min: 13 }],
  druida:      [{ key: 'sab', min: 13 }],
  feiticeiro:  [{ key: 'car', min: 13 }],
  guerreiro:   [{ key: 'for', min: 13 }, { key: 'des', min: 13 }], // OU
  ladino:      [{ key: 'des', min: 13 }],
  mago:        [{ key: 'int', min: 13 }],
  monge:       [{ key: 'des', min: 13 }, { key: 'sab', min: 13 }], // E (ambos)
  paladino:    [{ key: 'for', min: 13 }, { key: 'car', min: 13 }], // E (ambos)
  patrulheiro: [{ key: 'des', min: 13 }, { key: 'sab', min: 13 }], // E (ambos)
};

// Regra de combinação: classes com "OU" (qualquer um basta) vs "E" (todos).
// PHB diz: Guerreiro qualquer (FOR ou DES), Paladino/Monge/Patrulheiro ambos.
const PREREQ_LOGIC: Record<ClassId, 'any' | 'all'> = {
  barbaro: 'any', bardo: 'any', bruxo: 'any', clerigo: 'any', druida: 'any',
  feiticeiro: 'any', guerreiro: 'any', ladino: 'any', mago: 'any',
  monge: 'all', paladino: 'all', patrulheiro: 'all',
};

// Caster type — define como classe entra na tabela de slots combinada.
// 'full'  → soma integral (Bardo, Clérigo, Druida, Feiticeiro, Mago)
// 'half'  → soma /2 floor a partir do nv 2 (Paladino, Patrulheiro)
// 'pact'  → Bruxo, slots separados, NÃO combina
// 'none'  → não casta (Bárbaro, Guerreiro*, Ladino*, Monge)
//          * exceções subclass (EK, AT) são "third" mas pertencem à classe-mãe
export type CasterType = 'full' | 'half' | 'pact' | 'none';

export const CASTER_TYPE: Record<ClassId, CasterType> = {
  barbaro: 'none',
  bardo: 'full',
  bruxo: 'pact',
  clerigo: 'full',
  druida: 'full',
  feiticeiro: 'full',
  guerreiro: 'none',
  ladino: 'none',
  mago: 'full',
  monge: 'none',
  paladino: 'half',
  patrulheiro: 'half',
};

/**
 * Tabela de slots full caster (PHB pág 165). Input: caster level combinado.
 * Index 0 não usado; 1-20 mapeia pra tupla de slots por nível de magia (1-9).
 */
const FULL_CASTER_SLOTS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // 0 — placeholder
  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],  // 1
  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],  // 2
  [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],  // 3
  [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],  // 4
  [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],  // 5
  [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],  // 6
  [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],  // 7
  [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],  // 8
  [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],  // 9
  [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],  // 10
  [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],  // 11
  [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],  // 12
  [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],  // 13
  [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],  // 14
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],  // 15
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],  // 16
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 1],  // 17
  [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],  // 18
  [0, 4, 3, 3, 3, 3, 2, 1, 1, 1],  // 19
  [0, 4, 3, 3, 3, 3, 2, 2, 1, 1],  // 20
];

export interface CombinedClassEntry { classId: ClassId; level: number }

/**
 * Verifica se PJ atende pré-req pra MULTI-CLASSE de uma nova classe.
 * Checa também a classe ATUAL — PHB exige que ambas tenham os atributos batidos.
 * Retorna { ok, reason? }.
 */
export function canMulticlassInto(
  fromClassId: ClassId,
  toClassId: ClassId,
  abilityScores: Record<AbilityKey, number>,
): { ok: boolean; reason?: string } {
  if (fromClassId === toClassId) {
    return { ok: false, reason: 'já é dessa classe' };
  }
  for (const cls of [fromClassId, toClassId]) {
    const reqs = MULTICLASS_PREREQ[cls];
    if (!reqs || reqs.length === 0) continue;
    const logic = PREREQ_LOGIC[cls];
    const passes = reqs.map((r) => abilityScores[r.key] >= r.min);
    const ok = logic === 'all' ? passes.every(Boolean) : passes.some(Boolean);
    if (!ok) {
      const desc = reqs
        .map((r) => `${r.key.toUpperCase()} ≥ ${r.min}`)
        .join(logic === 'all' ? ' E ' : ' OU ');
      return { ok: false, reason: `${cls} requer ${desc}` };
    }
  }
  return { ok: true };
}

/**
 * Calcula caster level combinado pra PJ multi-classe (PHB pág 165).
 *  full * 1 + half (>=2) * 0.5 + ignora pact e none.
 * Floor no final.
 */
export function combinedCasterLevel(classes: CombinedClassEntry[]): number {
  let total = 0;
  for (const c of classes) {
    const t = CASTER_TYPE[c.classId];
    if (t === 'full') total += c.level;
    else if (t === 'half' && c.level >= 2) total += c.level / 2;
    // 'pact' e 'none' não contribuem
  }
  return Math.floor(total);
}

/**
 * Retorna slots combinados pra PJ multi-classe — record de spell-level → slot count.
 * Pact magic (Bruxo) NÃO incluído aqui (gerenciado separado pelos slots da classe).
 * Se PJ tem só 1 classe full caster, é equivalente à tabela individual.
 * Se tem 0 casters, retorna {} (sem slots).
 */
export function getCombinedSpellSlots(
  classes: CombinedClassEntry[],
): Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number> {
  const empty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 } as const;
  const level = combinedCasterLevel(classes);
  if (level === 0) return { ...empty };
  const row = FULL_CASTER_SLOTS[Math.min(20, level)];
  if (!row) return { ...empty };
  return {
    1: row[1] ?? 0,
    2: row[2] ?? 0,
    3: row[3] ?? 0,
    4: row[4] ?? 0,
    5: row[5] ?? 0,
    6: row[6] ?? 0,
    7: row[7] ?? 0,
    8: row[8] ?? 0,
    9: row[9] ?? 0,
  };
}

/**
 * Nível total efetivo do PJ — soma dos níveis em todas as classes.
 * É o que entra em proficiency bonus, ASI freq, etc.
 */
export function effectiveLevel(classes: CombinedClassEntry[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

// ════════════════════════════════════════════════════════════════════════════
// Proficiências limitadas ao adquirir multi-classe (PHB pág 164).
// Lista reduzida do que a classe "doaria" normalmente em nv 1.
// ════════════════════════════════════════════════════════════════════════════

export const MULTICLASS_PROFICIENCIES_GAINED: Record<ClassId, {
  armor?: string[];
  weapons?: string[];
  tools?: string[];
  skill?: { count: number; from: string[] };
  saves?: never;  // saves NÃO ganha em multi-classe
}> = {
  barbaro: {
    armor: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weapons: ['Armas simples', 'Armas marciais'],
  },
  bardo: {
    armor: ['Armaduras leves'],
    skill: { count: 1, from: ['ANY'] }, // bardo pode escolher 1 perícia qualquer
  },
  bruxo: {
    armor: ['Armaduras leves'],
    weapons: ['Armas simples'],
  },
  clerigo: {
    armor: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
  },
  druida: {
    armor: ['Armaduras leves (não-metal)', 'Armaduras médias (não-metal)', 'Escudos (não-metal)'],
  },
  feiticeiro: {},
  guerreiro: {
    armor: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weapons: ['Armas simples', 'Armas marciais'],
  },
  ladino: {
    armor: ['Armaduras leves'],
    tools: ['Ferramentas de ladrão'],
    skill: { count: 1, from: ['acrobacia', 'arrombamento', 'atletismo', 'enganacao', 'furtividade', 'intuicao', 'investigacao', 'percepcao', 'persuasao'] },
  },
  mago: {},
  monge: {
    weapons: ['Armas simples', 'Espadas curtas'],
  },
  paladino: {
    armor: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weapons: ['Armas simples', 'Armas marciais'],
  },
  patrulheiro: {
    armor: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weapons: ['Armas simples', 'Armas marciais'],
    skill: { count: 1, from: ['adestrar-animais', 'atletismo', 'furtividade', 'intuicao', 'investigacao', 'natureza', 'percepcao', 'sobrevivencia'] },
  },
};

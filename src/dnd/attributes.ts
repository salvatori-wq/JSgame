// JSgame · D&D 5e ability scores + point buy + modifiers.
// PHB pág 13: 6 atributos. Point buy de 27 pontos. Score base 8, máx 15
// (antes de bônus racial). Modifier = floor((score - 10) / 2).

export const ABILITY_KEYS = ['for', 'des', 'con', 'int', 'sab', 'car'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];

export type AbilityScores = Record<AbilityKey, number>;

// Display labels em PT-BR. "for" → "Força", etc.
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  for: 'Força',
  des: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  sab: 'Sabedoria',
  car: 'Carisma',
};

// Abreviações 3 letras pra UI compacta.
export const ABILITY_SHORT: Record<AbilityKey, string> = {
  for: 'FOR',
  des: 'DES',
  con: 'CON',
  int: 'INT',
  sab: 'SAB',
  car: 'CAR',
};

// Glyphs heráldicos pra UI. Cave Run usou ⚒➸◎♬∞ — adapto pra D&D 5e.
export const ABILITY_GLYPHS: Record<AbilityKey, string> = {
  for: '⚔',  // espada
  des: '➸',  // flecha
  con: '✚',  // cruz (vitalidade)
  int: '✦',  // estrela (arcano)
  sab: '◎',  // olho (percepção)
  car: '♛',  // coroa (presença)
};

// Modifier D&D 5e: floor((score - 10) / 2). Score 10 = mod 0; 14 = +2; 20 = +5.
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Formata modifier pra display: "+3" / "-1" / "+0".
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Point buy: custo pra elevar de 8 até o score alvo. PHB pág 13 (Variant: Customizing Ability Scores).
// 8: 0 / 9: 1 / 10: 2 / 11: 3 / 12: 4 / 13: 5 / 14: 7 / 15: 9
// Acima de 15 NÃO é permitido via point buy (apenas via bônus racial).
const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

// Calcula gasto total dos 6 scores. Retorna null se algum score é inválido (<8, >15).
export function totalPointBuyCost(scores: AbilityScores): number | null {
  let total = 0;
  for (const key of ABILITY_KEYS) {
    const c = pointBuyCost(scores[key]);
    if (c === null) return null;
    total += c;
  }
  return total;
}

// Valida que scores estão dentro do range e que o gasto cabe no orçamento.
export function isValidPointBuy(scores: AbilityScores): { ok: true } | { ok: false; reason: string } {
  for (const key of ABILITY_KEYS) {
    const s = scores[key];
    if (s < POINT_BUY_MIN) return { ok: false, reason: `${ABILITY_LABELS[key]} (${s}) abaixo do mínimo ${POINT_BUY_MIN}` };
    if (s > POINT_BUY_MAX) return { ok: false, reason: `${ABILITY_LABELS[key]} (${s}) acima do máx ${POINT_BUY_MAX} (point buy)` };
  }
  const cost = totalPointBuyCost(scores);
  if (cost === null) return { ok: false, reason: 'score inválido em algum atributo' };
  if (cost > POINT_BUY_BUDGET) return { ok: false, reason: `gasto ${cost} excede orçamento ${POINT_BUY_BUDGET}` };
  return { ok: true };
}

// Default array de scores (todos 8 = gasto 0 / sobra 27 inteiro pro player distribuir).
export function defaultPointBuyScores(): AbilityScores {
  return { for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 };
}

// Aplica bônus racial sobre scores base. Usado depois do point buy.
// Bônus de race somam acima de 15 (até max 20 sem mágica/level up).
export function applyRacialBonuses(base: AbilityScores, bonuses: Partial<AbilityScores>): AbilityScores {
  return {
    for: base.for + (bonuses.for ?? 0),
    des: base.des + (bonuses.des ?? 0),
    con: base.con + (bonuses.con ?? 0),
    int: base.int + (bonuses.int ?? 0),
    sab: base.sab + (bonuses.sab ?? 0),
    car: base.car + (bonuses.car ?? 0),
  };
}

// Proficiency bonus por nível. PHB pág 15. Nível 1-4: +2. 5-8: +3. 9-12: +4. 13-16: +5. 17-20: +6.
export function proficiencyBonus(level: number): number {
  if (level < 1) return 2;
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

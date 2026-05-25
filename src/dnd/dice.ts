// JSgame · D&D 5e dice utilities.
// Implementa d4/d6/d8/d10/d12/d20/d100, advantage/disadvantage, notação "XdY+Z",
// crits (nat 20 dobra dados de ataque) e modifier helpers.
//
// SERVER-side ONLY pra rolls oficiais (anti-cheat). Cliente pode rolar pra UI
// visual (encounter overlay etc), mas o resultado autoritativo vem do server.

export type DieKind = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface DiceRoll {
  notation: string;       // "1d20+3" / "3d6"
  rolls: number[];        // [13, 4, 6]
  modifier: number;       // +3
  total: number;          // soma + mod
  kind: DieKind;
  count: number;
  // d20 only:
  nat20?: boolean;
  nat1?: boolean;
  withAdvantage?: 'advantage' | 'disadvantage' | 'normal';
  bothRolls?: [number, number];  // só quando advantage/disadvantage
}

// Roll genérico de um dado (RNG é Math.random — server deve trocar por seeded RNG
// se precisar de reprodutibilidade — Cave Run usa seededRandom em daily).
export function rollDie(kind: DieKind): number {
  return 1 + Math.floor(Math.random() * kind);
}

// Roll de N dados do mesmo tipo + modifier. Notação "3d6+2".
export function rollDice(count: number, kind: DieKind, modifier = 0): DiceRoll {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(kind));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return {
    notation: formatNotation(count, kind, modifier),
    rolls,
    modifier,
    total: sum + modifier,
    kind,
    count,
  };
}

// Roll d20 com advantage (rola 2x, pega o maior) ou disadvantage (pega o menor).
// D&D 5e: PHB pág 175. Se vantagem E desvantagem ambos: cancelam, rola normal.
export function rollD20(opts: {
  modifier?: number;
  advantage?: boolean;
  disadvantage?: boolean;
} = {}): DiceRoll {
  const mod = opts.modifier ?? 0;
  const adv = !!opts.advantage;
  const dis = !!opts.disadvantage;
  // Cancela
  if (adv && dis) {
    const r = rollDie(20);
    return {
      notation: formatNotation(1, 20, mod),
      rolls: [r],
      modifier: mod,
      total: r + mod,
      kind: 20,
      count: 1,
      nat20: r === 20,
      nat1: r === 1,
      withAdvantage: 'normal',
    };
  }
  if (adv || dis) {
    const a = rollDie(20);
    const b = rollDie(20);
    const picked = adv ? Math.max(a, b) : Math.min(a, b);
    return {
      notation: formatNotation(1, 20, mod) + (adv ? ' (vant)' : ' (desv)'),
      rolls: [picked],
      modifier: mod,
      total: picked + mod,
      kind: 20,
      count: 1,
      nat20: picked === 20,
      nat1: picked === 1,
      withAdvantage: adv ? 'advantage' : 'disadvantage',
      bothRolls: [a, b],
    };
  }
  const r = rollDie(20);
  return {
    notation: formatNotation(1, 20, mod),
    rolls: [r],
    modifier: mod,
    total: r + mod,
    kind: 20,
    count: 1,
    nat20: r === 20,
    nat1: r === 1,
    withAdvantage: 'normal',
  };
}

// Roll de dano em ataque. Se isCritical=true, dobra os DADOS (não o modifier).
// PHB pág 196: "When you score a critical hit, you get to roll extra dice
// for the attack's damage against the target. Roll all of the attack's damage
// dice twice and add them together."
export function rollDamage(count: number, kind: DieKind, modifier = 0, isCritical = false): DiceRoll {
  const total = isCritical ? count * 2 : count;
  const base = rollDice(total, kind, modifier);
  return {
    ...base,
    notation: isCritical
      ? `${count}d${kind}+${modifier} (CRIT ×2 dados)`
      : base.notation,
  };
}

// Parser de notação "3d6+2" / "1d20-1" / "2d8". Útil pra cards/spells que
// declaram dano em string.
export function parseDiceNotation(s: string): { count: number; kind: DieKind; modifier: number } | null {
  const m = s.replace(/\s+/g, '').match(/^(\d+)d(4|6|8|10|12|20|100)([+-]\d+)?$/i);
  if (!m) return null;
  const count = parseInt(m[1]!, 10);
  const kind = parseInt(m[2]!, 10) as DieKind;
  const modifier = m[3] ? parseInt(m[3], 10) : 0;
  return { count, kind, modifier };
}

// Roll a partir de notação direta. Conveniente pra cards/spells.
export function rollNotation(notation: string, opts: { critical?: boolean } = {}): DiceRoll | null {
  const parsed = parseDiceNotation(notation);
  if (!parsed) return null;
  return opts.critical
    ? rollDamage(parsed.count, parsed.kind, parsed.modifier, true)
    : rollDice(parsed.count, parsed.kind, parsed.modifier);
}

function formatNotation(count: number, kind: DieKind, modifier: number): string {
  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  return `${count}d${kind}${sign}`;
}

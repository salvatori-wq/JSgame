// JSgame · F2 — Combat log narrado com variação de verbos.
// Substitui "Borin → Goblin: 14 vs CA 13 · HIT · 5 dmg" hardcoded por
// frases narradas tipo "Borin cravou a espada em Goblin (5 dmg)".
//
// Pure function — server side. Random pick de verbo por categoria
// (hit/crit/miss/nat1/kill). Suporta seed opcional pra determinismo
// em tests.

export interface AttackLogOpts {
  attackerName: string;
  targetName: string;
  attackRoll: number;
  targetAc: number;
  hit: boolean;
  crit: boolean;
  nat1: boolean;
  damage: number;
  killed: boolean;
  /** Opcional pra testes — usa pseudo-random determinístico. */
  seed?: number;
}

const HIT_VERBS = ['cravou em', 'rasgou', 'atingiu', 'acertou em cheio em', 'feriu', 'golpeou'];
const CRIT_VERBS = ['esmagou', 'dilacerou', 'demoliu', 'decepou parte de', 'aniquilou', 'destruiu'];
const NAT1_VERBS = ['tropeçou no próprio golpe contra', 'errou feio em', 'perdeu o equilíbrio atacando', 'falhou miseravelmente contra'];
const MISS_VERBS = ['errou', 'passou raspando em', 'atacou — sem efeito em', 'foi bloqueado por', 'falhou contra'];
const KILL_SUFFIXES = [
  '{target} cai morto.',
  '{target} tomba sem vida.',
  '{target} desaba no chão.',
  '{target} é arremessado pra trás e não move mais.',
];

// λ.5 — Crit + Kill = drama maxed. Verbos mais visuais pra momento épico.
const KILL_CRIT_SUFFIXES = [
  '{target} é PARTIDO em dois — o golpe rasgou pele e osso.',
  '{target} engole o último arquejo enquanto desaba — uma morte de história.',
  '{target} é arremessado num arco — bate na parede com som que ecoa.',
  '{target} cai numa poça do próprio sangue. A cena fica gravada.',
  '{target} morre antes do som chegar — o ataque foi cirúrgico.',
  '{target} explode em fragmentos — o golpe foi excessivo, e bonito.',
];

function pick<T>(arr: readonly T[], seed?: number): T {
  if (seed !== undefined) {
    return arr[seed % arr.length]!;
  }
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Constrói uma linha narrativa para o combat log.
 * Format: "[Attacker] [verb] [target] ([roll] vs CA [ac]; [damage] dmg)[. Kill suffix]"
 *
 * Exemplo:
 * - Hit normal: "Borin cravou em Goblin (14 vs CA 13; 5 dmg)"
 * - Crit: "Borin ESMAGOU Goblin (NAT20; 12 dmg) — Goblin cai morto."
 * - Miss: "Borin errou Goblin (8 vs CA 13)"
 * - Nat1: "Borin tropeçou no próprio golpe contra Goblin (NAT1)"
 */
export function enrichAttackLog(opts: AttackLogOpts): string {
  const { attackerName, targetName, attackRoll, targetAc, hit, crit, nat1, damage, killed } = opts;

  if (!hit) {
    const verbs = nat1 ? NAT1_VERBS : MISS_VERBS;
    const verb = pick(verbs, opts.seed);
    const tail = nat1 ? '(NAT1)' : `(${attackRoll} vs CA ${targetAc})`;
    return `${attackerName} ${verb} ${targetName} ${tail}`;
  }

  // Hit
  const verbs = crit ? CRIT_VERBS : HIT_VERBS;
  const verb = pick(verbs, opts.seed);
  const verbDisplay = crit ? verb.toUpperCase() : verb;
  const rollTag = crit ? 'NAT20' : `${attackRoll} vs CA ${targetAc}`;
  const base = `${attackerName} ${verbDisplay} ${targetName} (${rollTag}; ${damage} dmg)`;

  if (killed) {
    // λ.5 — Crit + kill usa templates mais épicos
    const templates = crit ? KILL_CRIT_SUFFIXES : KILL_SUFFIXES;
    const killTemplate = pick(templates, opts.seed);
    const kill = killTemplate.replace('{target}', targetName);
    return `${base} — ${kill}`;
  }
  return base;
}

/**
 * Narração curta SERVER-SIDE pra player KO (chega a 0HP). Substitui
 * "INCONSCIENTE" genérico por linha dramática. Pure (sem LLM).
 */
const KO_TEMPLATES = [
  '{name} desaba no chão, sangue escorrendo. Os olhos rolam pra trás.',
  '{name} tomba inconsciente, o último sopro escapando devagar.',
  '{name} cai. Tudo escurece. Death save vem aí.',
  '{name} é arremessado pra trás. O corpo bate na pedra. Não se move.',
];

export function buildKoNarration(characterName: string, seed?: number): string {
  const tpl = pick(KO_TEMPLATES, seed);
  return tpl.replace(/\{name\}/g, characterName);
}

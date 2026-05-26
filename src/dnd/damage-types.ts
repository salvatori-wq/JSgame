// JSgame · F26 — Damage types + resistance/immunity/vulnerability multipliers.
// PHB pág 196-197: resistance halves (×0.5), immunity nulifica (×0), vulnerability dobra (×2).
// Default sem nenhum dos três = multiplier 1.

export type DamageType =
  | 'cortante' | 'perfurante' | 'contundente'        // físicos
  | 'fogo' | 'frio' | 'eletricidade' | 'ácido' | 'trovão'  // elementais
  | 'veneno' | 'psíquico' | 'radiante' | 'necrótico' | 'força';

export interface DamageProfile {
  resistances?: DamageType[];
  immunities?: DamageType[];
  vulnerabilities?: DamageType[];
}

// Retorna multiplier final pra dano de um tipo contra profile.
// Ordem: immunity > vulnerability > resistance > 1.
export function damageMultiplier(damageType: DamageType, profile: DamageProfile): number {
  if (profile.immunities?.includes(damageType)) return 0;
  const hasVuln = profile.vulnerabilities?.includes(damageType);
  const hasResist = profile.resistances?.includes(damageType);
  if (hasVuln && hasResist) return 1;   // cancelam (PHB ambíguo, regra de mesa comum)
  if (hasVuln) return 2;
  if (hasResist) return 0.5;
  return 1;
}

// Aplica multiplier e arredonda PHB-style (round down para resist).
export function applyDamageMultiplier(rawDamage: number, damageType: DamageType, profile: DamageProfile): number {
  const m = damageMultiplier(damageType, profile);
  return Math.floor(rawDamage * m);
}

// Texto curto pra log/UI ("imune", "resistência", "vulnerável", "normal")
export function damageVerdict(damageType: DamageType, profile: DamageProfile): string | null {
  const m = damageMultiplier(damageType, profile);
  if (m === 0) return `imune a ${damageType}`;
  if (m === 0.5) return `resistência a ${damageType}`;
  if (m === 2) return `vulnerável a ${damageType}`;
  return null;
}

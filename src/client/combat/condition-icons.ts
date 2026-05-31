// JSgame · POLISH β.4 — Icons + tooltips pra D&D 5e conditions.
// Source: PHB Appendix A (Conditions). Cada condition tem ícone visual + descrição
// mecânica curta pro tooltip on tap/hover.

/** Mapping de condition ID (lower-case) → emoji ícone visual. */
const CONDITION_ICONS: Record<string, string> = {
  inconsciente: '💀',
  paralisado: '⏸',
  petrificado: '🗿',
  atordoado: '💫',
  amedrontado: '😱',
  agarrado: '🤝',
  restrito: '⛓',
  envenenado: '🧪',
  enfeiticado: '💜',
  caido: '🔻',
  cego: '👁',
  surdo: '👂',
  enfraquecido: '💔',
  invisivel: '👻',
  incapacitado: '🚫',
};

/** Descrição mecânica curta — exibida no tooltip on tap/hover.
 *  Mantida CURTA pra caber em tooltip mobile (≤80 chars cada). */
const CONDITION_DESCRIPTIONS: Record<string, string> = {
  inconsciente: 'Cai, larga itens, falha auto saves For/Des, hits crit em ≤1.5m.',
  paralisado: 'Incapacitado, falha auto saves For/Des, hits crit em ≤1.5m.',
  petrificado: 'Transformado em pedra. Resistência a tudo, imune a venenos/doenças.',
  atordoado: 'Incapacitado, falha auto saves For/Des, hits têm vantagem.',
  amedrontado: 'Desvantagem em ataques/atributos enquanto vê a fonte do medo.',
  agarrado: 'Velocidade 0. Sem ações que aumentam velocidade. Termina se atacante incapacitado.',
  restrito: 'Velocidade 0, desvantagem em ataques/Des saves, hits têm vantagem.',
  envenenado: 'Desvantagem em ataques e testes de atributo.',
  enfeiticado: 'Não pode atacar quem o enfeitiçou. Quem enfeitiçou tem vantagem em interagir.',
  caido: 'Desvantagem em ataques. Hits ≤1.5m têm vantagem; hits a distância têm desvantagem.',
  cego: 'Desvantagem em ataques. Hits contra você têm vantagem. Falha checks que precisam de visão.',
  surdo: 'Falha checks que precisam de audição.',
  enfraquecido: 'Causa metade do dano em ataques For/Mel.',
  invisivel: 'Inalcançável sem magia. Vantagem em ataques, hits contra você têm desvantagem.',
  incapacitado: 'Não pode tomar ações nem reações.',
};

/** Retorna emoji pra condition. Fallback: '•' (bullet) se não mapeado. */
export function getConditionIcon(condition: string): string {
  return CONDITION_ICONS[condition.toLowerCase()] ?? '•';
}

/** Retorna descrição mecânica curta. Vazio se não mapeado. */
export function getConditionDescription(condition: string): string {
  return CONDITION_DESCRIPTIONS[condition.toLowerCase()] ?? '';
}

/** Nome PT-BR canônico (capitalizado + com acento) pra exibir no chip.
 *  Fonte: PHB Apêndice A (espelha CONDITIONS em src/dnd/conditions.ts).
 *  QA-lançamento (Ciclo Combate): o pill do inimigo vazava o slug cru
 *  ("caido", "enfeiticado", "invisivel", "restrito") em vez do nome. */
const CONDITION_NAMES: Record<string, string> = {
  agarrado: 'Agarrado', amedrontado: 'Amedrontado', atordoado: 'Atordoado',
  caido: 'Caído', cego: 'Cego', enfeiticado: 'Enfeitiçado',
  envenenado: 'Envenenado', incapacitado: 'Incapacitado', inconsciente: 'Inconsciente',
  invisivel: 'Invisível', paralisado: 'Paralisado', petrificado: 'Petrificado',
  restrito: 'Restrito', surdo: 'Surdo', enfraquecido: 'Enfraquecido',
};

/** Retorna o nome PT-BR pra exibição. Fallback: capitaliza a 1ª letra do slug. */
export function getConditionName(condition: string): string {
  const key = condition.toLowerCase();
  return CONDITION_NAMES[key] ?? (condition.charAt(0).toUpperCase() + condition.slice(1));
}

/** Retorna formato "ICON Label" pronto pra exibir no chip. */
export function formatConditionLabel(condition: string): string {
  return `${getConditionIcon(condition)} ${getConditionName(condition)}`;
}

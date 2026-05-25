// JSgame · D&D 5e condições (PHB Apêndice A, pág 291).
// 14 condições que afetam criaturas. Usadas pelo motor de combate e narração.

export type ConditionId =
  | 'agarrado' | 'amedrontado' | 'atordoado' | 'caido' | 'cego'
  | 'enfeiticado' | 'envenenado' | 'incapacitado' | 'inconsciente'
  | 'invisivel' | 'paralisado' | 'petrificado' | 'restrito' | 'surdo';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  glyph: string;            // UI sting
  shortDesc: string;        // tooltip 1 linha
  effects: string[];        // efeitos mecânicos discretos (bullets pra UI)
}

export const CONDITIONS: Record<ConditionId, ConditionDef> = {
  agarrado: {
    id: 'agarrado', name: 'Agarrado', glyph: '🤝',
    shortDesc: 'Movimentação reduzida a 0.',
    effects: [
      'Deslocamento = 0, sem bônus a deslocamento',
      'Termina se quem agarrou ficar incapacitado ou se condição forçá-lo pra fora',
    ],
  },
  amedrontado: {
    id: 'amedrontado', name: 'Amedrontado', glyph: '😱',
    shortDesc: 'Desvantagem em ataques/testes enquanto vê fonte do medo.',
    effects: [
      'Desvantagem em testes e ataques enquanto a fonte estiver na linha de visão',
      'Não pode mover-se voluntariamente em direção à fonte',
    ],
  },
  atordoado: {
    id: 'atordoado', name: 'Atordoado', glyph: '💫',
    shortDesc: 'Incapacitado, não move, fala enrolado. Falha automática For/Des saves.',
    effects: [
      'Incapacitado (sem ações, sem reações)',
      'Falha automática em testes de resistência de For e Des',
      'Ataques contra ele têm vantagem',
    ],
  },
  caido: {
    id: 'caido', name: 'Caído', glyph: '↘',
    shortDesc: 'Deitado no chão. Custa metade do desloc pra se levantar.',
    effects: [
      'Único movimento: rastejar OU gastar metade do desloc pra levantar',
      'Desvantagem em ataques',
      'Ataques corpo-a-corpo contra ele têm vantagem; ataques à distância têm desvantagem',
    ],
  },
  cego: {
    id: 'cego', name: 'Cego', glyph: '🕶',
    shortDesc: 'Não vê. Falha em testes que dependem de visão.',
    effects: [
      'Falha automática em testes que exijam visão',
      'Ataques contra ele têm vantagem; seus ataques têm desvantagem',
    ],
  },
  enfeiticado: {
    id: 'enfeiticado', name: 'Enfeitiçado', glyph: '💖',
    shortDesc: 'Não ataca quem enfeitiçou. Quem enfeitiçou tem vantagem em interação social.',
    effects: [
      'Não pode atacar o encantador nem alvejá-lo com efeitos prejudiciais',
      'Encantador tem vantagem em testes sociais para interagir com ele',
    ],
  },
  envenenado: {
    id: 'envenenado', name: 'Envenenado', glyph: '☠',
    shortDesc: 'Desvantagem em ataques e testes de habilidade.',
    effects: [
      'Desvantagem em jogadas de ataque',
      'Desvantagem em testes de habilidade',
    ],
  },
  incapacitado: {
    id: 'incapacitado', name: 'Incapacitado', glyph: '∅',
    shortDesc: 'Não realiza ações nem reações.',
    effects: [
      'Sem ações',
      'Sem reações',
    ],
  },
  inconsciente: {
    id: 'inconsciente', name: 'Inconsciente', glyph: '💤',
    shortDesc: 'Incapacitado + caído + sem percepção do ambiente.',
    effects: [
      'Incapacitado (sem ações/reações)',
      'Não percebe nada à volta — derruba o que segurar e cai no chão',
      'Falha automática em saves de For e Des',
      'Ataques contra ele têm vantagem',
      'Ataques corpo-a-corpo a 1,5 m são críticos automáticos',
    ],
  },
  invisivel: {
    id: 'invisivel', name: 'Invisível', glyph: '👻',
    shortDesc: 'Impossível de ver sem magia/sentido especial.',
    effects: [
      'Considerado fortemente camuflado pra fins de esconder-se',
      'Posição pode ser detectada por som ou rastros',
      'Ataques contra ele têm desvantagem; seus ataques têm vantagem',
    ],
  },
  paralisado: {
    id: 'paralisado', name: 'Paralisado', glyph: '🧊',
    shortDesc: 'Incapacitado + não pode mover/falar. Crit automático corpo-a-corpo.',
    effects: [
      'Incapacitado, sem movimento, sem fala',
      'Falha automática em saves de For e Des',
      'Ataques contra ele têm vantagem',
      'Acertos corpo-a-corpo a 1,5 m são críticos automáticos',
    ],
  },
  petrificado: {
    id: 'petrificado', name: 'Petrificado', glyph: '🗿',
    shortDesc: 'Virou pedra. Incapacitado, sem percepção, resistência a tudo, imunidade a veneno/doença.',
    effects: [
      'Transformado (com equipamentos) em substância sólida — pedra',
      'Peso multiplicado por dez',
      'Incapacitado, sem percepção, sem fala',
      'Ataques contra ele têm vantagem',
      'Falha automática em saves de For e Des',
      'Resistência a todo dano',
      'Imune a veneno e doença (efeitos pré-existentes ficam pausados)',
    ],
  },
  restrito: {
    id: 'restrito', name: 'Restrito', glyph: '⛓',
    shortDesc: 'Deslocamento 0. Desvantagem em ataques.',
    effects: [
      'Deslocamento = 0',
      'Ataques contra ele têm vantagem; seus ataques têm desvantagem',
      'Desvantagem em saves de Destreza',
    ],
  },
  surdo: {
    id: 'surdo', name: 'Surdo', glyph: '🔇',
    shortDesc: 'Não ouve. Falha em testes que dependem de audição.',
    effects: [
      'Falha automática em testes que exijam audição',
    ],
  },
};

export function getCondition(id: ConditionId): ConditionDef {
  return CONDITIONS[id];
}

export const ALL_CONDITIONS: ConditionDef[] = Object.values(CONDITIONS);

// ════════════════════════════════════════════════════════════════════════════
// Exaustão — 6 níveis cumulativos (PHB pág 291). NÃO é condição padrão.
// ════════════════════════════════════════════════════════════════════════════

export const EXHAUSTION_LEVELS = [
  { level: 1, label: 'Cansado', effect: 'Desvantagem em testes de habilidade' },
  { level: 2, label: 'Esgotado', effect: 'Velocidade reduzida pela metade' },
  { level: 3, label: 'Debilitado', effect: 'Desvantagem em ataques e saves' },
  { level: 4, label: 'Quebrado', effect: 'HP máximo pela metade' },
  { level: 5, label: 'Moribundo', effect: 'Velocidade reduzida a 0' },
  { level: 6, label: 'Morto', effect: 'Morte por exaustão' },
] as const;

export function exhaustionDescription(level: number): string {
  if (level < 1) return '';
  const cap = Math.min(6, Math.floor(level));
  const acc = EXHAUSTION_LEVELS.slice(0, cap).map((l) => `Nv${l.level}: ${l.effect}`).join(' · ');
  return `Exaustão ${cap}/6 — ${acc}`;
}

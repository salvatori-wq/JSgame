// JSgame · Motor de ícones SVG (Fase 1A "Rumo ao 10/10").
//
// Substitui emojis por ícones vetoriais autênticos de fantasia (game-icons.net,
// CC BY 3.0 — ver CREDITS.md). SVG = nítido em qualquer DPI, escala no mobile,
// herda cor via `currentColor`. Tudo embarcado no bundle: zero call em runtime.
//
// Filosofia de fallback: TODA função aceita um emoji de reserva. Se o ícone não
// existir no registry (ex.: nome de inimigo exótico do Mestre IA), cai no emoji
// graciosamente — nunca quebra a UI. Migração incremental e reversível.

import { GAME_ICON_DATA } from './game-icons-data';

export interface GameIconOpts {
  /** classe(s) CSS extra no <svg> (além de `gi`) */
  className?: string;
  /** título acessível (vira <title> + aria-label) */
  title?: string;
  /** rótulo aria sem <title> visível (se title não for dado) */
  ariaLabel?: string;
}

/** True se há um ícone SVG registrado pra esse nome game-icons. */
export function hasGameIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(GAME_ICON_DATA, name);
}

/**
 * Markup string `<svg>…</svg>` pronto pra innerHTML / templates.
 * Retorna '' se o ícone não existe (caller decide o fallback).
 */
export function gameIconMarkup(name: string, opts: GameIconOpts = {}): string {
  const raw = GAME_ICON_DATA[name];
  if (!raw) return '';
  const cls = opts.className ? `gi ${opts.className}` : 'gi';
  const titleEl = opts.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  // Acessibilidade: com title → role img + aria-label; sem → aria-hidden
  // (decorativo, o texto adjacente carrega o significado).
  const a11y = opts.title
    ? `role="img" aria-label="${escapeXml(opts.title)}"`
    : opts.ariaLabel
      ? `role="img" aria-label="${escapeXml(opts.ariaLabel)}"`
      : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" viewBox="0 0 ${raw.w} ${raw.h}" ${a11y} xmlns="http://www.w3.org/2000/svg">${titleEl}${raw.b}</svg>`;
}

/**
 * Elemento DOM <span class="gi-wrap"> contendo o SVG do ícone, OU o emoji de
 * reserva (como texto) se o ícone não existir. É o helper preferido nos
 * call-sites baseados em `el()`.
 */
export function iconEl(name: string, fallbackEmoji: string, opts: GameIconOpts = {}): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = opts.className ? `gi-wrap ${opts.className}` : 'gi-wrap';
  const markup = gameIconMarkup(name, { ...opts, className: undefined });
  if (markup) {
    span.innerHTML = markup;
    if (opts.title) span.setAttribute('title', opts.title);
  } else {
    span.classList.add('gi-wrap-emoji');
    span.textContent = fallbackEmoji;
    if (opts.title) span.setAttribute('title', opts.title);
    else if (opts.ariaLabel) span.setAttribute('aria-label', opts.ariaLabel);
  }
  return span;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ════════════════════════════════════════════════════════════════════════════
// Mapas semânticos — D&D 5e → nome game-icons
// ════════════════════════════════════════════════════════════════════════════

/** ClassId PT-BR (ver src/dnd/classes.ts) → ícone. */
export const CLASS_ICON: Record<string, string> = {
  barbaro: 'battle-axe',
  bardo: 'lyre',
  bruxo: 'evil-eyes',
  clerigo: 'holy-symbol',
  druida: 'oak',
  feiticeiro: 'magic-swirl',
  guerreiro: 'broadsword',
  ladino: 'hood',
  mago: 'pointy-hat',
  monge: 'fist',
  paladino: 'winged-sword',
  patrulheiro: 'high-shot',
};

/** Condição PT-BR (lower) → ícone. Algumas caem no emoji (não mapeadas). */
export const CONDITION_ICON: Record<string, string> = {
  inconsciente: 'dead-head',
  atordoado: 'knocked-out-stars',
  petrificado: 'stone-bust',
  amedrontado: 'terror',
  agarrado: 'grab',
  restrito: 'imprisoned',
  envenenado: 'poison-bottle',
  enfeiticado: 'hearts',
  caido: 'falling',
  cego: 'blindfold',
  enfraquecido: 'broken-bone',
  invisivel: 'invisible',
  incapacitado: 'cancel',
  // paralisado / surdo / paralizado → sem ícone bom → emoji fallback (⏸ / 👂)
};

/** Escola de magia (id em src/dnd/spells.ts) → ícone. */
export const SCHOOL_ICON: Record<string, string> = {
  abjuracao: 'shield',
  adivinhacao: 'all-seeing-eye',
  conjuracao: 'magic-portal',
  encantamento: 'charm',
  evocacao: 'fireball',
  ilusao: 'psychic-waves',
  necromancia: 'dead-head',
  transmutacao: 'transform',
};

/** Tipo de item (InventoryItem['type']) → ícone. */
export const ITEM_TYPE_ICON: Record<string, string> = {
  arma: 'crossed-swords',
  armadura: 'breastplate',
  escudo: 'checked-shield',
  consumivel: 'round-potion',
  tesouro: 'gems',
  ferramenta: 'gear-hammer',
  misc: 'backpack',
};

// ════════════════════════════════════════════════════════════════════════════
// Matcher de inimigo — nome livre (gerado pelo Mestre IA) → criatura
// ════════════════════════════════════════════════════════════════════════════

/**
 * Pares [regex, ícone] testados em ordem. PT-BR + EN. O nome do inimigo vem do
 * LLM (livre), então casamos por palavra-chave. Ordem importa: específico antes
 * de genérico. Sem match → null (caller usa fallback genérico/emoji).
 */
const ENEMY_PATTERNS: Array<[RegExp, string]> = [
  [/goblin|gnoll|trasgo/i, 'goblin-head'],
  [/\borc|orc\b|meio-?orc/i, 'orc-head'],
  [/esqueleto|skeleton|caveira ambulante|morto-?vivo|undead/i, 'skeleton'],
  [/zumbi|zombie|ghoul|carniçal/i, 'shambling-zombie'],
  [/lobishomem|werewolf|licantropo/i, 'werewolf'],
  [/lobo|wolf|cão|cao|hound|mastim|matilha/i, 'wolf-head'],
  [/urso|bear|urso/i, 'bear-head'],
  [/javali|boar|porco|suíno/i, 'boar'],
  [/leão|leao|lion|felino|pantera|tigre|tiger/i, 'lion'],
  [/dragão|dragao|dragon|wyrm|drake/i, 'dragon-head'],
  [/wyvern|serpe alada/i, 'wyvern'],
  [/hidra|hydra/i, 'hydra'],
  [/aranha|spider|aracníd|aracnid/i, 'spider-face'],
  [/serpente|cobra|snake|naja|víbora|vibora|réptil|reptil/i, 'snake'],
  [/lagarto|lizard|lacraia|homem-?lagarto|saurial|kobold/i, 'lizardman'],
  [/rato|ratazana|\brat\b|roedor/i, 'rat'],
  [/polvo|octopus|tentácul|tentacul|lula|kraken|aboleth/i, 'octopus'],
  [/limo|gosma|slime|ooze|cubo gelatinoso|geleia|gelatinoso/i, 'slime'],
  [/trol|troll/i, 'troll'],
  [/ogro|ogre/i, 'ogre'],
  [/minotauro|minotaur/i, 'minotaur'],
  [/harpia|harpy/i, 'harpy'],
  [/gigante|giant|titã|tita\b|colosso/i, 'giant'],
  [/vampiro|vampire|vampira/i, 'vampire-dracula'],
  [/fantasma|espectro|spectre|specter|wraith|assombra|aparição|aparicao|alma penada/i, 'spectre'],
  [/espírito|espirito|ghost|alma|wisp|banshee/i, 'ghost'],
  [/diabo|devil|diablo|capeta|cão infernal|cao infernal/i, 'devil-mask'],
  [/demônio|demonio|demon|imundo|abissal/i, 'horned-skull'],
  [/diabrete|imp|quasit|familiar maligno/i, 'imp'],
  [/cultista|cultist|sectário|sectario|fanático|fanatico|adorador/i, 'cultist'],
  [/bandido|bandit|ladrão|ladrao|salteador|assaltante|saqueador|gatuno|capanga|brigão|brigao/i, 'bandit'],
  [/assassino|assassin|matador|sicário|sicario/i, 'hood'],
  [/bruxo|bruxa|warlock|feiticeir|witch|necromante|necromancer|mago negro/i, 'evil-eyes'],
  [/cavaleiro|knight|soldado|guarda|guard|guerreiro|warrior|mercenário|mercenario|capitão|capitao/i, 'broadsword'],
  [/morcego|\bbat\b|chiroptera/i, 'fangs'],
];

/**
 * Resolve um nome de inimigo livre pra um nome game-icons.
 * Boss sem match → ícone de "horned-skull" (cara de chefe). Comum sem match →
 * 'fangs' (criatura genérica). Retorna sempre um nome válido do registry.
 */
export function enemyIconName(name: string, isBoss = false): string {
  const n = (name ?? '').toLowerCase();
  for (const [re, icon] of ENEMY_PATTERNS) {
    if (re.test(n)) return icon;
  }
  return isBoss ? 'horned-skull' : 'fangs';
}

// ── Helpers de conveniência (icon name por domínio, com fallback embutido) ──

/** Ícone de classe ou '' se a classe não for mapeada. */
export function classIconName(classId: string | null | undefined): string {
  if (!classId) return '';
  return CLASS_ICON[classId.toLowerCase().trim()] ?? '';
}

/** Ícone de condição ou '' se não mapeada (caller usa emoji PHB). */
export function conditionIconName(condition: string): string {
  return CONDITION_ICON[(condition ?? '').toLowerCase().trim()] ?? '';
}

/** Ícone de escola de magia ou '' se não mapeada. */
export function schoolIconName(school: string): string {
  return SCHOOL_ICON[(school ?? '').toLowerCase().trim()] ?? '';
}

/** Ícone de tipo de item ou '' se não mapeado. */
export function itemTypeIconName(type: string): string {
  return ITEM_TYPE_ICON[(type ?? '').toLowerCase().trim()] ?? '';
}

// JSgame · γ.2 — Server-side keyword detector pra forçar mais rolls.
//
// Problema: apesar da REGRA DE OURO no prompt do DM + α.1 chips com hint,
// o LLM ocasionalmente narra resultados de ação sem chamar `request_skill_check`.
// Player passa turnos sem rolar = sente que está "lendo livro".
//
// Solução: regex match em `details` (e fallback em `action`) com 12 keyword
// patterns. Se match e DM AINDA não setou pendingCheck nem chamou request_skill_check,
// server injeta automaticamente. DM respeita override quando explícito.
//
// IMPORTANT: pure function — sem side effects. Caller (campaign.takeAction)
// decide quando aplicar. Tests cobrem cada keyword + edge cases (negação,
// ação vazia, combat skip).

import type { SkillId } from '../shared/types.js';

export interface DetectedSkillCheck {
  skill: SkillId;
  dc: number;
  reason: string;
}

// Patterns ordenados por prioridade — primeiro match vence. Word-boundary
// (`\b`) evita falsos positivos (ex: "investigation" não bate em "vestigation").
// Cada pattern é case-insensitive via flag /i.
const KEYWORD_PATTERNS: Array<{
  re: RegExp;
  skill: SkillId;
  dc: number;
  reason: string;
}> = [
  { re: /\b(investig|examin|procur|vasculh|busc|olh\w*\s+atent|inspecion)/i,
    skill: 'investigacao', dc: 12, reason: 'Procurar pistas' },
  { re: /\b(persuad|convenc|negoc|barganh|argument)/i,
    skill: 'persuasao', dc: 13, reason: 'Convencer alguém' },
  { re: /\b(intimid|amedront|amea[çc]|coag)/i,
    skill: 'intimidacao', dc: 13, reason: 'Intimidar' },
  { re: /\b(engan|mentir|minto|mentindo|iludi|blefar|blefe|fars)/i,
    skill: 'enganacao', dc: 14, reason: 'Enganar' },
  { re: /\b(escut|ouvir\s+atent|ouv\w*\s+(?:os|o)\s|notar|perceb|atentar)/i,
    skill: 'percepcao', dc: 12, reason: 'Notar algo' },
  { re: /\b(esgu|furtad|esconde|sorrateir|silencios|esgueir|na\s+ponta|sneak)/i,
    skill: 'furtividade', dc: 13, reason: 'Mover sem ser visto' },
  { re: /\b(escal|saltar|salto|balan[çc]|trep|nada|nadar|arrast|empurrar\s+(?:a|o)\s+pedra)/i,
    skill: 'atletismo', dc: 12, reason: 'Esforço físico' },
  { re: /\b(equilibr|cambalho|cambalh|acrobaci|cair|tombar|esquiv\w*\s+pulando)/i,
    skill: 'acrobacia', dc: 12, reason: 'Equilíbrio/agilidade' },
  { re: /\b(lembrar\s+(?:da|do|de)|recordar|conhe[çc]o\s+sobre|estud\w*\s+(?:livro|tomo|relíquia))/i,
    skill: 'historia', dc: 14, reason: 'Recordar lore' },
  { re: /\b(curar|tratar\s+(?:a\s+|o\s+)?(?:ferid|machucad|aliad|companheir)|medicar|bandag|estabiliz|primeiro[\s-]socorro)/i,
    skill: 'medicina', dc: 12, reason: 'Tratar ferimentos' },
  { re: /\b(rastrear|ca[çc]ar|sobreviv|seguir\s+pegada|trilh|farejar)/i,
    skill: 'sobrevivencia', dc: 13, reason: 'Rastrear' },
  { re: /\b(arromba|picka|pick.?lock|destranc|destravar\s+fechadur|forçar\s+fechadur|escapar\s+de\s+amarras)/i,
    skill: 'prestidigitacao', dc: 14, reason: 'Habilidade manual' },
];

// Patterns de NEGAÇÃO — se match, NÃO dispara skill check. Cobre "evita olhar",
// "não vou investigar", "esqueço o que sabia".
const NEGATION_RE = /\b(n[ãa]o\s+(?:vou\s+)?(?:investig|olh|examin|persuad|intimid|engan|escut|esgueir|nada|escal|lembr|curar|rastrear|arromb)|evita(?:r|m)?\s+(?:olhar|investig|examin|persuad)|esquec\w*\s+(?:do|da|o\s+que))/i;

/**
 * Tenta detectar um skill check implícito na ação do player.
 *
 * @param action exploration action enum ('explore' / 'investigate' / etc).
 * @param details string livre do player descrevendo o que faz. Pode ser undefined.
 * @returns skill+dc+reason se detectado, null caso contrário.
 *
 * Regras:
 * - Action vazia (sem details, ou só explore genérico) → null
 * - Negação explícita ("não vou investigar") → null
 * - Múltiplas keywords match → primeira da tabela (priority order)
 * - Action 'attack' / 'cast-spell' / 'rest-*' → null (não-aplicáveis)
 */
export function detectImpliedSkillCheck(
  action: string | undefined,
  details: string | undefined,
): DetectedSkillCheck | null {
  // Combat-aware: combat actions têm fluxo próprio. Não injeta check.
  if (action === 'attack' || action === 'cast-spell') return null;
  if (action === 'rest-short' || action === 'rest-long') return null;
  if (action === 'use-item' || action === 'travel') return null;

  // Sem details + action genérica → não dá pra adivinhar. Skip.
  const text = (details ?? '').trim();
  if (text.length < 4) return null;

  // Negação explícita
  if (NEGATION_RE.test(text)) return null;

  // Verifica keywords em ordem
  for (const p of KEYWORD_PATTERNS) {
    if (p.re.test(text)) {
      return { skill: p.skill, dc: p.dc, reason: p.reason };
    }
  }
  return null;
}

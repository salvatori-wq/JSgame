// JSgame · γ.2 + Mestre Experiente — Server-side keyword detector pra forçar mais rolls.
//
// Problema: apesar da REGRA DE OURO no prompt do DM + α.1 chips com hint,
// o LLM ocasionalmente narra resultados de ação sem chamar `request_skill_check`.
// Player passa turnos sem rolar = sente que está "lendo livro".
//
// Solução: regex match em `details` (e fallback em `action`) com 25+ keyword
// patterns cobrindo TODAS as 18 perícias D&D 5e + saves comuns. Se match e DM
// AINDA não setou pendingCheck nem chamou request_skill_check, server injeta
// automaticamente. DM respeita override quando explícito.
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
//
// Cobertura por pilar:
//   FÍSICAS  (FOR/DES): atletismo, acrobacia, furtividade, prestidigitacao
//   MENTAIS  (INT/SAB): arcanismo, historia, investigacao, natureza, religiao,
//                       medicina, percepcao, sobrevivencia, intuicao, lidar-com-animais
//   SOCIAIS  (CAR):     persuasao, enganacao, intimidacao, atuacao
const KEYWORD_PATTERNS: Array<{
  re: RegExp;
  skill: SkillId;
  dc: number;
  reason: string;
}> = [
  // ═══════ MENTAIS — mais específicas primeiro pra não conflitar com Investigação ═══════
  { re: /\b(identific\w+\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:magia|encantament|runa|gl[íi]fo|artefat)|reconhec\w+\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:magia|encantament|runa)|estudar\s+(?:a|o)\s+(?:runa|encantament|magia)|sentir\s+aura\s+m[áa]gic)/i,
    skill: 'arcanismo', dc: 14, reason: 'Identificar magia/runa' },
  { re: /\b(reconhec\w+\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:s[ií]mbol|deusa|deus|relíquia\s+sagrad|culto)|identific\w+\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:s[ií]mbol|morto[-\s]vivo|undead|tipo\s+de\s+morto)|orar|invoc(?:ar|o)\s+(?:a\s+|o\s+)?(?:deusa|deus)|rito\s+sagrad)/i,
    skill: 'religiao', dc: 13, reason: 'Conhecimento religioso' },
  { re: /\b(identific\w+\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:planta|ervas|fungo|criatura|besta|animal)|reconhec\w+\s+(?:a\s+|o\s+)?(?:planta|veneno\s+vegetal|criatura\s+selvagem)|prever\s+(?:o\s+|a\s+)?clim|ler\s+(?:o\s+)?cli|comestível|venenos[oa])/i,
    skill: 'natureza', dc: 13, reason: 'Conhecimento natural' },
  { re: /\b(diagn[óo]stic|examin\w+\s+(?:o\s+|a\s+)?(?:corp|cad[áa]ver|ferid)|causa\s+(?:da\s+)?morte|identific\w+\s+(?:o\s+|a\s+)?veneno|tratar\s+(?:a\s+|o\s+)?(?:ferid|machucad|aliad|companheir)|medicar|bandag|estabiliz|primeiro[\s-]socorro|curar)/i,
    skill: 'medicina', dc: 13, reason: 'Diagnóstico/cura' },
  { re: /\b(rastrear|ca[çc]ar|sobreviv|seguir\s+pegada|trilh|farejar|forrage|achar\s+(?:comid|trilha|caminho|abrigo)|nav?egar\s+sem|prever\s+(?:o\s+)?tempo)/i,
    skill: 'sobrevivencia', dc: 13, reason: 'Sobrevivência/rastreio' },
  { re: /\b(acalm\w+\s+(?:o\s+|a\s+)?(?:cavalo|cachorro|c[ãa]o|besta|animal|montaria)|monto?\s+(?:no|na|o|a)\s+(?:cavalo|grifo|p[ôo]nei|montaria)|cavalgar|domar|treinar\s+(?:o\s+)?(?:cavalo|animal|besta)|controlar\s+(?:a\s+|o\s+)?montaria)/i,
    skill: 'adestrar-animais', dc: 12, reason: 'Lidar com animal' },
  { re: /\b(lembrar\s+(?:da|do|de)|recordar|conhe[çc]o\s+sobre|estud\w*\s+(?:livro|tomo|rel[íi]quia|crônica)|hist[óo]ria\s+(?:de|do|da)|legenda|antiguidade|reino\s+antig)/i,
    skill: 'historia', dc: 14, reason: 'Recordar lore' },
  { re: /\b(investig|examin|procur|vasculh|busc|olh\w*\s+atent|inspecion|analis|deduzir|decifr\w+\s+(?:mecanism|charada|enigma))/i,
    skill: 'investigacao', dc: 12, reason: 'Investigar/deduzir' },
  { re: /\b(escut|ouvir\s+atent|ouv\w*\s+(?:os|o)\s|notar|perceb|atentar|observar\s+(?:a\s+|o\s+)?(?:sala|ambiente|arredor|sombras)|cheir\w*\s+(?:o\s+|a\s+)?(?:ar|ambient|sala|cheir)|sint(?:o|ir)\s+(?:o\s+|a\s+|uma\s+|um\s+)?(?:cheir|aura|tens[ãa]o|presen[çc]a)|toco?\s+(?:com\s+)?cuidado|me\s+aproxim\w+\s+(?:devagar|com\s+cuidado))/i,
    skill: 'percepcao', dc: 12, reason: 'Notar algo' },
  { re: /\b(verifico\s+se\s+(?:ele|ela|isso)?\s*(?:mente|fala\s+verdade)|sinto\s+(?:que\s+)?(?:ele|ela)?\s*(?:mente|esconde|h[áa]\s+algo|esconde\s+algo)|leio\s+(?:a\s+)?inten[çc][ãa]o|duvid\w+\s+(?:do|da)|olho\s+(?:nos\s+)?olhos)/i,
    skill: 'intuicao', dc: 13, reason: 'Ler intenção' },

  // ═══════ FÍSICAS ═══════
  { re: /\b(esgu|furtad|esconde|sorrateir|silencios|esgueir|na\s+ponta\s+(?:dos\s+)?p[ée]|sneak|me\s+escond)/i,
    skill: 'furtividade', dc: 13, reason: 'Mover sem ser visto' },
  { re: /\b(arromba|picka|pick.?lock|destranc|destravar\s+fechadur|forçar\s+fechadur|escapar\s+de\s+amarras|abrir\s+a\s+fechadur|gazua|ladroag|punga|bols)/i,
    skill: 'prestidigitacao', dc: 14, reason: 'Habilidade manual' },
  { re: /\b(escal|saltar|salto|balan[çc]|trep|nada|nadar|arrast|empurr\w+\s+(?:a|o|com|de)|levant\w+\s+(?:a\s+|o\s+)?(?:port|gigante|gradem|pesad|pedra|t[áa]bua|ba[úu]|caix)|abr\w+\s+(?:a\s+|o\s+)?(?:port|ba[úu]|caix|tampa)\s+(?:com\s+)?(?:for[çc]|truncad|trinquete))/i,
    skill: 'atletismo', dc: 12, reason: 'Esforço físico' },
  { re: /\b(equilibr|cambalho|cambalh|acrobaci|cair\s+(?:com\s+)?(?:estilo|gracios)|rolamento|esquiv\w*\s+pulando|cambalear)/i,
    skill: 'acrobacia', dc: 12, reason: 'Equilíbrio/agilidade' },

  // ═══════ SOCIAIS ═══════
  { re: /\b(persuad|convenc|negoc|barganh|argument|tento?\s+(?:falar|conversar)\s+(?:com\s+)?(?:o\s+|a\s+)|raciocin\w+\s+com)/i,
    skill: 'persuasao', dc: 13, reason: 'Convencer alguém' },
  { re: /\b(intimid|amedront|amea[çc]|coag|imp[õo]r\s+respeito|encarar\s+(?:com\s+)?(?:f[úu]ria|raiv))/i,
    skill: 'intimidacao', dc: 13, reason: 'Intimidar' },
  { re: /\b(engan|mentir|minto|mentindo|iludi|blefar|blefe|fars|disfar[cç]\w+|finjo|finge|me\s+passo\s+por)/i,
    skill: 'enganacao', dc: 14, reason: 'Enganar' },
  { re: /\b(cantar|canto\s|cant\w+\s+(?:uma\s+)?(?:m[úu]sic|cançã|cancao)|(?:toca|tocar|toco)\s+(?:o\s+|a\s+|uma\s+|um\s+)?(?:instrumento|ala[úu]de|harpa|flaut|tambor)|atuar|representar|impersonar|distrair\s+(?:com|via)\s+(?:m[úu]sic|atua))/i,
    skill: 'atuacao', dc: 13, reason: 'Performance' },
];

// Patterns de NEGAÇÃO — se match, NÃO dispara skill check. Cobre "evita olhar",
// "não vou investigar", "esqueço o que sabia".
const NEGATION_RE = /\b(n[ãa]o\s+(?:vou\s+)?(?:investig|olh|examin|persuad|intimid|engan|escut|esgueir|nada|escal|lembr|curar|rastrear|arromb|cant|tent|tocar|reconhec|identific)|evita(?:r|m)?\s+(?:olhar|investig|examin|persuad)|esquec\w*\s+(?:do|da|o\s+que)|desisto)/i;

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

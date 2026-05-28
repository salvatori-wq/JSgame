// JSgame · Sprint Y.A1 — Narration Fog-of-War Linter (server-side).
//
// Detecta vazamento de números do oponente na narração da LLM. SYSTEM_PROMPT
// proíbe (X.A4 Sprint X) mas LLM vaza ~10-15% das vezes — consultor D&D:
// "regra é instrução, não enforcement. Sem linter a regra é aspiracional".
//
// Pipeline em dm.ts:
//  1. LLM retorna narration
//  2. lintNarrationForOpponentNumbers(text) detecta violações
//  3. Se violação: 1× retry com correctionPromptForNarration() injetado
//  4. Se retry também viola: sanitizeOpponentNumbers() substitui por adjetivos
//  5. Log warning + telemetria
//
// Patterns proibidos (consultor D&D Sprint X seção fog of war):
//  - X HP / X/Y HP                    → "ferido / muito ferido / à beira"
//  - CA X / AC X                       → omit
//  - DC X vs [stat]                    → omit ou "teste difícil"
//  - +X de ataque / +X attack          → omit
//  - XdY+Z (dado de dano)              → omit ou "lâmina pesada"
//  - X pés / X ft / X de movimento     → omit ou "perto / longe"
//  - +X XP                             → omit (não é do oponente, mas ruído)
//
// Aceito (NÃO disparam linter):
//  - Contagem turnos/rounds: "3 turnos pro ritual", "1 round restante"
//  - Nome de arma/spell: "Bless", "Misty Step", "Espada Longa"
//  - Damage TAKEN PELO PLAYER: "7 de dano cortante" (tool já narra)
//  - Adjetivos de HP: "intacto / arranhado / ferido / muito ferido / à beira"

export interface LintResult {
  hasViolation: boolean;
  /** Substrings que matched, pra log/correction prompt. */
  matches: string[];
  /** Texto sanitizado: cada match substituído por adjetivo neutro. */
  sanitized: string;
}

/**
 * Regex patterns proibidos (compilados uma vez). Ordem importa — mais
 * específicos primeiro pra não capturar substring vazia.
 *
 * Cada entry: [pattern, sanitizedReplacement].
 * Sanitized usa adjetivo da lista permitida do PHB.
 */
const PATTERNS: Array<{ re: RegExp; replace: string; description: string }> = [
  // "12/45 HP" / "23/30 vida" — barra HP exposta
  { re: /\b\d+\s*\/\s*\d+\s*(HP|vida|hp|saúde)\b/gi, replace: 'ferido', description: 'HP fração' },
  // "tem 23 HP" / "está com 12 HP" — número + HP
  { re: /(?:tem|está com|possui|sobrou|resta)\s+\d+\s*(?:de\s+)?(HP|vida|pontos\s+de\s+vida)\b/gi, replace: 'parece ferido', description: 'tem X HP' },
  // "HP 23" / "HP: 12" — abreviação técnica
  { re: /\bHP\s*[:=]?\s*\d+(?:\/\d+)?\b/gi, replace: '(estado físico variável)', description: 'HP:N' },
  // "CA 16" / "AC 14" / "armor class 18" — classe de armadura
  { re: /\b(?:CA|AC|armor\s+class|classe\s+de\s+armadura)\s*[:=]?\s*\d+\b/gi, replace: '(armadura pesada)', description: 'CA/AC numerico' },
  // "DC 15" / "DC: 14 vs Constituição" — dificuldade exposta
  { re: /\bDC\s*[:=]?\s*\d+(?:\s+vs\s+\w+)?/gi, replace: 'teste difícil', description: 'DC explícito' },
  // "+5 de ataque" / "+3 to hit" / "bônus +5"
  { re: /[+\-−]\s*\d+\s+(?:de\s+|to\s+|para\s+)?ataque\b/gi, replace: 'ataque preciso', description: '+N ataque' },
  { re: /\bbônus\s*[:=]?\s*[+\-−]?\s*\d+\b/gi, replace: 'com bônus', description: 'bônus N' },
  // "1d8+3" / "2d6+5" / "3d10" — fórmula de dano
  { re: /\b\d+d\d+(?:\s*[+\-−]\s*\d+)?\b(?!\s*(?:turno|round|hora|minuto))/gi, replace: 'golpe pesado', description: 'XdY+Z fórmula' },
  // "30 pés" / "60 ft" / "15 metros" — distância numérica precisa do oponente
  // (aceita "9m" porque ribbon ec.movement do PLAYER passa por aí — só pega ft/pés)
  { re: /\b\d+\s*(?:pés|ft|feet)\b/gi, replace: 'à distância', description: 'pés/ft' },
];

/**
 * Analisa o texto da narração e retorna violações.
 * Texto NUNCA mutado quando hasViolation=false — passa pro client igual.
 */
export function lintNarrationForOpponentNumbers(text: string): LintResult {
  const matches: string[] = [];
  let sanitized = text;
  for (const pat of PATTERNS) {
    // Coleta matches sem flag global manipulado
    const re = new RegExp(pat.re.source, pat.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push(m[0]);
      // Previne loop infinito em padrão zero-length
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    // Aplica substituição se houve match neste padrão
    if (matches.length > 0) {
      sanitized = sanitized.replace(pat.re, pat.replace);
    }
  }
  return {
    hasViolation: matches.length > 0,
    matches: dedupe(matches),
    sanitized,
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/**
 * Gera prompt de correção pra retry. Lista as violações que o LLM cometeu
 * e instrui reescrita SEM aqueles números.
 */
export function correctionPromptForNarration(originalNarration: string, matches: string[]): string {
  const violationList = matches.map((m) => `  - "${m}"`).join('\n');
  return [
    '## CORREÇÃO OBRIGATÓRIA',
    '',
    'Sua narração violou a regra de FOG OF WAR (proibido citar números do oponente).',
    '',
    'Você escreveu:',
    `> ${originalNarration}`,
    '',
    'Violações detectadas:',
    violationList,
    '',
    'REESCREVA a narração SEM esses números. Use adjetivos e sinais corporais:',
    '  - HP → "intacto / arranhado / ferido / muito ferido / à beira / caído"',
    '  - "respira pesado", "mancando", "sangrando", "olha apavorado"',
    '  - CA/DC/dano: omita (player vê resultado via tool, não na narração)',
    '',
    'Mantenha mesmo tom, mesma cena, mesma duração (2-4 frases). Responda em JSON {"narration": "..."}.',
  ].join('\n');
}

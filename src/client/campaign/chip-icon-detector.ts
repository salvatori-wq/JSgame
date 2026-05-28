// M2.1 — Detector client-side de verbo na chip label.
// Retorna emoji prefix apropriado pra chip de ação (não-skill). Skill chips
// já recebem 🎲 prefix automaticamente. Aqui o foco é AÇÕES como "Falar com
// NPC" / "Seguir em frente" / "Atacar" etc — pra player reconhecer ação à 1ª
// vista sem ler texto inteiro.
//
// Função pura sem dep de DOM — testável com vitest puro.

interface VerbPattern {
  /** Regex case-insensitive testando o início da label (ou palavra inicial). */
  pattern: RegExp;
  icon: string;
}

// Ordem importa: padrões mais específicos antes dos genéricos.
const PATTERNS: VerbPattern[] = [
  // Falar / conversar / dialogar / sussurrar
  { pattern: /^(falar|conversar|dialogar|sussurrar|chamar|gritar|cumprimentar|perguntar)\b/i, icon: '🗣' },
  // Atacar / golpear / desferir / esfaquear
  { pattern: /^(atacar|golpear|desferir|esfaquear|cortar|estoquear|lutar)\b/i, icon: '⚔' },
  // Conjurar / lançar magia / invocar
  { pattern: /^(conjurar|lan[çc]ar magia|invocar|recitar|canalizar)\b/i, icon: '🔮' },
  // Curar / ajudar / proteger
  { pattern: /^(curar|ajudar|salvar|proteger|benzer|aben[çc]oar)\b/i, icon: '💚' },
  // Fugir / recuar
  { pattern: /^(fugir|recuar|escapar|correr)\b/i, icon: '🏃' },
  // Esconder / furtar-se
  { pattern: /^(esconder|furtar|emboscar|infiltrar)\b/i, icon: '🥷' },
  // Pegar / recolher / agarrar
  { pattern: /^(pegar|agarrar|recolher|coletar|apanhar|tomar)\b/i, icon: '✋' },
  // Abrir / destrancar
  { pattern: /^(abrir|destrancar|arrombar|forçar a porta|romper)\b/i, icon: '🔓' },
  // Ler / examinar texto/livro/runa
  { pattern: /^(ler|estudar|decifrar|interpretar)\b/i, icon: '📖' },
  // Esperar / aguardar / observar
  { pattern: /^(esperar|aguardar|vigiar|observar passivamente)\b/i, icon: '⏳' },
  // Seguir / continuar / avançar
  { pattern: /^(seguir|continuar|avan[çc]ar|prosseguir|caminhar|andar|ir at[ée])\b/i, icon: '🚶' },
  // Subir / escalar
  { pattern: /^(subir|escalar|trepar|ascender)\b/i, icon: '🧗' },
  // Beber / comer
  { pattern: /^(beber|comer|consumir|degustar|provar)\b/i, icon: '🍺' },
  // Dormir / descansar
  { pattern: /^(dormir|descansar|repousar|acampar)\b/i, icon: '🌙' },
  // Equipar / vestir
  { pattern: /^(equipar|vestir|empunhar|sacar|desembainhar)\b/i, icon: '🛡' },
  // Comprar / vender / negociar
  { pattern: /^(comprar|vender|negociar|comerciar|barganhar)\b/i, icon: '💰' },
];

/**
 * Retorna icon emoji pra chip não-skill baseado no verbo inicial da label.
 * Devolve null se nenhum padrão match (UI não adiciona prefix).
 *
 * Skill chips (hint presente) recebem 🎲 prefix em outro código —
 * NÃO chamar essa função pra elas (sobreescreveria o dado).
 *
 * @param label Texto da chip ex: "Falar com Borin", "Seguir em frente"
 * @returns Emoji icon ou null
 */
export function detectChipIcon(label: string): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  for (const p of PATTERNS) {
    if (p.pattern.test(trimmed)) return p.icon;
  }
  return null;
}

/**
 * Helper interno pra tests: lista todos os patterns + icons (sanity check).
 */
export function listChipIconPatterns(): ReadonlyArray<{ pattern: string; icon: string }> {
  return PATTERNS.map((p) => ({ pattern: p.pattern.source, icon: p.icon }));
}

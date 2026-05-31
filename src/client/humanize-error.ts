// Sub-sprint C — Tradutor de erros técnicos do servidor pra mensagens
// family-friendly. Usado em campaign-screen toast pra evitar despejar
// stacktrace/connection-string/HTTP codes na cara do jogador.
//
// Estratégia: mapeia padrões conhecidos pra mensagens curtas em PT-BR.
// Fallback: prefixa com "🌙 " pra dar tom narrativo se nada match.

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // ─── LLM/IA ────────────────────────────────────────────────────────────
  // Ordem importa: "all providers failed" precisa bater ANTES do generic fail pattern
  [/Mestre demorou demais|timeout|timed out|ETIMEDOUT/i,
   '⌛ O Mestre demorou demais pra responder. Tenta de novo daqui a pouco.'],
  [/no provider|all providers (failed|down)|nenhum provider/i,
   '🌙 Todos os Mestres IA estão indisponíveis agora. Tente recarregar a página.'],
  [/Llama|Groq|Gemini|Anthropic|Mistral|provider.*fail|API key|403|429/i,
   '🧠 O Mestre IA tropeçou. Já estou tentando outro caminho — espere alguns segundos.'],

  // ─── Network ───────────────────────────────────────────────────────────
  [/network|ECONNREFUSED|ENOTFOUND|fetch fail|failed to fetch/i,
   '📡 Sem sinal com o servidor. Verifique sua conexão e tente novamente.'],
  [/500 Internal Server Error|500|Internal Server/i,
   '🌙 Algo se quebrou no servidor. Tente novamente em alguns segundos.'],
  [/503|service unavailable|502|bad gateway/i,
   '🌙 Servidor em manutenção. Volte daqui a pouco.'],
  // Cold-start do Render free devolve HTML (página de proxy) em vez de JSON →
  // res.json() lança SyntaxError. Trata como "servidor acordando".
  [/SyntaxError|Unexpected token|not valid JSON|Unexpected end of (JSON|input)/i,
   '🌙 O servidor está acordando. Tente de novo em alguns segundos.'],

  // ─── Combate / regras ──────────────────────────────────────────────────
  [/not your turn|turno de outro/i,
   '⏳ Não é seu turno ainda. Aguarde sua vez.'],
  [/invalid target|alvo inválido/i,
   '🎯 Alvo inválido. Escolha um inimigo vivo.'],
  [/already used|já usado/i,
   '⛔ Você já usou essa ação neste turno.'],

  // ─── Persistência ──────────────────────────────────────────────────────
  [/persistence not initialized|database.*locked|SQLITE_BUSY/i,
   '💾 O servidor não consegue salvar agora. Tente de novo em instantes.'],

  // ─── Coop / Sala ─────────────────────────────────────────────────────────
  // QA-lançamento Ciclo Coop: o server emite reasons PT-BR ("lobby não
  // encontrado", "lobby cheio", "lobby já virou campanha", "só o host pode
  // iniciar") que os regexes antigos (só inglês) NÃO pegavam → vazava cru.
  [/lobby.*(closed|not found|expirou|n[ãa]o encontrad|vazi)|sala.*(fechou|fechada|expirou|n[ãa]o encontrad|vazia)/i,
   '🚪 A sala foi fechada ou expirou. Crie uma nova ou peça código atualizado.'],
  [/lobby (cheio|cheia|lotad)|full|lotada|max.*players/i,
   '👥 A sala está cheia (máximo 4 jogadores).'],
  [/j[áa] virou campanha|campanha j[áa] iniciada/i,
   '🚪 Essa sala já começou a aventura.'],
  [/s[óo] o host|host pode/i,
   '👑 Só quem criou a sala pode fazer isso.'],
];

/**
 * Traduz um erro técnico do servidor em mensagem amigável pra o jogador.
 * Se nenhum padrão bate, devolve a mensagem original prefixada com "🌙 "
 * pra dar tom narrativo (sem expor estrutura técnica).
 */
export function humanizeServerError(raw: string): string {
  if (!raw) return '🌙 Algo deu errado. Tente novamente.';
  const trimmed = raw.trim();
  for (const [pattern, friendly] of PATTERNS) {
    if (pattern.test(trimmed)) return friendly;
  }
  // Heurística: se a string tem ≤80 chars e não tem termos técnicos
  // suspeitos, mostrar como veio (pode ser um aviso já amigável do servidor).
  const looksTechnical = /TypeError|SyntaxError|ReferenceError|RangeError|Error:|Exception|undefined|null|stack|throw|at \w+/.test(trimmed);
  if (!looksTechnical && trimmed.length <= 80) {
    return trimmed;
  }
  // Fallback genérico — esconde detalhe técnico mas mantém ele no console.
  return '🌙 Algo se atrapalhou aqui. Tente de novo em instantes.';
}

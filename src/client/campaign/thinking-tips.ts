// JSgame · POLISH α.6 — Thinking indicator rico.
// Dicas rotativas + texto principal escala com tempo decorrido.

const TIPS: string[] = [
  'Sabia que pode usar Inspiração pra rolar 2d20 e pegar o maior?',
  'Atalho: digite ação custom no input e Enter envia direto.',
  'Crit nat 20 dobra dados de dano (não o modificador).',
  'Desvantagem em ataque? Rola 2d20 e pega o MENOR.',
  'Skill check com 1 natural não é falha automática (só ataques/saves).',
  'Combate é "uma rodada = 6 segundos no mundo do jogo".',
  'Descanso longo (8h) recupera HP máximo e magias.',
  'Você pode falar com qualquer NPC — Mestre improvisa diálogo.',
  'Conditions têm efeito mecânico — toque pra ver descrição.',
  'Cada PJ tem antecedente que muda como o mundo reage a você.',
  'Mestre lembra de NPCs e promessas — use callbacks pra dar peso.',
  'Coop até 3 — code da crônica pra compartilhar com amigos.',
];

/** Sorteia uma dica aleatória diferente da última (anti-repetição). */
let lastTipIdx = -1;
export function pickRandomTip(): string {
  if (TIPS.length === 0) return '';
  let idx = Math.floor(Math.random() * TIPS.length);
  if (idx === lastTipIdx && TIPS.length > 1) {
    idx = (idx + 1) % TIPS.length;
  }
  lastTipIdx = idx;
  return TIPS[idx]!;
}

/** Retorna texto principal baseado em tempo decorrido (escala 3 fases). */
export function getThinkingPhase(elapsedSec: number, playerName: string, action: string): string {
  if (elapsedSec < 8) {
    return `Mestre escrevendo… (${playerName} → ${action})`;
  }
  if (elapsedSec < 18) {
    return `Mestre demorando um pouco… (${playerName} → ${action})`;
  }
  if (elapsedSec < 30) {
    return `Trocando provedor LLM… aguarde mais um pouco`;
  }
  return `Resposta lenta — pode estar com problema. Aguarde ou tente recarregar`;
}

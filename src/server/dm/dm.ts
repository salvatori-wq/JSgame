// JSgame · DungeonMaster controller.
// Coordena provider (Groq/Anthropic) + prompts + parse de tools.
// Tem FallbackDM offline pra quando provider falha (timeout, rate limit, sem key).

import type { DMProvider, DMToolCall } from './providers/base.js';
import { SYSTEM_PROMPT, DM_TOOLS, buildNarrationPrompt, type NarrationContext } from './prompts.js';

export interface DMResponse {
  narration: string;
  speaker?: string;
  toolCalls: DMToolCall[];
  raw: string;
}

export class DungeonMaster {
  constructor(private provider: DMProvider) {}

  async narrate(context: NarrationContext): Promise<DMResponse> {
    const userPrompt = buildNarrationPrompt(context);

    let response;
    try {
      response = await this.provider.generate({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        tools: DM_TOOLS,
        maxTokens: 1024,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Aprendizado Cave Run: Llama 4 Scout dá 400 em ~26% dos calls com tools.
      // Retry sem tools — perde tool_calls mas mantém narração.
      if (/400|failed to call a function|tool/i.test(msg)) {
        console.warn('[dm] retry sem tools após erro:', msg.slice(0, 120));
        response = await this.provider.generate({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 1024,
        });
      } else {
        throw err;
      }
    }

    const parsed = extractJson(response.text);
    return {
      narration: parsed.narration ?? response.text.trim(),
      speaker: parsed.speaker,
      toolCalls: response.toolCalls,
      raw: response.text,
    };
  }
}

// Tolerante a JSON malformado (Llama às vezes trunca). Tenta:
// 1. ```json ... ```
// 2. { ... } primeiro objeto
// 3. Regex narration/speaker fields como último recurso
function extractJson(text: string): { narration?: string; speaker?: string } {
  const block = text.match(/```json\s*([\s\S]*?)```/);
  const candidate = block ? block[1]! : text;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // segue pra extract tolerante
    }
  }
  const narrationMatch = candidate.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const speakerMatch = candidate.match(/"speaker"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (narrationMatch) {
    return {
      narration: narrationMatch[1]!.replace(/\\"/g, '"').replace(/\\n/g, ' '),
      speaker: speakerMatch?.[1],
    };
  }
  return {};
}

// ════════════════════════════════════════════════════════════════════════════
// FallbackDM — narrações offline pré-escritas
// ════════════════════════════════════════════════════════════════════════════

export class FallbackDM {
  // ESLint warning OK: classe segue interface implícita do DungeonMaster
  async narrate(context: NarrationContext): Promise<DMResponse> {
    const partyName = context.party[0]?.characterName ?? 'aventureiro';
    let narration: string;

    if (context.skillCheckResolution) {
      const r = context.skillCheckResolution;
      narration = r.nat20
        ? `${r.playerName} acerta tão bem que algo no mundo treme. Vai além do esperado.`
        : r.nat1
          ? `${r.playerName} falha feio. Pior — algo escutou a desgraça e tá vindo.`
          : r.success
            ? `${r.playerName} consegue. Não foi gracioso. Mas tá feito.`
            : `${r.playerName} tenta e falha. O mundo registra. Anda.`;
    } else if (context.playerAction) {
      narration = `Você faz: ${context.playerAction.action}. O mundo responde — mas o Mestre IA tá offline. Provider sem key ou timeout. Tenta de novo.`;
    } else {
      narration = `${partyName}, vocês chegaram. Tem algo errado no ar — sempre tem. O Mestre IA tá offline, então a campanha vai ficar atmosfera só por enquanto. Configura GROQ_API_KEY ou ANTHROPIC_API_KEY no .env pra eu acordar.`;
    }

    return {
      narration,
      speaker: 'Mestre (offline)',
      toolCalls: [],
      raw: '',
    };
  }
}

export type DMInterface = DungeonMaster | FallbackDM;

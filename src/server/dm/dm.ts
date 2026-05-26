// JSgame · DungeonMaster controller.
// Coordena provider (Groq/Anthropic) + prompts + parse de tools.
// Tem FallbackDM offline pra quando provider falha (timeout, rate limit, sem key).

import type { DMProvider, DMToolCall } from './providers/base.js';
import { getSystemPrompt, DM_TOOLS, buildNarrationPrompt, type NarrationContext } from './prompts.js';

export interface DMResponse {
  narration: string;
  speaker?: string;
  toolCalls: DMToolCall[];
  raw: string;
}

// Timeout 55s — cobre cascade COMPLETO: Cerebras (~3s rápido), Gemini (~5s rápido),
// Groq (~5-15s), Cloudflare Llama 3.3 70B (~20-45s pro prompt completo D&D).
// 2026-05-26: era 35s e Cloudflare timeoutava abortando antes do Llama responder.
const LLM_TIMEOUT_MS = 55_000;
// Summarize/recap são chamadas leves (prompt curto, sem tools) — timeout 12s.
const LLM_TIMEOUT_SHORT_MS = 12_000;

export class DungeonMaster {
  constructor(private provider: DMProvider) {}

  /**
   * Comprime um bloco de narrações em 1-2 frases factuais — usado pelo Campaign
   * pra auto-resumo periódico (zera o narrationLog após N=10 entradas).
   * Sem tools, sem persona pesada — só compressão. Retorna null em falha (caller
   * decide se ignora ou usa fallback).
   */
  async summarize(text: string): Promise<string | null> {
    if (!text.trim()) return null;
    try {
      const response = await withTimeout(
        this.provider.generate({
          systemPrompt:
            'Você comprime conversas de RPG D&D em PT-BR. Devolva 1-2 frases factuais (máx 35 palavras) preservando: nomes próprios, locais, decisões marcantes, promessas. Sem tom, sem floreio — apenas fatos.',
          userPrompt: `Resuma estas narrações:\n${text}\n\nResumo curto:`,
          maxTokens: 200,
        }),
        LLM_TIMEOUT_SHORT_MS,
      );
      return response.text.trim() || null;
    } catch (err) {
      console.warn('[dm] summarize falhou:', err);
      return null;
    }
  }

  /**
   * A3 — Gera "Previously on..." recap das sessões anteriores baseado em top facts.
   * Chamado em startSession quando sessionNumber > 1. Curto: 2-3 frases tom narrativo.
   */
  async generateRecap(facts: import('../../shared/types.js').MemoryFact[], personality?: import('../../dnd/dm-personality.js').DmPersonality): Promise<string | null> {
    if (facts.length === 0) return null;
    const personalityName = personality ?? 'sombrio';
    const factsList = facts.map((f) => `- [${f.kind}] ${f.text}`).join('\n');
    try {
      const response = await withTimeout(
        this.provider.generate({
          systemPrompt: `Você é o Mestre de D&D no estilo ${personalityName}. Gere um RECAP curto (2-3 frases) que retoma a sessão anterior. Comece com "Anteriormente..." ou similar. Mencione 2-3 fatos chave da lista abaixo. Tom narrativo, PT-BR coloquial, sem repetir literalmente os fatos.`,
          userPrompt: `Fatos relevantes da campanha:\n${factsList}\n\nGere o recap em 2-3 frases:`,
          maxTokens: 200,
        }),
        LLM_TIMEOUT_SHORT_MS,
      );
      return response.text.trim() || null;
    } catch (err) {
      console.warn('[dm] generateRecap falhou:', err);
      return null;
    }
  }

  async narrate(context: NarrationContext): Promise<DMResponse> {
    const userPrompt = buildNarrationPrompt(context);
    // 1C — System prompt dinâmico baseado em CampaignState.dmPersonality (default sombrio).
    const systemPrompt = getSystemPrompt(context.campaign.dmPersonality);

    let response;
    let retriedWithoutTools = false;
    try {
      response = await this.callWithBackoff(systemPrompt, userPrompt, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Aprendizado Cave Run: Llama 4 Scout dá 400 em ~26% dos calls com tools.
      // Retry sem tools — perde tool_calls mas mantém narração.
      if (/400|failed to call a function|tool/i.test(msg)) {
        console.warn('[dm] retry sem tools após erro:', msg.slice(0, 120));
        try {
          response = await this.callWithBackoff(systemPrompt, userPrompt, false);
          retriedWithoutTools = true;
        } catch (err2) {
          console.warn('[dm] retry sem tools também falhou:', err2);
          // T1 — track narration_error
          void this.trackError(context, msg.slice(0, 80));
          return makeGracefulFallback(err2);
        }
      } else {
        // Timeout ou erro fatal — devolve fallback sem quebrar o queue
        console.warn('[dm] LLM falhou/expirou após backoff:', msg.slice(0, 120));
        void this.trackError(context, msg.slice(0, 80));
        return makeGracefulFallback(err);
      }
    }
    let parsed = extractJson(response.text);
    // Nullish (not ||) — preserva "" literal de parsed.narration pra que o retry dispare
    // em vez de mostrar o JSON cru ao jogador.
    let narration = (parsed.narration ?? response.text).trim();

    // BUG-001 recovery: Gemini (e às vezes Groq) com mode=auto retorna 200 OK
    // contendo APENAS functionCalls (sem text part) → narração vazia chega ao cliente.
    // Retry sem tools quando isso acontece — mesma idéia do retry de 400.
    if (!narration && response.toolCalls.length > 0 && !retriedWithoutTools) {
      console.warn('[dm] narração vazia com toolCalls — retry sem tools');
      try {
        response = await this.callWithBackoff(systemPrompt, userPrompt, false);
        retriedWithoutTools = true;
        parsed = extractJson(response.text);
        narration = (parsed.narration ?? response.text).trim();
      } catch (err) {
        console.warn('[dm] retry pós-narração-vazia falhou:', err);
      }
    }

    // Se ainda vazio após retry, degrada graceful em vez de mandar string vazia.
    if (!narration) {
      void this.trackError(context, 'empty narration after retry');
      return makeGracefulFallback(new Error('LLM retornou narração vazia'));
    }

    // T1 — track narration_success (após validar que de fato veio conteúdo).
    void this.trackSuccess(context, retriedWithoutTools);

    return {
      narration,
      speaker: parsed.speaker,
      toolCalls: response.toolCalls,
      raw: response.text,
    };
  }

  // T1 — Helpers de telemetria, lazy-import pra evitar ciclo. Falhas silenciosas.
  // 2026-05-26: rastreia também effectiveProvider quando o ativo é cascade —
  // CascadeProvider expõe lastSuccessfulProvider (sucesso) e lastFailedProvider
  // (último que falhou quando cascade esgotou). Antes só salvávamos "cascade(...)".
  private getEffectiveProviderForSuccess(): string {
    const cascade = this.provider as { lastSuccessfulProvider?: string | null };
    return cascade.lastSuccessfulProvider ?? this.provider.name;
  }
  private getEffectiveProviderForError(): string {
    const cascade = this.provider as { lastFailedProvider?: string | null };
    return cascade.lastFailedProvider ?? this.provider.name;
  }
  private async trackSuccess(ctx: NarrationContext, retried: boolean): Promise<void> {
    try {
      const { trackMetricEvent } = await import('../metrics.js');
      await trackMetricEvent({
        sessionId: ctx.campaign.id,
        kind: 'narration_success',
        payload: {
          retriedWithoutTools: retried,
          provider: this.provider.name,
          effectiveProvider: this.getEffectiveProviderForSuccess(),
        },
      });
    } catch { /* ignore */ }
  }
  private async trackError(ctx: NarrationContext, errMsg: string): Promise<void> {
    try {
      const { trackMetricEvent } = await import('../metrics.js');
      await trackMetricEvent({
        sessionId: ctx.campaign.id,
        kind: 'narration_error',
        payload: {
          error: errMsg,
          provider: this.provider.name,
          effectiveProvider: this.getEffectiveProviderForError(),
        },
      });
    } catch { /* ignore */ }
  }

  /**
   * Chama provider.generate com backoff exponencial em erros transientes (429/503).
   *
   * Estratégia pós-cascade: como CascadeProvider já tenta Gemini→Groq→Anthropic
   * internamente em UMA chamada, backoff aqui só ajuda em erros transientes que
   * afetem TODOS os providers simultaneamente (ex: rede do Render lenta).
   * Reduzimos pra 2 tentativas total com 2s entre elas — pior caso 35+2+35 = 72s
   * mas só pra cenários patológicos. Caso normal é 1 chamada cascade-interna
   * resolvendo em ~5-25s.
   */
  private async callWithBackoff(systemPrompt: string, userPrompt: string, withTools: boolean): Promise<{ text: string; toolCalls: DMToolCall[] }> {
    const delays = [0, 2000]; // 2 tentativas, total ~2s de espera entre elas
    let lastErr: unknown;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]! > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt]!));
      }
      try {
        return await withTimeout(
          this.provider.generate({
            systemPrompt,
            userPrompt,
            tools: withTools ? DM_TOOLS : undefined,
            maxTokens: 1024,
          }),
          LLM_TIMEOUT_MS,
        );
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Só vale retry com backoff se erro transiente (rate limit/overload/timeout).
        // 400/auth/parse não se resolvem com espera — propaga já.
        // Timeout AGORA é retriable: cascade pode ter ido até o último provider e
        // ele estava lento; 2ª tentativa pode pegar um momento melhor.
        if (!/429|rate.?limit|503|502|504|overload|timeout/i.test(msg)) {
          throw err;
        }
        console.warn(`[dm] tentativa ${attempt + 1}/${delays.length} falhou (transiente):`, msg.slice(0, 80));
      }
    }
    throw lastErr ?? new Error('LLM falhou após backoff');
  }
}

// Promise.race com timeout — rejeita após N ms.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM timeout após ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// DMResponse fallback que mantém a campanha rodando se o LLM falhou de vez.
function makeGracefulFallback(err: unknown): DMResponse {
  const msg = err instanceof Error ? err.message : String(err);
  const isTimeout = /timeout/i.test(msg);
  return {
    narration: isTimeout
      ? 'O mundo segue, mas o Mestre tá lento — fala outra coisa, tenta de novo. Ou espera 30s.'
      : 'O Mestre travou no meio da frase. Algo no éter. Tenta de novo — talvez mais direto.',
    speaker: 'Mestre (degradado)',
    toolCalls: [],
    raw: msg,
  };
}

// Detecta JSON de tool_call format OpenAI-style ({"type":"function","name":...,"parameters":...}).
// Quando providers como Llama 3.3 (Cloudflare/Groq) recebem tools mas não suportam function
// calling do mesmo jeito, eles podem RETORNAR esse JSON literalmente no campo text — daí
// vaza pra UI como "```json {...} ```" visível pro player. Tratamos isso descartando o
// text — extractJson retorna {} → narration vazia → callsite força retry sem tools.
function isLeakedToolCallJson(text: string): boolean {
  // Pattern: ```json {...} ``` OU JSON inline com type+function
  if (/```json\s*\{[\s\S]*?"type"\s*:\s*"function"[\s\S]*?\}/i.test(text)) return true;
  if (/^\s*\{[\s\S]*?"type"\s*:\s*"function"[\s\S]*?"parameters"\s*:/i.test(text.trim())) return true;
  if (/^\s*\{[\s\S]*?"name"\s*:\s*"(request_skill_check|describe_scene|apply_damage|start_combat|apply_condition|save_fact|cast_spell|end_combat|enemy_casts_spell)"/i.test(text.trim())) return true;
  return false;
}

// Tolerante a JSON malformado (Llama às vezes trunca). Tenta:
// 1. ```json ... ```
// 2. { ... } primeiro objeto
// 3. Regex narration/speaker fields como último recurso
function extractJson(text: string): { narration?: string; speaker?: string } {
  // 2026-05-26: descarta tool_call JSON vazado → força fluxo de retry sem tools.
  if (isLeakedToolCallJson(text)) return {};

  const block = text.match(/```json\s*([\s\S]*?)```/);
  const candidate = block ? block[1]! : text;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      // Defesa: se o JSON parseado for tool_call format (sem narration), descarta.
      if (parsed && typeof parsed === 'object' && parsed.type === 'function' && !parsed.narration) {
        return {};
      }
      return parsed;
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
  // FallbackDM não chama LLM nenhum — summarize sempre null. Campaign ignora.
  async summarize(_text: string): Promise<string | null> {
    return null;
  }

  // A3 — Fallback: monta recap simples a partir dos facts diretos (sem LLM).
  async generateRecap(facts: import('../../shared/types.js').MemoryFact[]): Promise<string | null> {
    if (facts.length === 0) return null;
    const top = facts.slice(0, 3).map((f) => f.text);
    return `Anteriormente: ${top.join('. ')}.`;
  }

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

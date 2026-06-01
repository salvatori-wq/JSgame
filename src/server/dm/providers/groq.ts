// JSgame · Provider Groq (Llama 3.3 70B / Llama 4 Scout).
// Free tier generoso. Usa groq-sdk diretamente.

import Groq from 'groq-sdk';
import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface GroqProviderOptions {
  apiKey: string;
  model: string;
}

export class GroqProvider implements DMProvider {
  readonly name = 'groq';
  private client: Groq;
  private model: string;

  constructor(opts: GroqProviderOptions) {
    this.client = new Groq({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    const tools = opts.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema,
      },
    }));

    // Timeout 12s — aprendizado Cave Run (Groq pode travar silenciosamente).
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      tools,
      tool_choice: tools ? 'auto' : undefined,
    }, { timeout: 12000 });

    const choice = completion.choices[0];
    const text = choice?.message?.content ?? '';
    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    for (const tc of choice?.message?.tool_calls ?? []) {
      // groq-sdk types: tool_call tem function.name/arguments
      try {
        toolCalls.push({
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      } catch {
        // argumentos malformados — ignora silenciosamente (DM as vezes manda JSON inválido)
      }
    }

    // Fase 3 (estabilização) — empty response throw → CascadeProvider failover.
    // Llama 3.3 às vezes devolve content vazio sem tool_calls (corte por length
    // ou filtro). Sem este throw o cascade PARAVA no Groq achando que foi sucesso
    // e o jogo caía no FallbackDM offline em vez de tentar Gemini/Cerebras. Mesmo
    // padrão já presente em Cerebras/Cloudflare/Mistral.
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`Groq empty response: model=${this.model} finish_reason=${choice?.finish_reason ?? 'none'}`);
    }
    return { text, toolCalls };
  }
}

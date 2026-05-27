// JSgame · Provider Mistral AI.
// Free tier: La Plateforme — 1 req/s rate limit, ~500K tokens/dia em
// mistral-small-latest. Endpoint OpenAI-compatible.
//
// γ.4 — 5º provider no cascade (após Cloudflare). Cobre cenário em que
// CF retorna empty response (Llama 3.3 70B as vezes responde "" sem
// tool_calls). Mistral entra como rede final antes da narração degradada.
//
// Setup prod: configurar MISTRAL_API_KEY env var no Render dashboard.

import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface MistralProviderOptions {
  apiKey: string;
  model: string;        // ex: 'mistral-small-latest', 'mistral-large-latest'
  baseUrl?: string;
  timeoutMs?: number;
}

interface MistralChoice {
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason?: string;
}

interface MistralResponse {
  choices?: MistralChoice[];
  error?: { message?: string; type?: string; code?: string | number };
}

export class MistralProvider implements DMProvider {
  readonly name = 'mistral';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts: MistralProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.mistral.ai/v1';
    // Mistral small ~3-6s pra D&D prompts. Margem confortável.
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0.85,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    };

    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.schema },
      }));
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Mistral ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as MistralResponse;
    if (data.error) {
      throw new Error(`Mistral error ${data.error.code ?? data.error.type ?? ''}: ${data.error.message ?? 'unknown'}`);
    }
    const choice = data.choices?.[0];
    // Mistral pode bloquear por content safety
    if (choice?.finish_reason && /content_filter|safety|blocked/i.test(choice.finish_reason)) {
      throw new Error(`Mistral safety block: finish_reason=${choice.finish_reason}`);
    }

    const text = choice?.message?.content ?? '';
    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    for (const tc of choice?.message?.tool_calls ?? []) {
      try {
        toolCalls.push({
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      } catch {
        // Argumentos malformados — ignora (cascade fallback cobre)
      }
    }

    // Empty response → throw pra CascadeProvider passar pra próximo fallback
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`Mistral empty response: model=${this.model} finish_reason=${choice?.finish_reason ?? 'none'}`);
    }

    return { text, toolCalls };
  }
}

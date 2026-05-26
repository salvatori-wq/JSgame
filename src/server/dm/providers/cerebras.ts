// JSgame · Provider Cerebras Cloud.
// Free tier: 30 RPM, 60K TPM input, 1M tokens/dia em Llama 3.3 70B.
// Velocidade ~2000 tokens/s (literalmente o mais rápido do mercado).
// API OpenAI-compatible — só troca base URL.

import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface CerebrasProviderOptions {
  apiKey: string;
  model: string;        // 'llama-3.3-70b', 'llama3.1-8b', 'qwen-3-32b'
  baseUrl?: string;
  timeoutMs?: number;
}

interface CerebrasChoice {
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason?: string;
}

interface CerebrasResponse {
  choices?: CerebrasChoice[];
  error?: { message?: string; code?: string | number };
}

export class CerebrasProvider implements DMProvider {
  readonly name = 'cerebras';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts: CerebrasProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.cerebras.ai/v1';
    this.timeoutMs = opts.timeoutMs ?? 20_000;
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
      temperature: 0.9,
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
      throw new Error(`Cerebras ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as CerebrasResponse;
    if (data.error) {
      throw new Error(`Cerebras error ${data.error.code ?? ''}: ${data.error.message ?? 'unknown'}`);
    }
    const choice = data.choices?.[0];
    // Cerebras às vezes corta por safety/length — propaga como erro classificado.
    if (choice?.finish_reason && /content_filter|safety|blocked/i.test(choice.finish_reason)) {
      throw new Error(`Cerebras safety block: finish_reason=${choice.finish_reason}`);
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
        // Argumentos malformados — ignora (dm.ts retry sem tools cobre)
      }
    }

    // 2026-05-26 fix: Cerebras (esp. gpt-oss-120b) às vezes retorna text="" SEM tool_calls.
    // Isso passava silencioso pro cascade (sem erro lançado), entupia o fluxo de
    // narração vazia → degraded fallback no client. Detectado em prod via
    // /api/dm/errors: 3x "empty narration after retry" eram desse cenário.
    // Agora joga erro → CascadeProvider failover pro próximo provider funcional.
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`Cerebras empty response: model=${this.model} finish_reason=${choice?.finish_reason ?? 'none'}`);
    }

    return { text, toolCalls };
  }
}

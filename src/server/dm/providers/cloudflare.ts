// JSgame · Provider Cloudflare Workers AI.
// Free tier: 10K neurons/dia (~500-1000 calls Llama 3.3 70B).
// Infra Cloudflare distribuída globalmente — uptime ~99.99%.
// API REST simples — Bearer token, body {messages, tools opcional}.

import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface CloudflareProviderOptions {
  accountId: string;
  apiToken: string;
  model: string;        // ex: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  baseUrl?: string;
  timeoutMs?: number;
}

interface CFResponseBody {
  // Schema do CF response (varia entre modelos, mas message-based é o padrão)
  response?: string;
  tool_calls?: Array<{
    name?: string;
    arguments?: Record<string, unknown> | string;
  }>;
}

interface CFEnvelope {
  result?: CFResponseBody;
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: unknown[];
}

export class CloudflareProvider implements DMProvider {
  readonly name = 'cloudflare';
  private accountId: string;
  private apiToken: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts: CloudflareProviderOptions) {
    this.accountId = opts.accountId;
    this.apiToken = opts.apiToken;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.cloudflare.com/client/v4';
    this.timeoutMs = opts.timeoutMs ?? 25_000;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    // 2026-05-26 fix: Cloudflare Workers AI rodando Llama 3.3 70B NÃO suporta
    // function calling do mesmo jeito que OpenAI/Anthropic — quando recebe `tools`
    // no body, o modelo retorna o tool_call como JSON dentro de result.response
    // (texto cru), causando vazamento de "```json {type:function...} ```" no chat.
    // Solução: nunca passar tools pro Cloudflare. Ele só faz narração pura, sem
    // tool_calls. Fluxo D&D (skill checks, dano, etc) funciona normalmente nos
    // outros 3 providers do cascade (Cerebras/Gemini/Groq). Cloudflare é fallback
    // de narração-only quando os 3 estouram.
    const body: Record<string, unknown> = {
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0.9,
    };
    // NOTE: opts.tools ignorado intencionalmente — vide comentário acima.

    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${this.model}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudflare ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as CFEnvelope;
    if (!data.success || data.errors?.length) {
      const errMsg = data.errors?.[0]?.message ?? 'unknown';
      throw new Error(`Cloudflare error: ${errMsg}`);
    }

    const result = data.result ?? {};
    const text = result.response ?? '';

    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    for (const tc of result.tool_calls ?? []) {
      if (!tc.name) continue;
      try {
        const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments ?? {});
        toolCalls.push({ name: tc.name, input: args as Record<string, unknown> });
      } catch {
        // Argumentos malformados — ignora silenciosamente
      }
    }

    // Mesma proteção do Cerebras fix (2026-05-26): se Cloudflare retornar
    // response vazia E sem tool_calls, throw → CascadeProvider failover.
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`Cloudflare empty response: model=${this.model}`);
    }

    return { text, toolCalls };
  }
}

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
    const body: Record<string, unknown> = {
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0.9,
    };

    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.schema,
      }));
    }

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

    return { text, toolCalls };
  }
}

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
    // 2026-05-26 (rev): habilita tools de volta + parser inline.
    // Cloudflare/Llama 3.3 70B retorna tool_call como JSON DENTRO do text:
    //   ```json{"type":"function","name":"start_combat","parameters":{...}}```
    // Antes desabilitei tools (vazava JSON pro chat). Mas isso quebrou combate:
    // DM narrava briga mas não chamava start_combat → initiative/dados não rolavam.
    // Agora: passa tools no body, parseia inline no response (post-processing).
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
    let text = result.response ?? '';

    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    // 1) tool_calls no envelope nativo (caso CF mude API e suporte)
    for (const tc of result.tool_calls ?? []) {
      if (!tc.name) continue;
      try {
        const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments ?? {});
        toolCalls.push({ name: tc.name, input: args as Record<string, unknown> });
      } catch { /* ignora */ }
    }
    // 2) tool_calls inline no text (Llama 3.3 70B retorna ```json{...}``` ou JSON direto).
    //    Parseia + remove do text pra não vazar pro chat.
    const parsed = parseInlineToolCalls(text);
    text = parsed.cleanedText;
    toolCalls.push(...parsed.toolCalls);

    // Empty response throw — CascadeProvider failover.
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`Cloudflare empty response: model=${this.model}`);
    }

    return { text, toolCalls };
  }
}

// Parser de tool_calls embedded no text. Suporta 2 formatos comuns do Llama:
// 1. ```json {"type":"function","name":"foo","parameters":{...}} ```
// 2. JSON direto sem code block: {"type":"function","name":"foo","parameters":{...}}
// Retorna texto sem os JSON blocks + array de toolCalls extraídos.
export function parseInlineToolCalls(text: string): {
  cleanedText: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
} {
  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  let cleaned = text;

  // Pattern 1: ```json...``` blocks
  const codeBlockRe = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  cleaned = cleaned.replace(codeBlockRe, (match, jsonStr) => {
    const tc = tryParseToolCall(jsonStr);
    if (tc) {
      toolCalls.push(tc);
      return ''; // remove o block do text
    }
    return match; // mantém se não for tool call
  });

  // Pattern 2: JSON direto no início do text (sem code block)
  const trimmed = cleaned.trim();
  if (trimmed.startsWith('{')) {
    // Tenta achar onde fecha o JSON top-level
    const endIdx = findMatchingBrace(trimmed, 0);
    if (endIdx > 0) {
      const candidate = trimmed.slice(0, endIdx + 1);
      const tc = tryParseToolCall(candidate);
      if (tc) {
        toolCalls.push(tc);
        cleaned = trimmed.slice(endIdx + 1).trimStart();
      }
    }
  }

  return { cleanedText: cleaned.trim(), toolCalls };
}

function tryParseToolCall(jsonStr: string): { name: string; input: Record<string, unknown> } | null {
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj === 'object') {
      // Formato Llama: {"type":"function","name":"X","parameters":{...}}
      if (obj.type === 'function' && typeof obj.name === 'string') {
        const params = obj.parameters ?? obj.arguments ?? {};
        return { name: obj.name, input: typeof params === 'string' ? JSON.parse(params) : params };
      }
      // Formato direto: {"name":"X","parameters":{...}}
      if (typeof obj.name === 'string' && (obj.parameters || obj.arguments)) {
        const params = obj.parameters ?? obj.arguments;
        return { name: obj.name, input: typeof params === 'string' ? JSON.parse(params) : params };
      }
    }
  } catch { /* não é JSON válido */ }
  return null;
}

function findMatchingBrace(s: string, start: number): number {
  if (s[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

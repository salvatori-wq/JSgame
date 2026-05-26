// JSgame · Provider Gemini (Google AI Studio).
// Free tier: 15 RPM / 1M tokens/min / 1500 req/dia em gemini-2.0-flash.
// SEM auto-billing — quando estoura, retorna 429 (zero risco de cobrança surpresa).
//
// Implementação via fetch nativo — sem deps novas. Gemini API REST simples:
// POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...
//
// Tool calling: Gemini suporta nativamente via `tools.functionDeclarations`.
// Schema OpenAPI-like; conversão de DMToolDef.schema (JSON Schema padrão) é direta.

import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;       // 'gemini-2.0-flash-exp', 'gemini-1.5-flash', etc
  baseUrl?: string;
  timeoutMs?: number;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
      functionCall?: { name: string; args: Record<string, unknown> };
    }>;
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string };
}

export class GeminiProvider implements DMProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts: GeminiProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    // Gemini não tem "system" role explícito — concatena com user content
    // ou usa systemInstruction (preferido). Aqui usamos systemInstruction.
    const body: Record<string, unknown> = {
      systemInstruction: {
        role: 'system',
        parts: [{ text: opts.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: opts.userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1024,
        temperature: 0.9, // narrativo — quer variedade
        // Gemini 2.5 default usa thinking (consome muito do free tier sem entregar
        // narrativa melhor pra esse use case). Desabilita pra economizar quota.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    if (opts.tools && opts.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: opts.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.schema,
          })),
        },
      ];
      // Default 'auto' — modelo decide. Outros valores: 'any', 'none'.
      body.toolConfig = { functionCallingConfig: { mode: 'auto' } };
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as GeminiResponse;
    if (data.error) {
      throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);
    }
    if (data.promptFeedback?.blockReason) {
      // Safety block — retorna texto vazio em vez de throw (caller vai degradar)
      return { text: '', toolCalls: [] };
    }

    const candidate = data.candidates?.[0];
    let text = '';
    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
        });
      }
    }

    return { text, toolCalls };
  }
}

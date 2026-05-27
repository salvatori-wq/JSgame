// γ.4 — Tests pro MistralProvider — happy path + erros classificados pro cascade.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MistralProvider } from '../dm/providers/mistral.js';

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    return handler(u, init ?? {});
  }) as typeof fetch;
}

describe('MistralProvider', () => {
  beforeEach(() => {
    globalThis.fetch = realFetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('chama API mistral.ai com bearer + body OpenAI-compatible', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};
    let capturedAuth = '';

    mockFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init.headers as Record<string, string>)['Authorization'] ?? '';
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'taverna sombria', tool_calls: [] }, finish_reason: 'stop' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const p = new MistralProvider({ apiKey: 'mk-test', model: 'mistral-small-latest' });
    const r = await p.generate({ systemPrompt: 'sys', userPrompt: 'usr', maxTokens: 800 });

    expect(capturedUrl).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(capturedAuth).toBe('Bearer mk-test');
    expect(capturedBody.model).toBe('mistral-small-latest');
    expect(capturedBody.max_tokens).toBe(800);
    expect((capturedBody.messages as unknown[])[0]).toEqual({ role: 'system', content: 'sys' });
    expect(r.text).toBe('taverna sombria');
  });

  it('inclui tools com tool_choice=auto', async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch((_, init) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });
    const p = new MistralProvider({ apiKey: 'k', model: 'mistral-small-latest' });
    await p.generate({
      systemPrompt: 's', userPrompt: 'u',
      tools: [{ name: 'apply_damage', description: 'aplica dano', schema: { type: 'object' } }],
    });
    expect((capturedBody.tools as unknown[]).length).toBe(1);
    expect(capturedBody.tool_choice).toBe('auto');
  });

  it('parse tool_calls com arguments JSON string', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{
        message: {
          content: '',
          tool_calls: [{
            id: 'tc-1',
            function: { name: 'request_skill_check', arguments: '{"skill":"investigacao","dc":15}' },
          }],
        },
      }],
    }), { status: 200 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls).toEqual([
      { name: 'request_skill_check', input: { skill: 'investigacao', dc: 15 } },
    ]);
  });

  it('throw em status não-200 com mensagem do body', async () => {
    mockFetch(() => new Response('quota exceeded', { status: 429 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/Mistral 429/);
  });

  it('throw em error JSON body com error.message', async () => {
    mockFetch(() => new Response(JSON.stringify({
      error: { type: 'invalid_request', message: 'bad model name' },
    }), { status: 200 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/bad model name/);
  });

  it('throw em empty response (content="" + tool_calls=[]) pra triggerar failover', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{ message: { content: '', tool_calls: [] }, finish_reason: 'stop' }],
    }), { status: 200 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/empty response/);
  });

  it('throw classificado em finish_reason safety/content_filter', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{ message: { content: '' }, finish_reason: 'content_filter' }],
    }), { status: 200 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/safety block/);
  });

  it('tool_calls com arguments malformados ignorados silenciosamente', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'narração',
          tool_calls: [{ id: 'tc', function: { name: 'roll', arguments: '{broken' } }],
        },
      }],
    }), { status: 200 }));
    const p = new MistralProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('narração');
    expect(r.toolCalls).toEqual([]);
  });
});

describe('Factory — Mistral integration', () => {
  it('factory inclui Mistral no cascade quando MISTRAL_API_KEY presente', async () => {
    const { buildProviderFromEnv } = await import('../dm/providers/factory.js');
    const p = buildProviderFromEnv({
      MISTRAL_API_KEY: 'mk-x',
      MISTRAL_MODEL: 'mistral-small-latest',
    });
    expect(p).not.toBeNull();
    expect(p!.name).toBe('mistral');
  });

  it('cascade ordem inclui Mistral após Cloudflare', async () => {
    const { buildProviderFromEnv } = await import('../dm/providers/factory.js');
    const p = buildProviderFromEnv({
      CEREBRAS_API_KEY: 'ck',
      GEMINI_API_KEY: 'gk',
      GROQ_API_KEY: 'grk',
      CLOUDFLARE_ACCOUNT_ID: 'cfid',
      CLOUDFLARE_API_TOKEN: 'cftok',
      MISTRAL_API_KEY: 'mk',
    });
    expect(p).not.toBeNull();
    // Cascade name = "cascade(cerebras→gemini→groq→cloudflare→mistral)"
    expect(p!.name).toContain('mistral');
    expect(p!.name).toMatch(/cloudflare.*mistral/);
  });

  it('explicit DM_PROVIDER=mistral instancia MistralProvider', async () => {
    const { buildProviderFromEnv } = await import('../dm/providers/factory.js');
    const p = buildProviderFromEnv({ DM_PROVIDER: 'mistral', MISTRAL_API_KEY: 'mk' });
    expect(p).not.toBeNull();
    expect(p!.name).toBe('mistral');
  });
});

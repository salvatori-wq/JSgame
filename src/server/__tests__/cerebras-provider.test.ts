// Tests pro CerebrasProvider — happy path + erro classificado pro cascade.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CerebrasProvider } from '../dm/providers/cerebras.js';

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    return handler(u, init ?? {});
  }) as typeof fetch;
}

describe('CerebrasProvider', () => {
  beforeEach(() => {
    globalThis.fetch = realFetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('chama API com bearer + body OpenAI-compatible', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};
    let capturedAuth = '';

    mockFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init.headers as Record<string, string>)['Authorization'] ?? '';
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'narração ok', tool_calls: [] }, finish_reason: 'stop' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const p = new CerebrasProvider({ apiKey: 'csk-test', model: 'llama-3.3-70b' });
    const r = await p.generate({ systemPrompt: 'sys', userPrompt: 'usr', maxTokens: 500 });

    expect(capturedUrl).toBe('https://api.cerebras.ai/v1/chat/completions');
    expect(capturedAuth).toBe('Bearer csk-test');
    expect(capturedBody.model).toBe('llama-3.3-70b');
    expect(capturedBody.max_tokens).toBe(500);
    expect((capturedBody.messages as unknown[])[0]).toEqual({ role: 'system', content: 'sys' });
    expect(r.text).toBe('narração ok');
    expect(r.toolCalls).toEqual([]);
  });

  it('inclui tools com tool_choice=auto quando passados', async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch((_, init) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });
    const p = new CerebrasProvider({ apiKey: 'k', model: 'm' });
    await p.generate({
      systemPrompt: 's', userPrompt: 'u',
      tools: [{ name: 'roll', description: 'd', schema: { type: 'object' } }],
    });
    expect((capturedBody.tools as unknown[]).length).toBe(1);
    expect(capturedBody.tool_choice).toBe('auto');
  });

  it('parse tool_calls com arguments JSON string', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{
        message: {
          content: '',
          tool_calls: [{ id: 't1', function: { name: 'apply_damage', arguments: '{"damage":10}' } }],
        },
      }],
    }), { status: 200 }));
    const p = new CerebrasProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls).toEqual([{ name: 'apply_damage', input: { damage: 10 } }]);
  });

  it('throw em status não-200 com mensagem do body', async () => {
    mockFetch(() => new Response('rate limit exceeded', { status: 429 }));
    const p = new CerebrasProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/Cerebras 429/);
  });

  it('throw classificado em finish_reason safety/content_filter', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{ message: { content: '' }, finish_reason: 'content_filter' }],
    }), { status: 200 }));
    const p = new CerebrasProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/safety block/);
  });

  it('tool_calls com arguments malformados são silenciosamente ignorados', async () => {
    mockFetch(() => new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'narração',
          tool_calls: [{ id: 't1', function: { name: 'roll', arguments: '{malformed' } }],
        },
      }],
    }), { status: 200 }));
    const p = new CerebrasProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls).toEqual([]);
    expect(r.text).toBe('narração');
  });
});

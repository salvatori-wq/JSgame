// Tests pro CloudflareProvider — endpoint específico CF AI + envelope parse.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CloudflareProvider } from '../dm/providers/cloudflare.js';

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Response): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    return handler(u, init ?? {});
  }) as typeof fetch;
}

describe('CloudflareProvider', () => {
  beforeEach(() => { globalThis.fetch = realFetch; });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('endpoint inclui account_id + model no path', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init.headers as Record<string, string>)['Authorization'] ?? '';
      return new Response(JSON.stringify({
        success: true,
        result: { response: 'narração CF ok' },
      }), { status: 200 });
    });
    const p = new CloudflareProvider({
      accountId: 'acc-123',
      apiToken: 'cfat-token',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
    await p.generate({ systemPrompt: 's', userPrompt: 'u' });

    expect(capturedUrl).toBe('https://api.cloudflare.com/client/v4/accounts/acc-123/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(capturedAuth).toBe('Bearer cfat-token');
  });

  it('extrai response.result.response do envelope CF', async () => {
    mockFetch(() => new Response(JSON.stringify({
      success: true,
      result: { response: 'A taverna range.' },
    }), { status: 200 }));
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('A taverna range.');
  });

  it('throw em success=false com mensagem dos errors', async () => {
    mockFetch(() => new Response(JSON.stringify({
      success: false,
      errors: [{ code: 7003, message: 'invalid binding' }],
    }), { status: 200 }));
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/invalid binding/);
  });

  it('throw em status não-200', async () => {
    mockFetch(() => new Response('unauthorized', { status: 401 }));
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/Cloudflare 401/);
  });

  it('parse tool_calls em result.tool_calls (formato CF)', async () => {
    mockFetch(() => new Response(JSON.stringify({
      success: true,
      result: {
        response: 'narração',
        tool_calls: [{ name: 'apply_damage', arguments: { damage: 5, type: 'fogo' } }],
      },
    }), { status: 200 }));
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls).toEqual([{ name: 'apply_damage', input: { damage: 5, type: 'fogo' } }]);
  });

  // 2026-05-26 fix tool-call leak: Cloudflare IGNORA tools no body.
  // Llama 3.3 70B no CF não suporta function calling do mesmo jeito que OpenAI —
  // quando recebia tools, retornava JSON cru no text. Agora narração-only.
  it('IGNORA tools no body (evita JSON vazado no text)', async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch((_, init) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ success: true, result: { response: 'ok' } }), { status: 200 });
    });
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    await p.generate({
      systemPrompt: 's', userPrompt: 'u',
      tools: [{ name: 'roll', description: 'd', schema: { type: 'object' } }],
    });
    expect(capturedBody.tools).toBeUndefined();
  });

  it('throw em response vazia (response="" + sem tool_calls) — caso failover cascade', async () => {
    // Bug equivalente ao Cerebras gpt-oss-120b: provider retorna 200 OK mas
    // response.response="" sem tool_calls → cascade não failovava.
    mockFetch(() => new Response(JSON.stringify({
      success: true,
      result: { response: '', tool_calls: [] },
    }), { status: 200 }));
    const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' }))
      .rejects.toThrow(/empty response/i);
  });
});

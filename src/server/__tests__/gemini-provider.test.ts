// Tests pro GeminiProvider — happy path + empty-throw pro cascade failover.
// Fase 3 (estabilização): Gemini 2.5 free as vezes devolve 200 com candidate
// vazio. Sem throw, o CascadeProvider parava aqui (achando sucesso) e o jogo
// caía no FallbackDM offline em vez de tentar Groq/Cerebras. Este guard prova
// que agora ele joga erro → cascade failover.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../dm/providers/gemini.js';

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Response): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    return handler(u, init ?? {});
  }) as typeof fetch;
}

describe('GeminiProvider', () => {
  beforeEach(() => { globalThis.fetch = realFetch; });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('happy path — extrai text do candidate', async () => {
    mockFetch(() => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'narração viva' }] }, finishReason: 'STOP' }],
    }), { status: 200 }));
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('narração viva');
    expect(r.toolCalls).toEqual([]);
  });

  it('throw em status não-200 (429 quota) — cascade detecta via regex', async () => {
    mockFetch(() => new Response('quota exceeded', { status: 429 }));
    const p = new GeminiProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/Gemini 429/);
  });

  it('throw classificado em safety block (promptFeedback.blockReason)', async () => {
    mockFetch(() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    const p = new GeminiProvider({ apiKey: 'k', model: 'm' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/safety block/);
  });

  it('Fase 3 — throw em response vazia (candidate sem text/tool) → cascade failover', async () => {
    mockFetch(() => new Response(JSON.stringify({
      candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }],
    }), { status: 200 }));
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/empty response/i);
  });

  it('NÃO throw com functionCall mas text vazia (só tool é válido)', async () => {
    mockFetch(() => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ functionCall: { name: 'start_combat', args: { enemies: [] } } }] } }],
    }), { status: 200 }));
    const p = new GeminiProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('');
    expect(r.toolCalls).toEqual([{ name: 'start_combat', input: { enemies: [] } }]);
  });
});

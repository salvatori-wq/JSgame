// Tests pra CascadeProvider — failover automático entre múltiplos providers.

import { describe, it, expect } from 'vitest';
import { CascadeProvider } from '../dm/providers/cascade.js';
import type { DMProvider, DMRawResponse } from '../dm/providers/base.js';

class StubProvider implements DMProvider {
  calls = 0;
  constructor(public readonly name: string, private behavior: 'success' | Error) {}
  async generate(): Promise<DMRawResponse> {
    this.calls++;
    if (this.behavior instanceof Error) throw this.behavior;
    return { text: `from ${this.name}`, toolCalls: [] };
  }
}

describe('CascadeProvider', () => {
  it('retorna resultado do primeiro provider quando sucesso', async () => {
    const p1 = new StubProvider('gemini', 'success');
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from gemini');
    expect(p1.calls).toBe(1);
    expect(p2.calls).toBe(0);
  });

  it('failover pro segundo provider quando primeiro joga 429', async () => {
    const p1 = new StubProvider('gemini', new Error('Gemini 429: quota exceeded'));
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from groq');
    expect(p1.calls).toBe(1);
    expect(p2.calls).toBe(1);
  });

  it('failover quando primeiro joga safety block', async () => {
    const p1 = new StubProvider('gemini', new Error('Gemini safety block: HARM_CATEGORY_VIOLENCE'));
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from groq');
  });

  it('failover quando primeiro joga timeout', async () => {
    const p1 = new StubProvider('gemini', new Error('LLM timeout após 25000ms'));
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from groq');
  });

  it('failover quando primeiro joga 503 overload', async () => {
    const p1 = new StubProvider('gemini', new Error('Gemini 503: service unavailable'));
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from groq');
  });

  it('propaga erro do último se todos falham', async () => {
    const p1 = new StubProvider('gemini', new Error('Gemini 429: quota'));
    const p2 = new StubProvider('groq', new Error('Groq 503: down'));
    const cascade = new CascadeProvider({ providers: [p1, p2] });

    await expect(cascade.generate({ systemPrompt: 's', userPrompt: 'u' }))
      .rejects.toThrow(/Groq 503/);
  });

  it('cascade name lista providers em ordem', () => {
    const p1 = new StubProvider('gemini', 'success');
    const p2 = new StubProvider('groq', 'success');
    const p3 = new StubProvider('anthropic', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2, p3] });
    expect(cascade.name).toBe('cascade(gemini→groq→anthropic)');
  });

  it('cascade de 3 providers — primeiro e segundo falham, terceiro sucede', async () => {
    const p1 = new StubProvider('gemini', new Error('Gemini 429'));
    const p2 = new StubProvider('groq', new Error('Groq 503'));
    const p3 = new StubProvider('anthropic', 'success');
    const cascade = new CascadeProvider({ providers: [p1, p2, p3] });

    const r = await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('from anthropic');
    expect(p1.calls).toBe(1);
    expect(p2.calls).toBe(1);
    expect(p3.calls).toBe(1);
  });

  it('rejeita construção com lista vazia', () => {
    expect(() => new CascadeProvider({ providers: [] })).toThrow(/pelo menos 1/);
  });

  it('onProviderResult callback observa sucesso e failover', async () => {
    const events: Array<{ providerName: string; stage: string }> = [];
    const p1 = new StubProvider('gemini', new Error('Gemini 429: quota'));
    const p2 = new StubProvider('groq', 'success');
    const cascade = new CascadeProvider({
      providers: [p1, p2],
      onProviderResult: (e) => events.push({ providerName: e.providerName, stage: e.stage }),
    });

    await cascade.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(events).toEqual([
      { providerName: 'gemini', stage: 'failed-retriable' },
      { providerName: 'groq', stage: 'success' },
    ]);
  });
});

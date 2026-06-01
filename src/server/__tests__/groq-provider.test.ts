// Tests pro GroqProvider — happy path + empty-throw pro cascade failover.
// Fase 3 (estabilização): Llama 3.3 as vezes devolve content="" sem tool_calls.
// Sem throw, o CascadeProvider parava no Groq (que e o PRIMARY em prod) achando
// sucesso e o jogo caía no FallbackDM em vez de tentar Gemini/Cerebras. Este
// guard prova que agora ele joga erro → cascade failover.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do groq-sdk (file-scoped — nao vaza pra outros arquivos de teste).
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: createMock } };
    constructor(_opts: unknown) { /* mock */ }
  },
}));

import { GroqProvider } from '../dm/providers/groq.js';

describe('GroqProvider', () => {
  beforeEach(() => { createMock.mockReset(); });

  it('happy path — extrai content da choice', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'narração ok', tool_calls: [] }, finish_reason: 'stop' }] });
    const p = new GroqProvider({ apiKey: 'k', model: 'llama-3.3-70b-versatile' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.text).toBe('narração ok');
    expect(r.toolCalls).toEqual([]);
  });

  it('parse tool_calls com arguments JSON string', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'briga', tool_calls: [{ function: { name: 'apply_damage', arguments: '{"damage":7}' } }] }, finish_reason: 'tool_calls' }] });
    const p = new GroqProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls).toEqual([{ name: 'apply_damage', input: { damage: 7 } }]);
  });

  it('Fase 3 — throw em response vazia (content="" sem tool_calls) → cascade failover', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '', tool_calls: [] }, finish_reason: 'stop' }] });
    const p = new GroqProvider({ apiKey: 'k', model: 'llama-3.3-70b-versatile' });
    await expect(p.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/empty response/i);
  });

  it('NÃO throw com tool_calls mas text vazia (só tool é válido)', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '', tool_calls: [{ function: { name: 'roll', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] });
    const p = new GroqProvider({ apiKey: 'k', model: 'm' });
    const r = await p.generate({ systemPrompt: 's', userPrompt: 'u' });
    expect(r.toolCalls.length).toBe(1);
    expect(r.text).toBe('');
  });
});

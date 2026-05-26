// Sprint pós-Cloudflare 2026-05-26 — tests pro fix de tool call vazando como texto.
// Cenário: Llama 3.3 70B (Cloudflare/outros) recebe tools mas retorna o tool_call
// como JSON literal dentro de result.response, vazando pra UI como "```json {...}```".

import { describe, it, expect } from 'vitest';

// Re-importa o helper via dynamic import porque isLeakedToolCallJson é unexported.
// Em vez disso, vamos importar a função pública extractJson via test indireto:
// mockamos um provider response e checamos que dm.ts NÃO usa o JSON como narration.

import { CloudflareProvider } from '../dm/providers/cloudflare.js';

const realFetch = globalThis.fetch;

describe('Cloudflare provider: NÃO passa tools no body (fix tool-call leak)', () => {
  it('body NÃO contém tools mesmo quando passados', async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({
        success: true,
        result: { response: 'narração CF normal' },
      }), { status: 200 });
    }) as typeof fetch;

    try {
      const p = new CloudflareProvider({ accountId: 'a', apiToken: 't', model: 'm' });
      await p.generate({
        systemPrompt: 's', userPrompt: 'u',
        tools: [
          { name: 'request_skill_check', description: 'd', schema: { type: 'object' } },
          { name: 'describe_scene', description: 'd', schema: { type: 'object' } },
        ],
      });
      // Body NÃO deve ter campo tools — provider ignora intencionalmente
      expect(capturedBody.tools).toBeUndefined();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

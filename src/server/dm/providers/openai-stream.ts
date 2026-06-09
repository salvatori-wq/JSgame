// Fase 2 — parser de SSE no formato OpenAI (chat.completions stream:true).
// Reusado pelos providers fetch-based OpenAI-compatible (Cerebras etc). Acumula
// content + tool_calls (montados por index ao longo dos chunks) e chama
// onText(delta) a cada pedaço de conteúdo. Devolve { text, toolCalls } igual ao
// generate() não-streamado.

import type { DMRawResponse } from './base.js';

interface DeltaToolCall {
  index?: number;
  function?: { name?: string; arguments?: string };
}

/** Lê um corpo SSE OpenAI-style até o fim, emitindo deltas de conteúdo. */
export async function parseOpenAiSSE(
  body: ReadableStream<Uint8Array>,
  onText: (delta: string) => void,
): Promise<DMRawResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const toolAcc = new Map<number, { name: string; args: string }>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '' || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string | null; tool_calls?: DeltaToolCall[] } }>;
        };
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) { text += delta.content; onText(delta.content); }
        for (const tc of delta?.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const cur = toolAcc.get(idx) ?? { name: '', args: '' };
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolAcc.set(idx, cur);
        }
      } catch { /* chunk parcial / keep-alive — ignora */ }
    }
  }

  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  for (const { name, args } of toolAcc.values()) {
    if (!name) continue;
    try {
      toolCalls.push({ name, input: JSON.parse(args || '{}') as Record<string, unknown> });
    } catch { /* argumentos malformados — dm.ts cobre com retry */ }
  }
  return { text, toolCalls };
}

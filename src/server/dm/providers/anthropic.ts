// JSgame · Provider Anthropic Claude.
// Pago mas alta qualidade narrativa. Usado opcionalmente.

import Anthropic from '@anthropic-ai/sdk';
import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export class AnthropicProvider implements DMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.client = new Anthropic({ apiKey, baseURL });
    this.model = model;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    const tools = opts.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema as Anthropic.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
      tools,
    }, { timeout: 12000 });

    let text = '';
    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
      }
    }
    return { text, toolCalls };
  }
}

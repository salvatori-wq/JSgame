// JSgame · DM provider interface comum.
// Permite trocar Groq/Anthropic/Ollama sem mudar o resto do código.

export interface DMToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface DMToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface DMRawResponse {
  text: string;
  toolCalls: DMToolCall[];
}

export interface DMProvider {
  readonly name: string;
  generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse>;
}

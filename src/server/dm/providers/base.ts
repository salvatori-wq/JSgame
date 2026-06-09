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

export interface GenerateOpts {
  systemPrompt: string;
  userPrompt: string;
  tools?: DMToolDef[];
  maxTokens?: number;
}

export interface DMProvider {
  readonly name: string;
  generate(opts: GenerateOpts): Promise<DMRawResponse>;
  /**
   * Fase 2 — streaming opcional. ACUMULA tudo e devolve o MESMO DMRawResponse
   * que generate() devolveria (text + toolCalls), MAS chama onText(delta) com os
   * deltas de CONTEÚDO crus conforme chegam. Provider sem suporte → ausente
   * (o DungeonMaster cai no generate). O delta é o conteúdo CRU (JSON-wrapped);
   * a extração da narração limpa é feita uma camada acima (narration-stream).
   */
  generateStream?(opts: GenerateOpts, onText: (delta: string) => void): Promise<DMRawResponse>;
}

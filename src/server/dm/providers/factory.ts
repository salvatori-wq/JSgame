// JSgame · Auto-detect DM provider baseado em env vars.
// Ordem: DM_PROVIDER explícito > Anthropic > Groq > null (fallback offline).

import type { DMProvider } from './base.js';
import { GroqProvider } from './groq.js';
import { AnthropicProvider } from './anthropic.js';

export interface ProviderEnv {
  DM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

export function buildProviderFromEnv(env: ProviderEnv): DMProvider | null {
  const explicit = env.DM_PROVIDER?.toLowerCase();

  if (explicit === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(
      env.ANTHROPIC_API_KEY,
      env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      env.ANTHROPIC_BASE_URL,
    );
  }
  if (explicit === 'groq' && env.GROQ_API_KEY) {
    return new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    });
  }

  // Auto-detect
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(
      env.ANTHROPIC_API_KEY,
      env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      env.ANTHROPIC_BASE_URL,
    );
  }
  if (env.GROQ_API_KEY) {
    return new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    });
  }

  return null;
}

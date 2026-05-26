// JSgame · Auto-detect DM provider baseado em env vars.
// Ordem: DM_PROVIDER explícito > CascadeProvider (todos disponíveis) > single fallback.
//
// Cascade — quando 2+ keys configuradas, builda um CascadeProvider que tenta:
//   Gemini (free + qualidade narrativa) →
//   Groq (free + 10× mais rápido) →
//   Anthropic (pago opcional)
//
// Se um falhar (429 quota, safety block, 5xx, timeout), AUTO tenta o próximo
// sem que o player perceba. Aprendizado playtest 2026-05-26: Gemini free tier
// estourou quota → 100% das narrações degradaram. Cascade resolve isso.

import type { DMProvider } from './base.js';
import { GroqProvider } from './groq.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { CascadeProvider } from './cascade.js';

export interface ProviderEnv {
  DM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export function buildProviderFromEnv(env: ProviderEnv): DMProvider | null {
  const explicit = env.DM_PROVIDER?.toLowerCase();

  if (explicit === 'gemini' && env.GEMINI_API_KEY) {
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    });
  }
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

  // Auto-detect cascade — monta lista de providers disponíveis em ordem de
  // preferência. Se 2+ keys configuradas, retorna CascadeProvider; se só 1,
  // retorna o provider direto. Ordem: Gemini > Groq > Anthropic.
  // (Gemini primeiro por qualidade narrativa; Groq segundo porque é rápido e
  // tem free tier generoso; Anthropic terceiro porque cobra.)
  const available: DMProvider[] = [];
  if (env.GEMINI_API_KEY) {
    available.push(new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    }));
  }
  if (env.GROQ_API_KEY) {
    available.push(new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    }));
  }
  if (env.ANTHROPIC_API_KEY) {
    available.push(new AnthropicProvider(
      env.ANTHROPIC_API_KEY,
      env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      env.ANTHROPIC_BASE_URL,
    ));
  }

  if (available.length === 0) return null;
  if (available.length === 1) return available[0]!;
  return new CascadeProvider({ providers: available });
}

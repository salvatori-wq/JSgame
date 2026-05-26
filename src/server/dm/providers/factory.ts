// JSgame · Auto-detect DM provider baseado em env vars.
// Ordem: DM_PROVIDER explícito > CascadeProvider (todos disponíveis) > single fallback.
//
// Cascade auto-build — quando 2+ keys configuradas, monta CascadeProvider em
// ordem otimizada pra latência+qualidade+disponibilidade:
//
//   1. Cerebras Llama 3.3 70B   (~2000 tok/s, 1M tokens/dia free)
//   2. Gemini 2.5 Flash         (qualidade narrativa premium, 1500/dia free)
//   3. Groq Llama 3.3 70B       (rápido, 14.4K/dia free)
//   4. Cloudflare Workers AI    (10K neurons/dia, infra distribuída)
//   5. Anthropic Haiku          (pago opcional, latência consistente)
//
// Se um falhar (429 quota, safety block, 5xx, timeout), AUTO tenta o próximo
// sem que o player perceba. Capacidade combinada free: ~47K calls/dia.

import type { DMProvider } from './base.js';
import { GroqProvider } from './groq.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { CerebrasProvider } from './cerebras.js';
import { CloudflareProvider } from './cloudflare.js';
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
  CEREBRAS_API_KEY?: string;
  CEREBRAS_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_MODEL?: string;
}

// Models Groq cujo context window NÃO comporta nosso prompt sistema D&D longo
// + 7 tool defs + recent narrations. Confirmado em prod: llama-3.1-8b-instant
// deu 413 "Request too large" em narrações simples. Se o env apontar pra um
// desses, ignoramos e forçamos 70b-versatile (128K context — plenty).
const GROQ_MODELS_TOO_SMALL = new Set([
  'llama-3.1-8b-instant',
  'llama-3.2-1b-preview',
  'llama-3.2-3b-preview',
]);
const GROQ_MODEL_DEFAULT = 'llama-3.3-70b-versatile';

function pickGroqModel(envModel: string | undefined): string {
  if (!envModel) return GROQ_MODEL_DEFAULT;
  if (GROQ_MODELS_TOO_SMALL.has(envModel)) {
    console.warn(`[factory] GROQ_MODEL=${envModel} tem context window pequeno demais pra prompt D&D — usando ${GROQ_MODEL_DEFAULT}`);
    return GROQ_MODEL_DEFAULT;
  }
  return envModel;
}

export function buildProviderFromEnv(env: ProviderEnv): DMProvider | null {
  const explicit = env.DM_PROVIDER?.toLowerCase();

  if (explicit === 'cerebras' && env.CEREBRAS_API_KEY) {
    return new CerebrasProvider({
      apiKey: env.CEREBRAS_API_KEY,
      model: env.CEREBRAS_MODEL ?? 'gpt-oss-120b',
    });
  }
  if (explicit === 'gemini' && env.GEMINI_API_KEY) {
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    });
  }
  if (explicit === 'cloudflare' && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    return new CloudflareProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      model: env.CLOUDFLARE_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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
      model: pickGroqModel(env.GROQ_MODEL),
    });
  }

  // Auto-detect cascade — ordem priorizando latência+qualidade+free tier:
  //   Cerebras (2000 tok/s, 1M/dia) → Gemini (narrativa premium) →
  //   Groq (14.4K/dia) → Cloudflare (10K neurons/dia) → Anthropic (pago opcional)
  const available: DMProvider[] = [];
  if (env.CEREBRAS_API_KEY) {
    available.push(new CerebrasProvider({
      apiKey: env.CEREBRAS_API_KEY,
      model: env.CEREBRAS_MODEL ?? 'gpt-oss-120b',
    }));
  }
  if (env.GEMINI_API_KEY) {
    available.push(new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    }));
  }
  if (env.GROQ_API_KEY) {
    available.push(new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: pickGroqModel(env.GROQ_MODEL),
    }));
  }
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    available.push(new CloudflareProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      model: env.CLOUDFLARE_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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

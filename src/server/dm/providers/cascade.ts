// JSgame · CascadeProvider — wraps múltiplos providers em ordem de prioridade.
// Se o primeiro falha com erro NÃO-transiente (quota 429, safety block, parse fail),
// pula direto pro próximo provider em vez de gastar backoff.
//
// Ordem típica (definida em factory.ts):
//   Gemini (free + qualidade) → Groq (free + rápido) → Anthropic (pago opcional)
//
// Erros que SAEM do cascade sem retry no próximo:
//   - 401/403 (auth fail — todos os providers vão falhar igual)
//   - Timeout custom configurado em short-circuit (já consumiu budget de tempo)
//
// O cascade EM SI não faz backoff — quem chama (DungeonMaster.callWithBackoff)
// decide se vale tentar de novo. Mas dentro de uma chamada, o cascade tenta os
// providers em sequência.
//
// Aprendizado playtest 2026-05-26: Gemini free tier estourou quota mid-session
// → 100% das narrações degradaram pra fallback offline mesmo com GROQ_API_KEY
// configurada. Cascade resolve esse cenário automaticamente.

import type { DMProvider, DMRawResponse, DMToolDef } from './base.js';

export interface CascadeProviderOptions {
  providers: DMProvider[];
  // Callback opcional pra observabilidade (sucesso de qual provider, qual falhou).
  onProviderResult?: (event: {
    providerName: string;
    stage: 'success' | 'failed-retriable' | 'failed-fatal';
    errorMsg?: string;
    attemptIndex: number;
    totalProviders: number;
  }) => void;
}

// Erros que NÃO resolvem se a gente tentar de novo no mesmo provider —
// faz sentido pular pro próximo da cascata.
function isErrorWorthFailover(msg: string): boolean {
  return (
    /429|quota|rate.?limit/i.test(msg) ||           // quota / rate limit
    /503|502|504|overload|unavailable/i.test(msg) || // upstream down
    /safety|block|recitation|filtered/i.test(msg) || // safety block (Gemini)
    /5\d\d/.test(msg) ||                              // qualquer 5xx
    /timeout/i.test(msg)                              // timeout (provider lento)
  );
}

// Erros que indicam config errada — não adianta tentar próximo provider
// se o primeiro tem key inválida, o segundo provavelmente também tem outro problema,
// mas mesmo assim vamos tentar (defesa em profundidade).
function isErrorFatal(msg: string): boolean {
  return /401|403|unauthorized|forbidden|invalid.?api.?key/i.test(msg);
}

export class CascadeProvider implements DMProvider {
  readonly name: string;
  private providers: DMProvider[];
  private onResult?: CascadeProviderOptions['onProviderResult'];
  // 2026-05-26: expõe qual provider EFETIVAMENTE respondeu na última chamada.
  // dm.ts lê isso pra telemetria precisa — antes salvávamos "cascade(...)" o que
  // mascarava qual provider individual deu success/error.
  public lastSuccessfulProvider: string | null = null;
  // Quando cascade esgota, registra qual foi o último que falhou (pra error telemetry).
  public lastFailedProvider: string | null = null;

  constructor(opts: CascadeProviderOptions) {
    if (opts.providers.length === 0) {
      throw new Error('CascadeProvider: pelo menos 1 provider obrigatório');
    }
    this.providers = opts.providers;
    this.name = `cascade(${opts.providers.map((p) => p.name).join('→')})`;
    this.onResult = opts.onProviderResult;
  }

  // Provider primário (índice 0) — usado pra logs e dashboard.
  get primary(): DMProvider {
    return this.providers[0]!;
  }

  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    tools?: DMToolDef[];
    maxTokens?: number;
  }): Promise<DMRawResponse> {
    let lastErr: unknown = null;
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i]!;
      try {
        const result = await provider.generate(opts);
        this.lastSuccessfulProvider = provider.name;
        this.lastFailedProvider = null; // reset — sucesso limpa
        this.onResult?.({
          providerName: provider.name,
          stage: 'success',
          attemptIndex: i,
          totalProviders: this.providers.length,
        });
        if (i > 0) {
          // Provider de backup salvou o dia — vale a pena logar pra ver frequência.
          console.warn(`[cascade] ${provider.name} respondeu após ${i} provider(s) falharem`);
        }
        return result;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isLast = i === this.providers.length - 1;

        if (isLast) {
          // Acabou a cascata — propaga o erro pro caller decidir
          this.lastFailedProvider = provider.name;
          this.onResult?.({
            providerName: provider.name,
            stage: 'failed-fatal',
            errorMsg: msg.slice(0, 200),
            attemptIndex: i,
            totalProviders: this.providers.length,
          });
          throw err;
        }

        // Erro fatal de auth no provider atual — ainda vale tentar próximo
        // (talvez tenha key válida diferente).
        if (isErrorFatal(msg)) {
          this.onResult?.({
            providerName: provider.name,
            stage: 'failed-retriable',
            errorMsg: msg.slice(0, 200),
            attemptIndex: i,
            totalProviders: this.providers.length,
          });
          console.warn(`[cascade] ${provider.name} auth fail — tentando próximo (${this.providers[i + 1]!.name})`);
          continue;
        }

        if (isErrorWorthFailover(msg)) {
          this.onResult?.({
            providerName: provider.name,
            stage: 'failed-retriable',
            errorMsg: msg.slice(0, 200),
            attemptIndex: i,
            totalProviders: this.providers.length,
          });
          console.warn(`[cascade] ${provider.name} falhou (${msg.slice(0, 80)}) — failover pra ${this.providers[i + 1]!.name}`);
          continue;
        }

        // Erro NÃO classificado como worth-failover (ex: 400 malformed request) —
        // mesmo assim tenta próximo, defesa em profundidade. Pode ser que o próximo
        // provider aceite o prompt.
        this.onResult?.({
          providerName: provider.name,
          stage: 'failed-retriable',
          errorMsg: msg.slice(0, 200),
          attemptIndex: i,
          totalProviders: this.providers.length,
        });
        console.warn(`[cascade] ${provider.name} falhou (${msg.slice(0, 80)}) — tentando ${this.providers[i + 1]!.name} mesmo assim`);
      }
    }
    // Inalcançável (último iteration ou throws ou retorna), mas TS pede
    throw lastErr ?? new Error('CascadeProvider: todos providers falharam');
  }
}

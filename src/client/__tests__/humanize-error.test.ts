// Sub-sprint C — Tests do tradutor de erros family-friendly.

import { describe, it, expect } from 'vitest';
import { humanizeServerError } from '../humanize-error';

describe('humanizeServerError — LLM/IA', () => {
  it('traduz timeout do Mestre', () => {
    expect(humanizeServerError('Mestre demorou demais')).toMatch(/⌛.*demorou demais/);
    expect(humanizeServerError('Request timed out after 12s')).toMatch(/⌛/);
    expect(humanizeServerError('ETIMEDOUT')).toMatch(/⌛/);
  });

  it('traduz falhas de provider LLM', () => {
    expect(humanizeServerError('Groq 429 rate limit')).toMatch(/🧠.*tropeçou/);
    expect(humanizeServerError('Gemini API key invalid')).toMatch(/🧠/);
    expect(humanizeServerError('Anthropic 403 forbidden')).toMatch(/🧠/);
  });

  it('traduz "no provider available"', () => {
    expect(humanizeServerError('no provider available')).toMatch(/🌙.*indisponíveis/);
    expect(humanizeServerError('all providers failed')).toMatch(/🌙/);
  });
});

describe('humanizeServerError — Network', () => {
  it('traduz erros de rede', () => {
    expect(humanizeServerError('ECONNREFUSED 127.0.0.1:3001')).toMatch(/📡/);
    expect(humanizeServerError('Failed to fetch')).toMatch(/📡/);
    expect(humanizeServerError('network error: ENOTFOUND')).toMatch(/📡/);
  });

  it('traduz 500 Internal Server Error', () => {
    expect(humanizeServerError('500 Internal Server Error')).toMatch(/🌙.*servidor/);
  });

  it('traduz 503', () => {
    expect(humanizeServerError('503 service unavailable')).toMatch(/manutenção/);
  });

  it('traduz 502 bad gateway (proxy do Render free no cold-start)', () => {
    expect(humanizeServerError('502 Bad Gateway')).toMatch(/manutenção/);
  });

  it('traduz SyntaxError de cold-start (servidor responde HTML em vez de JSON)', () => {
    expect(humanizeServerError("SyntaxError: Unexpected token '<', \"<!DOCTYPE\"... is not valid JSON"))
      .toMatch(/🌙.*acordando/);
    expect(humanizeServerError('Unexpected end of JSON input')).toMatch(/🌙.*acordando/);
  });
});

describe('humanizeServerError — combate', () => {
  it('traduz erros de regras', () => {
    expect(humanizeServerError('not your turn')).toMatch(/⏳.*turno/);
    expect(humanizeServerError('invalid target')).toMatch(/🎯/);
    expect(humanizeServerError('action already used')).toMatch(/⛔/);
  });
});

describe('humanizeServerError — persistência', () => {
  it('traduz SQLITE_BUSY', () => {
    expect(humanizeServerError('SQLITE_BUSY: database is locked')).toMatch(/💾/);
    expect(humanizeServerError('persistence not initialized')).toMatch(/💾/);
  });
});

describe('humanizeServerError — coop', () => {
  it('traduz lobby fechado', () => {
    expect(humanizeServerError('lobby not found')).toMatch(/🚪.*fechada/);
    expect(humanizeServerError('lobby closed')).toMatch(/🚪/);
  });

  it('traduz sala cheia', () => {
    expect(humanizeServerError('lobby full')).toMatch(/👥.*cheia/);
    expect(humanizeServerError('max players reached')).toMatch(/👥/);
  });
});

describe('humanizeServerError — fallback', () => {
  it('mensagem curta amigável passa direto', () => {
    expect(humanizeServerError('Você precisa selecionar um aliado.'))
      .toBe('Você precisa selecionar um aliado.');
  });

  it('mensagem técnica longa cai no fallback genérico', () => {
    const result = humanizeServerError('TypeError: Cannot read property "foo" of undefined\n  at Object.<anonymous>');
    expect(result).toMatch(/🌙/);
    expect(result).not.toMatch(/TypeError/);
    expect(result).not.toMatch(/anonymous/);
  });

  it('string vazia', () => {
    expect(humanizeServerError('')).toMatch(/🌙/);
  });

  it('erro técnico CURTO sem padrão conhecido NÃO vaza (looksTechnical pega)', () => {
    // Antes: ≤80 chars + sem "TypeError" passava direto pro usuário. Agora
    // SyntaxError/ReferenceError/Error:/Exception caem no fallback genérico.
    const r = humanizeServerError('ReferenceError: x is not defined');
    expect(r).toMatch(/🌙/);
    expect(r).not.toMatch(/ReferenceError/);
  });

  it('mensagem com stack trace é escondida', () => {
    const tech = 'undefined is not a function\n  at Module.eval (...)\n  at Promise.then';
    expect(humanizeServerError(tech)).not.toMatch(/eval|Module/);
  });
});

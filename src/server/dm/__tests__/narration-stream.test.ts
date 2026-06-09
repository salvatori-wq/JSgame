// Fase 2a — guards do extrator incremental de narração. Prova que, com chunks
// quebrados em QUALQUER fronteira (inclusive no meio de escapes), ele emite só o
// texto limpo da narração, para na aspa de fechamento, e nunca vaza o JSON cru.

import { describe, it, expect } from 'vitest';
import { NarrationStreamExtractor, decodeJsonStringPartial } from '../narration-stream';

/** Alimenta o extrator com `chunks` e devolve o texto concatenado emitido. */
function run(chunks: string[]): { out: string; finished: boolean } {
  const ex = new NarrationStreamExtractor();
  let out = '';
  for (const c of chunks) ex.push(c, (d) => { out += d; });
  return { out, finished: ex.finished };
}

/** Quebra uma string inteira em chunks de tamanho `n` (testa toda fronteira). */
function chunked(s: string, n: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += n) parts.push(s.slice(i, i + n));
  return parts;
}

describe('decodeJsonStringPartial — Fase 2a', () => {
  it('para na aspa de fechamento', () => {
    expect(decodeJsonStringPartial('abc" , "speaker"')).toEqual({ value: 'abc', closed: true });
  });
  it('decodifica escapes \\n \\" \\\\', () => {
    expect(decodeJsonStringPartial('a\\nb\\"c\\\\d"').value).toBe('a\nb"c\\d');
  });
  it('escape incompleto na fronteira para ANTES (não vaza barra)', () => {
    expect(decodeJsonStringPartial('abc\\')).toEqual({ value: 'abc', closed: false });
  });
  it('\\u incompleto espera o resto', () => {
    expect(decodeJsonStringPartial('a\\u12')).toEqual({ value: 'a', closed: false });
    expect(decodeJsonStringPartial('a\\u00e9"').value).toBe('aé');
  });
});

describe('NarrationStreamExtractor — Fase 2a', () => {
  const FULL = '{"narration":"Vocês entram na caverna. Água pinga.","speaker":"Mestre"}';
  const EXPECTED = 'Vocês entram na caverna. Água pinga.';

  it('JSON inteiro num chunk só → emite só a narração', () => {
    const { out, finished } = run([FULL]);
    expect(out).toBe(EXPECTED);
    expect(finished).toBe(true);
  });

  it('mesmo resultado quebrando em chunks de 1 char (toda fronteira)', () => {
    const { out, finished } = run(chunked(FULL, 1));
    expect(out).toBe(EXPECTED);
    expect(finished).toBe(true);
  });

  it('chunks de 3 e de 7 chars dão o mesmo texto', () => {
    expect(run(chunked(FULL, 3)).out).toBe(EXPECTED);
    expect(run(chunked(FULL, 7)).out).toBe(EXPECTED);
  });

  it('nunca vaza a abertura do JSON nem o campo speaker', () => {
    const { out } = run(chunked(FULL, 2));
    expect(out).not.toContain('"narration"');
    expect(out).not.toContain('speaker');
    expect(out).not.toContain('{');
  });

  it('narração com aspas e \\n escapados decodifica certo', () => {
    const json = '{"narration":"Ele diz \\"corra\\"!\\nE some.","speaker":"NPC"}';
    expect(run(chunked(json, 4)).out).toBe('Ele diz "corra"!\nE some.');
  });

  it('para no fechamento e ignora o resto', () => {
    const { out, finished } = run(['{"narration":"oi","speaker":"Mestre"}', 'LIXO DEPOIS']);
    expect(out).toBe('oi');
    expect(finished).toBe(true);
  });

  it('texto-puro (sem JSON) acima do threshold → streama cru (fallback)', () => {
    const plain = 'A '.repeat(200); // bem acima de 240 chars, sem chaves
    const { out } = run(chunked(plain, 30));
    expect(out).toBe(plain);
  });

  it('sem campo narration (só tool_call JSON) → não emite nada', () => {
    const toolOnly = '{"type":"function","name":"start_combat","parameters":{"enemies":[]}}';
    expect(run(chunked(toolOnly, 5)).out).toBe('');
  });
});

// Tests pro parser de tool_calls inline do Cloudflare.
// Llama 3.3 70B retorna tool_calls como JSON dentro do text — parser extrai
// pra toolCalls array e limpa do text.

import { describe, it, expect } from 'vitest';
import { parseInlineToolCalls } from '../dm/providers/cloudflare.js';

describe('parseInlineToolCalls', () => {
  it('text limpo (sem JSON) passa intacto', () => {
    const r = parseInlineToolCalls('A taverna treme. O troll bate na porta.');
    expect(r.cleanedText).toBe('A taverna treme. O troll bate na porta.');
    expect(r.toolCalls).toEqual([]);
  });

  it('extrai tool_call de ```json``` block formato Llama', () => {
    const text = 'Você ataca o orc!\n```json\n{"type":"function","name":"start_combat","parameters":{"enemies":[{"name":"orc","hp":15}]}}\n```\nA batalha começa.';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls).toEqual([
      { name: 'start_combat', input: { enemies: [{ name: 'orc', hp: 15 }] } },
    ]);
    expect(r.cleanedText).toBe('Você ataca o orc!\n\nA batalha começa.');
  });

  it('extrai tool_call de JSON direto no início (sem code block)', () => {
    const text = '{"type":"function","name":"request_skill_check","parameters":{"skill":"percepcao","dc":15}}';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls).toEqual([
      { name: 'request_skill_check', input: { skill: 'percepcao', dc: 15 } },
    ]);
    expect(r.cleanedText).toBe('');
  });

  it('JSON direto seguido de narração', () => {
    const text = '{"type":"function","name":"describe_scene","parameters":{"location":"taverna"}} Os jogadores entram.';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls.length).toBe(1);
    expect(r.toolCalls[0]!.name).toBe('describe_scene');
    expect(r.cleanedText).toBe('Os jogadores entram.');
  });

  it('múltiplos tool_calls em code blocks', () => {
    const text = '```json\n{"type":"function","name":"start_combat","parameters":{"a":1}}\n```\nNarração no meio.\n```json\n{"type":"function","name":"apply_condition","parameters":{"b":2}}\n```';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls.length).toBe(2);
    expect(r.toolCalls[0]!.name).toBe('start_combat');
    expect(r.toolCalls[1]!.name).toBe('apply_condition');
    expect(r.cleanedText).toBe('Narração no meio.');
  });

  it('JSON malformado não crasha, mantém no text', () => {
    const text = '```json\n{broken json\n```\nfallback';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls).toEqual([]);
    // Block malformado é PRESERVADO no text (não consegue extrair)
    expect(r.cleanedText).toContain('broken json');
  });

  it('JSON que não é tool_call (sem type:function nem name) — mantém intacto', () => {
    const text = '```json\n{"data":[1,2,3]}\n```';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls).toEqual([]);
    expect(r.cleanedText).toContain('data');
  });

  it('formato direto sem type:function mas com name + parameters', () => {
    const text = '{"name":"apply_damage","parameters":{"target":"orc","damage":10}}';
    const r = parseInlineToolCalls(text);
    expect(r.toolCalls).toEqual([
      { name: 'apply_damage', input: { target: 'orc', damage: 10 } },
    ]);
  });
});

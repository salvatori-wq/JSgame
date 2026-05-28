// U.1 — Tests do stripInlineToolMentions.
// Bug original (playtest 2026-05-29): Gemini em retry-sem-tools imitou os
// exemplos do system prompt e cuspiu "+ tool start_combat (enemies: [...])"
// literal no texto narrativo. Player viu isso.

import { describe, it, expect } from 'vitest';
import { stripInlineToolMentions } from '../dm/dm';

describe('U.1 — stripInlineToolMentions', () => {
  it('remove "+ tool start_combat (...)" no fim do texto', () => {
    const input = 'A lâmpada balança. "Então é assim, elfa?"+ tool start_combat (enemies: [{name: "Carcereiro", hp: 11}])';
    expect(stripInlineToolMentions(input)).toBe('A lâmpada balança. "Então é assim, elfa?"');
  });

  it('remove versão compacta sem underscore "startcombat"', () => {
    const input = 'Algo se move nas sombras. + tool startcombat (enemies: [{}])';
    expect(stripInlineToolMentions(input)).toBe('Algo se move nas sombras.');
  });

  it('remove múltiplas tools em sequência (cobertura playtest real)', () => {
    const input = '"Sem conversa?"+ tool start_combat (enemies: [...])+ tool suggest_actions (actions: [...])';
    expect(stripInlineToolMentions(input)).toBe('"Sem conversa?"');
  });

  it('preserva texto sem tool mentions intacto', () => {
    const input = 'Cela fria, cheiro de mofo. O carcereiro joga um pergaminho.';
    expect(stripInlineToolMentions(input)).toBe(input);
  });

  it('detecta sem o sinal de "+" (defensivo)', () => {
    const input = 'O guarda te encara. tool request_skill_check (skill: persuasao, dc: 13)';
    expect(stripInlineToolMentions(input)).toBe('O guarda te encara.');
  });

  it('detecta variações em caixa alta/baixa', () => {
    const input = 'Algo se move. + Tool Apply_Damage (target: pj-1, dmg: 4)';
    expect(stripInlineToolMentions(input)).toBe('Algo se move.');
  });

  it('NÃO confunde palavra "tool" em contexto narrativo legítimo', () => {
    // Palavra "tool" em texto narrativo SEM ser seguida de tool name conhecido
    const input = 'Você encontra uma tool antiga na bancada do ferreiro.';
    expect(stripInlineToolMentions(input)).toBe(input);
  });

  it('strip também consome trailing punctuation/whitespace sobrando', () => {
    const input = 'Frase narrativa.   + tool end_combat (outcome: vitória)';
    expect(stripInlineToolMentions(input)).toBe('Frase narrativa.');
  });

  it('input vazio passa intacto', () => {
    expect(stripInlineToolMentions('')).toBe('');
  });

  it('cobre todas tools do prompts.ts (suggest_actions, apply_condition, end_combat)', () => {
    // cast_spell NÃO existe em prompts.ts (player casta via socket, não tool DM);
    // usar enemy_casts_spell pra cobrir o caso de spell-related tool.
    const cases = [
      'A. + tool suggest_actions (actions: [])',
      'B. + tool apply_condition (target: x, condition: prone)',
      'C. + tool end_combat_with_outcome (outcome: defeat)',
      'D. + tool describe_scene (location: cell)',
      'E. + tool enemy_casts_spell (enemy: goblin, spell: cure)',
    ];
    for (const c of cases) {
      const out = stripInlineToolMentions(c);
      // Pega o prefix antes do " + tool"
      expect(out).toMatch(/^[A-E]\.?$/);
    }
  });

  it('respeita o texto até o PRIMEIRO match (multi-tool inline)', () => {
    const input = 'Início. + tool start_combat (a) + tool suggest_actions (b)';
    expect(stripInlineToolMentions(input)).toBe('Início.');
  });

  it('preserva content quando "tool" aparece em palavra maior (toolkit, etc)', () => {
    const input = 'Ele pega um toolkit do bolso para arrombar a fechadura.';
    expect(stripInlineToolMentions(input)).toBe(input);
  });
});

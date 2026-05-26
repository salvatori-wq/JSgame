// Tests pra 1C — DM personality presets.
// Garante que cada preset gera SYSTEM_PROMPT distinto, não-vazio, válido.

import { describe, it, expect } from 'vitest';
import { getSystemPrompt, SYSTEM_PROMPT } from '../dm/prompts.js';
import { PERSONALITIES, ALL_PERSONALITIES, getPersonality, DEFAULT_PERSONALITY } from '../../dnd/dm-personality.js';

describe('1C — DM Personality presets', () => {
  it('5 personalities definidas (sombrio/epico/comedia/noir/pulp)', () => {
    expect(ALL_PERSONALITIES.length).toBe(5);
    expect(Object.keys(PERSONALITIES).sort()).toEqual(['comedia', 'epico', 'noir', 'pulp', 'sombrio']);
  });

  it('cada preset tem id, label, icon, description, identityBlock não-vazio', () => {
    for (const p of ALL_PERSONALITIES) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.identityBlock).toBeTruthy();
      expect(p.identityBlock.length).toBeGreaterThan(200); // bloco substancial
    }
  });

  it('DEFAULT_PERSONALITY = sombrio (retrocompat)', () => {
    expect(DEFAULT_PERSONALITY).toBe('sombrio');
  });

  it('getPersonality(undefined) retorna sombrio default', () => {
    expect(getPersonality(undefined).id).toBe('sombrio');
  });

  it('getPersonality(invalido) retorna default sombrio', () => {
    // @ts-expect-error testing runtime fallback
    expect(getPersonality('xpto').id).toBe('sombrio');
  });

  it('getSystemPrompt(sombrio) contém regras D&D + identidade sombria', () => {
    const prompt = getSystemPrompt('sombrio');
    expect(prompt).toContain('SOMBRIO LOVECRAFTIANO');
    expect(prompt).toContain('REGRAS D&D 5e EMBARCADAS');
    expect(prompt).toContain('request_skill_check');
  });

  it('getSystemPrompt(epico) NÃO contém "SOMBRIO LOVECRAFTIANO" mas sim "TOLKIEN"', () => {
    const prompt = getSystemPrompt('epico');
    expect(prompt).not.toContain('SOMBRIO LOVECRAFTIANO');
    expect(prompt).toContain('TOLKIEN');
  });

  it('getSystemPrompt(comedia) menciona Pratchett/Monty Python', () => {
    const prompt = getSystemPrompt('comedia');
    expect(prompt.toLowerCase()).toContain('pratchett');
  });

  it('getSystemPrompt(noir) sublinha mistério/sombra/lovecraft puro', () => {
    const prompt = getSystemPrompt('noir');
    expect(prompt.toLowerCase()).toContain('detetive');
  });

  it('getSystemPrompt(pulp) menciona Indiana Jones', () => {
    const prompt = getSystemPrompt('pulp');
    expect(prompt.toLowerCase()).toContain('indiana jones');
  });

  it('cada preset gera prompt distinto', () => {
    const prompts = ALL_PERSONALITIES.map((p) => getSystemPrompt(p.id));
    const unique = new Set(prompts);
    expect(unique.size).toBe(5);
  });

  it('SYSTEM_PROMPT (retrocompat const) = getSystemPrompt(sombrio)', () => {
    expect(SYSTEM_PROMPT).toBe(getSystemPrompt('sombrio'));
  });

  it('todos prompts mantêm regras D&D base (tools, DC table)', () => {
    for (const p of ALL_PERSONALITIES) {
      const prompt = getSystemPrompt(p.id);
      expect(prompt).toContain('request_skill_check');
      expect(prompt).toContain('start_combat');
      expect(prompt).toContain('DCs padrão');
    }
  });
});

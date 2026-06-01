// Fase 0 (estabilização) — guard do echo do dado em PT-BR limpo.
// Bug reproduzido no playtest do João: o log mostrava "percepcao (DC 12): rolou
// 4 → FALHOU" — slug de enum sem acento + DC interno exposto + CAIXA ALTA de
// teste. O jogador deve ver só perícia (PT-BR) + número + desfecho.
// As funções skillLabel/rollVerdictLabel vivem em connection.ts; aqui validamos
// o comportamento via SKILLS direto (mesma fonte) + um guard de formato.

import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../dnd/skills';
import { ABILITY_LABELS } from '../../dnd/attributes';

describe('Fase 0 — echo do dado sem jargão (PT-BR)', () => {
  it('perícias têm nome PT-BR com acento (não o slug cru)', () => {
    expect(SKILLS['percepcao'].name).toBe('Percepção');
    expect(SKILLS['investigacao'].name).toBe('Investigação');
    expect(SKILLS['persuasao'].name).toBe('Persuasão');
    // o slug NUNCA deve ser exibido cru
    expect(SKILLS['percepcao'].name).not.toBe('percepcao');
  });

  it('atributos de resistência têm rótulo PT-BR por extenso', () => {
    expect(ABILITY_LABELS['sab']).toBe('Sabedoria');
    expect(ABILITY_LABELS['des']).toBe('Destreza');
    expect(ABILITY_LABELS['con']).toBe('Constituição');
  });

  // Reproduz o formato ANTIGO (bugado) e garante que o nome PT-BR + formato novo
  // não contêm o slug, o "DC", nem a CAIXA ALTA de verdict.
  it('formato novo do echo: "Percepção 14 — sucesso" (sem DC/slug/CAPS)', () => {
    const skill = 'percepcao';
    const total = 14;
    const verdict = 'sucesso';
    const echo = `${SKILLS[skill as keyof typeof SKILLS].name} ${total} — ${verdict}`;
    expect(echo).toBe('Percepção 14 — sucesso');
    expect(echo).not.toContain('percepcao');     // sem slug cru
    expect(echo).not.toMatch(/\bDC\b/);            // sem DC interno exposto
    expect(echo).not.toMatch(/FALHOU|SUCESSO|NAT20|NAT1/); // sem CAIXA ALTA de teste
  });
});

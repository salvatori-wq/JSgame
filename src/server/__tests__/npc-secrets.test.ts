// Y.A3 — Sprint Y: Tests pras 2 tools mark_npc_secret + reveal_npc_secret.

import { describe, it, expect } from 'vitest';
import { validateToolCall } from '../dm/tools';

describe('mark_npc_secret — Y.A3 validator', () => {
  it('mark com npcName + secret + revealCondition', () => {
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: {
        npcName: 'Estalajadeira Olga',
        secret: 'É irmã do bandido procurado pelo capitão',
        revealCondition: 'insight>=15',
      },
    });
    expect(r?.kind).toBe('mark_npc_secret');
    if (r?.kind === 'mark_npc_secret') {
      expect(r.npcName).toBe('Estalajadeira Olga');
      expect(r.secret).toContain('irmã');
      expect(r.revealCondition).toBe('insight>=15');
    }
  });

  it('mark com secretId opcional', () => {
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: {
        npcName: 'Padre Mateus',
        secret: 'Esconde grimório',
        revealCondition: 'manual',
        secretId: 'mateus-grimorio',
      },
    });
    expect(r?.kind).toBe('mark_npc_secret');
    if (r?.kind === 'mark_npc_secret') {
      expect(r.secretId).toBe('mateus-grimorio');
    }
  });

  it('npcName vazio → null', () => {
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: { npcName: '', secret: 'x', revealCondition: 'manual' },
    });
    expect(r).toBeNull();
  });

  it('secret vazio → null', () => {
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: { npcName: 'N', secret: '', revealCondition: 'manual' },
    });
    expect(r).toBeNull();
  });

  it('revealCondition vazio → default "manual"', () => {
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: { npcName: 'N', secret: 'x', revealCondition: '' },
    });
    expect(r?.kind).toBe('mark_npc_secret');
    if (r?.kind === 'mark_npc_secret') {
      expect(r.revealCondition).toBe('manual');
    }
  });

  it('secret muito longo é truncado em 400 chars', () => {
    const longSecret = 'a'.repeat(800);
    const r = validateToolCall({
      name: 'mark_npc_secret',
      input: { npcName: 'N', secret: longSecret, revealCondition: 'manual' },
    });
    expect(r?.kind).toBe('mark_npc_secret');
    if (r?.kind === 'mark_npc_secret') {
      expect(r.secret.length).toBeLessThanOrEqual(400);
    }
  });
});

describe('reveal_npc_secret — Y.A3 validator', () => {
  it('reveal com npcName + secretId', () => {
    const r = validateToolCall({
      name: 'reveal_npc_secret',
      input: { npcName: 'Olga', secretId: 'olga-irma-bandido' },
    });
    expect(r?.kind).toBe('reveal_npc_secret');
    if (r?.kind === 'reveal_npc_secret') {
      expect(r.npcName).toBe('Olga');
      expect(r.secretId).toBe('olga-irma-bandido');
    }
  });

  it('secretId vazio → null', () => {
    const r = validateToolCall({
      name: 'reveal_npc_secret',
      input: { npcName: 'Olga', secretId: '' },
    });
    expect(r).toBeNull();
  });

  it('npcName vazio → null', () => {
    const r = validateToolCall({
      name: 'reveal_npc_secret',
      input: { npcName: '', secretId: 'x' },
    });
    expect(r).toBeNull();
  });
});

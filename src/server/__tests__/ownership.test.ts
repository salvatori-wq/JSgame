// Fase 0c — guards dos predicados de ownership usados nas rotas REST e no
// joinCampaign. Provam: PJ de OUTRO user logado é bloqueado; PJ anônimo passa;
// crônica só "pertence" a quem tem PJ na party.

import { describe, it, expect } from 'vitest';
import { canAccessCharacter, ownsCampaignParty } from '../ownership';

describe('canAccessCharacter — Fase 0c', () => {
  it('PJ de user logado: só o dono acessa', () => {
    expect(canAccessCharacter({ userId: 'u1' }, 'u1')).toBe(true);
    expect(canAccessCharacter({ userId: 'u1' }, 'u2')).toBe(false);
    expect(canAccessCharacter({ userId: 'u1' }, undefined)).toBe(false); // anônimo não acessa PJ alheio
  });

  it('PJ anônimo (sem userId): liberado pra qualquer um (jogar sem cadastro)', () => {
    expect(canAccessCharacter({ userId: undefined }, undefined)).toBe(true);
    expect(canAccessCharacter({ userId: undefined }, 'u1')).toBe(true);
    expect(canAccessCharacter({} as { userId?: string }, 'u1')).toBe(true);
  });

  it('PJ inexistente (null): nada a proteger', () => {
    expect(canAccessCharacter(null, 'u1')).toBe(true);
    expect(canAccessCharacter(undefined, undefined)).toBe(true);
  });
});

describe('ownsCampaignParty — Fase 0c', () => {
  it('true quando o user tem ao menos 1 PJ na party', () => {
    expect(ownsCampaignParty(['pjA', 'pjB'], ['pjB', 'pjZ'])).toBe(true);
    expect(ownsCampaignParty(['pjA'], ['pjA'])).toBe(true);
  });

  it('false quando nenhum PJ do user está na party', () => {
    expect(ownsCampaignParty(['pjA', 'pjB'], ['pjX'])).toBe(false);
    expect(ownsCampaignParty(['pjA'], [])).toBe(false);
  });

  it('false pra party vazia/ausente (não dá pra reivindicar posse)', () => {
    expect(ownsCampaignParty([], ['pjA'])).toBe(false);
    expect(ownsCampaignParty(undefined, ['pjA'])).toBe(false);
  });
});

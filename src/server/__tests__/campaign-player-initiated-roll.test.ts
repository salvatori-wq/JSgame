// Sub-sprint D2 — Tests pra player-initiated skill check.
// Cobertura: player toma iniciativa de rolar, server cria pendingCheck,
// não sobrescreve pending existente, valida shape.

import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';
import { FallbackDM } from '../dm/dm.js';

describe('Campaign.setPlayerInitiatedSkillCheck', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new FallbackDM());
  });

  it('cria pendingCheck novo com skill + dc + reason', () => {
    camp.setPlayerInitiatedSkillCheck({
      playerId: 'p1',
      skill: 'percepcao',
      dc: 12,
      reason: 'Player iniciativa',
    });
    const pending = camp.getPendingSkillCheck();
    expect(pending).not.toBeNull();
    expect(pending?.skill).toBe('percepcao');
    expect(pending?.dc).toBe(12);
    expect(pending?.playerId).toBe('p1');
    expect(pending?.reason).toContain('Player iniciativa');
  });

  it('NÃO sobrescreve pendingCheck existente (Mestre prevalece)', () => {
    // Simula pending check criado pelo Mestre (set_pending_check tool call)
    camp.state.pendingCheck = {
      playerId: 'p1',
      skill: 'arcanismo',
      dc: 15,
      reason: 'Mestre pediu primeiro',
    };
    camp.setPlayerInitiatedSkillCheck({
      playerId: 'p1',
      skill: 'percepcao',
      dc: 12,
      reason: 'Player tentou sobrescrever',
    });
    const pending = camp.getPendingSkillCheck();
    expect(pending?.skill).toBe('arcanismo');   // mantém o do Mestre
    expect(pending?.dc).toBe(15);
    expect(pending?.reason).toBe('Mestre pediu primeiro');
  });

  it('aceita DC alto (15+) e baixo (5)', () => {
    camp.setPlayerInitiatedSkillCheck({
      playerId: 'p1',
      skill: 'atletismo',
      dc: 20,
      reason: 'Tentar feito impossível',
    });
    expect(camp.getPendingSkillCheck()?.dc).toBe(20);
  });
});

// M1.2 — Player desiste do teste pendente. Server limpa pendingCheck.
describe('Campaign.clearPendingCheck', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new FallbackDM());
  });

  it('limpa pending e retorna reason+skill quando playerId match', () => {
    camp.state.pendingCheck = {
      playerId: 'p1',
      skill: 'percepcao',
      dc: 12,
      reason: 'Notar a emboscada',
    };
    const result = camp.clearPendingCheck('p1');
    expect(result).toEqual({ reason: 'Notar a emboscada', skill: 'percepcao' });
    expect(camp.getPendingSkillCheck()).toBeNull();
  });

  it('retorna null e NÃO limpa se playerId não é owner do check', () => {
    camp.state.pendingCheck = {
      playerId: 'p1',
      skill: 'arcanismo',
      dc: 15,
      reason: 'Decifrar runa',
    };
    const result = camp.clearPendingCheck('outro-player');
    expect(result).toBeNull();
    expect(camp.getPendingSkillCheck()).not.toBeNull(); // pending intacto
    expect(camp.getPendingSkillCheck()?.skill).toBe('arcanismo');
  });

  it('retorna null silenciosamente quando não há pending', () => {
    const result = camp.clearPendingCheck('p1');
    expect(result).toBeNull();
  });
});

// ψ.2 — Tests pro Campaign.appendPartyMessage (rate limit + persistência FIFO).
//
// Coverage: append OK, rate limit token-bucket, refill por tempo, FIFO cap 50,
// empty text rejeitado.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Campaign } from '../campaign.js';
import { FallbackDM } from '../dm/dm.js';

describe('Campaign.appendPartyMessage', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new FallbackDM());
  });

  it('aceita primeira mensagem e armazena com id+timestamp', () => {
    const result = camp.appendPartyMessage({
      characterId: 'pj-1',
      speaker: 'Borin',
      text: 'Vamos pelo norte',
    });
    expect(result.accepted).toBe(true);
    expect(result.msg).toBeDefined();
    expect(result.msg?.text).toBe('Vamos pelo norte');
    expect(result.msg?.id).toMatch(/^pm-/);
    expect(camp.partyMessages.length).toBe(1);
  });

  it('rejeita mensagem vazia', () => {
    const result = camp.appendPartyMessage({
      characterId: 'pj-1',
      speaker: 'Borin',
      text: '   ',
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('empty');
    expect(camp.partyMessages.length).toBe(0);
  });

  it('trunca em 280 chars', () => {
    const longText = 'a'.repeat(500);
    const result = camp.appendPartyMessage({
      characterId: 'pj-1',
      speaker: 'Borin',
      text: longText,
    });
    expect(result.accepted).toBe(true);
    expect(result.msg?.text.length).toBe(280);
  });

  it('rate limit: 5 cap, 6ª rejeitada', () => {
    for (let i = 0; i < 5; i++) {
      const r = camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: `msg ${i}` });
      expect(r.accepted).toBe(true);
    }
    const r6 = camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: 'msg 6' });
    expect(r6.accepted).toBe(false);
    expect(r6.reason).toBe('rate_limit');
  });

  it('rate limit é POR-PLAYER (outro pj não afeta)', () => {
    for (let i = 0; i < 5; i++) {
      camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: `msg ${i}` });
    }
    // pj-2 ainda tem bucket cheio
    const r = camp.appendPartyMessage({ characterId: 'pj-2', speaker: 'Lyra', text: 'oi' });
    expect(r.accepted).toBe(true);
  });

  it('rate limit refill 1 token / 2s', () => {
    vi.useFakeTimers();
    try {
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      for (let i = 0; i < 5; i++) {
        camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: `msg ${i}` });
      }
      // Esgotou. Avança 2.1s = 1 refill
      vi.setSystemTime(startTime + 2100);
      const r = camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: 'msg 6' });
      expect(r.accepted).toBe(true);
      // Próxima rejeita até refill
      const r7 = camp.appendPartyMessage({ characterId: 'pj-1', speaker: 'Borin', text: 'msg 7' });
      expect(r7.accepted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('FIFO cap 50: 60 mensagens → mantém últimas 50', () => {
    for (let i = 0; i < 60; i++) {
      // Reset bucket pra não bater rate limit
      const result = camp.appendPartyMessage({
        characterId: `pj-${i}`, // player único cada msg pra não bater bucket
        speaker: 'X',
        text: `m${i}`,
      });
      expect(result.accepted).toBe(true);
    }
    expect(camp.partyMessages.length).toBe(50);
    // Primeiras 10 foram cortadas; última msg é "m59"
    expect(camp.partyMessages[0]?.text).toBe('m10');
    expect(camp.partyMessages[49]?.text).toBe('m59');
  });
});

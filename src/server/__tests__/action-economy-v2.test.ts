// β.4 V2 — Tests consume mecânico bloqueia ações já gastas.
//
// V1 testes (action-economy.test.ts) cobrem: structure + reset.
// V2 testes (este arquivo) cobrem: enforce bloqueio + grant (action surge) +
// integração via Campaign.combatAction.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startCombat, advanceTurn, consumeActionEconomy, grantActionEconomy,
  actionEconomyKindFor, freshActionEconomy,
} from '../combat.js';
import { Campaign } from '../campaign.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';

const fakeDM = {
  async narrate(): Promise<DMResponse> {
    return { narration: 'ok', speaker: 'Mestre', toolCalls: [], raw: '' };
  },
  async summarize(): Promise<string | null> { return null; },
} as unknown as DMInterface;

function makePJ(id: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: id,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 16, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 16, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    maxHp: 12, currentHp: 12, tempHp: 0, hitDiceRemaining: 1, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['for', 'con'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

describe('β.4 V2 — consume retorna { ok, reason }', () => {
  it('1ª action consume = ok:true', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    const r = consumeActionEconomy(combat, 'pj-1', 'action');
    expect(r.ok).toBe(true);
  });

  it('2ª action consume = ok:false com reason explicativo', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'action');
    const r = consumeActionEconomy(combat, 'pj-1', 'action');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Ação/i);
    expect(r.reason).toMatch(/PHB/);
  });

  it('bonus action segue mesma lógica', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(consumeActionEconomy(combat, 'pj-1', 'bonus').ok).toBe(true);
    expect(consumeActionEconomy(combat, 'pj-1', 'bonus').ok).toBe(false);
  });

  it('reaction também', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(consumeActionEconomy(combat, 'pj-1', 'reaction').ok).toBe(true);
    expect(consumeActionEconomy(combat, 'pj-1', 'reaction').ok).toBe(false);
  });

  it('movement: bloqueia só se pediu MAIS que tem', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(consumeActionEconomy(combat, 'pj-1', 'movement', 15).ok).toBe(true);
    expect(consumeActionEconomy(combat, 'pj-1', 'movement', 15).ok).toBe(true);
    expect(consumeActionEconomy(combat, 'pj-1', 'movement', 5).ok).toBe(false);
  });
});

describe('β.4 V2 — grantActionEconomy (Action Surge)', () => {
  it('grant action restaura slot consumed', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'action');
    expect(combat.actionEconomy!['pj-1']!.action).toBe(false);
    grantActionEconomy(combat, 'pj-1', 'action');
    expect(combat.actionEconomy!['pj-1']!.action).toBe(true);
  });

  it('grant em participante inexistente é noop seguro', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(() => grantActionEconomy(combat, 'nobody', 'action')).not.toThrow();
  });
});

describe('β.4 V2 — actionEconomyKindFor mapping', () => {
  it('attack/dodge/etc → action', () => {
    expect(actionEconomyKindFor('attack')).toBe('action');
    expect(actionEconomyKindFor('dodge')).toBe('action');
    expect(actionEconomyKindFor('cast-spell')).toBe('action');
    expect(actionEconomyKindFor('shove')).toBe('action');
  });

  it('two-weapon → bonus', () => {
    expect(actionEconomyKindFor('two-weapon')).toBe('bonus');
  });

  it('desconhecido → free', () => {
    expect(actionEconomyKindFor('whatever')).toBe('free');
  });
});

describe('β.4 V2 — economy + flags combinados (cenário 2 attacks no turno)', () => {
  // Simula o que aconteceria se um caller chamasse consume() 2x sem avançar turno —
  // que é o cenário que combatAction handler protege. advanceTurn no fim do turno
  // resetará a economy, então integração-real via Campaign.playerCombatAction não
  // dá pra testar 2-no-mesmo-turno SEM mockar pesado. Aqui testamos o invariante:
  // consume(action) 2x sequenciais sem advanceTurn = 2ª falha.

  it('consume sequencial sem advance: 1ª attack ok, 2ª falha', () => {
    const combat = startCombat({ party: [makePJ('alice')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    const r1 = consumeActionEconomy(combat, 'alice', 'action');
    const r2 = consumeActionEconomy(combat, 'alice', 'action');
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toMatch(/Ação/);
  });

  it('attack (action) + two-weapon (bonus) no mesmo turno = OK', () => {
    const combat = startCombat({ party: [makePJ('alice')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(consumeActionEconomy(combat, 'alice', 'action').ok).toBe(true);
    expect(consumeActionEconomy(combat, 'alice', 'bonus').ok).toBe(true);
  });

  it('two-weapon 2x bloqueia 2ª', () => {
    const combat = startCombat({ party: [makePJ('alice')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(consumeActionEconomy(combat, 'alice', 'bonus').ok).toBe(true);
    const r2 = consumeActionEconomy(combat, 'alice', 'bonus');
    expect(r2.ok).toBe(false);
    expect(r2.reason).toMatch(/Bônus/);
  });
});

describe('β.4 V2 — advanceTurn reseta action permitindo novo attack', () => {
  it('após advance, mesmo PJ pode atacar de novo', () => {
    const party = [makePJ('a'), makePJ('b')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 50, ac: 10 }] });
    // Consome action de A
    consumeActionEconomy(combat, 'a', 'action');
    expect(combat.actionEconomy!['a']!.action).toBe(false);

    // Avança turno até voltar pra A (round completo)
    for (let i = 0; i < combat.initiativeOrder.length * 2; i++) {
      const r = advanceTurn(combat, party);
      if (r.combatOver) break;
      if (r.participant?.id === 'a') {
        // A retornou — economy reset
        expect(combat.actionEconomy!['a']!.action).toBe(true);
        return;
      }
    }
    // Se chegou aqui sem voltar pra A, fail explícito
    throw new Error('A não voltou no turno esperado');
  });
});

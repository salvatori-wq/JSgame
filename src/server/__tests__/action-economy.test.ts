// β.4 — Tests Action Economy (PHB pág 189-193) V1.
// V1: server estrutura + reset no start of turn. UI exibe. Consume é noop
// seguro (sempre permite). Bloqueio mecânico em Sprint γ.

import { describe, it, expect } from 'vitest';
import { startCombat, advanceTurn, freshActionEconomy, consumeActionEconomy } from '../combat.js';
import type { CharacterSheet } from '../../shared/types.js';

function makePJ(id: string): CharacterSheet {
  return {
    id, ownerName: 'João', characterName: id,
    raceId: 'humano', classId: 'guerreiro', backgroundId: 'soldado', alignment: 'lb',
    level: 1, xp: 0,
    abilityScoresBase: { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
    abilityScores:     { for: 15, des: 12, con: 14, int: 10, sab: 13, car: 8 },
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

describe('β.4 — freshActionEconomy', () => {
  it('default: tudo disponível, 30ft movement', () => {
    const ec = freshActionEconomy();
    expect(ec.action).toBe(true);
    expect(ec.bonusAction).toBe(true);
    expect(ec.reaction).toBe(true);
    expect(ec.movement).toBe(30);
  });
});

describe('β.4 — startCombat inicializa actionEconomy por participante', () => {
  it('cada player + enemy tem entry fresh', () => {
    const party = [makePJ('pj-1'), makePJ('pj-2')];
    const combat = startCombat({
      party,
      enemies: [{ name: 'Goblin', hp: 7, ac: 13 }],
    });
    expect(combat.actionEconomy).toBeDefined();
    expect(combat.actionEconomy!['pj-1']).toEqual(freshActionEconomy());
    expect(combat.actionEconomy!['pj-2']).toEqual(freshActionEconomy());
    // Enemy também — embora AI não use ainda
    const enemyIds = combat.initiativeOrder.filter((p) => p.kind === 'enemy').map((p) => p.id);
    for (const id of enemyIds) {
      expect(combat.actionEconomy![id]).toEqual(freshActionEconomy());
    }
  });
});

describe('β.4 — consumeActionEconomy', () => {
  it('marca action consumed', () => {
    const party = [makePJ('pj-1')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'action');
    expect(combat.actionEconomy!['pj-1']!.action).toBe(false);
    expect(combat.actionEconomy!['pj-1']!.bonusAction).toBe(true);
  });

  it('marca bonus consumed', () => {
    const party = [makePJ('pj-1')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'bonus');
    expect(combat.actionEconomy!['pj-1']!.bonusAction).toBe(false);
    expect(combat.actionEconomy!['pj-1']!.action).toBe(true);
  });

  it('marca reaction consumed', () => {
    const party = [makePJ('pj-1')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'reaction');
    expect(combat.actionEconomy!['pj-1']!.reaction).toBe(false);
  });

  it('decrementa movement', () => {
    const party = [makePJ('pj-1')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    consumeActionEconomy(combat, 'pj-1', 'movement', 15);
    expect(combat.actionEconomy!['pj-1']!.movement).toBe(15);
  });

  it('movement: rejeita se pediu mais que tem (V2 strict, não clampa)', () => {
    const party = [makePJ('pj-1')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    const r = consumeActionEconomy(combat, 'pj-1', 'movement', 99);
    expect(r.ok).toBe(false);
    // Movement preserved (não clampa nem consome parcial)
    expect(combat.actionEconomy!['pj-1']!.movement).toBe(30);
  });

  it('participante inexistente é noop seguro', () => {
    const combat = startCombat({ party: [makePJ('pj-1')], enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    expect(() => consumeActionEconomy(combat, 'nobody', 'action')).not.toThrow();
  });
});

describe('β.4 — advanceTurn reseta actionEconomy do entrante (exceto reaction)', () => {
  it('próximo participante começa com action+bonus+movement fresh', () => {
    const party = [makePJ('pj-1'), makePJ('pj-2')];
    const combat = startCombat({ party, enemies: [{ name: 'X', hp: 5, ac: 10 }] });
    const initial = combat.initiativeOrder[combat.currentTurnIndex]!;
    // Consome tudo
    consumeActionEconomy(combat, initial.id, 'action');
    consumeActionEconomy(combat, initial.id, 'bonus');
    consumeActionEconomy(combat, initial.id, 'movement', 30);
    consumeActionEconomy(combat, initial.id, 'reaction');

    // Avança turno
    const r = advanceTurn(combat, party);
    expect(r.combatOver).toBe(false);
    const next = r.participant!;

    // Se o próximo é um participante diferente, deve ter ec fresh
    if (next.id !== initial.id) {
      const ec = combat.actionEconomy![next.id]!;
      expect(ec.action).toBe(true);
      expect(ec.bonusAction).toBe(true);
      expect(ec.movement).toBe(30);
    }
  });
});

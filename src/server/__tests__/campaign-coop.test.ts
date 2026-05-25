// Tests pra coop-safety do Campaign engine:
// - mutex: 2 takeAction concorrentes serializam (não rodam LLM em paralelo)
// - isStarted: startSession dispara só 1 narração mesmo se chamado 2x
// - resolveSkillCheck: rejeita playerId errado

import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';
import type { DMInterface, DMResponse } from '../dm/dm.js';
import type { CharacterSheet } from '../../shared/types.js';
import type { NarrationContext } from '../dm/prompts.js';

class MockDM {
  callCount = 0;
  lastContexts: NarrationContext[] = [];
  delayMs = 20;
  // Eu controlo o que ele retorna por chamada (FIFO). Default narração "ok N".
  responses: DMResponse[] = [];

  async narrate(ctx: NarrationContext): Promise<DMResponse> {
    this.callCount += 1;
    this.lastContexts.push(ctx);
    await new Promise((r) => setTimeout(r, this.delayMs));
    const next = this.responses.shift();
    return next ?? {
      narration: `mock-narration-${this.callCount}`,
      speaker: 'Mestre',
      toolCalls: [],
      raw: '',
    };
  }
}

function makeChar(id: string, name: string): CharacterSheet {
  return {
    id,
    ownerName: `owner-${id}`,
    characterName: name,
    raceId: 'humano',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: 1,
    xp: 0,
    abilityScoresBase: { for: 14, des: 12, con: 13, int: 10, sab: 10, car: 8 },
    abilityScores: { for: 15, des: 12, con: 14, int: 10, sab: 10, car: 8 },
    maxHp: 12,
    currentHp: 12,
    tempHp: 0,
    hitDiceRemaining: 1,
    armorClass: 16,
    proficientSkills: ['atletismo'],
    proficientSavingThrows: ['for', 'con'],
    languages: ['Comum'],
    toolProficiencies: [],
    armorProficiencies: ['Todas armaduras'],
    weaponProficiencies: ['Armas simples', 'Armas marciais'],
    conditions: [],
    inventory: [],
    equippedWeapons: [],
    gold: 10,
    spellsKnown: [],
    spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    backstory: '',
    createdAt: 0,
    lastPlayedAt: 0,
    deathCount: 0,
    campaignsPlayed: [],
  };
}

describe('Campaign coop safety', () => {
  let dm: MockDM;
  let camp: Campaign;
  let alice: CharacterSheet;
  let bob: CharacterSheet;

  beforeEach(() => {
    dm = new MockDM();
    camp = new Campaign(dm as unknown as DMInterface);
    alice = makeChar('alice', 'Alice');
    bob = makeChar('bob', 'Bob');
    camp.addCharacter(alice);
    camp.addCharacter(bob);
  });

  describe('startSession one-shot', () => {
    it('dispara só 1 narração mesmo se chamado 2x concorrente', async () => {
      const [r1, r2] = await Promise.all([camp.startSession(), camp.startSession()]);
      expect(dm.callCount).toBe(1);
      // Apenas 1 retorna response não-null
      const realResponses = [r1, r2].filter((r) => r !== null);
      expect(realResponses).toHaveLength(1);
    });

    it('3ª chamada também é noop após start', async () => {
      await camp.startSession();
      const r = await camp.startSession();
      expect(r).toBeNull();
      expect(dm.callCount).toBe(1);
    });
  });

  describe('actionQueue mutex', () => {
    it('serializa 2 takeAction concorrentes (não chama DM em paralelo)', async () => {
      // Se rodassem paralelo, ambos veriam callCount=0 antes de incrementar.
      // Como serializa, a 2ª vê callCount=1 ao começar.
      const observedAtStart: number[] = [];
      dm.delayMs = 30;
      // Trick: contexto passado contém recentEvents. Se 2 rodassem paralelo,
      // ambos veriam recentEvents vazio. Serializado, a 2ª vê o evento da 1ª.
      const p1 = camp.takeAction('alice', 'explore', 'olha pra cima');
      const p2 = camp.takeAction('bob', 'investigate', 'mexe no baú');
      await Promise.all([p1, p2]);

      expect(dm.callCount).toBe(2);
      // Capturou 2 chamadas. A 2ª deve ver o evento da 1ª nos recentEvents.
      const ctx1 = dm.lastContexts[0]!;
      const ctx2 = dm.lastContexts[1]!;
      expect(ctx1.campaign.recentEvents.length).toBeLessThanOrEqual(ctx2.campaign.recentEvents.length);
      // A 2ª chamada deve ter o evento de Alice já registrado
      expect(ctx2.campaign.recentEvents.some((e) => e.includes('Alice'))).toBe(true);
      // Suppress unused
      expect(observedAtStart).toBeDefined();
    });

    it('actions seguidas mantém ordem FIFO', async () => {
      const order: string[] = [];
      const wrap = (label: string, fn: () => Promise<unknown>): Promise<unknown> =>
        fn().then((r) => { order.push(label); return r; });

      await Promise.all([
        wrap('a', () => camp.takeAction('alice', 'explore')),
        wrap('b', () => camp.takeAction('bob', 'investigate')),
        wrap('c', () => camp.takeAction('alice', 'sneak')),
      ]);

      expect(order).toEqual(['a', 'b', 'c']);
    });
  });

  describe('pendingCheck ownership', () => {
    it('resolveSkillCheck rejeita se playerId !== pendingCheck.playerId', async () => {
      // Setup: força um pendingCheck pra alice
      camp.state.pendingCheck = {
        skill: 'atletismo',
        dc: 15,
        reason: 'teste',
        playerId: 'alice',
      };

      // Bob tenta rolar — deve retornar null
      const result = await camp.resolveSkillCheck('bob');
      expect(result).toBeNull();
      // pendingCheck continua intacto pra alice
      expect(camp.state.pendingCheck).not.toBeNull();
      expect(camp.state.pendingCheck?.playerId).toBe('alice');
    });

    it('alice consegue rolar seu próprio check', async () => {
      camp.state.pendingCheck = {
        skill: 'atletismo',
        dc: 15,
        reason: 'teste',
        playerId: 'alice',
      };
      const result = await camp.resolveSkillCheck('alice');
      expect(result).not.toBeNull();
      // pendingCheck consumido
      expect(camp.state.pendingCheck).toBeNull();
    });

    it('sem pendingCheck, resolveSkillCheck retorna null', async () => {
      const result = await camp.resolveSkillCheck('alice');
      expect(result).toBeNull();
    });
  });

  describe('markStartedIfHasHistory', () => {
    it('flag de campanha persistida não dispara startSession outra vez', async () => {
      camp.state.recentEvents.push('algum evento antigo');
      camp.markStartedIfHasHistory();
      const r = await camp.startSession();
      expect(r).toBeNull();
      expect(dm.callCount).toBe(0);
    });
  });
});

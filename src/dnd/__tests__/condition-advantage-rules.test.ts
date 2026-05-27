// η.4 — Tests Condition Advantage Rules.

import { describe, it, expect } from 'vitest';
import {
  combineAdvantage, attackAdvantageMode, skillCheckAdvantageMode,
  isAutoFailSave, consumePendingAdvantage,
} from '../condition-advantage-rules';

describe('combineAdvantage η.4', () => {
  it('advantage + advantage = advantage', () => {
    expect(combineAdvantage('advantage', 'advantage')).toBe('advantage');
  });

  it('disadvantage + disadvantage = disadvantage', () => {
    expect(combineAdvantage('disadvantage', 'disadvantage')).toBe('disadvantage');
  });

  it('advantage + disadvantage = normal (cancela PHB)', () => {
    expect(combineAdvantage('advantage', 'disadvantage')).toBe('normal');
    expect(combineAdvantage('disadvantage', 'advantage')).toBe('normal');
  });

  it('normal + qualquer = qualquer', () => {
    expect(combineAdvantage('normal', 'advantage')).toBe('advantage');
    expect(combineAdvantage('normal', 'disadvantage')).toBe('disadvantage');
    expect(combineAdvantage('normal', 'normal')).toBe('normal');
  });
});

describe('attackAdvantageMode η.4', () => {
  it('target cego → advantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: [],
      targetConditions: ['cego'],
      isMelee: true,
    })).toBe('advantage');
  });

  it('target paralisado → advantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: [],
      targetConditions: ['paralisado'],
      isMelee: true,
    })).toBe('advantage');
  });

  it('target caído + melee → advantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: [],
      targetConditions: ['caido'],
      isMelee: true,
    })).toBe('advantage');
  });

  it('target caído + ranged → disadvantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: [],
      targetConditions: ['caido'],
      isMelee: false,
    })).toBe('disadvantage');
  });

  it('attacker cego → disadvantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: ['cego'],
      targetConditions: [],
      isMelee: true,
    })).toBe('disadvantage');
  });

  it('attacker envenenado → disadvantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: ['envenenado'],
      targetConditions: [],
      isMelee: true,
    })).toBe('disadvantage');
  });

  it('attacker caído → disadvantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: ['caido'],
      targetConditions: [],
      isMelee: false,
    })).toBe('disadvantage');
  });

  it('attacker cego + target paralisado → cancela (normal)', () => {
    expect(attackAdvantageMode({
      attackerConditions: ['cego'],
      targetConditions: ['paralisado'],
      isMelee: true,
    })).toBe('normal');
  });

  it('target invisivel → disadvantage', () => {
    expect(attackAdvantageMode({
      attackerConditions: [],
      targetConditions: ['invisivel'],
      isMelee: true,
    })).toBe('disadvantage');
  });
});

describe('skillCheckAdvantageMode η.4', () => {
  it('envenenado → disadvantage', () => {
    expect(skillCheckAdvantageMode(['envenenado'])).toBe('disadvantage');
  });

  it('sem conditions → normal', () => {
    expect(skillCheckAdvantageMode([])).toBe('normal');
  });
});

describe('isAutoFailSave η.4', () => {
  it('paralisado + STR save → auto-fail', () => {
    expect(isAutoFailSave(['paralisado'], 'for')).toBe(true);
  });

  it('paralisado + DEX save → auto-fail', () => {
    expect(isAutoFailSave(['paralisado'], 'des')).toBe(true);
  });

  it('paralisado + CON save → não auto-fail', () => {
    expect(isAutoFailSave(['paralisado'], 'con')).toBe(false);
  });

  it('inconsciente/atordoado/petrificado também auto-fail', () => {
    expect(isAutoFailSave(['inconsciente'], 'for')).toBe(true);
    expect(isAutoFailSave(['atordoado'], 'des')).toBe(true);
    expect(isAutoFailSave(['petrificado'], 'for')).toBe(true);
  });

  it('sem condition → não auto-fail', () => {
    expect(isAutoFailSave([], 'for')).toBe(false);
  });
});

describe('consumePendingAdvantage η.4', () => {
  it('match attack → consome e retorna mode', () => {
    const state = {
      pendingAdvantages: {
        'pc-1': { mode: 'advantage' as const, targetRoll: 'next-attack', reason: 'r', createdAt: 0 },
      },
    };
    expect(consumePendingAdvantage(state, 'pc-1', 'attack')).toBe('advantage');
    expect(state.pendingAdvantages!['pc-1']).toBeUndefined();
  });

  it('match wrong kind → null + não consome', () => {
    const state = {
      pendingAdvantages: {
        'pc-1': { mode: 'advantage' as const, targetRoll: 'next-attack', reason: 'r', createdAt: 0 },
      },
    };
    expect(consumePendingAdvantage(state, 'pc-1', 'save')).toBe(null);
    expect(state.pendingAdvantages!['pc-1']).toBeDefined();
  });

  it('player sem pending → null', () => {
    expect(consumePendingAdvantage({}, 'pc-1', 'attack')).toBe(null);
  });
});

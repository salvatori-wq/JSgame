// Tests pra 2A — Reaction engine (Counterspell + Dispel Magic).
// PHB pág 228 (Counterspell) e pág 231 (Dispel Magic).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveCounterspell, resolveDispelMagic,
  hasReactionAvailable, consumeReaction, resetReactionsForRound,
} from '../reaction-engine.js';
import type { CharacterSheet, CombatState, ActiveBuff } from '../../shared/types.js';

function mkMago(level = 5): CharacterSheet {
  return {
    id: 'mago', ownerName: 'p', characterName: 'Eldrin',
    raceId: 'alto-elfo', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level, xp: 0,
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 18, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 14, con: 12, int: 18, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0,
    hitDiceRemaining: level, armorClass: 12,
    proficientSkills: [],
    proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: ['counterspell', 'dispel-magic'], spellsPrepared: ['counterspell', 'dispel-magic'],
    spellSlots: { 1:{max:4,used:0},2:{max:3,used:0},3:{max:2,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
}

function mkCombat(): CombatState {
  return {
    active: true,
    round: 1,
    initiativeOrder: [],
    currentTurnIndex: 0,
    enemies: [],
    log: [],
  };
}

describe('2A — Reaction tracking', () => {
  it('reaction disponível por default', () => {
    const c = mkCombat();
    expect(hasReactionAvailable(c, 'pj1')).toBe(true);
  });

  it('consumeReaction marca como usada', () => {
    const c = mkCombat();
    consumeReaction(c, 'pj1');
    expect(hasReactionAvailable(c, 'pj1')).toBe(false);
  });

  it('resetReactionsForRound libera reação consumida', () => {
    const c = mkCombat();
    const pj = mkMago();
    consumeReaction(c, pj.id);
    expect(hasReactionAvailable(c, pj.id)).toBe(false);
    resetReactionsForRound(c, [pj]);
    expect(hasReactionAvailable(c, pj.id)).toBe(true);
  });

  it('reset não afeta outros chars sem reação consumida', () => {
    const c = mkCombat();
    const pj1 = mkMago(); pj1.id = 'pj1';
    const pj2 = mkMago(); pj2.id = 'pj2';
    consumeReaction(c, pj1.id);
    resetReactionsForRound(c, [pj1, pj2]);
    expect(hasReactionAvailable(c, pj1.id)).toBe(true);
    expect(hasReactionAvailable(c, pj2.id)).toBe(true);
  });
});

describe('2A — Counterspell', () => {
  it('slot ≥ spell level = auto-cancel', () => {
    const pj = mkMago();
    const c = mkCombat();
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 3, combat: c });
    expect(r.ok).toBe(true);
    expect(r.cancelled).toBe(true);
    expect(pj.spellSlots[3].used).toBe(1);
  });

  it('slot > spell level = auto-cancel mais alto', () => {
    const pj = mkMago(7);
    pj.spellSlots[4] = { max: 1, used: 0 };
    const c = mkCombat();
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 4, combat: c });
    expect(r.cancelled).toBe(true);
  });

  it('slot < spell level = check de conjuração', () => {
    const pj = mkMago(5);
    // Mago nv 5 INT 18 = +4 mod, PB nv 5 = +3 → bônus +7
    // Slot 3 vs spell nv 5 → DC 10+5=15. Roll precisa ≥8. Em 30 tentativas, expect >20 sucessos.
    let successes = 0;
    for (let i = 0; i < 30; i++) {
      // Reset slot + reação a cada iteração
      pj.spellSlots[3].used = 0;
      const c = mkCombat();
      const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 5, slotLevel: 3, combat: c });
      expect(r.ok).toBe(true);
      if (r.cancelled) successes++;
    }
    // P(roll ≥ 8 com +7 mod) = roll ≥ 1 com 8 = 13/20 = 65% (na verdade roll ≥ 8 vs nat: precisa nat ≥1, sempre vale)
    // Espera ~30/30 sucessos (sempre passa) — relaxando pra ≥20
    expect(successes).toBeGreaterThanOrEqual(20);
  });

  it('rejeita slot < 3 (Contramágica é nv 3+)', () => {
    const pj = mkMago();
    const c = mkCombat();
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 2 as 3, combat: c });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('slot ≥3');
    expect(pj.spellSlots[3].used).toBe(0);  // não consumiu nada
  });

  it('rejeita sem slot disponível', () => {
    const pj = mkMago();
    pj.spellSlots[3].used = pj.spellSlots[3].max;  // gastou tudo
    const c = mkCombat();
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 3, combat: c });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Sem slot');
  });

  it('rejeita se reação já usada esta rodada', () => {
    const pj = mkMago();
    const c = mkCombat();
    consumeReaction(c, pj.id);
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 3, combat: c });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('reação');
  });

  it('rejeita spell level inválido', () => {
    const pj = mkMago();
    const c = mkCombat();
    const r = resolveCounterspell({ caster: pj, incomingSpellLevel: 0, slotLevel: 3, combat: c });
    expect(r.ok).toBe(false);
  });

  it('consome reação no sucesso', () => {
    const pj = mkMago();
    const c = mkCombat();
    resolveCounterspell({ caster: pj, incomingSpellLevel: 3, slotLevel: 3, combat: c });
    expect(hasReactionAvailable(c, pj.id)).toBe(false);
  });
});

describe('2A — Dispel Magic', () => {
  function buff(source: string): ActiveBuff {
    return { id: `b-${source}`, source, appliesTo: 'attack', effect: { kind: 'dice-bonus', dice: '1d4' }, turnsLeft: 5 };
  }

  it('slot ≥3 = auto-dispel todos buffs', () => {
    const caster = mkMago();
    const target = mkMago();
    target.id = 'target';
    target.activeBuffs = [buff('Bless'), buff('Bardic')];
    const r = resolveDispelMagic({ caster, target, slotLevel: 3 });
    expect(r.ok).toBe(true);
    expect(r.dispelled.length).toBe(2);
    expect(target.activeBuffs).toEqual([]);
    expect(caster.spellSlots[3].used).toBe(1);
  });

  it('auto-drop concentration ao dispelar', () => {
    const caster = mkMago();
    const target = mkMago();
    target.id = 'target';
    target.concentratingOn = 'bless';
    resolveDispelMagic({ caster, target, slotLevel: 3 });
    expect(target.concentratingOn).toBeNull();
  });

  it('rejeita slot < 3', () => {
    const caster = mkMago();
    const target = mkMago();
    const r = resolveDispelMagic({ caster, target, slotLevel: 2 as 3 });
    expect(r.ok).toBe(false);
  });

  it('rejeita sem slot disponível', () => {
    const caster = mkMago();
    caster.spellSlots[3].used = caster.spellSlots[3].max;
    const target = mkMago();
    const r = resolveDispelMagic({ caster, target, slotLevel: 3 });
    expect(r.ok).toBe(false);
  });

  it('gasta slot mesmo sem buffs (RAW)', () => {
    const caster = mkMago();
    const target = mkMago();
    target.activeBuffs = [];
    const r = resolveDispelMagic({ caster, target, slotLevel: 3 });
    expect(r.ok).toBe(true);
    expect(r.dispelled.length).toBe(0);
    expect(caster.spellSlots[3].used).toBe(1);
  });

  it('emite combat event com texto', () => {
    const caster = mkMago();
    const target = mkMago();
    target.activeBuffs = [buff('Bless')];
    const r = resolveDispelMagic({ caster, target, slotLevel: 3 });
    expect(r.events.length).toBe(1);
    expect(r.events[0]!.text).toContain('Bless'.length > 0 ? 'dissipa' : 'nada');
  });
});

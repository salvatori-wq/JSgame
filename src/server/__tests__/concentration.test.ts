// Tests pra F25 — Concentration enforce + upcasting + ritual cast.

import { describe, it, expect } from 'vitest';
import { resolvePlayerCastSpell, tryBreakConcentration, dropConcentrationIfUnconscious, computeUpcastBonus } from '../spells-engine.js';
import { startCombat } from '../combat.js';
import type { CharacterSheet, ClassId } from '../../shared/types.js';
import { applySpellcasterDefaults } from '../../dnd/spell-slots.js';
import { getSpell } from '../../dnd/spells.js';

function mkCaster(opts: { classId?: ClassId; level?: number; con?: number; conProf?: boolean } = {}): CharacterSheet {
  const sheet: CharacterSheet = {
    id: 'caster',
    ownerName: 'p', characterName: 'Mago', raceId: 'humano',
    classId: opts.classId ?? 'mago',
    backgroundId: 'sabio', alignment: 'nn',
    level: opts.level ?? 5, xp: 0,
    abilityScoresBase: { for: 8, des: 12, con: opts.con ?? 14, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 12, con: opts.con ?? 14, int: 16, sab: 12, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0,
    hitDiceRemaining: 5, armorClass: 12,
    proficientSkills: [],
    proficientSavingThrows: opts.conProf ? ['con', 'int'] : ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [],
    inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
  };
  applySpellcasterDefaults(sheet);
  return sheet;
}

describe('F25 — Concentration enforce', () => {
  it('tryBreakConcentration: sem concentratingOn retorna broken=false', () => {
    const pj = mkCaster();
    const r = tryBreakConcentration(pj, 10);
    expect(r.broken).toBe(false);
  });

  it('tryBreakConcentration: dano grande quase sempre quebra', () => {
    const pj = mkCaster({ con: 8, conProf: false });
    pj.concentratingOn = 'guidance';
    // dmg 100 → DC 50 (impossível superar com con mod -1)
    const r = tryBreakConcentration(pj, 100);
    expect(r.broken).toBe(true);
    expect(r.dc).toBe(50);
    expect(pj.concentratingOn).toBeNull();
    expect(r.spellDropped).toBe('guidance');
  });

  it('tryBreakConcentration: dano pequeno gera DC mínimo 10', () => {
    const pj = mkCaster({ con: 20, conProf: true });
    pj.concentratingOn = 'bless';
    const r = tryBreakConcentration(pj, 1);
    expect(r.dc).toBe(10);
  });

  it('dropConcentrationIfUnconscious: PJ inconsciente perde concentração', () => {
    const pj = mkCaster();
    pj.concentratingOn = 'haste';
    pj.conditions = ['inconsciente'];
    const dropped = dropConcentrationIfUnconscious(pj);
    expect(dropped).toBe(true);
    expect(pj.concentratingOn).toBeNull();
  });

  it('dropConcentrationIfUnconscious: PJ acordado não drop', () => {
    const pj = mkCaster();
    pj.concentratingOn = 'haste';
    pj.conditions = [];
    expect(dropConcentrationIfUnconscious(pj)).toBe(false);
    expect(pj.concentratingOn).toBe('haste');
  });
});

describe('F25 — Casting concentration spell', () => {
  it('seta concentratingOn ao lançar guidance', () => {
    const pj = mkCaster({ classId: 'clerigo' });
    pj.spellsKnown.push('guidance' as never);
    const result = resolvePlayerCastSpell({
      caster: pj,
      spellId: 'guidance' as never,
      targetIds: [pj.id],
      slotLevel: 0,
      party: [pj],
      combat: null,
    });
    expect(result.ok).toBe(true);
    expect(pj.concentratingOn).toBe('guidance');
  });

  it('drop previous ao lançar outra concentration', () => {
    const pj = mkCaster({ classId: 'clerigo' });
    pj.spellsKnown.push('guidance' as never, 'resistance' as never);
    pj.concentratingOn = 'guidance';
    const result = resolvePlayerCastSpell({
      caster: pj,
      spellId: 'resistance' as never,
      targetIds: [pj.id],
      slotLevel: 0,
      party: [pj],
      combat: null,
    });
    expect(result.ok).toBe(true);
    expect(pj.concentratingOn).toBe('resistance');
    // events tem um condition-removed pelo drop
    expect(result.events.some((e) => e.type === 'condition-removed')).toBe(true);
  });
});

describe('F25 — Upcasting', () => {
  it('cure-wounds slot 1 = sem upcast', () => {
    const spell = getSpell('cure-wounds');
    const bonus = computeUpcastBonus(spell, 1);
    expect(bonus).toBe(0);
  });
  it('cure-wounds slot 2 = +1d8', () => {
    const spell = getSpell('cure-wounds');
    // Roll many — bonus 1..8
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) samples.push(computeUpcastBonus(spell, 2));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(min).toBeGreaterThanOrEqual(1);
    expect(max).toBeLessThanOrEqual(8);
  });
  it('cure-wounds slot 5 = +4d8', () => {
    const spell = getSpell('cure-wounds');
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) samples.push(computeUpcastBonus(spell, 5));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(min).toBeGreaterThanOrEqual(4);
    expect(max).toBeLessThanOrEqual(32);
  });
  it('spell sem upcastDice = 0', () => {
    const spell = getSpell('shield');
    expect(computeUpcastBonus(spell, 3)).toBe(0);
  });
});

describe('F25 — Ritual cast', () => {
  it('detect-magic ritual fora de combate NÃO gasta slot', () => {
    const pj = mkCaster();
    pj.spellsKnown.push('detect-magic' as never);
    const slotsBefore = pj.spellSlots[1]!.used;
    const result = resolvePlayerCastSpell({
      caster: pj,
      spellId: 'detect-magic' as never,
      targetIds: [],
      slotLevel: 1,
      party: [pj],
      combat: null,
    });
    expect(result.ok).toBe(true);
    expect(pj.spellSlots[1]!.used).toBe(slotsBefore);
  });

  it('detect-magic ritual EM combate gasta slot normalmente', () => {
    const pj = mkCaster();
    pj.spellsKnown.push('detect-magic' as never);
    const combat = startCombat({ party: [pj], enemies: [{ name: 'g', hp: 1, ac: 10 }] });
    const slotsBefore = pj.spellSlots[1]!.used;
    const result = resolvePlayerCastSpell({
      caster: pj,
      spellId: 'detect-magic' as never,
      targetIds: [],
      slotLevel: 1,
      party: [pj],
      combat,
    });
    expect(result.ok).toBe(true);
    expect(pj.spellSlots[1]!.used).toBe(slotsBefore + 1);
  });
});

// Fase 2 — Buffs de magia MECÂNICOS (não só narração).
// Mage Armor / Escudo da Fé / Bless / Shield agora alteram CA/ataque de verdade,
// expiram por duração e somem no descanso longo.

import { describe, it, expect } from 'vitest';
import { resolvePlayerCastSpell } from '../spells-engine.js';
import { startCombat, advanceTurn } from '../combat.js';
import { readAcBonus, spellToBuffs, makeMageArmor, makeShieldOfFaith } from '../buff-engine.js';
import { clearAllBuffs } from '../buff-engine.js';
import { applySpellcasterDefaults } from '../../dnd/spell-slots.js';
import { effectiveArmorClass, acBonusFromBuffs } from '../../dnd/active-buffs.js';
import type { CharacterSheet } from '../../shared/types.js';

function makeMago(over: Partial<CharacterSheet> = {}): CharacterSheet {
  const sheet: CharacterSheet = {
    id: 'mago1', ownerName: 'p', characterName: 'Elara',
    raceId: 'humano', classId: 'mago', backgroundId: 'sabio', alignment: 'nn',
    level: 3, xp: 0,
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    abilityScores: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 },
    maxHp: 14, currentHp: 14, tempHp: 0, hitDiceRemaining: 3, armorClass: 12,
    proficientSkills: [], proficientSavingThrows: ['int', 'sab'],
    languages: [], toolProficiencies: [],
    armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [],
    gold: 0, spellsKnown: [], spellsPrepared: [],
    spellSlots: { 1:{max:0,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} },
    personalityTraits: [], ideals: [], bonds: [], flaws: [], backstory: '',
    createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...over,
  };
  applySpellcasterDefaults(sheet);
  return sheet;
}

function makeClerigo(over: Partial<CharacterSheet> = {}): CharacterSheet {
  return makeMago({
    id: 'cl1', characterName: 'Ferro', classId: 'clerigo',
    proficientSavingThrows: ['sab', 'car'],
    abilityScores: { for: 12, des: 10, con: 14, int: 8, sab: 16, car: 12 },
    abilityScoresBase: { for: 12, des: 10, con: 14, int: 8, sab: 16, car: 12 },
    ...over,
  });
}

describe('active-buffs (helper puro)', () => {
  it('acBonusFromBuffs soma só buffs de CA flat', () => {
    const r = acBonusFromBuffs([
      { id: 'a', source: 'Mage Armor', appliesTo: 'ac', effect: { kind: 'flat-bonus', value: 3 } },
      { id: 'b', source: 'Bless', appliesTo: 'attack', effect: { kind: 'dice-bonus', dice: '1d4' } },
      { id: 'c', source: 'Escudo da Fé', appliesTo: 'ac', effect: { kind: 'flat-bonus', value: 2 } },
    ]);
    expect(r.flatBonus).toBe(5);
    expect(r.sources).toEqual(['Mage Armor', 'Escudo da Fé']);
  });

  it('effectiveArmorClass = base + buffs; sem buffs = base', () => {
    expect(effectiveArmorClass({ armorClass: 12, activeBuffs: [] })).toBe(12);
    expect(effectiveArmorClass({ armorClass: 12, activeBuffs: undefined })).toBe(12);
    expect(effectiveArmorClass({ armorClass: 12, activeBuffs: [makeMageArmor()] })).toBe(15);
  });
});

describe('spellToBuffs', () => {
  it('mage-armor em alvo SEM armadura → +3 CA', () => {
    const t = makeMago();
    const buffs = spellToBuffs('mage-armor', 1, t);
    expect(buffs).not.toBeNull();
    expect(buffs!.length).toBe(1);
    expect(buffs![0]!.appliesTo).toBe('ac');
    expect(buffs![0]!.effect).toEqual({ kind: 'flat-bonus', value: 3 });
  });

  it('mage-armor em alvo COM armadura → [] (sem efeito, PHB)', () => {
    const t = makeMago({ equippedArmor: 'cota-malha' });
    expect(spellToBuffs('mage-armor', 1, t)).toEqual([]);
  });

  it('shield-of-faith → +2 CA com turnsLeft', () => {
    const buffs = spellToBuffs('shield-of-faith', 1, makeMago())!;
    expect(buffs[0]!.effect).toEqual({ kind: 'flat-bonus', value: 2 });
    expect(buffs[0]!.turnsLeft).toBeGreaterThan(0);
  });

  it('spell sem mecânica modelada → null', () => {
    expect(spellToBuffs('detect-magic', 1, makeMago())).toBeNull();
  });
});

describe('resolvePlayerCastSpell — buff mecânico end-to-end', () => {
  it('Mage Armor: gasta slot E aumenta a CA efetiva em +3', () => {
    const mago = makeMago();
    mago.spellsKnown = ['mage-armor'];
    mago.spellsPrepared = ['mage-armor'];
    const baseAc = mago.armorClass;
    const usedBefore = mago.spellSlots[1].used;

    const r = resolvePlayerCastSpell({
      caster: mago, spellId: 'mage-armor', targetIds: [mago.id],
      slotLevel: 1, party: [mago], combat: null,
    });

    expect(r.ok).toBe(true);
    expect(mago.spellSlots[1].used).toBe(usedBefore + 1);     // gastou slot
    expect(effectiveArmorClass(mago)).toBe(baseAc + 3);        // CA SUBIU (era o bug)
    expect(readAcBonus(mago).flatBonus).toBe(3);
  });

  it('Escudo da Fé num aliado: +2 CA no alvo, não no caster', () => {
    const clerigo = makeClerigo();
    clerigo.spellsKnown = ['shield-of-faith'];
    clerigo.spellsPrepared = ['shield-of-faith'];
    const aliado = makeMago({ id: 'tank', characterName: 'Borin', armorClass: 16 });

    const r = resolvePlayerCastSpell({
      caster: clerigo, spellId: 'shield-of-faith', targetIds: [aliado.id],
      slotLevel: 1, party: [clerigo, aliado], combat: null,
    });

    expect(r.ok).toBe(true);
    expect(effectiveArmorClass(aliado)).toBe(18);             // +2 no aliado
    expect(effectiveArmorClass(clerigo)).toBe(clerigo.armorClass); // caster intacto
  });

  it('re-cast Mage Armor não empilha (mesma source, dropa anterior)', () => {
    const mago = makeMago({ spellSlots: { 1:{max:5,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0} } as never });
    mago.spellsKnown = ['mage-armor'];
    mago.spellsPrepared = ['mage-armor'];
    resolvePlayerCastSpell({ caster: mago, spellId: 'mage-armor', targetIds: [mago.id], slotLevel: 1, party: [mago], combat: null });
    resolvePlayerCastSpell({ caster: mago, spellId: 'mage-armor', targetIds: [mago.id], slotLevel: 1, party: [mago], combat: null });
    expect(acBonusFromBuffs(mago.activeBuffs).flatBonus).toBe(3); // não +6
  });
});

describe('CA buffada é lida no combate (enemy attack vs effectiveAc)', () => {
  it('readAcBonus reflete Mage Armor → enemy precisa rolar mais alto', () => {
    const mago = makeMago();
    mago.spellsKnown = ['mage-armor'];
    mago.spellsPrepared = ['mage-armor'];
    resolvePlayerCastSpell({ caster: mago, spellId: 'mage-armor', targetIds: [mago.id], slotLevel: 1, party: [mago], combat: null });
    // combat.ts:550 faz effectiveAc = armorClass + readAcBonus().flatBonus
    expect(mago.armorClass + readAcBonus(mago).flatBonus).toBe(mago.armorClass + 3);
  });
});

describe('duração — Shield expira no fim do turno; long rest limpa', () => {
  it('Shield (+5 CA, 1 turno) expira após o turno do PJ via advanceTurn', () => {
    const mago = makeMago();
    mago.spellsKnown = ['shield'];
    mago.spellsPrepared = ['shield'];
    const combat = startCombat({ party: [mago], enemies: [{ name: 'Boneco', hp: 30, ac: 10 }] });
    // força o turno do PJ como atual
    const myIdx = combat.initiativeOrder.findIndex((p) => p.id === mago.id);
    combat.currentTurnIndex = myIdx;

    resolvePlayerCastSpell({ caster: mago, spellId: 'shield', targetIds: [mago.id], slotLevel: 1, party: [mago], combat });
    expect(readAcBonus(mago).flatBonus).toBe(5);

    // Avança turno (sai do PJ) → tick decrementa turnsLeft 1→0 → expira
    advanceTurn(combat, [mago]);
    expect(readAcBonus(mago).flatBonus).toBe(0);
  });

  it('clearAllBuffs (long rest) remove Mage Armor', () => {
    const mago = makeMago();
    mago.activeBuffs = [makeMageArmor(), makeShieldOfFaith()];
    clearAllBuffs(mago);
    expect(effectiveArmorClass(mago)).toBe(mago.armorClass);
  });
});

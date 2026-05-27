// F1 — Tests pros 3 PJs pré-fab.

import { describe, it, expect } from 'vitest';
import { buildPrefabCharacter, listPrefabs, PREFAB_DEFS } from '../prefab-characters';

describe('prefab characters', () => {
  it('buildPrefabCharacter retorna sheet válido pra borin', () => {
    const sheet = buildPrefabCharacter('borin');
    expect(sheet.classId).toBe('guerreiro');
    expect(sheet.raceId).toBe('anao-montanha');
    expect(sheet.backgroundId).toBe('soldado');
    expect(sheet.level).toBe(1);
    expect(sheet.maxHp).toBeGreaterThan(0);
    expect(sheet.currentHp).toBe(sheet.maxHp);
  });

  it('buildPrefabCharacter aplica bônus racial', () => {
    const sheet = buildPrefabCharacter('borin');
    // anão-montanha: +2 FOR, +2 CON
    expect(sheet.abilityScores.for).toBeGreaterThan(sheet.abilityScoresBase.for);
    expect(sheet.abilityScores.con).toBeGreaterThan(sheet.abilityScoresBase.con);
  });

  it('lyra é caster com spell slots e spells', () => {
    const sheet = buildPrefabCharacter('lyra');
    expect(sheet.classId).toBe('mago');
    expect(sheet.spellsKnown.length).toBeGreaterThan(0);
    expect(sheet.spellsPrepared.length).toBeGreaterThan(0);
    // Mago nv 1 tem 2 slots de nível 1
    expect(sheet.spellSlots[1].max).toBeGreaterThan(0);
  });

  it('sina é skirmisher (halfling ladina) com furtividade', () => {
    const sheet = buildPrefabCharacter('sina');
    expect(sheet.classId).toBe('ladino');
    expect(sheet.raceId).toBe('halfling-pes-leve');
    expect(sheet.proficientSkills).toContain('furtividade');
    expect(sheet.proficientSkills).toContain('enganacao');
  });

  it('cada prefab tem personality traits/ideals/bonds/flaws preenchidos', () => {
    for (const id of ['borin', 'lyra', 'sina'] as const) {
      const sheet = buildPrefabCharacter(id);
      expect(sheet.personalityTraits.length).toBeGreaterThan(0);
      expect(sheet.ideals.length).toBeGreaterThan(0);
      expect(sheet.bonds.length).toBeGreaterThan(0);
      expect(sheet.flaws.length).toBeGreaterThan(0);
      expect(sheet.backstory.length).toBeGreaterThan(20);
    }
  });

  it('inventory tem itens equipáveis + AC calculada certo pra borin (cota+escudo)', () => {
    const sheet = buildPrefabCharacter('borin');
    expect(sheet.inventory.length).toBeGreaterThan(0);
    expect(sheet.equippedArmor).toBe('cota-malha');
    expect(sheet.equippedShield).toBe('escudo');
    // cota-malha base 16 + escudo +2 = 18
    expect(sheet.armorClass).toBe(18);
  });

  it('id único por chamada (não colide com outras instâncias do mesmo prefab)', () => {
    const a = buildPrefabCharacter('borin');
    const b = buildPrefabCharacter('borin');
    expect(a.id).not.toBe(b.id);
  });

  it('ownerName e userId são respeitados', () => {
    const sheet = buildPrefabCharacter('lyra', 'TestUser', 'user-123');
    expect(sheet.ownerName).toBe('TestUser');
    expect(sheet.userId).toBe('user-123');
  });

  it('userId default null se não fornecido', () => {
    const sheet = buildPrefabCharacter('borin');
    expect(sheet.userId).toBeNull();
  });

  it('listPrefabs retorna os 3 defs', () => {
    const list = listPrefabs();
    expect(list.length).toBe(3);
    expect(list.map((p) => p.id)).toEqual(['borin', 'lyra', 'sina']);
  });

  it('PREFAB_DEFS tem teasers curtos', () => {
    for (const def of Object.values(PREFAB_DEFS)) {
      expect(def.teaser.length).toBeLessThan(120);
      expect(def.teaser.length).toBeGreaterThan(10);
      expect(def.icon.length).toBeGreaterThanOrEqual(1); // emoji
    }
  });

  it('lança erro pra prefabId inválido', () => {
    expect(() => buildPrefabCharacter('inexistente' as 'borin')).toThrow();
  });

  it('damage profile racial aplicado (anão = resistência veneno)', () => {
    const borin = buildPrefabCharacter('borin');
    // Anão tem resistência a veneno
    expect(borin.resistances).toContain('veneno');
  });
});

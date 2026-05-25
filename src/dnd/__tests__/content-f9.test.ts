// Tests pro conteúdo F9: bestiary, subclasses, feats, spells expandidas.

import { describe, it, expect } from 'vitest';
import { MONSTERS, ALL_MONSTERS, getMonster, pickMonstersByCR, monstersByType, monstersUpToCR } from '../monsters';
import { SUBCLASSES, ALL_SUBCLASSES, getSubclass, subclassesByClass } from '../subclasses';
import { FEATS, ALL_FEATS, getFeat } from '../feats';
import { SPELLS, ALL_SPELLS, spellsForClass } from '../spells';
import { exhaustionDescription, EXHAUSTION_LEVELS } from '../conditions';

describe('Bestiary (F9.1)', () => {
  it('tem 30+ monstros catalogados', () => {
    expect(ALL_MONSTERS.length).toBeGreaterThanOrEqual(30);
  });

  it('getMonster retorna stats corretos', () => {
    const goblin = getMonster('goblin');
    expect(goblin).not.toBeNull();
    expect(goblin?.name).toBe('Goblin');
    expect(goblin?.hp).toBe(7);
    expect(goblin?.cr).toBe(0.25);
  });

  it('getMonster retorna null pra id inválido', () => {
    expect(getMonster('xpto-nao-existe')).toBeNull();
  });

  it('tem boss CR alto (lich CR 21)', () => {
    const lich = getMonster('lich');
    expect(lich?.cr).toBe(21);
    expect(lich?.isBoss).toBe(true);
  });

  it('pickMonstersByCR retorna encontro razoável', () => {
    const easy = pickMonstersByCR(1, 3);
    expect(easy.length).toBeGreaterThan(0);
    expect(easy[0]!.count).toBeGreaterThanOrEqual(1);
    expect(easy[0]!.monster.cr).toBeLessThanOrEqual(1);
  });

  it('monstersByType filtra correto', () => {
    const ferozes = monstersByType('fera');
    expect(ferozes.length).toBeGreaterThan(0);
    expect(ferozes.every((m) => m.type === 'fera')).toBe(true);
  });

  it('monstersUpToCR limita por CR', () => {
    const baixos = monstersUpToCR(1);
    expect(baixos.every((m) => m.cr <= 1)).toBe(true);
  });
});

describe('Subclasses (F9.4)', () => {
  it('tem 30+ subclasses', () => {
    expect(ALL_SUBCLASSES.length).toBeGreaterThanOrEqual(30);
  });

  it('todas classes têm pelo menos 1 subclasse', () => {
    const classes = ['barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guerreiro', 'ladino', 'mago', 'monge', 'paladino', 'patrulheiro'] as const;
    for (const c of classes) {
      const subs = subclassesByClass(c);
      expect(subs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('mago tem 8 escolas', () => {
    const mago = subclassesByClass('mago');
    expect(mago.length).toBe(8);
  });

  it('getSubclass retorna features no nível 3', () => {
    const champion = getSubclass('champion');
    expect(champion.classId).toBe('guerreiro');
    expect(champion.features.length).toBeGreaterThan(0);
    expect(champion.features.some((f) => f.level === 3)).toBe(true);
  });
});

describe('Feats (F9.6)', () => {
  it('tem 25+ feats', () => {
    expect(ALL_FEATS.length).toBeGreaterThanOrEqual(25);
  });

  it('getFeat retorna definição', () => {
    const gwm = getFeat('great-weapon-master');
    expect(gwm.name).toBe('Mestre de Arma Pesada');
    expect(gwm.benefit.length).toBeGreaterThan(0);
  });

  it('feats com pré-requisito têm prerequisite', () => {
    const warCaster = getFeat('war-caster');
    expect(warCaster.prerequisite?.proficiency).toBe('spellcaster');
  });

  it('alguns feats dão ability increase', () => {
    const observant = getFeat('observant');
    expect(observant.abilityIncrease?.int).toBe(1);
  });
});

describe('Spells expandidas (F9.3)', () => {
  it('tem 80+ magias totais', () => {
    expect(ALL_SPELLS.length).toBeGreaterThanOrEqual(80);
  });

  it('tem magias até nível 9', () => {
    const lvl9 = ALL_SPELLS.filter((s) => s.level === 9);
    expect(lvl9.length).toBeGreaterThanOrEqual(4);
  });

  it('Meteor Swarm existe', () => {
    expect(SPELLS['meteor-swarm']).toBeDefined();
    expect(SPELLS['meteor-swarm']!.level).toBe(9);
  });

  it('Wish existe e é nível 9', () => {
    expect(SPELLS.wish.level).toBe(9);
  });

  it('spellsForClass filtra por classe', () => {
    const magoSpells = spellsForClass('mago', 9);
    expect(magoSpells.length).toBeGreaterThan(20);
    expect(magoSpells.every((s) => s.classes.includes('mago'))).toBe(true);
  });
});

describe('Exhaustion (F9.8)', () => {
  it('tem 6 níveis', () => {
    expect(EXHAUSTION_LEVELS.length).toBe(6);
  });

  it('nv 6 = morte', () => {
    const lvl6 = EXHAUSTION_LEVELS.find((l) => l.level === 6);
    expect(lvl6?.effect).toMatch(/morte/i);
  });

  it('exhaustionDescription cumulativa', () => {
    const desc3 = exhaustionDescription(3);
    expect(desc3).toContain('3/6');
    expect(desc3).toContain('Desvantagem');
  });

  it('exhaustionDescription empty se 0', () => {
    expect(exhaustionDescription(0)).toBe('');
  });
});

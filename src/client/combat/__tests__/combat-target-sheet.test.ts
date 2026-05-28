// W3.2 Sprint W — Tests pro combat-target-sheet contextual.
// Consultor D&D pediu padrão VTT: click enemy → ação primária dominante.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { combatActionLabel } from '../combat-target-sheet';
import type { CombatActionKind } from '../../../shared/types';

describe('combatActionLabel — W3.2 label + sub contextual', () => {
  it('attack → "⚔ Atacar"', () => {
    const r = combatActionLabel('attack');
    expect(r.icon).toBe('⚔');
    expect(r.label).toBe('Atacar');
    expect(r.sub).toMatch(/arma/i);
  });

  it('grapple → "🤼 Agarrar" com sub Atletismo', () => {
    const r = combatActionLabel('grapple');
    expect(r.icon).toBe('🤼');
    expect(r.label).toBe('Agarrar');
    expect(r.sub).toMatch(/atletismo/i);
  });

  it('shove → "👐 Empurrar"', () => {
    const r = combatActionLabel('shove');
    expect(r.icon).toBe('👐');
    expect(r.label).toBe('Empurrar');
  });

  it('two-weapon → "🗡 Ataque com 2ª arma"', () => {
    const r = combatActionLabel('two-weapon');
    expect(r.icon).toBe('🗡');
    expect(r.label).toMatch(/2/);
    expect(r.sub).toMatch(/bônus/i);
  });

  it('help → "🤝 Ajudar" com sub vantagem aliado', () => {
    const r = combatActionLabel('help');
    expect(r.icon).toBe('🤝');
    expect(r.sub).toMatch(/vantagem/i);
  });

  it('dodge → "🛡 Esquivar"', () => {
    const r = combatActionLabel('dodge');
    expect(r.icon).toBe('🛡');
    expect(r.label).toBe('Esquivar');
  });

  it('action desconhecida → fallback Atacar', () => {
    const r = combatActionLabel('foo' as CombatActionKind);
    expect(r.icon).toBe('⚔');
    expect(r.label).toBe('Atacar');
  });
});

describe('openCombatTargetSheet — DOM smoke (W3.2)', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — não tem DOM', () => {});
    return;
  }
  const { openCombatTargetSheet, closeCombatTargetSheet, isCombatTargetSheetOpen } = await import('../combat-target-sheet');

  beforeEach(() => {
    closeCombatTargetSheet();
    document.body.innerHTML = '<div id="app"></div>';
  });
  afterEach(() => {
    closeCombatTargetSheet();
  });

  const makeEnemy = (): import('../../../shared/types').EnemySnapshot => ({
    id: 'e1',
    name: 'Goblin Selvagem',
    currentHp: 5,
    maxHp: 10,
    armorClass: 13,
    attackBonus: 4,
    damageDice: '1d6',
    damageBonus: 2,
    conditions: [],
    initiative: 10,
    description: 'Goblin imundo',
    isBoss: false,
    xpAward: 50,
  });
  const makeChar = (): import('../../../shared/types').CharacterSheet => ({
    id: 'pc-1',
    ownerId: 'owner-1',
    raceId: 'human',
    classId: 'fighter',
    characterName: 'Borin',
    level: 1,
    xp: 0,
    armorClass: 14,
    currentHp: 10,
    maxHp: 10,
    abilities: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    savingThrows: { str: true, con: true } as Record<string, boolean>,
    proficientSkills: [],
    conditions: [],
    inventory: [],
    proficiencyBonus: 2,
    speed: 30,
    spellSlots: {},
    abilityScoreIncreases: 0,
    feats: [],
    proficiencies: [],
  } as unknown as import('../../../shared/types').CharacterSheet);

  it('abre sheet com primary action + footer info+cancel', () => {
    let confirmedAction: CombatActionKind | null = null;
    openCombatTargetSheet({
      enemy: makeEnemy(),
      myChar: makeChar(),
      onConfirm: (action) => { confirmedAction = action; },
    });
    expect(isCombatTargetSheetOpen()).toBe(true);
    expect(document.querySelector('.cts-overlay')).toBeTruthy();
    expect(document.querySelector('.cts-primary-btn')).toBeTruthy();
    expect(document.querySelector('.cts-info-btn')).toBeTruthy();
    expect(document.querySelector('.cts-cancel-btn')).toBeTruthy();
    expect(document.querySelector('.cts-enemy-name')?.textContent).toBe('Goblin Selvagem');
    expect(confirmedAction).toBeNull(); // ainda não clicou
  });

  it('click primary → onConfirm com action default attack', () => {
    let confirmedAction: CombatActionKind | null = null;
    openCombatTargetSheet({
      enemy: makeEnemy(),
      myChar: makeChar(),
      onConfirm: (action) => { confirmedAction = action; },
    });
    const primary = document.querySelector('.cts-primary-btn') as HTMLButtonElement;
    primary.click();
    expect(confirmedAction).toBe('attack');
    expect(isCombatTargetSheetOpen()).toBe(false);
  });

  it('click cancel → onCancel + fecha sheet', () => {
    let cancelled = false;
    openCombatTargetSheet({
      enemy: makeEnemy(),
      myChar: makeChar(),
      onConfirm: () => {},
      onCancel: () => { cancelled = true; },
    });
    const cancel = document.querySelector('.cts-cancel-btn') as HTMLButtonElement;
    cancel.click();
    expect(cancelled).toBe(true);
    expect(isCombatTargetSheetOpen()).toBe(false);
  });

  it('pendingAction grapple usa label "🤼 Agarrar"', () => {
    openCombatTargetSheet({
      enemy: makeEnemy(),
      myChar: makeChar(),
      pendingAction: 'grapple',
      onConfirm: () => {},
    });
    const label = document.querySelector('.cts-primary-label');
    expect(label?.textContent).toBe('Agarrar');
  });

  it('header mostra adjetivo HP (fog of war) em vez de "X/Y"', () => {
    openCombatTargetSheet({
      enemy: makeEnemy(), // 5/10 = 50% → ferido
      myChar: makeChar(),
      onConfirm: () => {},
    });
    const adj = document.querySelector('.cts-hp-adj');
    expect(adj?.textContent).toBe('ferido');
    // Não deve aparecer "5/10" ou "HP" literal no header
    const sheet = document.querySelector('.cts-sheet')?.textContent ?? '';
    expect(sheet).not.toMatch(/5\/10/);
  });
});

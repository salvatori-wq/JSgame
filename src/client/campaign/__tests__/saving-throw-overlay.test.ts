// @vitest-environment happy-dom
// η.6 — Tests Saving Throw fórmula didática.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderSavingThrowFormula, resetSavingThrowTutorialForTest } from '../saving-throw-overlay';
import type { CharacterSheet } from '../../../shared/types';

function makeChar(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'pc-1', ownerName: 'p', characterName: 'Borin',
    raceId: 'anao-montanha', classId: 'clerigo', backgroundId: 'soldado', alignment: 'nn',
    level: 5, xp: 6500,
    abilityScoresBase: { for: 12, des: 10, con: 14, int: 10, sab: 16, car: 10 },
    abilityScores: { for: 12, des: 10, con: 14, int: 10, sab: 16, car: 10 },
    maxHp: 30, currentHp: 30, tempHp: 0, hitDiceRemaining: 5, armorClass: 16,
    proficientSkills: [], proficientSavingThrows: ['sab', 'car'],
    languages: [], toolProficiencies: [], armorProficiencies: [], weaponProficiencies: [],
    conditions: [], inventory: [], equippedWeapons: [], gold: 0,
    spellsKnown: [], spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [], ideals: [], bonds: [], flaws: [],
    backstory: '', createdAt: 0, lastPlayedAt: 0, deathCount: 0, campaignsPlayed: [],
    deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0,
    ...overrides,
  };
}

describe('renderSavingThrowFormula η.6', () => {
  beforeEach(() => {
    resetSavingThrowTutorialForTest();
    document.body.innerHTML = '';
  });

  it('mostra fórmula d20 + mod + prof = total vs DC', () => {
    const el = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab',
      dc: 15,
      reason: 'Resista ao terror',
      onRoll: () => {},
    });
    document.body.appendChild(el);
    expect(el.textContent).toContain('d20');
    expect(el.textContent).toContain('DC 15');
    expect(el.textContent).toContain('Resista ao terror');
  });

  it('proficiente: mostra +prof bonus', () => {
    // Clérigo proficiente em SAB
    const el = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab',
      dc: 14,
      reason: '',
      onRoll: () => {},
    });
    expect(el.querySelector('.sfb-prof')).toBeTruthy();
  });

  it('NÃO proficiente: oculta prof bonus', () => {
    const el = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'for', // não proficiente
      dc: 14,
      reason: '',
      onRoll: () => {},
    });
    expect(el.querySelector('.sfb-prof')).toBeNull();
  });

  it('tutorial inline aparece 1ª vez', () => {
    const el = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab', dc: 14, reason: '',
      onRoll: () => {},
    });
    expect(el.querySelector('.sfb-tutorial')).toBeTruthy();
  });

  it('tutorial NÃO aparece 2ª vez (localStorage flag)', () => {
    renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab', dc: 14, reason: '',
      onRoll: () => {},
    });
    const el2 = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab', dc: 14, reason: '',
      onRoll: () => {},
    });
    expect(el2.querySelector('.sfb-tutorial')).toBeNull();
  });

  it('botão Rolar dispara onRoll', () => {
    let rolled = 0;
    const el = renderSavingThrowFormula({
      character: makeChar(),
      ability: 'sab', dc: 14, reason: '',
      onRoll: () => { rolled++; },
    });
    const btn = el.querySelector('.sfb-roll-btn') as HTMLButtonElement;
    btn.click();
    expect(rolled).toBe(1);
  });

  it('mod negativo formata "-1" corretamente', () => {
    const el = renderSavingThrowFormula({
      character: makeChar({ abilityScores: { ...makeChar().abilityScores, for: 8 } }),
      ability: 'for', dc: 12, reason: '',
      onRoll: () => {},
    });
    const mod = el.querySelector('.sfb-mod');
    expect(mod?.textContent).toBe('-1');
  });
});

// @vitest-environment happy-dom
// ο.4 — Tests do Initiative Ribbon Uber-Style.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderInitiativeRibbon } from '../initiative-ribbon';
import type { CombatState, CharacterSheet } from '../../../shared/types';

function makeCharacter(id: string, overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id,
    ownerName: 'p',
    characterName: id,
    raceId: 'humano',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nn',
    level: 1,
    xp: 0,
    abilityScoresBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    abilityScores: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDiceRemaining: 1,
    armorClass: 12,
    proficientSkills: [],
    proficientSavingThrows: [],
    languages: [],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    conditions: [],
    inventory: [],
    equippedWeapons: [],
    gold: 0,
    spellsKnown: [],
    spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    backstory: '',
    createdAt: 0,
    lastPlayedAt: 0,
    deathCount: 0,
    campaignsPlayed: [],
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    exhaustion: 0,
    ...overrides,
  };
}

function makeCombat(): CombatState {
  return {
    active: true,
    round: 2,
    initiativeOrder: [
      { id: 'pc-1', kind: 'player', initiative: 18, name: 'Borin' },
      { id: 'enemy-1', kind: 'enemy', initiative: 15, name: 'Goblin' },
      { id: 'pc-2', kind: 'player', initiative: 12, name: 'Lyra' },
    ],
    currentTurnIndex: 0,
    enemies: [{
      id: 'enemy-1', name: 'Goblin',
      maxHp: 10, currentHp: 6, armorClass: 13,
      attackBonus: 3, damageDice: '1d6', damageBonus: 1,
      initiative: 15, conditions: [], description: '', isBoss: false, xpAward: 25,
    }],
    log: [],
  };
}

describe('renderInitiativeRibbon', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renderiza N nodes + N-1 connectors', () => {
    const combat = makeCombat();
    const party = [makeCharacter('pc-1'), makeCharacter('pc-2', { characterName: 'Lyra' })];
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    document.body.appendChild(el);
    expect(el.querySelectorAll('.irb-node').length).toBe(3);
    expect(el.querySelectorAll('.irb-connector').length).toBe(2);
  });

  it('current node tem classe is-current', () => {
    const combat = makeCombat();
    const party = [makeCharacter('pc-1')];
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    const current = el.querySelectorAll('.irb-node')[0];
    expect(current?.classList.contains('is-current')).toBe(true);
  });

  it('node próprio (me) tem classe is-me', () => {
    const combat = makeCombat();
    const party = [makeCharacter('pc-1'), makeCharacter('pc-2')];
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-2' });
    const nodes = el.querySelectorAll('.irb-node');
    expect(nodes[2]?.classList.contains('is-me')).toBe(true);
    expect(nodes[0]?.classList.contains('is-me')).toBe(false);
  });

  it('enemy morto vira is-down + skull overlay', () => {
    const combat = makeCombat();
    combat.enemies[0]!.currentHp = 0;
    const party = [makeCharacter('pc-1')];
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    const enemyNode = el.querySelectorAll('.irb-node')[1];
    expect(enemyNode?.classList.contains('is-down')).toBe(true);
    expect(enemyNode?.querySelector('.irb-downed-overlay')).toBeTruthy();
  });

  it('tap em node expande mini-card', () => {
    const combat = makeCombat();
    const party = [makeCharacter('pc-1'), makeCharacter('pc-2')];
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    expect(el.querySelector('.irb-expand-card')).toBeNull();
    (el.querySelectorAll('.irb-node')[0] as HTMLButtonElement).click();
    expect(el.querySelector('.irb-expand-card')).toBeTruthy();
  });

  // W3-DnD — Sprint W: next-up hint agora aparece SEMPRE (não só pra aliado).
  // Consultor D&D: "ordem dramática" — DM narra próximo participante sempre,
  // seja enemy ou aliado. Glyph muda por kind (🩸 enemy / 🤝 aliado / ▶ você).
  it('hint "Próximo" aparece em TODOS turnos (W3-DnD next-up)', () => {
    const combat = makeCombat();
    const party = [makeCharacter('pc-1'), makeCharacter('pc-2', { characterName: 'Lyra' })];

    // currentTurn=0 (pc-1), próximo é enemy "Goblin". Hint mostra Goblin com 🩸.
    const el = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    const hint0 = el.querySelector('.irb-next-hint');
    expect(hint0).not.toBeNull();
    expect(hint0?.textContent).toContain('Goblin');
    expect(hint0?.className).toContain('irb-next-enemy');

    // currentTurn=1 (enemy), próximo = pc-2 (aliado Lyra).
    combat.currentTurnIndex = 1;
    const el2 = renderInitiativeRibbon({ combat, party, myCharacterId: 'pc-1' });
    const hint1 = el2.querySelector('.irb-next-hint');
    expect(hint1?.textContent).toContain('Lyra');
    expect(hint1?.className).toContain('irb-next-player');
  });
});

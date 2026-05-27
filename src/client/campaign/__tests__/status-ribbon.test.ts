// @vitest-environment happy-dom
// ο.1 — Tests do Status Ribbon mode-aware.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderStatusRibbon } from '../status-ribbon';
import type { CampaignState, CharacterSheet } from '../../../shared/types';

function makeCharacter(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'pc-1',
    ownerName: 'João',
    characterName: 'Borin',
    raceId: 'anao-montanha',
    classId: 'guerreiro',
    backgroundId: 'soldado',
    alignment: 'nb',
    level: 3,
    xp: 1820,
    abilityScoresBase: { for: 14, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    abilityScores: { for: 16, des: 12, con: 16, int: 10, sab: 12, car: 10 },
    maxHp: 30,
    currentHp: 28,
    tempHp: 0,
    hitDiceRemaining: 3,
    armorClass: 14,
    proficientSkills: [],
    proficientSavingThrows: ['for', 'con'],
    languages: [],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    conditions: [],
    inventory: [],
    equippedWeapons: [],
    gold: 10,
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

function makeState(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    id: 'c-1',
    name: 'Crônica de Teste',
    mode: 'exploration',
    partyCharacterIds: ['pc-1'],
    currentLocation: 'Caverna do Trovão',
    currentSceneDescription: '',
    worldFlags: {},
    npcsMet: [],
    recentEvents: [],
    sessionNumber: 1,
    startedAt: 0,
    lastPlayedAt: 0,
    pendingCheck: null,
    pendingSave: null,
    combat: null,
    quests: [],
    ...overrides,
  };
}

describe('renderStatusRibbon', () => {
  let exitCount: number;
  let expandCount: number;
  beforeEach(() => {
    exitCount = 0;
    expandCount = 0;
  });

  it('mostra loading quando state é null', () => {
    const el = renderStatusRibbon({
      state: null,
      character: null,
      onExpand: () => { expandCount++; },
      onExit: () => { exitCount++; },
    });
    expect(el.textContent).toContain('Carregando');
    expect(el.classList.contains('status-ribbon-loading')).toBe(true);
  });

  it('exploration: mostra location + HP + XP', () => {
    const character = makeCharacter();
    const state = makeState();
    const el = renderStatusRibbon({
      state, character,
      onExpand: () => { expandCount++; },
      onExit: () => { exitCount++; },
    });
    expect(el.classList.contains('status-ribbon-exploration')).toBe(true);
    expect(el.textContent).toContain('Caverna do Trovão');
    expect(el.textContent).toContain('28/30');
    expect(el.textContent).toContain('1820xp');
  });

  it('HP crítico (<25%) marca is-critical', () => {
    const character = makeCharacter({ currentHp: 5, maxHp: 30 });
    const state = makeState();
    const el = renderStatusRibbon({
      state, character,
      onExpand: () => {}, onExit: () => {},
    });
    const hpEl = el.querySelector('.sr-hp');
    expect(hpEl?.classList.contains('is-critical')).toBe(true);
  });

  it('combat: mostra Round + turno', () => {
    const character = makeCharacter();
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 3,
        initiativeOrder: [
          { id: 'pc-1', kind: 'player', initiative: 18, name: 'Borin' },
          { id: 'enemy-1', kind: 'enemy', initiative: 12, name: 'Goblin' },
        ],
        currentTurnIndex: 0,
        enemies: [],
        log: [],
        actionEconomy: {
          'pc-1': { action: true, bonusAction: true, reaction: true, movement: 30 },
        },
      },
    });
    const el = renderStatusRibbon({
      state, character,
      onExpand: () => {}, onExit: () => {},
    });
    expect(el.classList.contains('status-ribbon-combat')).toBe(true);
    expect(el.textContent).toContain('R3');
    expect(el.textContent).toContain('Sua vez');
  });

  it('combat: turno do inimigo mostra "Vez de"', () => {
    const character = makeCharacter();
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 1,
        initiativeOrder: [
          { id: 'enemy-1', kind: 'enemy', initiative: 18, name: 'Goblin Sarnento' },
          { id: 'pc-1', kind: 'player', initiative: 12, name: 'Borin' },
        ],
        currentTurnIndex: 0,
        enemies: [],
        log: [],
      },
    });
    const el = renderStatusRibbon({
      state, character,
      onExpand: () => {}, onExit: () => {},
    });
    expect(el.textContent).toContain('Vez de');
    expect(el.textContent).toContain('Goblin');
    const turn = el.querySelector('.sr-turn');
    expect(turn?.classList.contains('is-my-turn')).toBe(false);
  });

  it('exit button dispara onExit', () => {
    const el = renderStatusRibbon({
      state: makeState(),
      character: makeCharacter(),
      onExpand: () => { expandCount++; },
      onExit: () => { exitCount++; },
    });
    const exitBtn = el.querySelector('.sr-exit') as HTMLButtonElement;
    exitBtn.click();
    expect(exitCount).toBe(1);
  });

  it('body tap dispara onExpand', () => {
    const el = renderStatusRibbon({
      state: makeState(),
      character: makeCharacter(),
      onExpand: () => { expandCount++; },
      onExit: () => { exitCount++; },
    });
    const body = el.querySelector('.sr-body') as HTMLButtonElement;
    body.click();
    expect(expandCount).toBe(1);
  });
});

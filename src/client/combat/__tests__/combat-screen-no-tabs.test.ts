// @vitest-environment happy-dom
// ② Combate sem abas (portrait) — guarda o contrato do redesign de layout
// mobile: em is-portrait-narrow o combat-screen NÃO renderiza .cb-tabs nem
// seta data-active-tab, então inimigos + economia + ações aparecem JUNTOS
// (sem o split por abas). Desktop mantém a tab strip + data-active-tab.
//
// singleFork vaza body.* entre arquivos → afterEach limpa body class/innerHTML.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CombatState, CharacterSheet } from '../../../shared/types';
import { renderCombatScreen, type CombatScreenOpts } from '../combat-screen';

const makeChar = (): CharacterSheet => ({
  id: 'pc-1', ownerId: 'owner-1', raceId: 'dwarf', classId: 'fighter',
  characterName: 'Borin', level: 1, xp: 0, armorClass: 18,
  currentHp: 13, maxHp: 13,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  savingThrows: { str: true, con: true } as Record<string, boolean>,
  proficientSkills: [], conditions: [], inventory: [],
  proficiencyBonus: 2, speed: 30, spellSlots: {},
  abilityScoreIncreases: 0, feats: [], proficiencies: [],
} as unknown as CharacterSheet);

const makeCombat = (): CombatState => ({
  active: true, round: 1, currentTurnIndex: 0,
  initiativeOrder: [{ id: 'pc-1', name: 'Borin', kind: 'player', initiative: 15 }],
  enemies: [{
    id: 'e1', name: 'Capuz', currentHp: 10, maxHp: 10, armorClass: 13,
    attackBonus: 4, damageDice: '1d6', damageBonus: 2, conditions: [],
    initiative: 10, description: '', isBoss: false, xpAward: 50,
  }],
  actionEconomy: { 'pc-1': { action: true, bonusAction: true, movement: 30, reaction: true } },
  log: [],
} as unknown as CombatState);

const stubSocket = { emit: () => {} } as unknown as CombatScreenOpts['socket'];

function render(): HTMLElement {
  const container = document.createElement('div');
  renderCombatScreen(container, {
    combat: makeCombat(),
    party: [makeChar()],
    myCharacterId: 'pc-1',
    socket: stubSocket,
    combatLog: ['linha de log de combate'],
  });
  return container;
}

describe('② Combate sem abas — portrait (is-portrait-narrow)', () => {
  beforeEach(() => { document.body.className = 'is-portrait-narrow'; document.body.innerHTML = ''; });
  afterEach(() => { document.body.className = ''; document.body.innerHTML = ''; });

  it('NÃO renderiza a tab strip (.cb-tabs)', () => {
    const c = render();
    expect(c.querySelector('.cb-tabs')).toBeNull();
  });

  it('NÃO seta data-active-tab no .combat-screen (regras de esconde-aba não disparam)', () => {
    const c = render();
    const screen = c.querySelector('.combat-screen')!;
    expect(screen.hasAttribute('data-active-tab')).toBe(false);
  });

  it('inimigos + ações aparecem JUNTOS (ambas as seções presentes no mesmo render)', () => {
    const c = render();
    expect(c.querySelector('.cb-tab-enemies')).toBeTruthy(); // cards de inimigo
    expect(c.querySelector('.cb-tab-actions')).toBeTruthy(); // grade de ações
  });

  it('Fase 3 — o grid completo colapsa num <details> "+ ações" (default fechado) pra caber', () => {
    const c = render();
    const details = c.querySelector('details.cb-actions-collapse') as HTMLDetailsElement | null;
    expect(details).toBeTruthy();
    // grid vive DENTRO do details (honra "grid completo continua no combat-screen")
    expect(details!.querySelector('.cb-actions-grid')).toBeTruthy();
    // default fechado → não empurra o dock pra fora do fold
    expect(details!.open).toBe(false);
    // a seção de ações (cb-tab-actions) e o end-turn seguem fora do details
    expect(c.querySelector('.cb-tab-actions')).toBeTruthy();
  });
});

describe('② Combate — desktop mantém abas (sem is-portrait-narrow)', () => {
  beforeEach(() => { document.body.className = ''; document.body.innerHTML = ''; });
  afterEach(() => { document.body.className = ''; document.body.innerHTML = ''; });

  it('renderiza a tab strip + data-active-tab="actions" (comportamento legado intacto)', () => {
    const c = render();
    expect(c.querySelector('.cb-tabs')).toBeTruthy();
    const screen = c.querySelector('.combat-screen')!;
    expect(screen.getAttribute('data-active-tab')).toBe('actions');
  });
});

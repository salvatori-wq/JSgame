// @vitest-environment happy-dom
// ③ Party faixa fina (solo + portrait) — guarda o contrato do redesign de
// layout mobile: solo + is-portrait-narrow → renderPartyPanel devolve uma
// faixa de 1 linha (.camp-party.is-thin-strip) SEM XP/slots. Coop e desktop
// mantêm o card completo (com XP bar + título "Party").
//
// singleFork vaza body.* entre arquivos → afterEach limpa body class.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CampaignScreen } from '../campaign-screen';
import type { CharacterSheet } from '../../../shared/types';

const makeChar = (over: Partial<CharacterSheet> = {}): CharacterSheet => ({
  id: 'pc-1', ownerId: 'owner-1', raceId: 'dwarf', classId: 'fighter',
  characterName: 'Borin', level: 1, xp: 0, armorClass: 18,
  currentHp: 13, maxHp: 13, hitDiceRemaining: 1,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  savingThrows: { str: true, con: true } as Record<string, boolean>,
  proficientSkills: [], conditions: [], inventory: [],
  proficiencyBonus: 2, speed: 30, spellSlots: {},
  abilityScoreIncreases: 0, feats: [], proficiencies: [],
  deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0, inspirations: 0,
  ...over,
} as unknown as CharacterSheet);

function mount(party: CharacterSheet[], narrow: boolean): HTMLElement {
  document.body.className = narrow ? 'is-portrait-narrow' : '';
  const container = document.createElement('div');
  const screen = new CampaignScreen(container, {
    characterId: 'pc-1',
    socket: { emit: () => {} } as unknown as never,
    ownerName: 'João',
    onExit: () => {},
  } as never);
  const s = screen as unknown as { party: CharacterSheet[]; character: CharacterSheet | null; buildShell(): void; updatePartyPanel(): void };
  s.party = party;
  s.character = party[0] ?? null;
  s.buildShell();
  s.updatePartyPanel();
  return container;
}

afterEach(() => { document.body.className = ''; });

describe('③ Party faixa fina — solo + portrait (is-portrait-narrow)', () => {
  beforeEach(() => { document.body.className = 'is-portrait-narrow'; });

  it('devolve a faixa fina (.camp-party.is-thin-strip) com .cp-strip', () => {
    const c = mount([makeChar()], true);
    expect(c.querySelector('.camp-party.is-thin-strip')).toBeTruthy();
    expect(c.querySelector('.cp-strip')).toBeTruthy();
  });

  it('NÃO mostra XP nem slots na faixa in-game', () => {
    const c = mount([makeChar({ spellSlots: { 1: { max: 2, used: 0 } } as never })], true);
    expect(c.querySelector('.cp-pj-xp-bar')).toBeNull();
    expect(c.querySelector('.cp-pj-slots')).toBeNull();
  });

  it('mostra HP num + CA na faixa', () => {
    const c = mount([makeChar()], true);
    expect(c.querySelector('.cp-strip-hp')?.textContent).toBe('13/13');
    expect(c.querySelector('.cp-strip-ca')?.textContent).toMatch(/18/);
  });

  it('marca o slot host com is-solo + is-thin-host', () => {
    const c = mount([makeChar()], true);
    const slot = c.querySelector('.ch-slot-party')!;
    expect(slot.classList.contains('is-solo')).toBe(true);
    expect(slot.classList.contains('is-thin-host')).toBe(true);
  });

  it('badges críticos (conditions/conc) caem na 2ª mini-linha quando existem', () => {
    const c = mount([makeChar({ conditions: ['envenenado'], concentratingOn: 'Bless' } as never)], true);
    const badges = c.querySelector('.cp-strip-badges');
    expect(badges).toBeTruthy();
    expect(badges?.textContent).toMatch(/envenenado/);
    expect(badges?.textContent).toMatch(/Bless/);
  });

  it('sem condições → sem 2ª linha de badges', () => {
    const c = mount([makeChar()], true);
    expect(c.querySelector('.cp-strip-badges')).toBeNull();
  });
});

describe('③ Party — desktop solo mantém card completo (sem is-portrait-narrow)', () => {
  beforeEach(() => { document.body.className = ''; });

  it('renderiza card completo com título Party + XP bar (sem faixa fina)', () => {
    const c = mount([makeChar()], false);
    expect(c.querySelector('.camp-party.is-thin-strip')).toBeNull();
    expect(c.querySelector('.cp-title')).toBeTruthy();
    expect(c.querySelector('.cp-pj-xp-bar')).toBeTruthy();
  });
});

describe('③ Party — coop portrait (2+ PJs) mantém cards (sem faixa fina)', () => {
  beforeEach(() => { document.body.className = 'is-portrait-narrow'; });

  it('coop usa lista de cards (is-coop) com XP, não a faixa fina', () => {
    const c = mount([makeChar(), makeChar({ id: 'pc-2', characterName: 'Lyra' })], true);
    expect(c.querySelector('.camp-party.is-thin-strip')).toBeNull();
    expect(c.querySelector('.cp-list.is-coop')).toBeTruthy();
    expect(c.querySelector('.cp-pj-xp-bar')).toBeTruthy();
  });
});

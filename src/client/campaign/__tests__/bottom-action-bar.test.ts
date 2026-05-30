// @vitest-environment happy-dom
// Redesign WhatsApp (Fase 2) — o rodapé vira a BARRA DE AÇÕES e a exploração
// não usa mais o dock (narração domina). Contrato:
//  - exploração+portrait → .camp-action-bar com 5 botões (Explorar/Falar/
//    Batalha/Dado/Mais) no slot de baixo; main-content VAZIO (sem dock).
//  - combate+portrait → .camp-action-bar.is-combat (combat: ver Fase 3); dock
//    (combat-screen) montado no main-content.
//
// singleFork vaza body.* → afterEach limpa.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CampaignScreen } from '../campaign-screen';
import type { CharacterSheet, CampaignState } from '../../../shared/types';

const makeChar = (): CharacterSheet => ({
  id: 'pc-1', ownerId: 'o1', raceId: 'dwarf', classId: 'fighter',
  characterName: 'Borin', level: 1, xp: 0, armorClass: 18,
  currentHp: 13, maxHp: 13, hitDiceRemaining: 1,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  savingThrows: {} as Record<string, boolean>, proficientSkills: [], conditions: [],
  inventory: [], proficiencyBonus: 2, speed: 30, spellSlots: {},
  abilityScoreIncreases: 0, feats: [], proficiencies: [],
  deathSaveSuccesses: 0, deathSaveFailures: 0, exhaustion: 0, inspirations: 0,
} as unknown as CharacterSheet);

const exploreState = (): CampaignState => ({ id: 'c1', mode: 'exploration' } as unknown as CampaignState);
const combatState = (): CampaignState => ({
  id: 'c1', mode: 'combat',
  combat: {
    active: true, round: 1, currentTurnIndex: 0,
    initiativeOrder: [{ id: 'pc-1', name: 'Borin', kind: 'player', initiative: 10 }],
    enemies: [], actionEconomy: { 'pc-1': { action: true, bonusAction: true, movement: 30, reaction: true } }, log: [],
  },
} as unknown as CampaignState);

function mount(state: CampaignState, narrow = true): HTMLElement {
  document.body.className = narrow ? 'is-portrait-narrow' : '';
  const container = document.createElement('div');
  const screen = new CampaignScreen(container, {
    characterId: 'pc-1', socket: { emit: () => {} } as unknown as never, ownerName: 'João', onExit: () => {},
  } as never);
  const s = screen as unknown as {
    character: CharacterSheet; party: CharacterSheet[]; currentState: CampaignState;
    buildShell(): void; updateMainContent(): void; updateBottomTabBar(): void;
  };
  s.character = makeChar();
  s.party = [makeChar()];
  s.currentState = state;
  s.buildShell();
  s.updateMainContent();
  s.updateBottomTabBar();
  return container;
}

afterEach(() => { document.body.className = ''; });

describe('Redesign — exploração: barra de ações no rodapé, sem dock', () => {
  it('rodapé tem .camp-action-bar com 5 botões (Explorar/Falar/Batalha/Dado/Mais)', () => {
    const c = mount(exploreState());
    const bar = c.querySelector('.ch-slot-bottom-tabs .camp-action-bar');
    expect(bar).toBeTruthy();
    const labels = [...bar!.querySelectorAll('.cab-label')].map((e) => e.textContent);
    expect(labels).toEqual(['Explorar', 'Falar', 'Batalha', 'Dado', 'Mais']);
  });

  it('main-content (dock) fica VAZIO em exploração+portrait (narração domina)', () => {
    const c = mount(exploreState());
    const main = c.querySelector('.ch-slot-main-content');
    expect(main).toBeTruthy();
    expect(main!.children.length).toBe(0);
    expect(c.querySelector('.action-dock-topics')).toBeNull();
  });

  it('não renderiza a nav bar antiga (Missões/Glórias/...)', () => {
    const c = mount(exploreState());
    expect(c.querySelector('.bottom-tab-bar')).toBeNull();
  });

  it('botão ⚔ Batalha dispara takeAction("attack", "") — DM decide se inicia combate', () => {
    document.body.className = 'is-portrait-narrow';
    const container = document.createElement('div');
    const screen = new CampaignScreen(container, {
      characterId: 'pc-1', socket: { emit: () => {} } as unknown as never, ownerName: 'João', onExit: () => {},
    } as never);
    const s = screen as unknown as {
      character: CharacterSheet; party: CharacterSheet[]; currentState: CampaignState;
      buildShell(): void; updateBottomTabBar(): void; takeAction(a: string, d?: string): void;
    };
    s.character = makeChar();
    s.party = [makeChar()];
    s.currentState = exploreState();
    s.buildShell();
    s.updateBottomTabBar();
    const spy = vi.fn();
    s.takeAction = spy; // shadowing instance method — o closure resolve no click
    const bar = container.querySelector('.ch-slot-bottom-tabs .camp-action-bar')!;
    const batalha = [...bar.querySelectorAll('.cab-btn')]
      .find((b) => b.querySelector('.cab-label')?.textContent === 'Batalha') as HTMLButtonElement;
    expect(batalha).toBeTruthy();
    batalha.click();
    expect(spy).toHaveBeenCalledWith('attack', '');
  });
});

describe('Redesign — combate (Fase 3): barra [Atacar, Dado, Mais]; dock mantido', () => {
  it('rodapé tem .camp-action-bar.is-combat com [Atacar, Dado, Mais]', () => {
    const c = mount(combatState());
    const bar = c.querySelector('.ch-slot-bottom-tabs .camp-action-bar.is-combat');
    expect(bar).toBeTruthy();
    const labels = [...bar!.querySelectorAll('.cab-label')].map((e) => e.textContent);
    expect(labels).toEqual(['Atacar', 'Dado', 'Mais']);
  });

  it('⚔ Atacar é o botão DOMINANTE (.is-primary) e fica ATIVO no meu turno', () => {
    const c = mount(combatState()); // initiativeOrder me dá o turno (currentTurnIndex 0 = pc-1)
    const atk = c.querySelector('.camp-action-bar.is-combat .cab-btn.is-primary') as HTMLButtonElement;
    expect(atk).toBeTruthy();
    expect(atk.querySelector('.cab-label')?.textContent).toBe('Atacar');
    expect(atk.hasAttribute('disabled')).toBe(false);
  });

  it('combat-screen (dock ①②) montado no main-content', () => {
    const c = mount(combatState());
    expect(c.querySelector('.ch-slot-main-content .combat-screen')).toBeTruthy();
  });
});

describe('Redesign — desktop não usa barra inferior', () => {
  it('sem is-portrait-narrow, o slot de baixo fica vazio (usa o dock no main-content)', () => {
    const c = mount(exploreState(), false);
    expect(c.querySelector('.ch-slot-bottom-tabs .camp-action-bar')).toBeNull();
    // desktop mantém o grid de ações no main-content
    expect(c.querySelector('.ch-slot-main-content .camp-actions')).toBeTruthy();
  });
});

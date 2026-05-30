// @vitest-environment happy-dom
// Fase 2 — WhatsApp: a faixa fina solo (topo) é tocável e expande a ficha
// completa num bottom-sheet (sheet-stack). Reusa renderPartyCard.
//
// singleFork vaza body.* + sheet-stack → afterEach limpa ambos.

import { describe, it, expect, afterEach } from 'vitest';
import { CampaignScreen } from '../campaign-screen';
import { resetSheetStackForTest } from '../../sheet-stack-manager';
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

function mountSolo(): HTMLElement {
  document.body.className = 'is-portrait-narrow';
  const container = document.createElement('div');
  const screen = new CampaignScreen(container, {
    characterId: 'pc-1', socket: { emit: () => {} } as unknown as never, ownerName: 'João', onExit: () => {},
  } as never);
  const s = screen as unknown as {
    character: CharacterSheet; party: CharacterSheet[]; currentState: CampaignState;
    buildShell(): void; updatePartyPanel(): void;
  };
  s.character = makeChar();
  s.party = [makeChar()];
  s.currentState = exploreState();
  s.buildShell();
  s.updatePartyPanel();
  return container;
}

afterEach(() => { document.body.className = ''; resetSheetStackForTest(); });

describe('Fase 2 — party fina solo: tap expande a ficha', () => {
  it('a faixa tem role=button + chevron › (affordance de toque)', () => {
    const c = mountSolo();
    const strip = c.querySelector('.cp-strip');
    expect(strip).toBeTruthy();
    expect(strip!.getAttribute('role')).toBe('button');
    expect(c.querySelector('.cp-strip-chevron')).toBeTruthy();
  });

  it('tocar a faixa abre o bottom-sheet com a ficha completa (.cp-pj)', () => {
    const c = mountSolo();
    const strip = c.querySelector('.cp-strip') as HTMLElement;
    expect(document.querySelector('.cp-member-sheet')).toBeNull();
    strip.click();
    const sheet = document.querySelector('.cp-member-sheet');
    expect(sheet).toBeTruthy();
    expect(sheet!.querySelector('.cp-pj')).toBeTruthy();
    expect(sheet!.querySelector('.cp-member-sheet-title')?.textContent).toContain('Borin');
  });
});

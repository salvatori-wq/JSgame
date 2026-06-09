// @vitest-environment happy-dom
// W3-DnD Sprint W — Tests pro renderConcentrationChip no status-ribbon.

import { describe, it, expect } from 'vitest';
import { renderConcentrationChip } from '../status-ribbon';
import type { CharacterSheet } from '../../../shared/types';

const makeChar = (concentratingOn?: string | null): CharacterSheet => ({
  id: 'pc-1',
  ownerId: 'o',
  raceId: 'human',
  classId: 'wizard',
  characterName: 'Lyra',
  level: 3,
  xp: 600,
  armorClass: 12,
  currentHp: 18,
  maxHp: 18,
  abilities: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
  savingThrows: {},
  proficientSkills: [],
  conditions: [],
  inventory: [],
  proficiencyBonus: 2,
  speed: 30,
  spellSlots: {},
  abilityScoreIncreases: 0,
  feats: [],
  proficiencies: [],
  concentratingOn,
} as unknown as CharacterSheet);

describe('renderConcentrationChip — W3-DnD concentração visível', () => {
  it('character sem concentração → null', () => {
    const r = renderConcentrationChip(makeChar(null));
    expect(r).toBeNull();
    const r2 = renderConcentrationChip(makeChar(undefined));
    expect(r2).toBeNull();
  });

  it('character null → null', () => {
    expect(renderConcentrationChip(null)).toBeNull();
  });

  it('character concentrando em "bless" → "🧠 Bless"', () => {
    const r = renderConcentrationChip(makeChar('bless'));
    expect(r).not.toBeNull();
    expect(r?.textContent).toContain('Bless');
    expect(r?.textContent).toContain('🧠');
    expect(r?.classList.contains('sr-conc')).toBe(true);
  });

  it('spellId com hífen vira display com espaço', () => {
    const r = renderConcentrationChip(makeChar('hold-person'));
    expect(r?.textContent).toContain('Hold person');
  });

  it('chip tem tooltip educacional sobre CON save', () => {
    const r = renderConcentrationChip(makeChar('bless'));
    const title = r?.getAttribute('title') ?? '';
    expect(title).toMatch(/save/i);
    expect(title).toMatch(/constitui/i);
  });
});

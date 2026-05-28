// Sprint Φ.1 — Snapshot dos tokens D&D 5e oficiais em _tokens.css.
// Garante que paleta oficial (extraída de rpgtex/DND-5e-LaTeX-Template lib/dndcolors.sty)
// permanece presente e com valores corretos pros componentes autênticos (StatBlock,
// SpellCard, ItemCard).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS = readFileSync(
  resolve(__dirname, '../styles/_tokens.css'),
  'utf-8'
);

describe('Φ.1 — Paleta D&D 5e oficial (cores tipográficas)', () => {
  it('expõe --dnd-title-red oficial (#58180D — sangue escuro do título)', () => {
    expect(TOKENS).toMatch(/--dnd-title-red:\s*#58180D/i);
  });

  it('expõe --dnd-title-gold (#C9AD6A — régua de título)', () => {
    expect(TOKENS).toMatch(/--dnd-title-gold:\s*#C9AD6A/i);
  });

  it('expõe --dnd-rule-red (#9C2B1B — régua triangular)', () => {
    expect(TOKENS).toMatch(/--dnd-rule-red:\s*#9C2B1B/i);
  });

  it('expõe --dnd-contour-gray (#CACCBE — outline chapter font)', () => {
    expect(TOKENS).toMatch(/--dnd-contour-gray:\s*#CACCBE/i);
  });
});

describe('Φ.1 — Paleta D&D 5e oficial (stat block)', () => {
  it('expõe --dnd-stat-ribbon (#E69A28 — fita gold)', () => {
    expect(TOKENS).toMatch(/--dnd-stat-ribbon:\s*#E69A28/i);
  });

  it('expõe --dnd-stat-bg (#FDF1DC — fundo tan)', () => {
    expect(TOKENS).toMatch(/--dnd-stat-bg:\s*#FDF1DC/i);
  });

  it('expõe --dnd-read-aloud (#F7F2E5 — fundo box leia em voz alta)', () => {
    expect(TOKENS).toMatch(/--dnd-read-aloud:\s*#F7F2E5/i);
  });

  it('expõe --dnd-page-gold (#B89A67 — footer/numbers)', () => {
    expect(TOKENS).toMatch(/--dnd-page-gold:\s*#B89A67/i);
  });
});

describe('Φ.1 — Rarities oficiais (DMG p.135)', () => {
  it('expõe 6 rarities (common→artifact) com cores DMG', () => {
    expect(TOKENS).toMatch(/--dnd-rarity-common:\s*#c8c8c8/i);
    expect(TOKENS).toMatch(/--dnd-rarity-uncommon:\s*#1eff00/i);
    expect(TOKENS).toMatch(/--dnd-rarity-rare:\s*#0070dd/i);
    expect(TOKENS).toMatch(/--dnd-rarity-very-rare:\s*#a335ee/i);
    expect(TOKENS).toMatch(/--dnd-rarity-legendary:\s*#ff8000/i);
    expect(TOKENS).toMatch(/--dnd-rarity-artifact:\s*#e6cc80/i);
  });
});

describe('Φ.1 — Spell school colors (8 escolas)', () => {
  it('cobre todas 8 escolas com cores temáticas', () => {
    expect(TOKENS).toMatch(/--dnd-school-abjuration:/);
    expect(TOKENS).toMatch(/--dnd-school-conjuration:/);
    expect(TOKENS).toMatch(/--dnd-school-divination:/);
    expect(TOKENS).toMatch(/--dnd-school-enchantment:/);
    expect(TOKENS).toMatch(/--dnd-school-evocation:/);
    expect(TOKENS).toMatch(/--dnd-school-illusion:/);
    expect(TOKENS).toMatch(/--dnd-school-necromancy:/);
    expect(TOKENS).toMatch(/--dnd-school-transmutation:/);
  });
});

describe('Φ.1 — Não regrediu tokens de tema existentes', () => {
  it('mantém --ink-gold + --accent-blood + --accent-rune (tema escuro)', () => {
    expect(TOKENS).toMatch(/--ink-gold:\s*#f4d07f/i);
    expect(TOKENS).toMatch(/--accent-blood:\s*#c84032/i);
    expect(TOKENS).toMatch(/--accent-rune:\s*#d4a857/i);
  });

  it('mantém fontes do tema (Cinzel heading + Cardo body Φ.5)', () => {
    expect(TOKENS).toMatch(/--font-heading:\s*'Cinzel'/);
    expect(TOKENS).toMatch(/--font-body:\s*'Cardo'/);
  });
});

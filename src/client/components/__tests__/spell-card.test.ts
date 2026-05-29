// @vitest-environment happy-dom
// Sprint Φ.3 — Tests do SpellCard component.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderSpellCard,
  schoolLabel,
  schoolIcon,
  schoolToken,
  parseComponents,
} from '../spell-card';
import { SPELLS } from '../../../dnd/spells';

describe('Φ.3 — helpers puros', () => {
  it('schoolLabel cobre 8 escolas em PT-BR', () => {
    expect(schoolLabel('abjuracao')).toBe('Abjuração');
    expect(schoolLabel('adivinhacao')).toBe('Adivinhação');
    expect(schoolLabel('conjuracao')).toBe('Conjuração');
    expect(schoolLabel('encantamento')).toBe('Encantamento');
    expect(schoolLabel('evocacao')).toBe('Evocação');
    expect(schoolLabel('ilusao')).toBe('Ilusão');
    expect(schoolLabel('necromancia')).toBe('Necromancia');
    expect(schoolLabel('transmutacao')).toBe('Transmutação');
  });

  it('schoolIcon retorna emoji diferente pra cada escola', () => {
    const icons = new Set([
      schoolIcon('abjuracao'),
      schoolIcon('adivinhacao'),
      schoolIcon('conjuracao'),
      schoolIcon('encantamento'),
      schoolIcon('evocacao'),
      schoolIcon('ilusao'),
      schoolIcon('necromancia'),
      schoolIcon('transmutacao'),
    ]);
    expect(icons.size).toBe(8);
  });

  it('schoolToken mapeia PT-BR → EN token names', () => {
    expect(schoolToken('abjuracao')).toBe('--dnd-school-abjuration');
    expect(schoolToken('adivinhacao')).toBe('--dnd-school-divination');
    expect(schoolToken('conjuracao')).toBe('--dnd-school-conjuration');
    expect(schoolToken('encantamento')).toBe('--dnd-school-enchantment');
    expect(schoolToken('evocacao')).toBe('--dnd-school-evocation');
    expect(schoolToken('ilusao')).toBe('--dnd-school-illusion');
    expect(schoolToken('necromancia')).toBe('--dnd-school-necromancy');
    expect(schoolToken('transmutacao')).toBe('--dnd-school-transmutation');
  });

  describe('parseComponents', () => {
    it('detecta V/S/M individualmente', () => {
      expect(parseComponents('V')).toEqual({ v: true, s: false, m: false, mDescription: undefined });
      expect(parseComponents('V, S')).toEqual({ v: true, s: true, m: false, mDescription: undefined });
      expect(parseComponents('V, S, M')).toEqual({ v: true, s: true, m: true, mDescription: undefined });
    });

    it('extrai descrição material entre parênteses', () => {
      const parsed = parseComponents('V, S, M (sal)');
      expect(parsed.m).toBe(true);
      expect(parsed.mDescription).toBe('sal');
    });

    it('lida com só S', () => {
      expect(parseComponents('S')).toEqual({ v: false, s: true, m: false, mDescription: undefined });
    });
  });
});

describe('Φ.3 — renderSpellCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const fireBolt = SPELLS['fire-bolt'];
  const fireball = SPELLS['fireball'];
  const bless = SPELLS['bless'];

  it('renderiza nome + descrição + meta (escola + casting time)', () => {
    const card = renderSpellCard(fireBolt);
    expect(card.querySelector('.sc-name')?.textContent).toBe('Raio de Fogo');
    const sub = card.querySelector('.sc-subline')?.textContent ?? '';
    expect(sub).toContain('Evocação');
    expect(sub).toContain('1 ação');
    expect(card.querySelector('.sc-desc')?.textContent ?? '').toContain('fogo');
  });

  it('renderiza level chip "TRUQUE" para cantrip (nv 0)', () => {
    const card = renderSpellCard(fireBolt);
    expect(card.querySelector('.sc-level-chip')?.textContent).toBe('TRUQUE');
  });

  it('renderiza level chip "Nv X" para magia de nível >= 1', () => {
    const card = renderSpellCard(fireball);
    expect(card.querySelector('.sc-level-chip')?.textContent).toContain('Nv 3');
  });

  it('aplica classe sc-school-<school> pra cor da escola', () => {
    const card = renderSpellCard(fireBolt);
    expect(card.classList.contains('sc-school-evocacao')).toBe(true);
    const cardBless = renderSpellCard(bless);
    expect(cardBless.classList.contains('sc-school-encantamento')).toBe(true);
  });

  it('expõe data-school e data-level pra css/automation', () => {
    const card = renderSpellCard(fireball);
    expect(card.getAttribute('data-school')).toBe('evocacao');
    expect(card.getAttribute('data-level')).toBe('3');
  });

  it('renderiza school icon dentro do badge', () => {
    const card = renderSpellCard(fireBolt);
    const icon = card.querySelector('.sc-school-icon');
    expect(icon).toBeTruthy();
    // Fase 1A — ícone agora é SVG (game-icons) com fallback emoji.
    expect(icon?.querySelector('svg') ?? icon?.textContent).toBeTruthy();
  });

  it('renderiza stats grid com Alcance / Componentes / Duração', () => {
    const card = renderSpellCard(fireBolt);
    const stats = Array.from(card.querySelectorAll('.sc-stat-label')).map((n) => n.textContent);
    expect(stats).toEqual(['Alcance', 'Componentes', 'Duração']);
    const values = Array.from(card.querySelectorAll('.sc-stat-value')).map((n) => n.textContent);
    expect(values[0]).toBe('36m');
    expect(values[1]).toBe('V, S');
    expect(values[2]).toBe('Instantâneo');
  });

  it('renderiza tags Concentração e Ritual quando presentes', () => {
    // bless tem concentração
    const blessCard = renderSpellCard(bless);
    const tags = Array.from(blessCard.querySelectorAll('.sc-tag')).map((n) => n.textContent);
    expect(tags.some((t) => t?.includes('Concentração'))).toBe(true);
  });

  it('omite tags row quando spell não é concentração nem ritual', () => {
    const card = renderSpellCard(fireBolt);
    expect(card.querySelector('.sc-tags')).toBeNull();
  });

  it('renderiza upcast hint quando upcastDice existe', () => {
    // magic-missile tem upcastDice
    const mm = SPELLS['magic-missile'];
    if (mm.upcastDice) {
      const card = renderSpellCard(mm);
      const up = card.querySelector('.sc-upcast');
      expect(up?.textContent ?? '').toContain('mais altos');
      expect(up?.textContent ?? '').toContain(mm.upcastDice);
    }
  });

  it('omite upcast hint pra cantrips mesmo com upcastDice', () => {
    // fire-bolt é cantrip
    const card = renderSpellCard(fireBolt);
    expect(card.querySelector('.sc-upcast')).toBeNull();
  });

  it('aplica is-disabled e omite onClick quando canCast=false', () => {
    let clicked = 0;
    const card = renderSpellCard(fireBolt, { canCast: false, onClick: () => { clicked++; } });
    expect(card.classList.contains('is-disabled')).toBe(true);
    card.dispatchEvent(new Event('click', { bubbles: true }));
    expect(clicked).toBe(0);
  });

  it('chama onClick quando clicado e canCast=true', () => {
    const onClick = vi.fn();
    const card = renderSpellCard(fireBolt, { canCast: true, onClick });
    card.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('compact variant aplica classe sc-card-compact', () => {
    const card = renderSpellCard(fireBolt, { compact: true });
    expect(card.classList.contains('sc-card-compact')).toBe(true);
  });

  it('full variant (default) aplica classe sc-card-full', () => {
    const card = renderSpellCard(fireBolt);
    expect(card.classList.contains('sc-card-full')).toBe(true);
  });

  it('escapa XSS em descrição via upcast', () => {
    const malicious = {
      ...fireball,
      upcastDice: '<script>alert(1)</script>',
    };
    const card = renderSpellCard(malicious);
    expect(card.querySelector('script')).toBeNull();
    expect(card.querySelector('.sc-upcast')?.textContent ?? '').toContain('<script>');
  });
});

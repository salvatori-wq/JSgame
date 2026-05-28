// P2 — Tests pro CTA "🪄 Castar" no SpellCard compact.
// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { renderSpellCard } from '../spell-card';
import type { SpellDef } from '../../../dnd/spells';

const fakeSpell: SpellDef = {
  id: 'magic-missile',
  name: 'Mísseis Mágicos',
  level: 1,
  school: 'evocacao',
  castingTime: '1 ação',
  range: '36m',
  components: 'V, S',
  duration: 'Instantâneo',
  classes: ['mago'],
  description: '3 dardos brilhantes.',
  effect: { kind: 'damage', dice: '1d4+1', type: 'forca' },
  upcastDice: '1d4',
};

describe('P2 — SpellCard CTA "Castar"', () => {
  it('compact + onClick + canCast=true → CTA "🪄 Castar" is-castable', () => {
    const card = renderSpellCard(fakeSpell, { compact: true, canCast: true, onClick: () => {} });
    const cta = card.querySelector('.sc-cta-btn');
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain('Castar');
    expect(cta?.classList.contains('is-castable')).toBe(true);
  });

  it('compact + onClick + canCast=false → CTA "— Sem slot —" is-no-slot', () => {
    const card = renderSpellCard(fakeSpell, { compact: true, canCast: false, onClick: () => {} });
    const cta = card.querySelector('.sc-cta-btn');
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain('Sem slot');
    expect(cta?.classList.contains('is-no-slot')).toBe(true);
  });

  it('compact SEM onClick (apenas leitura) → CTA não renderiza', () => {
    const card = renderSpellCard(fakeSpell, { compact: true, canCast: true });
    expect(card.querySelector('.sc-cta-btn')).toBeNull();
  });

  it('full variant (tooltip/details) NÃO renderiza CTA mesmo com onClick', () => {
    const card = renderSpellCard(fakeSpell, { compact: false, canCast: true, onClick: () => {} });
    expect(card.querySelector('.sc-cta-btn')).toBeNull();
  });

  it('click no card chama onClick (CTA herda do card)', () => {
    const onClick = vi.fn();
    const card = renderSpellCard(fakeSpell, { compact: true, canCast: true, onClick });
    card.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// β.1 — Tests helpers puros do npc-roster-modal.

import { describe, it, expect } from 'vitest';
import { attitudeIcon, relationshipLabel, relTier, formatRelative } from '../npc-roster-modal';

describe('β.1 — attitudeIcon', () => {
  it('icon pra cada attitude', () => {
    expect(attitudeIcon('amigavel')).toBe('😊');
    expect(attitudeIcon('neutro')).toBe('😐');
    expect(attitudeIcon('hostil')).toBe('😠');
    expect(attitudeIcon('misterioso')).toBe('🎭');
  });
});

describe('β.1 — relationshipLabel', () => {
  it('aliado próximo (rel ≥ 8)', () => {
    expect(relationshipLabel(10)).toMatch(/Aliado/);
    expect(relationshipLabel(8)).toMatch(/Aliado/);
  });
  it('amigo (rel 4-7)', () => {
    expect(relationshipLabel(5)).toMatch(/Amigo/);
  });
  it('conhecido bem (rel 1-3)', () => {
    expect(relationshipLabel(2)).toMatch(/Conhecido/);
  });
  it('neutro (rel 0)', () => {
    expect(relationshipLabel(0)).toMatch(/Neutro/);
  });
  it('frio (-1 a -3)', () => {
    expect(relationshipLabel(-2)).toMatch(/Frio/);
  });
  it('inimigo (-4 a -7)', () => {
    expect(relationshipLabel(-5)).toMatch(/Inimigo/);
  });
  it('mortal (-8 a -10)', () => {
    expect(relationshipLabel(-10)).toMatch(/Mortal/);
  });
});

describe('β.1 — relTier', () => {
  it('mapeia rel pros 3 tiers', () => {
    expect(relTier(10)).toBe('friend');
    expect(relTier(4)).toBe('friend');
    expect(relTier(3)).toBe('neutral');
    expect(relTier(0)).toBe('neutral');
    expect(relTier(-3)).toBe('neutral');
    expect(relTier(-4)).toBe('enemy');
    expect(relTier(-10)).toBe('enemy');
  });
});

describe('β.1 — formatRelative', () => {
  it('agora pra timestamp < 1min', () => {
    expect(formatRelative(Date.now() - 30_000)).toMatch(/agora/);
  });
  it('min pra < 1h', () => {
    expect(formatRelative(Date.now() - 30 * 60_000)).toMatch(/30 min/);
  });
  it('h pra < 24h', () => {
    expect(formatRelative(Date.now() - 5 * 3600_000)).toMatch(/5h/);
  });
  it('dias pra ≥ 24h', () => {
    expect(formatRelative(Date.now() - 3 * 24 * 3600_000)).toMatch(/3 dias/);
  });
});

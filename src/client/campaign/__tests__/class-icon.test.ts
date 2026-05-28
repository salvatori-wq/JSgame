// W2.3 Sprint W — Tests pro classIcon helper.
// Avatar do chat-absorbido na narration-log mostra ícone da classe (não hash do nome).

import { describe, it, expect } from 'vitest';
import { classIcon } from '../narration-log';

describe('classIcon — W2.3 avatar conectado ao PJ real', () => {
  it('classes D&D 5e mapeiam pra icons distintos', () => {
    expect(classIcon('fighter')).toBe('⚔');
    expect(classIcon('wizard')).toBe('🧙');
    expect(classIcon('rogue')).toBe('🥷');
    expect(classIcon('bard')).toBe('🎵');
    expect(classIcon('barbarian')).toBe('🪓');
    expect(classIcon('warlock')).toBe('🔮');
    expect(classIcon('druid')).toBe('🌿');
    expect(classIcon('ranger')).toBe('🏹');
    expect(classIcon('monk')).toBe('👊');
  });

  it('case insensitive', () => {
    expect(classIcon('FIGHTER')).toBe('⚔');
    expect(classIcon('Wizard')).toBe('🧙');
  });

  it('trim whitespace', () => {
    expect(classIcon('  rogue  ')).toBe('🥷');
  });

  it('class desconhecida cai em 🗣 (genérico)', () => {
    expect(classIcon('jedi')).toBe('🗣');
    expect(classIcon('')).toBe('🗣');
  });

  it('null/undefined cai em 🗣', () => {
    expect(classIcon(null)).toBe('🗣');
    expect(classIcon(undefined)).toBe('🗣');
  });
});

// BUG-004 fix — Spell slots PHB pág 113 (nv 1-20) completos pra todas classes casters.

import { describe, it, expect } from 'vitest';
import { getStartingSlots, getStartingCantripCount, isSpellcaster, isPactMagicClass } from '../spell-slots';

describe('BUG-004 — Spell slots tabela completa nv 1-20', () => {
  describe('Full casters (Mago, Clérigo, Druida, Bardo, Feiticeiro)', () => {
    it('nv 1: 2 slots nv 1', () => {
      const slots = getStartingSlots('mago', 1);
      expect(slots[1].max).toBe(2);
      expect(slots[2].max).toBe(0);
    });

    it('nv 5: 4/3/2 slots nv 1/2/3', () => {
      const slots = getStartingSlots('mago', 5);
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(3);
      expect(slots[3].max).toBe(2);
      expect(slots[4].max).toBe(0);
    });

    it('nv 11: ganha slot nv 6 (BUG-004 fix)', () => {
      const slots = getStartingSlots('mago', 11);
      expect(slots[6].max).toBe(1);  // Fireball maior, Globe of Invulnerability
      expect(slots[5].max).toBe(2);
      expect(slots[4].max).toBe(3);
    });

    it('nv 17: ganha slot nv 9 (Wish, Meteor Swarm)', () => {
      const slots = getStartingSlots('mago', 17);
      expect(slots[9].max).toBe(1);
      expect(slots[8].max).toBe(1);
      expect(slots[7].max).toBe(1);
    });

    it('nv 20: máxima distribuição PHB', () => {
      const slots = getStartingSlots('mago', 20);
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(3);
      expect(slots[3].max).toBe(3);
      expect(slots[4].max).toBe(3);
      expect(slots[5].max).toBe(3);
      expect(slots[6].max).toBe(2);
      expect(slots[7].max).toBe(2);
      expect(slots[8].max).toBe(1);
      expect(slots[9].max).toBe(1);
    });

    it('todas as 5 classes full caster usam mesma tabela', () => {
      const classes = ['mago', 'clerigo', 'druida', 'bardo', 'feiticeiro'] as const;
      for (const c of classes) {
        const slots = getStartingSlots(c, 11);
        expect(slots[6].max).toBe(1);  // Todas têm slot 6 no nv 11
        expect(slots[5].max).toBe(2);
      }
    });
  });

  describe('Half casters (Paladino, Patrulheiro)', () => {
    it('nv 1: sem slots (começa nv 2)', () => {
      const slots = getStartingSlots('paladino', 1);
      expect(slots[1].max).toBe(0);
    });

    it('nv 5: 4/2 slots nv 1/2', () => {
      const slots = getStartingSlots('paladino', 5);
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(2);
      expect(slots[3].max).toBe(0);
    });

    it('nv 13: ganha slot nv 4', () => {
      const slots = getStartingSlots('paladino', 13);
      expect(slots[4].max).toBe(1);
      expect(slots[3].max).toBe(3);
    });

    it('nv 17: ganha slot nv 5 (máximo half caster)', () => {
      const slots = getStartingSlots('paladino', 17);
      expect(slots[5].max).toBe(1);
      expect(slots[6].max).toBe(0);  // Half caster NUNCA pega nv 6+
    });

    it('nv 20: máxima distribuição half caster', () => {
      const slots = getStartingSlots('patrulheiro', 20);
      expect(slots[1].max).toBe(4);
      expect(slots[2].max).toBe(3);
      expect(slots[3].max).toBe(3);
      expect(slots[4].max).toBe(3);
      expect(slots[5].max).toBe(2);
      expect(slots[6].max).toBe(0);
    });
  });

  describe('Pact Magic (Bruxo) — slots únicos no spell-level mais alto', () => {
    it('nv 1: 1 slot nv 1', () => {
      const slots = getStartingSlots('bruxo', 1);
      expect(slots[1].max).toBe(1);
      expect(slots[2].max).toBe(0);
    });

    it('nv 5: 2 slots nv 3 (só nv 3, nada nos níveis menores)', () => {
      const slots = getStartingSlots('bruxo', 5);
      expect(slots[3].max).toBe(2);
      expect(slots[2].max).toBe(0);
      expect(slots[1].max).toBe(0);
    });

    it('nv 11: 3 slots nv 5', () => {
      const slots = getStartingSlots('bruxo', 11);
      expect(slots[5].max).toBe(3);
      expect(slots[6].max).toBe(0);  // Pact magic CAP em nv 5
    });

    it('nv 17: 4 slots nv 5 (máximo bruxo)', () => {
      const slots = getStartingSlots('bruxo', 17);
      expect(slots[5].max).toBe(4);
    });

    it('isPactMagicClass identifica Bruxo', () => {
      expect(isPactMagicClass('bruxo')).toBe(true);
      expect(isPactMagicClass('mago')).toBe(false);
      expect(isPactMagicClass('paladino')).toBe(false);
    });
  });

  describe('Non-casters', () => {
    it('Bárbaro nv 20 não tem slots', () => {
      const slots = getStartingSlots('barbaro', 20);
      for (let i = 1; i <= 9; i++) {
        expect(slots[i as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9].max).toBe(0);
      }
    });

    it('isSpellcaster false pra Guerreiro/Ladino/Monge', () => {
      expect(isSpellcaster('guerreiro')).toBe(false);
      expect(isSpellcaster('ladino')).toBe(false);
      expect(isSpellcaster('monge')).toBe(false);
      expect(isSpellcaster('barbaro')).toBe(false);
    });

    it('isSpellcaster true pra todas as classes casters', () => {
      expect(isSpellcaster('mago')).toBe(true);
      expect(isSpellcaster('bruxo')).toBe(true);
      expect(isSpellcaster('paladino')).toBe(true);
      expect(isSpellcaster('patrulheiro')).toBe(true);
    });
  });

  describe('Cantrips iniciais', () => {
    it('Mago nv 1 conhece 3 cantrips', () => {
      expect(getStartingCantripCount('mago')).toBe(3);
    });
    it('Feiticeiro nv 1 conhece 4 cantrips', () => {
      expect(getStartingCantripCount('feiticeiro')).toBe(4);
    });
    it('Guerreiro nv 1 não conhece cantrips', () => {
      expect(getStartingCantripCount('guerreiro')).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('nv 0 (inválido) clampa pra nv 1', () => {
      const slots = getStartingSlots('mago', 0);
      expect(slots[1].max).toBe(2);  // Tratado como nv 1
    });

    it('nv 25 (acima cap PHB) clampa pra nv 20', () => {
      const slots = getStartingSlots('mago', 25);
      expect(slots[9].max).toBe(1);  // Mesma distribuição do nv 20
    });
  });
});

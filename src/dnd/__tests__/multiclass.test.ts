// Tests da matemática de multi-classe PHB cap 6 pág 163-165.

import { describe, it, expect } from 'vitest';
import {
  canMulticlassInto, combinedCasterLevel, getCombinedSpellSlots, effectiveLevel,
  CASTER_TYPE, MULTICLASS_PREREQ,
} from '../multiclass';

const baseAttrs = { for: 15, des: 14, con: 14, int: 12, sab: 13, car: 8 } as const;

describe('canMulticlassInto', () => {
  it('aprova quando atributos batem em ambas as classes', () => {
    // Guerreiro (FOR 13) → Mago (INT 13)
    const attrs = { ...baseAttrs, for: 15, int: 13 };
    expect(canMulticlassInto('guerreiro', 'mago', attrs).ok).toBe(true);
  });

  it('rejeita quando classe destino tem atributo insuficiente', () => {
    const attrs = { ...baseAttrs, int: 10 };
    const r = canMulticlassInto('guerreiro', 'mago', attrs);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('mago');
  });

  it('rejeita quando classe origem perdeu pré-req (PHB exige ambas)', () => {
    // PJ teoricamente Guerreiro com FOR 8 (impossível na criação mas sheet pode estar corrompido)
    const attrs = { ...baseAttrs, for: 8, des: 8, int: 16 };
    const r = canMulticlassInto('guerreiro', 'mago', attrs);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('guerreiro');
  });

  it('Guerreiro requer FOR OU DES (OR lógico)', () => {
    // Só FOR — passa
    expect(canMulticlassInto('guerreiro', 'mago', { ...baseAttrs, for: 13, des: 8, int: 13 }).ok).toBe(true);
    // Só DES — passa
    expect(canMulticlassInto('guerreiro', 'mago', { ...baseAttrs, for: 8, des: 13, int: 13 }).ok).toBe(true);
    // Nenhum dos dois — falha
    expect(canMulticlassInto('guerreiro', 'mago', { ...baseAttrs, for: 8, des: 8, int: 13 }).ok).toBe(false);
  });

  it('Paladino requer FOR E CAR (AND lógico)', () => {
    // Só FOR — falha
    expect(canMulticlassInto('mago', 'paladino', { ...baseAttrs, int: 13, for: 15, car: 8 }).ok).toBe(false);
    // Só CAR — falha
    expect(canMulticlassInto('mago', 'paladino', { ...baseAttrs, int: 13, for: 8, car: 15 }).ok).toBe(false);
    // Ambos — passa
    expect(canMulticlassInto('mago', 'paladino', { ...baseAttrs, int: 13, for: 13, car: 13 }).ok).toBe(true);
  });

  it('rejeita multi-classe na mesma classe', () => {
    const r = canMulticlassInto('mago', 'mago', { ...baseAttrs, int: 16 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('já');
  });
});

describe('combinedCasterLevel', () => {
  it('full caster sozinho = level integral', () => {
    expect(combinedCasterLevel([{ classId: 'mago', level: 5 }])).toBe(5);
  });

  it('half caster sozinho a partir do nv 2 = level/2', () => {
    expect(combinedCasterLevel([{ classId: 'paladino', level: 1 }])).toBe(0);
    expect(combinedCasterLevel([{ classId: 'paladino', level: 2 }])).toBe(1);
    expect(combinedCasterLevel([{ classId: 'paladino', level: 5 }])).toBe(2); // 5/2 = 2.5 → floor
  });

  it('full + half soma corretamente', () => {
    // Mago 4 (full) + Paladino 4 (half /2 = 2) = 6
    const lvl = combinedCasterLevel([
      { classId: 'mago', level: 4 },
      { classId: 'paladino', level: 4 },
    ]);
    expect(lvl).toBe(6);
  });

  it('classes não-casters ignoradas (Guerreiro, Bárbaro, Ladino, Monge)', () => {
    expect(combinedCasterLevel([
      { classId: 'guerreiro', level: 10 },
      { classId: 'barbaro', level: 5 },
      { classId: 'ladino', level: 3 },
    ])).toBe(0);
  });

  it('Bruxo (pact) NÃO entra na soma', () => {
    // Bruxo 5 + Mago 3 → só Mago conta (Bruxo é pact magic separado)
    expect(combinedCasterLevel([
      { classId: 'bruxo', level: 5 },
      { classId: 'mago', level: 3 },
    ])).toBe(3);
  });

  it('floor no resultado', () => {
    // Paladino 3 → 3/2 = 1.5 → 1 (level mín 2 pra contar como caster)
    expect(combinedCasterLevel([
      { classId: 'paladino', level: 3 },
    ])).toBe(1);
  });
});

describe('getCombinedSpellSlots', () => {
  it('Mago 5 sozinho → tabela full caster nv 5', () => {
    const slots = getCombinedSpellSlots([{ classId: 'mago', level: 5 }]);
    expect(slots[1]).toBe(4);
    expect(slots[2]).toBe(3);
    expect(slots[3]).toBe(2);
    expect(slots[4]).toBe(0);
  });

  it('Mago 3 + Paladino 4 → caster level 5 (3+2)', () => {
    const slots = getCombinedSpellSlots([
      { classId: 'mago', level: 3 },
      { classId: 'paladino', level: 4 },
    ]);
    expect(slots[1]).toBe(4);
    expect(slots[2]).toBe(3);
    expect(slots[3]).toBe(2);
  });

  it('apenas non-casters → tudo zero', () => {
    const slots = getCombinedSpellSlots([
      { classId: 'guerreiro', level: 5 },
      { classId: 'ladino', level: 3 },
    ]);
    expect(slots[1]).toBe(0);
    expect(slots[9]).toBe(0);
  });

  it('caster level 20 → slots máximos', () => {
    const slots = getCombinedSpellSlots([
      { classId: 'mago', level: 10 },
      { classId: 'clerigo', level: 10 },
    ]);
    expect(slots[1]).toBe(4);
    expect(slots[6]).toBe(2);
    expect(slots[9]).toBe(1);
  });

  it('cap em 20 (caster level superior fica clamped)', () => {
    const slots = getCombinedSpellSlots([
      { classId: 'mago', level: 18 },
      { classId: 'clerigo', level: 18 },
    ]);
    // Cap em 20 mesmo com soma 36
    expect(slots[9]).toBe(1);
  });
});

describe('effectiveLevel', () => {
  it('soma todos os níveis', () => {
    expect(effectiveLevel([
      { classId: 'guerreiro', level: 3 },
      { classId: 'mago', level: 2 },
      { classId: 'ladino', level: 1 },
    ])).toBe(6);
  });
});

describe('Configuration sanity', () => {
  it('todas as classes têm CASTER_TYPE definido', () => {
    const allClasses = ['barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guerreiro', 'ladino', 'mago', 'monge', 'paladino', 'patrulheiro'] as const;
    for (const c of allClasses) {
      expect(CASTER_TYPE[c]).toBeDefined();
    }
  });

  it('todas as classes têm MULTICLASS_PREREQ', () => {
    const allClasses = ['barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guerreiro', 'ladino', 'mago', 'monge', 'paladino', 'patrulheiro'] as const;
    for (const c of allClasses) {
      expect(MULTICLASS_PREREQ[c]).toBeDefined();
      expect(MULTICLASS_PREREQ[c].length).toBeGreaterThan(0);
    }
  });
});

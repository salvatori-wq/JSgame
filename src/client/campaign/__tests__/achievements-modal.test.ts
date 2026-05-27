// β.2 — Tests helpers puros do achievements-modal + summarizeProgress.

import { describe, it, expect } from 'vitest';
import { formatDate, tierLabel } from '../achievements-modal';
import { ACHIEVEMENTS, summarizeProgress, CATEGORY_LABELS } from '../../../dnd/achievements';

describe('β.2 — formatDate', () => {
  it('formata timestamp pt-BR', () => {
    // Apenas garante que retorna string não-vazia (formato exato varia por locale)
    const ts = new Date('2026-03-15T12:00:00Z').getTime();
    const out = formatDate(ts);
    expect(out.length).toBeGreaterThan(0);
  });

  it('lida com timestamp inválido gracefully', () => {
    expect(formatDate(NaN)).toBe('');
  });
});

describe('β.2 — tierLabel', () => {
  it('retorna label PT-BR pra cada tier', () => {
    expect(tierLabel('bronze')).toContain('BRONZE');
    expect(tierLabel('silver')).toContain('PRATA');
    expect(tierLabel('gold')).toContain('OURO');
    expect(tierLabel('platinum')).toContain('PLATINA');
  });
});

describe('β.2 — summarizeProgress', () => {
  it('zero unlocked retorna stats vazias por tier', () => {
    const s = summarizeProgress(new Set());
    expect(s.unlocked).toBe(0);
    expect(s.total).toBe(ACHIEVEMENTS.length);
    expect(s.pctByTier.bronze.unlocked).toBe(0);
    expect(s.pctByTier.bronze.total).toBeGreaterThan(0);
  });

  it('conta unlocks por tier corretamente', () => {
    const unlocked = new Set(['first_session', 'first_combat', 'level_five']);
    const s = summarizeProgress(unlocked);
    expect(s.unlocked).toBe(3);
    expect(s.pctByTier.bronze.unlocked).toBe(2);
    expect(s.pctByTier.silver.unlocked).toBe(1);
    expect(s.pctByTier.gold.unlocked).toBe(0);
    expect(s.pctByTier.platinum.unlocked).toBe(0);
  });

  it('all unlocked: unlocked === total', () => {
    const unlocked = new Set(ACHIEVEMENTS.map((a) => a.id));
    const s = summarizeProgress(unlocked);
    expect(s.unlocked).toBe(s.total);
  });
});

describe('β.2 — CATEGORY_LABELS', () => {
  it('todos os categories tem label', () => {
    expect(CATEGORY_LABELS.combat).toBeTruthy();
    expect(CATEGORY_LABELS.exploration).toBeTruthy();
    expect(CATEGORY_LABELS.social).toBeTruthy();
    expect(CATEGORY_LABELS.progress).toBeTruthy();
    expect(CATEGORY_LABELS.meta).toBeTruthy();
  });
});

describe('β.2 — achievements catalog tem category', () => {
  it('todos os 30+ achievements tem category', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.category).toBeTruthy();
      expect(['combat', 'exploration', 'social', 'progress', 'meta']).toContain(a.category);
    }
  });
});

// @vitest-environment happy-dom
// T3.3 — Tests do long rest ritual visual.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  playLongRestRitual,
  LONG_REST_RITUAL_SEQUENCE,
  LONG_REST_RITUAL_TOTAL_MS,
} from '../long-rest-ritual';

describe('T3.3 — long rest ritual sequence config', () => {
  it('tem 3 steps (noite, descanso, amanhecer)', () => {
    expect(LONG_REST_RITUAL_SEQUENCE.length).toBe(3);
  });

  it('ordem narrativa: 🌙 → ⭐ → ☀', () => {
    expect(LONG_REST_RITUAL_SEQUENCE[0]!.icon).toBe('🌙');
    expect(LONG_REST_RITUAL_SEQUENCE[1]!.icon).toBe('⭐');
    expect(LONG_REST_RITUAL_SEQUENCE[2]!.icon).toBe('☀');
  });

  it('labels PT-BR (Henrique família)', () => {
    expect(LONG_REST_RITUAL_SEQUENCE[0]!.label).toContain('noite');
    expect(LONG_REST_RITUAL_SEQUENCE[2]!.label).toContain('Amanhece');
  });

  it('total < 2.5s (não pode entediar)', () => {
    expect(LONG_REST_RITUAL_TOTAL_MS).toBeLessThan(2500);
  });
});

describe('T3.3 — playLongRestRitual behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('em reduced-motion: chama callback imediato sem overlay', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const cb = vi.fn();
    playLongRestRitual(cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(document.querySelector('.lrr-overlay')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('sem reduced-motion: monta overlay e dispara callback após sequência', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const cb = vi.fn();
    playLongRestRitual(cb);
    // Overlay deve estar montado imediatamente
    expect(document.querySelector('.lrr-overlay')).toBeTruthy();
    // Antes do total — callback NÃO disparou ainda
    expect(cb).not.toHaveBeenCalled();
    // Avança o total + fade out
    vi.advanceTimersByTime(LONG_REST_RITUAL_TOTAL_MS + 500);
    expect(cb).toHaveBeenCalledOnce();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // V.3.c — Antes ignorava `force-motion` (toggle UX Settings Ω.1). Agora
  // honra: reduced-motion OS + force-motion ON = mostra overlay (não pula).
  it('V.3.c — force-motion ON com reduced-motion OS: AINDA mostra overlay', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    document.body.classList.add('force-motion');
    const cb = vi.fn();
    playLongRestRitual(cb);
    // Overlay aparece (force-motion sobrescreve reduced-motion)
    expect(document.querySelector('.lrr-overlay')).toBeTruthy();
    expect(cb).not.toHaveBeenCalled();
    document.body.classList.remove('force-motion');
    vi.unstubAllGlobals();
    // cleanup do overlay
    document.querySelector('.lrr-overlay')?.remove();
  });
});

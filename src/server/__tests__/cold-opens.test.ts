// F1 — Tests pros cold opens background-aware.

import { describe, it, expect } from 'vitest';
import { getColdOpen, listCoveredBackgrounds, pickFallbackLocation } from '../cold-opens';
import type { BackgroundId } from '../../shared/types';

describe('cold opens', () => {
  it('retorna narration não-vazia pra cada background', () => {
    const backgrounds: BackgroundId[] = [
      'acolito', 'artesao', 'artista', 'charlatao', 'criminoso',
      'eremita', 'forasteiro', 'herois-do-povo', 'marinheiro', 'nobre',
      'orfao', 'sabio', 'soldado',
    ];
    for (const b of backgrounds) {
      const co = getColdOpen(b, 'Borin');
      expect(co.narration.length).toBeGreaterThan(50);
      expect(co.speaker).toBe('Mestre');
    }
  });

  it('substitui {name} pelo nome do PJ', () => {
    const co = getColdOpen('soldado', 'Borin');
    expect(co.narration).toContain('Borin');
    expect(co.narration).not.toContain('{name}');
  });

  it('substitui {name} multiple vezes', () => {
    const co = getColdOpen('charlatao', 'Sina');
    expect(co.narration).toContain('Sina');
    expect(co.narration).not.toContain('{name}');
  });

  it('cada cold open tem pendingCheck com skill+dc+reason válidos', () => {
    const backgrounds: BackgroundId[] = [
      'soldado', 'sabio', 'charlatao', 'criminoso',
      'acolito', 'artesao', 'artista', 'eremita',
      'forasteiro', 'herois-do-povo', 'marinheiro', 'nobre', 'orfao',
    ];
    for (const b of backgrounds) {
      const co = getColdOpen(b, 'Test');
      expect(co.pendingCheck.skill).toBeTruthy();
      expect(co.pendingCheck.dc).toBeGreaterThanOrEqual(10);
      expect(co.pendingCheck.dc).toBeLessThanOrEqual(20);
      expect(co.pendingCheck.reason.length).toBeGreaterThan(10);
    }
  });

  it('soldado dispara emboscada (Percepção)', () => {
    const co = getColdOpen('soldado', 'Borin');
    expect(co.pendingCheck.skill).toBe('percepcao');
    expect(co.pendingCheck.dc).toBe(12);
    expect(co.narration.toLowerCase()).toMatch(/emboscada|encapuzad|figura|barr/);
  });

  it('sabio dispara decifração (Arcanismo)', () => {
    const co = getColdOpen('sabio', 'Lyra');
    expect(co.pendingCheck.skill).toBe('arcanismo');
    expect(co.narration.toLowerCase()).toMatch(/cela|prisão|pergaminho|runas/);
  });

  it('charlatao dispara engano (Enganação DC 14)', () => {
    const co = getColdOpen('charlatao', 'Sina');
    expect(co.pendingCheck.skill).toBe('enganacao');
    expect(co.pendingCheck.dc).toBe(14);
  });

  it('cada cold open tem mood definido', () => {
    const validMoods = ['sombrio', 'sarcastico', 'trickster', 'neutral'];
    const backgrounds: BackgroundId[] = ['soldado', 'sabio', 'charlatao', 'nobre', 'artista'];
    for (const b of backgrounds) {
      const co = getColdOpen(b, 'Test');
      expect(validMoods).toContain(co.mood);
    }
  });

  it('listCoveredBackgrounds retorna 13 (todos os backgrounds)', () => {
    const list = listCoveredBackgrounds();
    expect(list.length).toBe(13);
  });

  it('background inválido cai no fallback genérico', () => {
    const co = getColdOpen('inexistente' as BackgroundId, 'Test');
    expect(co.narration).toContain('Test');
    expect(co.narration.length).toBeGreaterThan(20);
  });

  it('narration tem tensão real (não "você está numa taverna")', () => {
    // Spot check: cold opens devem ter palavras-chave de tensão
    const co = getColdOpen('soldado', 'X');
    expect(co.narration.toLowerCase()).not.toMatch(/taverna|hospedaria/);
  });

  it('pendingCheck reason é frase humana legível', () => {
    const co = getColdOpen('marinheiro', 'X');
    expect(co.pendingCheck.reason.charAt(0).toLowerCase()).not.toBe(co.pendingCheck.reason.charAt(0));
    // Começa com letra maiúscula (humano-readable)
  });

  describe('Cenas com peso — locationLabel + fallback', () => {
    it('cada cold open tem locationLabel não-vazio (anti-arrastar pra taverna)', () => {
      const backgrounds: BackgroundId[] = [
        'soldado', 'sabio', 'charlatao', 'criminoso',
        'acolito', 'artesao', 'artista', 'eremita',
        'forasteiro', 'herois-do-povo', 'marinheiro', 'nobre', 'orfao',
      ];
      for (const b of backgrounds) {
        const co = getColdOpen(b, 'Test');
        expect(co.locationLabel.length).toBeGreaterThan(5);
        // Nunca contém "taverna" — esse era o bug
        expect(co.locationLabel.toLowerCase()).not.toContain('taverna');
      }
    });

    it('locationLabel é descritivo (não só categoria)', () => {
      const co = getColdOpen('soldado', 'X');
      expect(co.locationLabel.toLowerCase()).toMatch(/estrada|chuva|caminho/);
    });

    it('pickFallbackLocation retorna location válida', () => {
      const loc = pickFallbackLocation(123);
      expect(loc.length).toBeGreaterThan(10);
      expect(loc.toLowerCase()).not.toContain('taverna');
    });

    it('pickFallbackLocation determinístico por seed', () => {
      const l1 = pickFallbackLocation(42);
      const l2 = pickFallbackLocation(42);
      expect(l1).toBe(l2);
    });

    it('pickFallbackLocation dá variedade entre seeds', () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const locs = new Set(seeds.map((s) => pickFallbackLocation(s)));
      // Espera pelo menos 5 diferentes em 12 seeds
      expect(locs.size).toBeGreaterThanOrEqual(5);
    });
  });
});

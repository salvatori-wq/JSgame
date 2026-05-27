// κ.2 — Tests Glossary D&D.

import { describe, it, expect } from 'vitest';
import { GLOSSARY, searchGlossary, findGlossaryEntry, GLOSSARY_CATEGORIES } from '../glossary';

describe('Glossary κ.2', () => {
  it('tem 30+ entries', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
  });

  it('todas têm term + description + category', () => {
    for (const e of GLOSSARY) {
      expect(e.term).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.category).toBeTruthy();
    }
  });

  it('todas categorias mapeadas em GLOSSARY_CATEGORIES', () => {
    for (const e of GLOSSARY) {
      expect(GLOSSARY_CATEGORIES[e.category]).toBeDefined();
    }
  });

  it('searchGlossary "" retorna tudo', () => {
    expect(searchGlossary('').length).toBe(GLOSSARY.length);
  });

  it('searchGlossary "DC" encontra termo principal', () => {
    const results = searchGlossary('DC');
    expect(results.some((r) => r.term === 'DC')).toBe(true);
  });

  it('searchGlossary alias "advantage" encontra "Vantagem"', () => {
    const results = searchGlossary('advantage');
    expect(results.some((r) => r.term === 'Vantagem')).toBe(true);
  });

  it('searchGlossary case-insensitive', () => {
    const lower = searchGlossary('dc');
    const upper = searchGlossary('DC');
    expect(lower.length).toBeGreaterThan(0);
    expect(lower.length).toBe(upper.length);
  });

  it('findGlossaryEntry exato', () => {
    const e = findGlossaryEntry('DC');
    expect(e?.term).toBe('DC');
  });

  it('findGlossaryEntry por alias', () => {
    const e = findGlossaryEntry('classe de dificuldade');
    expect(e?.term).toBe('DC');
  });

  it('findGlossaryEntry retorna undefined pra inexistente', () => {
    expect(findGlossaryEntry('xxxinventado')).toBeUndefined();
  });

  it('cobre conceitos básicos D&D 5e', () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(terms).toContain('DC');
    expect(terms).toContain('AC');
    expect(terms).toContain('Nat 20');
    expect(terms).toContain('Vantagem');
    expect(terms).toContain('Cantrip');
    expect(terms).toContain('Slot');
    expect(terms).toContain('Initiative');
    expect(terms).toContain('Save Throw');
    expect(terms).toContain('Death Save');
    expect(terms).toContain('Hit Dice');
  });
});

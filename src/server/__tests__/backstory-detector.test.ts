// F4 — Tests pro detectBackstoryUsage.

import { describe, it, expect } from 'vitest';
import { detectBackstoryUsage } from '../backstory-detector';
import type { ActiveCharacterProfile } from '../dm/prompts';

const BORIN_PROFILE: ActiveCharacterProfile = {
  name: 'Borin',
  race: 'Anão da Montanha',
  class: 'Guerreiro',
  background: 'Soldado',
  trait: 'Carrega marcas de cada inimigo que matou. Mostra com orgulho.',
  ideal: 'Lealdade. Honro quem me honra, esmago quem trai.',
  bond: 'Meu pelotão foi morto na Campanha do Vale Negro. Vingo cada um.',
  flaw: 'Tenho medo de magia que não entendo. Reajo agredindo.',
};

describe('detectBackstoryUsage', () => {
  it('detecta trait quando palavra significativa aparece', () => {
    const r = detectBackstoryUsage('Suas cicatrizes brilham na luz do fogo.', BORIN_PROFILE);
    // "cicatrizes" não está no trait, mas "marcas" sim — texto não casa
    expect(r.traitMentioned).toBe(false);
  });

  it('detecta trait via palavra-chave do próprio trait', () => {
    const r = detectBackstoryUsage('Você mostra as marcas com orgulho.', BORIN_PROFILE);
    expect(r.traitMentioned).toBe(true);
  });

  it('detecta ideal via palavra-chave', () => {
    const r = detectBackstoryUsage('Sua lealdade é testada novamente.', BORIN_PROFILE);
    expect(r.idealMentioned).toBe(true);
  });

  it('detecta bond via palavra-chave (pelotão, Vale Negro, vingar)', () => {
    const r = detectBackstoryUsage('Lembre do pelotão. Vingança vem.', BORIN_PROFILE);
    expect(r.bondMentioned).toBe(true);
  });

  it('detecta flaw via palavra-chave (magia)', () => {
    const r = detectBackstoryUsage('A magia faísca à sua frente. Você sente medo.', BORIN_PROFILE);
    expect(r.flawMentioned).toBe(true);
  });

  it('flags são independentes', () => {
    const r = detectBackstoryUsage('Sua lealdade arde — pelotão te lembra.', BORIN_PROFILE);
    expect(r.idealMentioned).toBe(true);
    expect(r.bondMentioned).toBe(true);
    expect(r.flawMentioned).toBe(false);
  });

  it('total agrega as 4 flags', () => {
    const r = detectBackstoryUsage('Lealdade. Pelotão. Magia desce. Marcas brilham.', BORIN_PROFILE);
    expect(r.total).toBe(4);
  });

  it('narração sem mention retorna total=0', () => {
    const r = detectBackstoryUsage('A taverna está vazia. Ninguém olha.', BORIN_PROFILE);
    expect(r.total).toBe(0);
  });

  it('profile sem traits retorna 0 (não throw)', () => {
    const empty: ActiveCharacterProfile = {
      name: 'X', race: 'X', class: 'X', background: 'X',
    };
    const r = detectBackstoryUsage('qualquer texto', empty);
    expect(r.total).toBe(0);
    expect(r.traitMentioned).toBe(false);
  });

  it('case-insensitive: "LEALDADE" casa', () => {
    const r = detectBackstoryUsage('LEALDADE acima de tudo!', BORIN_PROFILE);
    expect(r.idealMentioned).toBe(true);
  });

  it('word-boundary: "honrosamente" não casa "honro"', () => {
    const r = detectBackstoryUsage('Você procede honrosamente.', BORIN_PROFILE);
    // "honro" como verbo de 5 letras do ideal — não casa em "honrosamente"
    // (a palavra significativa pode ser outra)
    // O importante: não bater "lealdade" só por "honro"
    // Se palavras de "lealdade honro" não bater "honrosamente", flag deveria ser false
    // Mas "honrosamente" começa com "honro" — word-boundary vai falhar (não há \b entre 'honro' e 'samente')
    // Então deveria ser false
    expect(r.idealMentioned).toBe(false);
  });

  it('escape regex chars em palavras (sem throw)', () => {
    const profile: ActiveCharacterProfile = {
      name: 'X', race: 'X', class: 'X', background: 'X',
      trait: 'Dr. Vex. é o vilão.',
    };
    expect(() => detectBackstoryUsage('texto qualquer', profile)).not.toThrow();
  });
});

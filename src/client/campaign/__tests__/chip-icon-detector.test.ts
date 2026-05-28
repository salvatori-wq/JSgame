// M2.1 — Tests pro detector de ícone de ação na chip label.
// Função pura — sem dep DOM. Cobre os padrões PT-BR principais.

import { describe, it, expect } from 'vitest';
import { detectChipIcon, listChipIconPatterns } from '../chip-icon-detector';

describe('M2.1 — detectChipIcon', () => {
  it('detecta verbo Falar → 🗣', () => {
    expect(detectChipIcon('Falar com Borin')).toBe('🗣');
    expect(detectChipIcon('Conversar com o NPC')).toBe('🗣');
    expect(detectChipIcon('Perguntar ao taverneiro')).toBe('🗣');
  });

  it('detecta verbo Atacar → ⚔', () => {
    expect(detectChipIcon('Atacar o goblin')).toBe('⚔');
    expect(detectChipIcon('Golpear com martelo')).toBe('⚔');
  });

  it('detecta verbo Seguir / Continuar / Avançar → 🚶', () => {
    expect(detectChipIcon('Seguir em frente')).toBe('🚶');
    expect(detectChipIcon('Continuar pela trilha')).toBe('🚶');
    expect(detectChipIcon('Avançar com cuidado')).toBe('🚶');
    expect(detectChipIcon('Andar até a torre')).toBe('🚶');
  });

  it('detecta verbo Fugir → 🏃', () => {
    expect(detectChipIcon('Fugir pela floresta')).toBe('🏃');
    expect(detectChipIcon('Recuar pra taverna')).toBe('🏃');
    expect(detectChipIcon('Escapar pela janela')).toBe('🏃');
  });

  it('detecta verbo Conjurar → 🔮', () => {
    expect(detectChipIcon('Conjurar Magic Missile')).toBe('🔮');
    expect(detectChipIcon('Lançar magia em área')).toBe('🔮');
    expect(detectChipIcon('Invocar familiar')).toBe('🔮');
  });

  it('detecta verbo Esconder → 🥷', () => {
    expect(detectChipIcon('Esconder atrás do barril')).toBe('🥷');
    expect(detectChipIcon('Furtar-se pela sombra')).toBe('🥷');
  });

  it('detecta verbo Pegar / Agarrar → ✋', () => {
    expect(detectChipIcon('Pegar o medalhão')).toBe('✋');
    expect(detectChipIcon('Agarrar a corda')).toBe('✋');
    expect(detectChipIcon('Recolher pedaços')).toBe('✋');
  });

  it('detecta verbo Abrir / Destrancar → 🔓', () => {
    expect(detectChipIcon('Abrir o baú')).toBe('🔓');
    expect(detectChipIcon('Destrancar a porta')).toBe('🔓');
  });

  it('detecta verbo Ler / Decifrar → 📖', () => {
    expect(detectChipIcon('Ler o pergaminho')).toBe('📖');
    expect(detectChipIcon('Decifrar a runa')).toBe('📖');
  });

  it('detecta verbo Subir / Escalar → 🧗', () => {
    expect(detectChipIcon('Subir a muralha')).toBe('🧗');
    expect(detectChipIcon('Escalar o penhasco')).toBe('🧗');
  });

  it('detecta verbo Comprar / Negociar → 💰', () => {
    expect(detectChipIcon('Comprar poção')).toBe('💰');
    expect(detectChipIcon('Negociar preço')).toBe('💰');
    expect(detectChipIcon('Barganhar pela espada')).toBe('💰');
  });

  it('retorna null pra labels sem verbo conhecido', () => {
    expect(detectChipIcon('Hmm interessante')).toBeNull();
    expect(detectChipIcon('aquela coisa lá')).toBeNull();
    expect(detectChipIcon('???')).toBeNull();
  });

  it('case-insensitive', () => {
    expect(detectChipIcon('FALAR COM NPC')).toBe('🗣');
    expect(detectChipIcon('falar com npc')).toBe('🗣');
    expect(detectChipIcon('FaLaR com Npc')).toBe('🗣');
  });

  it('só matcha no início da label (boundary)', () => {
    // "ele fala com..." não começa com verbo "falar" então não match
    expect(detectChipIcon('ele fala com o npc')).toBeNull();
  });

  it('retorna null pra label vazia', () => {
    expect(detectChipIcon('')).toBeNull();
    expect(detectChipIcon('   ')).toBeNull();
  });

  it('trim antes de matchar (espaço inicial não atrapalha)', () => {
    expect(detectChipIcon('  Falar com NPC')).toBe('🗣');
  });

  it('lista patterns expõe pelo menos 15 padrões cobertos', () => {
    const all = listChipIconPatterns();
    expect(all.length).toBeGreaterThanOrEqual(15);
    // sanity: todos têm icon não-vazio
    for (const p of all) {
      expect(p.icon.length).toBeGreaterThan(0);
    }
  });
});

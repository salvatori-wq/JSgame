// U.2 — Tests do explorationActionLabel.
// Bug original (playtest 2026-05-29): player echo aparecia como "attack"
// literal no log de narração — jargão dev visível pro jogador. Agora mapeado
// pra "⚔ Atacar" PT-BR com ícone consistente com action-dock-topics.

import { describe, it, expect } from 'vitest';
import { explorationActionLabel } from '../sockets/connection';

describe('U.2 — explorationActionLabel', () => {
  it('attack → "⚔ Atacar"', () => {
    expect(explorationActionLabel('attack')).toBe('⚔ Atacar');
  });

  it('explore → "🔍 Explorar"', () => {
    expect(explorationActionLabel('explore')).toBe('🔍 Explorar');
  });

  it('investigate → "🔎 Investigar"', () => {
    expect(explorationActionLabel('investigate')).toBe('🔎 Investigar');
  });

  it('sneak → "🥷 Furtar-se"', () => {
    expect(explorationActionLabel('sneak')).toBe('🥷 Furtar-se');
  });

  it('travel → "🚶 Viajar"', () => {
    expect(explorationActionLabel('travel')).toBe('🚶 Viajar');
  });

  it('talk → "🗣 Falar"', () => {
    expect(explorationActionLabel('talk')).toBe('🗣 Falar');
  });

  it('rest-short → "🛌 Descanso Curto"', () => {
    expect(explorationActionLabel('rest-short')).toBe('🛌 Descanso Curto');
  });

  it('rest-long → "🏕 Descanso Longo"', () => {
    expect(explorationActionLabel('rest-long')).toBe('🏕 Descanso Longo');
  });

  it('use-item → "🧪 Usar Item"', () => {
    expect(explorationActionLabel('use-item')).toBe('🧪 Usar Item');
  });

  it('cast-spell → "🔮 Lançar Magia"', () => {
    expect(explorationActionLabel('cast-spell')).toBe('🔮 Lançar Magia');
  });

  it('action desconhecida cai no fallback raw (defensivo)', () => {
    expect(explorationActionLabel('custom-unknown-action')).toBe('custom-unknown-action');
  });

  it('cobre TODAS ExplorationAction declaradas em types.ts (10 actions)', () => {
    const all = ['explore', 'investigate', 'sneak', 'talk', 'attack',
                 'rest-short', 'rest-long', 'travel', 'use-item', 'cast-spell'];
    for (const a of all) {
      const label = explorationActionLabel(a);
      // Mapeada (com ícone emoji) — NÃO retorna raw
      expect(label).not.toBe(a);
      // Tem ícone unicode (não-ASCII)
      expect(label).toMatch(/[^\x00-\x7F]/);
    }
  });
});

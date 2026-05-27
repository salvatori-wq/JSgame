// Fallback de chips suggested_actions — tests pra garantir chips sempre visíveis.
// 100% pure function que recebe CampaignState → SuggestedAction[]. Sem I/O.

import { describe, it, expect } from 'vitest';
import { generateFallbackChips } from '../dm/suggest-fallback';
import type { CampaignState, EnemySnapshot } from '../../shared/types';

function makeState(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    id: 'test',
    name: 'Test',
    sessionNumber: 1,
    mode: 'exploration',
    currentLocation: 'Test Location',
    party: [],
    suggestedActions: [],
    lastPlayedAt: Date.now(),
    ...overrides,
  } as CampaignState;
}

function makeEnemy(overrides: Partial<EnemySnapshot> = {}): EnemySnapshot {
  return {
    id: 'e1',
    name: 'Goblin',
    maxHp: 10,
    currentHp: 10,
    armorClass: 13,
    attackBonus: 3,
    damageDice: '1d6',
    damageBonus: 1,
    initiative: 12,
    conditions: [],
    description: '',
    isBoss: false,
    xpAward: 50,
    ...overrides,
  };
}

describe('generateFallbackChips', () => {
  it('retorna [] quando state.suggestedActions já tem chips (não sobrescreve DM)', () => {
    const state = makeState({
      suggestedActions: [
        { label: 'Already there', action: 'explore', details: 'do thing' },
      ],
    });
    expect(generateFallbackChips(state)).toEqual([]);
  });

  it('retorna [] quando openShop ativo (modal cobre)', () => {
    const state = makeState({
      openShop: { id: 's', npcName: 'Vendor', shopType: 'general', acceptsSell: true, items: [], openedAt: Date.now() },
    } as Partial<CampaignState>);
    expect(generateFallbackChips(state)).toEqual([]);
  });

  it('exploration: retorna 4 chips genéricos (observar/investigar/seguir/falar)', () => {
    const state = makeState();
    const chips = generateFallbackChips(state);
    expect(chips.length).toBe(4);
    // Set genéricos novo (smart fallback): Observar/Seguir/Investigar/Sneak
    const actions = chips.map((c) => c.action).sort();
    expect(actions).toEqual(['explore', 'explore', 'investigate', 'sneak']);
    // Cada chip tem label + details preenchidos
    for (const c of chips) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.details.length).toBeGreaterThan(0);
    }
  });

  it('exploration chips incluem hint (Percepção/Investigação)', () => {
    const chips = generateFallbackChips(makeState());
    const hints = chips.map((c) => c.hint).filter(Boolean);
    expect(hints).toContain('Percepção');
    expect(hints).toContain('Investigação');
  });

  it('combat ativo: retorna chip por inimigo (até 2) + Aproximar + Esquivar', () => {
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 1,
        initiativeOrder: [],
        currentTurnIndex: 0,
        log: [],
        enemies: [
          makeEnemy({ id: 'e1', name: 'Goblin Sarnento' }),
          makeEnemy({ id: 'e2', name: 'Orc Veterano', currentHp: 25 }),
          makeEnemy({ id: 'e3', name: 'Kobold Sneak', currentHp: 4 }),
        ],

      },
    } as Partial<CampaignState>);
    const chips = generateFallbackChips(state);
    // Top 2 attacks (mais HP primeiro: Orc 25 > Goblin 10), + Aproximar(target=Orc) + Esquivar
    expect(chips.length).toBe(4);
    expect(chips[0]!.label).toBe('Atacar Orc Veterano');
    expect(chips[1]!.label).toBe('Atacar Goblin Sarnento');
    expect(chips[2]!.label).toBe('Aproximar de Orc Veterano');
    expect(chips[3]!.label).toBe('Esquivar e observar');
  });

  it('combat com boss: prioriza boss no topo + marca hint "Chefe"', () => {
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 2,
        initiativeOrder: [],
        currentTurnIndex: 0,
        log: [],
        enemies: [
          makeEnemy({ id: 'minion', name: 'Esqueleto', currentHp: 6 }),
          makeEnemy({ id: 'boss', name: 'Lich Soberano', currentHp: 80, isBoss: true }),
        ],

      },
    } as Partial<CampaignState>);
    const chips = generateFallbackChips(state);
    expect(chips[0]!.label).toBe('Atacar Lich Soberano');
    expect(chips[0]!.hint).toBe('Chefe');
    expect(chips[1]!.label).toBe('Atacar Esqueleto');
    expect(chips[1]!.hint).toBeUndefined();
  });

  it('combat: ignora inimigos mortos (currentHp <= 0)', () => {
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 1,
        initiativeOrder: [],
        currentTurnIndex: 0,
        log: [],
        enemies: [
          makeEnemy({ id: 'e1', name: 'Vivo', currentHp: 5 }),
          makeEnemy({ id: 'e2', name: 'Morto', currentHp: 0 }),
        ],

      },
    } as Partial<CampaignState>);
    const chips = generateFallbackChips(state);
    const labels = chips.map((c) => c.label).join(' | ');
    expect(labels).toContain('Vivo');
    expect(labels).not.toContain('Morto');
  });

  it('combat sem inimigos vivos: só retorna Esquivar (defensiva)', () => {
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 5,
        initiativeOrder: [],
        currentTurnIndex: 0,
        enemies: [makeEnemy({ id: 'e1', currentHp: 0 })],
        log: [],
      },
    } as Partial<CampaignState>);
    const chips = generateFallbackChips(state);
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(chips.some((c) => c.label.includes('Esquivar'))).toBe(true);
  });

  describe('Cenas com peso — smart contextual chips (parsing narração)', () => {
    it('exploration com narração extrai NPC → chip "Falar com [npc]"', () => {
      const state = makeState();
      const narration = 'O guarda na porta acena pra você. O taverneiro afasta os copos.';
      const chips = generateFallbackChips(state, narration);
      const labels = chips.map((c) => c.label.toLowerCase()).join(' | ');
      expect(labels).toMatch(/falar com.*(guarda|taverneiro)/);
    });

    it('exploration com narração extrai landmark → chip "Investigar [landmark]"', () => {
      const state = makeState();
      const narration = 'No baú dourado, um pergaminho selado. A porta secreta atrás.';
      const chips = generateFallbackChips(state, narration);
      const labels = chips.map((c) => c.label.toLowerCase()).join(' | ');
      expect(labels).toMatch(/investigar (bau|porta|pergaminho)/);
    });

    it('exploration completa com genéricos se narração não tem entidades', () => {
      const state = makeState();
      const chips = generateFallbackChips(state, 'Vento. Frio. Nada se mexe.');
      expect(chips.length).toBe(4);
      expect(chips.some((c) => c.label === 'Observar arredores')).toBe(true);
    });

    it('exploration sem narração mantém comportamento antigo (4 genéricos)', () => {
      const state = makeState();
      const chips = generateFallbackChips(state); // undefined lastNarration
      expect(chips.length).toBe(4);
    });

    it('mistura: NPC + landmark + 2 genéricos = 4 chips totais', () => {
      const state = makeState();
      const narration = 'O guarda observa. Uma porta atrás dele.';
      const chips = generateFallbackChips(state, narration);
      expect(chips.length).toBe(4);
      const labels = chips.map((c) => c.label).join(' | ');
      expect(labels).toContain('guarda');
      expect(labels).toContain('porta');
    });
  });

  it('cap em 4 chips no máximo (UI não explode)', () => {
    const state = makeState({
      mode: 'combat',
      combat: {
        active: true,
        round: 1,
        initiativeOrder: [],
        currentTurnIndex: 0,
        enemies: Array.from({ length: 10 }, (_, i) => makeEnemy({ id: `e${i}`, name: `Inimigo${i}` })),
        log: [],
      },
    } as Partial<CampaignState>);
    const chips = generateFallbackChips(state);
    expect(chips.length).toBeLessThanOrEqual(4);
  });
});

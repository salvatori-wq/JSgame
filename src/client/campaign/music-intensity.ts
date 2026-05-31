// Onda 5 — Intensidade musical adaptativa a partir do estado do jogo (puro).
// Um único float [0,1] que o campaign-screen empurra pro ambient (setAmbientIntensity)
// a cada campaignState. Combate escala por boss/nº de inimigos/HP do PJ; fora de
// combate, perigo (HP baixo) e descanso ajustam a cama. Função pura → testável.

import type { CampaignState, CharacterSheet } from '../../shared/types';

/** Fração de HP do PJ [0,1], ou null se desconhecida. */
function playerHpFraction(character: CharacterSheet | null): number | null {
  if (!character || character.maxHp <= 0) return null;
  return Math.max(0, Math.min(1, character.currentHp / character.maxHp));
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Intensidade musical [0,1] derivada do estado.
 *  - Combate: base 0.55 (skirmish) / 0.78 (boss), +0.05 por inimigo vivo extra
 *    (até +0.15), e HP baixo do PJ empurra pro auge (clímax dramático).
 *  - Loja: 0.4 (jovial). Perigo fora de combate (HP < 25%): 0.5. Descanso: 0.12.
 *  - Exploração: 0.3 (cama que respira).
 */
export function computeIntensity(state: CampaignState, character: CharacterSheet | null): number {
  const hp = playerHpFraction(character);

  if (state.combat?.active) {
    const alive = (state.combat.enemies ?? []).filter((e) => e.currentHp > 0);
    const hasBoss = alive.some((e) => e.isBoss);
    let base = hasBoss ? 0.78 : 0.55;
    base += Math.min(0.15, Math.max(0, alive.length - 1) * 0.05);
    if (hp !== null && hp > 0 && hp < 0.25) base = Math.max(base, 0.92);
    else if (hp !== null && hp < 0.5) base += 0.05;
    return clamp01(base);
  }

  if (state.openShop) return 0.4;
  if (hp !== null && hp > 0 && hp < 0.25) return 0.5; // perigo: HP crítico fora de combate
  if (state.mode === 'rest') return 0.12;
  return 0.3; // exploração — cama respirando
}

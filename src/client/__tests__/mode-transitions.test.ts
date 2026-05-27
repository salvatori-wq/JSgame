// @vitest-environment happy-dom
// ο.7 — Tests Mode Transitions.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transitionToCombat, transitionCombatVictory, transitionCombatDefeat,
  transitionSceneChange, transitionLongRest, transitionRevive, clearTransitions,
} from '../mode-transitions';

describe('Mode Transitions ο.7', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('transitionToCombat cria vignette com classe combat-enter', () => {
    transitionToCombat();
    const v = document.getElementById('mode-transition-vignette');
    expect(v).toBeTruthy();
    expect(v?.classList.contains('is-combat-enter')).toBe(true);
    expect(v?.classList.contains('is-active')).toBe(true);
  });

  it('transitionCombatVictory aplica is-combat-victory', () => {
    transitionCombatVictory();
    const v = document.getElementById('mode-transition-vignette');
    expect(v?.classList.contains('is-combat-victory')).toBe(true);
  });

  it('transitionCombatDefeat aplica is-combat-defeat', () => {
    transitionCombatDefeat();
    expect(document.getElementById('mode-transition-vignette')?.classList.contains('is-combat-defeat')).toBe(true);
  });

  it('transitionSceneChange aplica is-scene-change', () => {
    transitionSceneChange();
    expect(document.getElementById('mode-transition-vignette')?.classList.contains('is-scene-change')).toBe(true);
  });

  it('transitionLongRest aplica is-long-rest', () => {
    transitionLongRest();
    expect(document.getElementById('mode-transition-vignette')?.classList.contains('is-long-rest')).toBe(true);
  });

  it('transitionRevive aplica is-revive', () => {
    transitionRevive();
    expect(document.getElementById('mode-transition-vignette')?.classList.contains('is-revive')).toBe(true);
  });

  it('clearTransitions remove classes ativas', () => {
    transitionToCombat();
    clearTransitions();
    const v = document.getElementById('mode-transition-vignette');
    expect(v?.classList.contains('is-active')).toBe(false);
    expect(v?.classList.contains('is-combat-enter')).toBe(false);
  });

  it('vignette tem aria-hidden=true (decoração visual)', () => {
    transitionToCombat();
    const v = document.getElementById('mode-transition-vignette');
    expect(v?.getAttribute('aria-hidden')).toBe('true');
  });
});

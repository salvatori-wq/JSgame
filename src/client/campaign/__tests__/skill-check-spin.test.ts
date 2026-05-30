// Fase 1 — O dado gira NO TOQUE, 100% client-side, antes de qualquer
// diceRollResult do servidor. Num Render frio (30-50s pra acordar) o dado
// não pode congelar no "?". Quando o resultado chega, assenta no valor; se
// nunca chega, o watchdog para no "?" com "Tentar novamente".
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showPendingSkillCheck, showSkillCheckResult, closeSkillCheck, type PendingCheck } from '../skill-check-overlay';
import type { DiceRoll } from '../../../shared/types';

const check: PendingCheck = { skill: 'percepcao', dc: 12, reason: 'Notar emboscada', bonus: 3, inspirations: 0 };

const makeRoll = (face: number, total: number): DiceRoll => ({
  notation: '1d20+3', rolls: [face], modifier: 3, total, kind: 20, count: 1,
  nat20: face === 20, nat1: face === 1,
});

describe('Fase 1 — o giro começa no toque (antes do diceRollResult)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    try { localStorage.setItem('jsgame:skillCheckTutorialSeen', '1'); } catch { /* */ }
  });
  afterEach(() => { closeSkillCheck(); document.body.innerHTML = ''; });

  it('clicar no dado adiciona is-rolling NA HORA (sem esperar o servidor)', () => {
    // onRoll é noop — simula servidor frio que ainda não respondeu.
    showPendingSkillCheck(check, () => { /* server frio: sem showSkillCheckResult */ });
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    expect(die.classList.contains('is-rolling')).toBe(false);
    die.click();
    expect(die.classList.contains('is-rolling')).toBe(true);
  });

  it('o dado fica em "?" enquanto o servidor não responde (giro infinito, não assenta sozinho)', () => {
    showPendingSkillCheck(check, () => { /* sem resposta */ });
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    die.click();
    expect(die.getAttribute('data-value')).toBe('?');
  });

  it('clicar no botão "Rolar" também inicia o giro client-side', () => {
    showPendingSkillCheck(check, () => { /* sem resposta */ });
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    const rollBtn = document.querySelector('.sc-roll-btn') as HTMLButtonElement;
    rollBtn.click();
    expect(die.classList.contains('is-rolling')).toBe(true);
  });
});

describe('Fase 1 — o servidor responde → o dado assenta no valor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    document.body.classList.remove('force-motion');
    try { localStorage.setItem('jsgame:skillCheckTutorialSeen', '1'); } catch { /* */ }
  });
  afterEach(() => { closeSkillCheck(); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('showSkillCheckResult assenta o MESMO dado no valor rolado', () => {
    showPendingSkillCheck(check, () => { /* roll */ });
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    die.click();
    expect(die.getAttribute('data-value')).toBe('?');
    // Servidor responde (face 17, total 20).
    showSkillCheckResult(makeRoll(17, 20), check, () => { /* close */ });
    // Aterrissagem de 1500ms.
    vi.advanceTimersByTime(1600);
    expect(die.getAttribute('data-value')).toBe('17');
    expect(die.classList.contains('is-rolling')).toBe(false);
  });
});

describe('Fase 1 — watchdog para no "?" com retry (nunca congela)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Stub fetch — o watchdog chama trackClientMetric (fire-and-forget); evita
    // ruído de ECONNREFUSED no log do teste.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as Response)));
    document.body.innerHTML = '<div id="app"></div>';
    try { localStorage.setItem('jsgame:skillCheckTutorialSeen', '1'); } catch { /* */ }
  });
  afterEach(() => { closeSkillCheck(); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('sem resposta em 10s, o dado volta pro "?" e o botão vira "Tentar novamente"', () => {
    showPendingSkillCheck(check, () => { /* nunca responde */ });
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    const rollBtn = document.querySelector('.sc-roll-btn') as HTMLButtonElement;
    die.click();
    expect(die.classList.contains('is-rolling')).toBe(true);
    vi.advanceTimersByTime(10001); // watchdog 10s
    expect(die.classList.contains('is-rolling')).toBe(false);
    expect(die.getAttribute('data-value')).toBe('?');
    expect(rollBtn.textContent).toContain('Tentar novamente');
    expect(rollBtn.hasAttribute('disabled')).toBe(false);
  });
});

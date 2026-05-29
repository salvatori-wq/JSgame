// M1.2 — Tests pro botão "Pular este teste" no skill-check overlay.
// Garante que onSkip:
//  - renderiza botão SÓ se callback for passado
//  - botão tem classe .sc-skip-btn (CSS sutil link-like)
//  - click dispara callback + fecha overlay
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showPendingSkillCheck, closeSkillCheck, type PendingCheck } from '../skill-check-overlay';

describe('M1.2 — Skip button no skill-check overlay', () => {
  const fakeCheck: PendingCheck = {
    skill: 'percepcao',
    dc: 12,
    reason: 'Notar a emboscada',
    bonus: 3,
    inspirations: 0,
  };

  beforeEach(() => {
    // Garante div #app pra overlay ancorar
    document.body.innerHTML = '<div id="app"></div>';
    // Mark tutorial seen pra não interferir
    try { localStorage.setItem('jsgame:skillCheckTutorialSeen', '1'); } catch { /* */ }
  });

  afterEach(() => {
    closeSkillCheck();
    document.body.innerHTML = '';
  });

  it('NÃO renderiza .sc-skip-btn quando onSkip não é fornecido', () => {
    showPendingSkillCheck(fakeCheck, () => { /* roll */ });
    const skipBtn = document.querySelector('.sc-skip-btn');
    expect(skipBtn).toBeNull();
  });

  it('renderiza .sc-skip-btn quando onSkip é fornecido', () => {
    showPendingSkillCheck(fakeCheck, () => { /* roll */ }, () => { /* skip */ });
    const skipBtn = document.querySelector('.sc-skip-btn');
    expect(skipBtn).not.toBeNull();
    expect(skipBtn?.textContent).toContain('Pular');
  });

  it('click no botão dispara callback onSkip', () => {
    const onSkip = vi.fn();
    showPendingSkillCheck(fakeCheck, () => { /* roll */ }, onSkip);
    const skipBtn = document.querySelector('.sc-skip-btn') as HTMLButtonElement;
    skipBtn.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('click no botão fecha o overlay (sc-overlay sai do DOM)', () => {
    showPendingSkillCheck(fakeCheck, () => { /* roll */ }, () => { /* skip */ });
    expect(document.querySelector('.sc-overlay')).not.toBeNull();
    const skipBtn = document.querySelector('.sc-skip-btn') as HTMLButtonElement;
    skipBtn.click();
    expect(document.querySelector('.sc-overlay')).toBeNull();
  });

  it('skip é one-shot: 2 clicks não dispara onSkip 2x', () => {
    const onSkip = vi.fn();
    showPendingSkillCheck(fakeCheck, () => { /* roll */ }, onSkip);
    const skipBtn = document.querySelector('.sc-skip-btn') as HTMLButtonElement;
    skipBtn.click();
    // overlay removido — segundo click no mesmo botão é no-op (DOM detached)
    skipBtn.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

// D6 — o dado em si é clicável (o verdict idle diz "toque pra rolar").
describe('D6 — dado clicável no skill-check', () => {
  const check: PendingCheck = { skill: 'percepcao', dc: 12, reason: 'Notar emboscada', bonus: 3, inspirations: 0 };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    try { localStorage.setItem('jsgame:skillCheckTutorialSeen', '1'); } catch { /* */ }
  });
  afterEach(() => { closeSkillCheck(); document.body.innerHTML = ''; });

  it('clicar no dado dispara onRoll', () => {
    const onRoll = vi.fn();
    showPendingSkillCheck(check, onRoll);
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement | null;
    expect(die).not.toBeNull();
    die!.click();
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('clicar no dado 2x rola só 1x (one-shot)', () => {
    const onRoll = vi.fn();
    showPendingSkillCheck(check, onRoll);
    const die = document.querySelector('.sc-overlay .die-3d') as HTMLElement;
    die.click();
    die.click();
    expect(onRoll).toHaveBeenCalledTimes(1);
  });
});

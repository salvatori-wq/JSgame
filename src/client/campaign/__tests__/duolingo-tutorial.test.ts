// κ.1 — Tests pro Tutorial Duolingo guiado.
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  openDuolingoTutorial,
  closeDuolingoTutorial,
  shouldShowDuolingoTutorial,
  markDuolingoTutorialDone,
  isDuolingoTutorialOpen,
  resetDuolingoTutorialForTest,
} from '../duolingo-tutorial';

// Mock trackClientMetric pra evitar fetch real
vi.mock('../../api', () => ({
  trackClientMetric: vi.fn(),
}));

// singleFork:true em vitest.config compartilha localStorage entre files;
// mock explícito window.localStorage isola a função shouldShow/markDone.
let storageMock: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string): string | null => storageMock[key] ?? null,
  setItem: (key: string, value: string): void => { storageMock[key] = value; },
  removeItem: (key: string): void => { delete storageMock[key]; },
  clear: (): void => { storageMock = {}; },
  key: (i: number): string | null => Object.keys(storageMock)[i] ?? null,
  get length(): number { return Object.keys(storageMock).length; },
};

describe('Duolingo Tutorial', () => {
  beforeEach(() => {
    storageMock = {};
    // Stub window.localStorage com mock isolado por test
    vi.stubGlobal('localStorage', mockStorage);
    resetDuolingoTutorialForTest();
    document.body.innerHTML = '';
  });

  it('shouldShow=true antes de marcar como done', () => {
    expect(shouldShowDuolingoTutorial()).toBe(true);
  });

  it('shouldShow=false após markDone', () => {
    markDuolingoTutorialDone();
    expect(shouldShowDuolingoTutorial()).toBe(false);
  });

  it('openDuolingoTutorial renderiza overlay com tooltip', () => {
    openDuolingoTutorial();
    const overlay = document.querySelector('.dt-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(isDuolingoTutorialOpen()).toBe(true);
    const tooltip = overlay.querySelector('.dt-tooltip');
    expect(tooltip).not.toBeNull();
  });

  it('primeiro step mostra welcome + sem skip (último step é "✓ Bora jogar")', () => {
    openDuolingoTutorial();
    const title = document.querySelector('.dt-tooltip-title');
    expect(title?.textContent).toBe('Bem-vindo a JSgame');
    const skip = document.querySelector('.dt-skip');
    expect(skip).not.toBeNull(); // primeiro step tem skip
    const next = document.querySelector('.dt-next');
    expect(next).not.toBeNull();
    const done = document.querySelector('.dt-done');
    expect(done).toBeNull(); // só último step
  });

  it('botão "Próximo" avança step e mostra "Voltar"', () => {
    openDuolingoTutorial();
    const next = document.querySelector('.dt-next') as HTMLButtonElement;
    next.click();
    const title = document.querySelector('.dt-tooltip-title');
    expect(title?.textContent).toBe('O Mestre narra aqui');
    const back = document.querySelector('.dt-back');
    expect(back).not.toBeNull(); // a partir do step 2 tem voltar
    const progress = document.querySelector('.dt-progress');
    expect(progress?.textContent).toBe('2 / 6');
  });

  it('botão "Voltar" volta um step', () => {
    openDuolingoTutorial();
    (document.querySelector('.dt-next') as HTMLButtonElement).click();
    (document.querySelector('.dt-next') as HTMLButtonElement).click();
    expect(document.querySelector('.dt-progress')?.textContent).toBe('3 / 6');
    (document.querySelector('.dt-back') as HTMLButtonElement).click();
    expect(document.querySelector('.dt-progress')?.textContent).toBe('2 / 6');
  });

  it('último step mostra botão "Bora jogar" + sem skip', () => {
    openDuolingoTutorial();
    // Avança até o final (6 steps total, 5 clicks)
    for (let i = 0; i < 5; i++) {
      (document.querySelector('.dt-next') as HTMLButtonElement).click();
    }
    expect(document.querySelector('.dt-progress')?.textContent).toBe('6 / 6');
    const done = document.querySelector('.dt-done');
    expect(done).not.toBeNull();
    const skip = document.querySelector('.dt-skip');
    expect(skip).toBeNull(); // último step não tem skip
  });

  it('botão "Pular ✕" fecha overlay + marca done', () => {
    openDuolingoTutorial();
    const skip = document.querySelector('.dt-skip') as HTMLButtonElement;
    skip.click();
    expect(document.querySelector('.dt-overlay')).toBeNull();
    expect(shouldShowDuolingoTutorial()).toBe(false);
    expect(isDuolingoTutorialOpen()).toBe(false);
  });

  it('botão "Bora jogar" no último step fecha + marca done', () => {
    openDuolingoTutorial();
    for (let i = 0; i < 5; i++) {
      (document.querySelector('.dt-next') as HTMLButtonElement).click();
    }
    const done = document.querySelector('.dt-done') as HTMLButtonElement;
    done.click();
    expect(document.querySelector('.dt-overlay')).toBeNull();
    expect(shouldShowDuolingoTutorial()).toBe(false);
  });

  it('tecla ArrowRight avança, ArrowLeft volta', () => {
    openDuolingoTutorial();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.querySelector('.dt-progress')?.textContent).toBe('2 / 6');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.querySelector('.dt-progress')?.textContent).toBe('1 / 6');
  });

  it('tecla Escape fecha tutorial + marca done', () => {
    openDuolingoTutorial();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.dt-overlay')).toBeNull();
    expect(shouldShowDuolingoTutorial()).toBe(false);
  });

  it('openDuolingoTutorial idempotente (segundo call não duplica)', () => {
    openDuolingoTutorial();
    openDuolingoTutorial();
    expect(document.querySelectorAll('.dt-overlay').length).toBe(1);
  });

  it('closeDuolingoTutorial fecha sem marcar done (use em destroy)', () => {
    openDuolingoTutorial();
    closeDuolingoTutorial();
    expect(document.querySelector('.dt-overlay')).toBeNull();
    // NÃO marca done — pode reaparecer
    expect(shouldShowDuolingoTutorial()).toBe(true);
  });

  it('spotlight não aparece em step center (welcome/outro)', () => {
    openDuolingoTutorial();
    const tooltip = document.querySelector('.dt-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('is-center')).toBe(true);
    const spotlight = document.querySelector('.dt-spotlight') as HTMLElement;
    expect(spotlight.classList.contains('is-visible')).toBe(false);
  });

  it('step com targetSelector inexistente faz fallback pra centro', () => {
    openDuolingoTutorial();
    (document.querySelector('.dt-next') as HTMLButtonElement).click();
    // Step 2 mira ".ch-narration-host" — não existe no DOM do test
    // Tooltip deve cair em is-center fallback
    const tooltip = document.querySelector('.dt-tooltip') as HTMLElement;
    expect(tooltip.classList.contains('is-center')).toBe(true);
  });
});

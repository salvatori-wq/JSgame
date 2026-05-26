// BUG-002 fix — Tutorial trigger pura, testável sem JSDOM.

import { describe, it, expect } from 'vitest';
import { shouldTriggerExplorationTutorial } from '../exploration-tutorial';

const baseline = {
  sessionNumber: 1,
  narrationsArrived: true,
  alreadyFiredThisSession: false,
  tutorialNotDoneYet: true,
};

describe('shouldTriggerExplorationTutorial — BUG-002 fix', () => {
  it('dispara em sessão 1 com narração + tutorial não feito', () => {
    expect(shouldTriggerExplorationTutorial(baseline)).toBe(true);
  });

  it('NÃO dispara se sessionNumber > 1', () => {
    expect(shouldTriggerExplorationTutorial({ ...baseline, sessionNumber: 2 })).toBe(false);
  });

  it('NÃO dispara se narração ainda não chegou (state arrives first em rejoin)', () => {
    expect(shouldTriggerExplorationTutorial({ ...baseline, narrationsArrived: false })).toBe(false);
  });

  it('dispara quando narração chega DEPOIS do state (cenário rejoin)', () => {
    // Sequência típica de rejoin:
    //   1) onState fires com narrationsArrived=false → não dispara
    //   2) onNarration fires com narrationsArrived=true → DEVE disparar
    const step1 = shouldTriggerExplorationTutorial({ ...baseline, narrationsArrived: false });
    expect(step1).toBe(false);
    // Step 2: now narration has arrived, tutorial fires:
    const step2 = shouldTriggerExplorationTutorial({ ...baseline, narrationsArrived: true, alreadyFiredThisSession: false });
    expect(step2).toBe(true);
  });

  it('NÃO dispara se já disparou na sessão (coop double-fire guard)', () => {
    expect(shouldTriggerExplorationTutorial({ ...baseline, alreadyFiredThisSession: true })).toBe(false);
  });

  it('NÃO dispara se tutorial já foi marcado feito (localStorage flag)', () => {
    expect(shouldTriggerExplorationTutorial({ ...baseline, tutorialNotDoneYet: false })).toBe(false);
  });

  it('coop simultâneo: 2 chamadas paralelas — só 1 deve passar (guard via alreadyFired)', () => {
    // Sim: a chamada que checar primeiro tem alreadyFiredThisSession=false → true
    // Caller deve marcar alreadyFired=true ANTES de scheduleTimeout pra a próxima
    // chamada veja flag=true e retorne false.
    const first = shouldTriggerExplorationTutorial(baseline);
    expect(first).toBe(true);
    // Após primeira chamada setar alreadyFired:
    const second = shouldTriggerExplorationTutorial({ ...baseline, alreadyFiredThisSession: true });
    expect(second).toBe(false);
  });
});

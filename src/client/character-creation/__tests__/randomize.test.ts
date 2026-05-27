// POLISH α.3 — tests pro randomize wizard helper.

import { describe, it, expect } from 'vitest';
import { randomizeWizardState } from '../randomize';
import { RACES } from '../../../dnd/races';
import { CLASSES } from '../../../dnd/classes';
import { BACKGROUNDS } from '../../../dnd/backgrounds';

describe('POLISH α.3 — randomize wizard', () => {
  it('retorna state válido com todos campos preenchidos', () => {
    const s = randomizeWizardState();
    expect(s.raceId).not.toBeNull();
    expect(s.classId).not.toBeNull();
    expect(s.backgroundId).not.toBeNull();
    expect(s.characterName.length).toBeGreaterThan(0);
    expect(s.step).toBe('review');
  });

  it('raceId aponta pra raça existente', () => {
    const s = randomizeWizardState();
    expect(RACES[s.raceId!]).toBeDefined();
  });

  it('classId aponta pra classe existente', () => {
    const s = randomizeWizardState();
    expect(CLASSES[s.classId!]).toBeDefined();
  });

  it('backgroundId aponta pra background existente', () => {
    const s = randomizeWizardState();
    expect(BACKGROUNDS[s.backgroundId!]).toBeDefined();
  });

  it('chosenSkills tem count == skillChoices.count da classe', () => {
    const s = randomizeWizardState();
    const klass = CLASSES[s.classId!];
    expect(s.chosenSkills.length).toBe(klass.skillChoices.count);
  });

  it('chosenSkills só contém skills do pool from da classe', () => {
    const s = randomizeWizardState();
    const klass = CLASSES[s.classId!];
    for (const sk of s.chosenSkills) {
      expect(klass.skillChoices.from).toContain(sk);
    }
  });

  it('alignment é válido (9 alinhamentos D&D)', () => {
    const valid = ['lb', 'nb', 'cb', 'ln', 'nn', 'cn', 'lm', 'nm', 'cm'];
    const s = randomizeWizardState();
    expect(valid).toContain(s.alignment);
  });

  it('abilityScoresBase é point buy default (15/14/13/12/10/8)', () => {
    const s = randomizeWizardState();
    const values = (Object.values(s.abilityScoresBase) as number[]).sort((a, b) => a - b);
    expect(values).toEqual([8, 10, 12, 13, 14, 15]);
  });

  it('randomização produz resultados diferentes em N calls (smoke)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = randomizeWizardState();
      seen.add(`${s.raceId}|${s.classId}|${s.backgroundId}|${s.characterName}`);
    }
    // Esperado >5 combinações diferentes em 20 sorteios (random com pools grandes)
    expect(seen.size).toBeGreaterThan(5);
  });
});

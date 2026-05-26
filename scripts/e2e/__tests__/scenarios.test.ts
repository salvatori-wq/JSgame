// Sprint B — Tests pra registry de cenários.
// Confirma estrutura, IDs únicos, e que cada cenário tem expectations.

import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../scenarios.js';

describe('E2E scenarios registry', () => {
  it('tem 10 cenários smoke', () => {
    const smoke = SCENARIOS.filter((s) => s.severity === 'smoke');
    expect(smoke.length).toBeGreaterThanOrEqual(10);
  });

  it('IDs únicos', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada cenário tem name não vazio', () => {
    for (const s of SCENARIOS) {
      expect(s.name).toBeTruthy();
      expect(s.id).toBeTruthy();
    }
  });

  it('cada cenário tem pelo menos 1 step e 1 expectation', () => {
    for (const s of SCENARIOS) {
      expect(s.steps.length).toBeGreaterThan(0);
      expect(s.expectations.length).toBeGreaterThan(0);
    }
  });

  it('cada expectation tem failureSeverity válida', () => {
    const valid = ['blocker', 'major', 'minor'];
    for (const s of SCENARIOS) {
      for (const e of s.expectations) {
        expect(valid).toContain(e.failureSeverity);
      }
    }
  });

  it('cada cenário tem estimatedDurationSec positivo', () => {
    for (const s of SCENARIOS) {
      expect(s.estimatedDurationSec).toBeGreaterThan(0);
    }
  });

  it('soma de durações estimadas é "rodável" (< 30min total)', () => {
    const total = SCENARIOS.reduce((a, s) => a + s.estimatedDurationSec, 0);
    expect(total).toBeLessThan(30 * 60);
  });
});

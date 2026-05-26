// Sprint C — Tests pra anomaly detector.
// Cobre computeAlerts (pura) com cenários conhecidos.

import { describe, it, expect } from 'vitest';
import { computeAlerts, BASELINES } from '../anomaly-detector.js';

const NORMAL_INPUT = {
  dmErrorRate: 0.02,
  sessionMinAvg: 25,
  sessionSampleCount: 20,
  charDiedPerSession: 0.1,
  combatLostRate: 0.1,
  combatSampleCount: 10,
  windowDays: 1,
};

describe('computeAlerts — DM error rate', () => {
  it('zero alerts em estado normal', () => {
    const alerts = computeAlerts(NORMAL_INPUT);
    expect(alerts).toEqual([]);
  });

  it('high alert quando error rate >= 10%', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, dmErrorRate: 0.12 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('high');
    expect(alerts[0]!.kind).toBe('dm_error_rate_high');
  });

  it('critical alert quando error rate >= 20%', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, dmErrorRate: 0.25 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('critical');
    expect(alerts[0]!.kind).toBe('dm_error_rate_critical');
  });
});

describe('computeAlerts — session length', () => {
  it('alerta se média < 5min (sample >= 5)', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, sessionMinAvg: 3 });
    expect(alerts[0]!.kind).toBe('session_too_short');
    expect(alerts[0]!.severity).toBe('medium');
  });

  it('alerta se média > 90min', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, sessionMinAvg: 120 });
    expect(alerts[0]!.kind).toBe('session_too_long');
    expect(alerts[0]!.severity).toBe('low');
  });

  it('NÃO alerta com sample insuficiente (< 5 sessões)', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, sessionMinAvg: 3, sessionSampleCount: 2 });
    expect(alerts).toEqual([]);
  });
});

describe('computeAlerts — character deaths', () => {
  it('medium alert se >= 0.5 mortes/sessão', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, charDiedPerSession: 0.6 });
    expect(alerts[0]!.kind).toBe('char_died_rate_high');
    expect(alerts[0]!.severity).toBe('medium');
  });

  it('critical alert se >= 1.0 morte/sessão', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, charDiedPerSession: 1.5 });
    expect(alerts[0]!.kind).toBe('char_died_rate_critical');
    expect(alerts[0]!.severity).toBe('critical');
  });
});

describe('computeAlerts — combat lost rate', () => {
  it('medium se >= 30% perdidos', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, combatLostRate: 0.35 });
    expect(alerts[0]!.kind).toBe('combat_lost_rate_high');
    expect(alerts[0]!.severity).toBe('medium');
  });

  it('high se >= 50% perdidos', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, combatLostRate: 0.6 });
    expect(alerts[0]!.kind).toBe('combat_lost_rate_critical');
    expect(alerts[0]!.severity).toBe('high');
  });

  it('NÃO alerta com sample insuficiente (< 3 combates)', () => {
    const alerts = computeAlerts({ ...NORMAL_INPUT, combatLostRate: 0.8, combatSampleCount: 2 });
    expect(alerts).toEqual([]);
  });
});

describe('computeAlerts — múltiplos alerts simultâneos', () => {
  it('agrega todos os triggers que disparam', () => {
    const alerts = computeAlerts({
      ...NORMAL_INPUT,
      dmErrorRate: 0.25,        // critical
      sessionMinAvg: 100,       // low (too long)
      charDiedPerSession: 1.5,  // critical
      combatLostRate: 0.6,      // high
    });
    expect(alerts).toHaveLength(4);
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain('dm_error_rate_critical');
    expect(kinds).toContain('session_too_long');
    expect(kinds).toContain('char_died_rate_critical');
    expect(kinds).toContain('combat_lost_rate_critical');
  });
});

describe('BASELINES — sanity check', () => {
  it('thresholds monotônicos', () => {
    expect(BASELINES.dmErrorRate.normal).toBeLessThan(BASELINES.dmErrorRate.high);
    expect(BASELINES.dmErrorRate.high).toBeLessThan(BASELINES.dmErrorRate.critical);
    expect(BASELINES.charDiedPerSession.high).toBeLessThan(BASELINES.charDiedPerSession.critical);
    expect(BASELINES.combatLostRate.high).toBeLessThan(BASELINES.combatLostRate.critical);
    expect(BASELINES.sessionMinAvg.min).toBeLessThan(BASELINES.sessionMinAvg.max);
  });
});

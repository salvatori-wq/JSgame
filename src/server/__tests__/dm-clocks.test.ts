// ψ.3 — Tests pros clocks (Blades-style pressão narrativa).
// Cobre validação tool + aplicação no state + clamp + trigger fire.

import { describe, it, expect, beforeEach } from 'vitest';
import { validateToolCall } from '../dm/tools.js';
import { applyValidatedToolToCampaign as applyDMTool } from '../dm-tool-applier.js';
import { Campaign } from '../campaign.js';
import { FallbackDM } from '../dm/dm.js';

describe('ψ.3 — create_clock tool validation', () => {
  it('aceita clock válido', () => {
    const r = validateToolCall({
      name: 'create_clock',
      input: { clockId: 'ritual', label: 'Ritual do Culto', max: 6, trigger: 'vilão imortal' },
    });
    expect(r?.kind).toBe('create_clock');
    if (r?.kind === 'create_clock') {
      expect(r.clockId).toBe('ritual');
      expect(r.label).toBe('Ritual do Culto');
      expect(r.max).toBe(6);
      expect(r.trigger).toBe('vilão imortal');
    }
  });

  it('rejeita sem clockId', () => {
    const r = validateToolCall({
      name: 'create_clock',
      input: { label: 'X', max: 4, trigger: 'algo' },
    });
    expect(r).toBeNull();
  });

  it('clamp max entre 2 e 12', () => {
    const r1 = validateToolCall({
      name: 'create_clock',
      input: { clockId: 'x', label: 'X', max: 100, trigger: 't' },
    });
    expect(r1?.kind === 'create_clock' && r1.max).toBe(12);

    const r2 = validateToolCall({
      name: 'create_clock',
      input: { clockId: 'y', label: 'Y', max: 1, trigger: 't' },
    });
    expect(r2?.kind === 'create_clock' && r2.max).toBe(2); // clamp min 2
  });
});

describe('ψ.3 — tick_clock tool validation', () => {
  it('aceita tick válido', () => {
    const r = validateToolCall({
      name: 'tick_clock',
      input: { clockId: 'ritual', amount: 2 },
    });
    expect(r?.kind).toBe('tick_clock');
    if (r?.kind === 'tick_clock') {
      expect(r.amount).toBe(2);
    }
  });

  it('clamp amount 1..6', () => {
    const r1 = validateToolCall({
      name: 'tick_clock',
      input: { clockId: 'x', amount: 50 },
    });
    expect(r1?.kind === 'tick_clock' && r1.amount).toBe(6);
  });

  it('default amount 1 se não informado', () => {
    const r = validateToolCall({
      name: 'tick_clock',
      input: { clockId: 'x' },
    });
    expect(r?.kind === 'tick_clock' && r.amount).toBe(1);
  });
});

describe('ψ.3 — clock state application', () => {
  let camp: Campaign;

  beforeEach(() => {
    camp = new Campaign(new FallbackDM());
  });

  it('create_clock adiciona ao state.activeClocks', () => {
    applyDMTool(camp, {
      kind: 'create_clock',
      clockId: 'ritual',
      label: 'Ritual',
      max: 6,
      trigger: 'imortal',
    });
    expect(camp.state.activeClocks?.length).toBe(1);
    expect(camp.state.activeClocks?.[0]?.id).toBe('ritual');
    expect(camp.state.activeClocks?.[0]?.progress).toBe(0);
  });

  it('create_clock com mesmo id atualiza ao invés de duplicar', () => {
    applyDMTool(camp, { kind: 'create_clock', clockId: 'r', label: 'Old', max: 4, trigger: 'x' });
    applyDMTool(camp, { kind: 'create_clock', clockId: 'r', label: 'New', max: 6, trigger: 'y' });
    expect(camp.state.activeClocks?.length).toBe(1);
    expect(camp.state.activeClocks?.[0]?.label).toBe('New');
    expect(camp.state.activeClocks?.[0]?.max).toBe(6);
  });

  it('tick_clock avança progresso', () => {
    applyDMTool(camp, { kind: 'create_clock', clockId: 'r', label: 'R', max: 6, trigger: 't' });
    applyDMTool(camp, { kind: 'tick_clock', clockId: 'r', amount: 2 });
    expect(camp.state.activeClocks?.[0]?.progress).toBe(2);
  });

  it('tick_clock clampa em max', () => {
    applyDMTool(camp, { kind: 'create_clock', clockId: 'r', label: 'R', max: 4, trigger: 't' });
    applyDMTool(camp, { kind: 'tick_clock', clockId: 'r', amount: 10 });
    expect(camp.state.activeClocks?.[0]?.progress).toBe(4);
  });

  it('tick_clock dispara fired=true quando atinge max', () => {
    applyDMTool(camp, { kind: 'create_clock', clockId: 'r', label: 'R', max: 4, trigger: 'BOOM' });
    expect(camp.state.activeClocks?.[0]?.fired).toBeUndefined();
    applyDMTool(camp, { kind: 'tick_clock', clockId: 'r', amount: 4 });
    expect(camp.state.activeClocks?.[0]?.fired).toBe(true);
  });

  it('tick_clock em clockId inexistente é no-op (não cria)', () => {
    applyDMTool(camp, { kind: 'tick_clock', clockId: 'nao-existe', amount: 1 });
    expect(camp.state.activeClocks ?? []).toEqual([]);
  });
});

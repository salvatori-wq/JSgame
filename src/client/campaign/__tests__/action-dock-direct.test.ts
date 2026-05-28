// O1.1 — Tests pra directActionFor — topics com 1 sub-ação devem disparar
// direto em vez de abrir drill com 1 botão (UI overhead inútil).

import { describe, it, expect, vi } from 'vitest';
import { directActionFor } from '../action-dock-topics';
import type { ActionDockContext } from '../action-dock-topics';

function makeCtx(overrides: Partial<ActionDockContext> = {}): ActionDockContext {
  return {
    isCombat: false,
    canRest: true,
    isCaster: false,
    isDmThinking: false,
    onAction: vi.fn(),
    onCustomAction: vi.fn(),
    onCombatAction: vi.fn(),
    onCastSpell: vi.fn(),
    onInventory: vi.fn(),
    onShortRest: vi.fn(),
    onLongRest: vi.fn(),
    onRollDice: vi.fn(),
    ...overrides,
  };
}

describe('O1.1 — directActionFor', () => {
  it('exploration "combat" tópico (só "Atacar") devolve handler', () => {
    const ctx = makeCtx();
    const handler = directActionFor('combat', ctx);
    expect(handler).not.toBeNull();
    handler!();
    expect(ctx.onAction).toHaveBeenCalledWith('attack', '');
  });

  it('exploration "social" tópico (só "Falar") devolve handler', () => {
    const ctx = makeCtx();
    const handler = directActionFor('social', ctx);
    expect(handler).not.toBeNull();
    handler!();
    expect(ctx.onAction).toHaveBeenCalledWith('talk', '');
  });

  it('exploration "explore" tópico (4 sub-actions) devolve null', () => {
    const ctx = makeCtx();
    expect(directActionFor('explore', ctx)).toBeNull();
  });

  it('"more" tópico SEMPRE devolve null (sempre múltiplo)', () => {
    expect(directActionFor('more', makeCtx())).toBeNull();
  });

  it('"custom" tópico SEMPRE devolve null (já tem fast-path modal)', () => {
    expect(directActionFor('custom', makeCtx())).toBeNull();
  });

  it('"dice" tópico SEMPRE devolve null (já tem fast-path picker)', () => {
    expect(directActionFor('dice', makeCtx())).toBeNull();
  });

  it('"magic" tópico SEMPRE devolve null (modal cast complexo)', () => {
    expect(directActionFor('magic', makeCtx({ isCaster: true }))).toBeNull();
  });

  it('combat "social" mid-combat tem só "Falar" → direct-action', () => {
    const ctx = makeCtx({ isCombat: true, isMyTurn: true });
    const handler = directActionFor('social', ctx);
    expect(handler).not.toBeNull();
  });

  it('combat "social" disabled (não meu turno) devolve null', () => {
    const ctx = makeCtx({ isCombat: true, isMyTurn: false });
    expect(directActionFor('social', ctx)).toBeNull();
  });

  it('combat "combat" (8 ações Attack/Dodge/etc) devolve null', () => {
    const ctx = makeCtx({ isCombat: true, isMyTurn: true });
    expect(directActionFor('combat', ctx)).toBeNull();
  });
});

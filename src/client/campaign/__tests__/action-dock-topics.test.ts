// @vitest-environment happy-dom
// ο.3 — Tests do Action Dock Topicizado.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderActionDockTopics, resetActionDockState } from '../action-dock-topics';

function baseCtx(overrides: Record<string, any> = {}) {
  return {
    isCombat: false,
    canRest: true,
    isCaster: false,
    isDmThinking: false,
    onAction: () => {},
    onCustomAction: () => {},
    onCastSpell: () => {},
    onInventory: () => {},
    onShortRest: () => {},
    onLongRest: () => {},
    onCombatAction: () => {},
    onEndTurn: () => {},
    ...overrides,
  };
}

describe('renderActionDockTopics — exploration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // ψ.5 — Reset state externo (preserva customDetails entre re-mounts no jogo,
    // mas em tests deve começar limpo a cada describe block)
    resetActionDockState();
  });

  it('renderiza 4 topic cards (U6 — sem "Combate" top-level)', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const cards = el.querySelectorAll('.adt-card');
    // U6: explore / social / more / custom = 4 (sem magic pq isCaster=false,
    // sem dice pq baseCtx não passa onRollDice, sem "Combate" que foi pro "Mais")
    expect(cards.length).toBe(4);
    expect(el.textContent).not.toContain('Combate');
  });

  it('inclui Magia se isCaster=true', () => {
    const el = renderActionDockTopics(baseCtx({ isCaster: true }));
    const cards = el.querySelectorAll('.adt-card');
    expect(cards.length).toBe(5); // U6: explore / social / magic / more / custom
    expect(el.textContent).toContain('Magia');
  });

  it('U6 — "Atacar" agora vive no drill de "Mais" (não no top-level)', () => {
    const el = renderActionDockTopics(baseCtx());
    const moreCard = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Mais')) as HTMLButtonElement;
    moreCard.click();
    expect(el.textContent).toContain('Atacar');
  });

  it('NÃO mostra drill antes de clicar', () => {
    const el = renderActionDockTopics(baseCtx());
    expect(el.querySelector('.adt-drill-panel')).toBeNull();
  });

  it('click em topic abre drill com sub-actions', () => {
    const el = renderActionDockTopics(baseCtx());
    const explorerCard = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Explorar')) as HTMLButtonElement;
    explorerCard.click();
    const drill = el.querySelector('.adt-drill-panel');
    expect(drill).toBeTruthy();
    expect(drill?.textContent).toContain('Investigar');
  });

  it('re-click em topic fecha drill', () => {
    // O1.1 — "Social" agora é direct-action (só "Falar") não abre drill.
    // Usa "Explorar" (4 sub-actions) pra testar toggle drill.
    const el = renderActionDockTopics(baseCtx());
    const findExplorar = () => Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Explorar')) as HTMLButtonElement;
    findExplorar().click();
    expect(el.querySelector('.adt-drill-panel')).toBeTruthy();
    // após rerender DOM foi recriado, re-pegar referência
    findExplorar().click();
    expect(el.querySelector('.adt-drill-panel')).toBeNull();
  });

  it('sub-action click dispara callback', () => {
    let called: string | null = null;
    const el = renderActionDockTopics(baseCtx({
      onAction: (action: string, details: string) => { called = action; },
    }));
    const explorer = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Explorar')) as HTMLButtonElement;
    explorer.click();
    const investigarBtn = Array.from(el.querySelectorAll('.adt-sub-btn'))
      .find((b) => b.textContent?.includes('Investigar')) as HTMLButtonElement;
    investigarBtn.click();
    expect(called).toBe('investigate');
  });

  it('Rest sub-actions só aparecem em canRest=true', () => {
    const elRest = renderActionDockTopics(baseCtx({ canRest: true }));
    const moreCard = Array.from(elRest.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Mais')) as HTMLButtonElement;
    moreCard.click();
    expect(elRest.textContent).toContain('Descanso');

    const elNoRest = renderActionDockTopics(baseCtx({ canRest: false }));
    const moreCard2 = Array.from(elNoRest.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Mais')) as HTMLButtonElement;
    moreCard2.click();
    expect(elNoRest.textContent).not.toContain('Descanso');
  });
});

describe('renderActionDockTopics — combat', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // ψ.5 — Reset state externo (preserva customDetails entre re-mounts no jogo,
    // mas em tests deve começar limpo a cada describe block)
    resetActionDockState();
  });

  it('End Turn sticky aparece em combat + isMyTurn', () => {
    const el = renderActionDockTopics(baseCtx({ isCombat: true, isMyTurn: true }));
    const combatCard = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Combate')) as HTMLButtonElement;
    combatCard.click();
    expect(el.querySelector('.adt-end-turn-btn')).toBeTruthy();
  });

  it('combat sub-actions: 8 actions disponíveis em "Combate"', () => {
    const el = renderActionDockTopics(baseCtx({ isCombat: true, isMyTurn: true }));
    const combatCard = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Combate')) as HTMLButtonElement;
    combatCard.click();
    const subs = el.querySelectorAll('.adt-sub-btn');
    expect(subs.length).toBeGreaterThanOrEqual(7);
    expect(el.textContent).toContain('Atacar');
    expect(el.textContent).toContain('Esquivar');
  });

  it('combat actions desabilitados se !isMyTurn', () => {
    const el = renderActionDockTopics(baseCtx({ isCombat: true, isMyTurn: false }));
    const combatCard = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Combate')) as HTMLButtonElement;
    combatCard.click();
    const attackBtn = Array.from(el.querySelectorAll('.adt-sub-btn'))
      .find((b) => b.textContent?.includes('Atacar')) as HTMLButtonElement;
    expect(attackBtn.disabled).toBe(true);
  });
});

describe('renderActionDockTopics — custom action (Ω.9 modal)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetActionDockState();
  });

  it('topic "Livre" NÃO expande drill inline (Ω.9: abre modal externo)', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const livre = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    // Ω.9: textarea INLINE não existe mais — agora abre modal via inputDialog
    expect(el.querySelector('.adt-custom-textarea')).toBeNull();
    expect(el.querySelector('.adt-drill-panel')).toBeNull();
  });

  it('Ω.9 — click em "Livre" NÃO modifica currentTopic state (modal externo)', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const livre = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    // Após click em Livre, dock continua igual — nenhum is-active marcado.
    // Modal abre via inputDialog assíncrono (testado em ui-modal.test.ts).
    const activeCards = el.querySelectorAll('.adt-card.is-active');
    expect(activeCards.length).toBe(0);
  });

  it('Ω.9 — outros topics (Explorar) ainda expandem drill inline', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const explorer = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Explorar')) as HTMLButtonElement;
    explorer.click();
    // Explorar AINDA tem drill inline (só Livre virou modal)
    expect(el.querySelector('.adt-drill-panel')).toBeTruthy();
  });

  it('Ω.9 — Livre NÃO marca currentTopic (não fica "active")', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const livre = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    // Card Livre não fica is-active depois do click (modal abriu fora)
    expect(livre.classList.contains('is-active')).toBe(false);
  });
});

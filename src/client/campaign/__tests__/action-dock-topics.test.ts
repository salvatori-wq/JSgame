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

  it('renderiza 4-5 topic cards', () => {
    const el = renderActionDockTopics(baseCtx());
    document.body.appendChild(el);
    const cards = el.querySelectorAll('.adt-card');
    // combat / explore / social / more / custom = 5 (sem magic pq isCaster=false)
    expect(cards.length).toBe(5);
  });

  it('inclui Magia se isCaster=true', () => {
    const el = renderActionDockTopics(baseCtx({ isCaster: true }));
    const cards = el.querySelectorAll('.adt-card');
    expect(cards.length).toBe(6);
    expect(el.textContent).toContain('Magia');
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
    const el = renderActionDockTopics(baseCtx());
    const findSocial = () => Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Social')) as HTMLButtonElement;
    findSocial().click();
    expect(el.querySelector('.adt-drill-panel')).toBeTruthy();
    // após rerender DOM foi recriado, re-pegar referência
    findSocial().click();
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

describe('renderActionDockTopics — custom action', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // ψ.5 — Reset state externo (preserva customDetails entre re-mounts no jogo,
    // mas em tests deve começar limpo a cada describe block)
    resetActionDockState();
  });

  it('topic "Livre" abre textarea + send button', () => {
    const el = renderActionDockTopics(baseCtx());
    const livre = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    expect(el.querySelector('.adt-custom-textarea')).toBeTruthy();
    expect(el.querySelector('.adt-custom-send')).toBeTruthy();
  });

  it('send button dispara onCustomAction com texto', () => {
    let received: string | null = null;
    const el = renderActionDockTopics(baseCtx({
      onCustomAction: (details: string) => { received = details; },
    }));
    document.body.appendChild(el);
    const livre = Array.from(el.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    const textarea = el.querySelector('.adt-custom-textarea') as HTMLTextAreaElement;
    textarea.value = 'abro o baú devagar';
    textarea.dispatchEvent(new Event('input'));
    const sendBtn = el.querySelector('.adt-custom-send') as HTMLButtonElement;
    sendBtn.click();
    expect(received).toBe('abro o baú devagar');
  });

  it('ψ.5 — customDetails preservado entre re-mounts (mesma sessão)', () => {
    // 1º mount: abre custom, digita texto
    const el1 = renderActionDockTopics(baseCtx());
    document.body.appendChild(el1);
    const livre = Array.from(el1.querySelectorAll('.adt-card'))
      .find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement;
    livre.click();
    const textarea1 = el1.querySelector('.adt-custom-textarea') as HTMLTextAreaElement;
    textarea1.value = 'tento subir na árvore';
    textarea1.dispatchEvent(new Event('input'));

    // Simula re-mount (campaign-screen render() recria componente).
    // O state externo já tem currentTopic='custom' + customDetails='...'
    // então o novo mount JÁ renderiza drill com textarea preenchida.
    document.body.innerHTML = '';
    const el2 = renderActionDockTopics(baseCtx());
    document.body.appendChild(el2);
    // NÃO clicar livre — drill já tá aberto via state externo preservado
    const textarea2 = el2.querySelector('.adt-custom-textarea') as HTMLTextAreaElement;
    expect(textarea2).toBeTruthy();
    expect(textarea2.value).toBe('tento subir na árvore'); // preserved!
  });

  it('ψ.5 — resetActionDockState limpa customDetails', () => {
    const el1 = renderActionDockTopics(baseCtx());
    document.body.appendChild(el1);
    (Array.from(el1.querySelectorAll('.adt-card')).find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement).click();
    const textarea = el1.querySelector('.adt-custom-textarea') as HTMLTextAreaElement;
    textarea.value = 'algo';
    textarea.dispatchEvent(new Event('input'));

    resetActionDockState();

    document.body.innerHTML = '';
    const el2 = renderActionDockTopics(baseCtx());
    document.body.appendChild(el2);
    (Array.from(el2.querySelectorAll('.adt-card')).find((c) => c.textContent?.includes('Livre')) as HTMLButtonElement).click();
    const textarea2 = el2.querySelector('.adt-custom-textarea') as HTMLTextAreaElement;
    expect(textarea2.value).toBe(''); // limpou
  });
});

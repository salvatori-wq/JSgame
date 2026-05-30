// JSgame · Classes de ambiente no <body> (device-aware) — Responsivo F3.
//
// FONTE ÚNICA do breakpoint mobile. Extraída de main.ts (era um IIFE width<600)
// pra o sweep de responsividade (F5) reusar o MESMO predicado sem importar o
// app inteiro — main.ts tem side-effects (socket.io, render, service worker).
//
// Predicado device-aware:
//   compact = w < 600                          retrato-estreito (qualquer device)
//          || (coarse && h < 600 && w < 950)   deitado-curto-DE-TOQUE; exclui
//                                              tablet coarse GRANDE (≥950)
//   landscapePhone = compact && w >= 600 && w > h   (modifier ADITIVO)
//
// O gate `coarse` protege o desktop: uma janela fina/baixa de laptop
// (pointer fine, ex. 900×500) NUNCA vira compact — mata a regressão do antigo
// Math.min(w,h)<600 que o width<600 já resolvia, sem reintroduzi-la.
//
// landscape-phone NÃO é um shell próprio: o is-portrait-narrow já entrega o
// shell compacto inteiro (ribbon fina + barra de ações inferior + height:100dvh).
// O is-landscape-phone só LIGA os deltas de paisagem (m-camp-dock.css F3.2).

/** Detecta ponteiro grosso / touch (matchMedia pode faltar em happy-dom). */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const touchEvt = 'ontouchstart' in window;
  const touchPts = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return mm || touchEvt || touchPts;
}

/**
 * Aplica is-touch / vertical-layout / is-portrait-narrow / is-landscape-phone
 * no <body> conforme o viewport + tipo de ponteiro atual. Idempotente —
 * pode ser chamada no boot e em cada resize/orientationchange.
 */
export function applyEnvironmentClasses(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const coarse = isCoarsePointer();
  document.body.classList.toggle('is-touch', coarse);
  document.body.classList.add('vertical-layout');

  const w = window.innerWidth;
  const h = window.innerHeight;
  const compact = w < 600 || (coarse && h < 600 && w < 950);
  const landscapePhone = compact && w >= 600 && w > h;
  document.body.classList.toggle('is-portrait-narrow', compact);
  document.body.classList.toggle('is-landscape-phone', landscapePhone);
}

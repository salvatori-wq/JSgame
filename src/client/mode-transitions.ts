// JSgame · ο.7 — Visual Rhythm + Mode Transitions.
// Vinhetas cinematográficas pra mudanças de modo: combat-enter, combat-exit,
// scene-change, long-rest, revive. CSS-only (sem libs). prefers-reduced-motion
// fallback = aplica state final instantâneo.

const VIGNETTE_ID = 'mode-transition-vignette';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return mq?.matches ?? false;
}

function ensureVignette(): HTMLDivElement {
  let el = document.getElementById(VIGNETTE_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = VIGNETTE_ID;
    el.className = 'mode-transition-vignette';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function trigger(kind: string, durationMs: number): void {
  if (prefersReducedMotion()) return;
  const el = ensureVignette();
  el.className = `mode-transition-vignette is-active is-${kind}`;
  // Cleanup
  window.setTimeout(() => {
    el.classList.remove('is-active');
    el.className = 'mode-transition-vignette';
  }, durationMs);
}

/** Entrada em combate — vinheta vermelha + haptic warn (W3-Mobile Sprint W).
 * Consultor Mobile: "macro-momento (exploration→combat) precisa de vinheta —
 * Marvel Snap faz isso em cada match-found". Já tinha vinheta CSS; W3 adiciona
 * haptic 30ms pulse pra reforçar o impacto no corpo, e usa duração mais longa
 * (700ms) pra player ter tempo de internalizar a transição. */
export function transitionToCombat(): void {
  // Haptic burst sem dependência (audio.ts não tem pra evitar imports cruzados)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([30, 40, 30]); // pulse breve, pause, pulse final
    }
  } catch { /* silent */ }
  trigger('combat-enter', 700);
}

/** Saída combate vitória — vinheta dourada radiating 800ms. */
export function transitionCombatVictory(): void {
  trigger('combat-victory', 1000);
}

/** Saída combate derrota — vinheta preta drone 1.2s. */
export function transitionCombatDefeat(): void {
  trigger('combat-defeat', 1500);
}

/** Scene change — flash sutil 1.2s. */
export function transitionSceneChange(): void {
  trigger('scene-change', 1200);
}

/** Long rest — dissolve to dawn (fade dourado pálido 1.5s). */
export function transitionLongRest(): void {
  trigger('long-rest', 1800);
}

/** Revive — vinheta cura verde 600ms. */
export function transitionRevive(): void {
  trigger('revive', 800);
}

/** Limpa qualquer transição ativa (útil em destroy/route change). */
export function clearTransitions(): void {
  const el = document.getElementById(VIGNETTE_ID);
  if (el) {
    el.classList.remove('is-active');
    el.className = 'mode-transition-vignette';
  }
}

// Helpers pra tests
export function _prefersReducedMotionForTest(): boolean {
  return prefersReducedMotion();
}

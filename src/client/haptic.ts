// JSgame · Haptic feedback wrapper sobre navigator.vibrate.
// Mobile-only no efeito (desktop ignora silenciosamente). Patterns curtos
// pra poupar bateria — vibe nunca dura mais que 300ms em pulso isolado.
//
// Usage: hapticTap() em qualquer click memorável, hapticCrit() em nat 20,
// hapticFumble() em nat 1. Degrade gracefully via 'vibrate' in navigator.
//
// IMPORTANT: respeita user setting (jsgame.haptic.enabled localStorage).
// Default ON, mas player pode desligar via settings menu (γ.5 audit).

const STORAGE_KEY = 'jsgame.haptic.enabled';

let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; }
  catch { return true; }
})();

export function isHapticEnabled(): boolean { return enabled; }
export function setHapticEnabled(v: boolean): void {
  enabled = v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); }
  catch { /* private mode → ignore */ }
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(pattern);
    }
  } catch {
    // Browser bloqueou (iOS sem suporte, permissão negada, etc) — silent skip
  }
}

/** Tap leve — feedback de "começou" ou "OK suave". 20ms. */
export function hapticTap(): void { vibrate(20); }

/** Sucesso normal — tap único 40ms. */
export function hapticSuccess(): void { vibrate(40); }

/** Crit / nat 20 — 3 pulses celebratórios. */
export function hapticCrit(): void { vibrate([80, 40, 80, 40, 80]); }

/** Fumble / nat 1 — long buzz de 300ms. */
export function hapticFumble(): void { vibrate(300); }

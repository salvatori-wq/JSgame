// JSgame · T3.3 — Long Rest ritual visual.
// Overlay cinematográfico curto (~1.8s) ao confirmar descanso longo.
// Sequência: 🌙 noite cai → ⭐ estrelas → ☀ amanhecer.
// prefers-reduced-motion: pula direto pro callback (sem animação).

import { el } from '../util';

const SEQUENCE: Array<{ icon: string; label: string; durationMs: number }> = [
  { icon: '🌙', label: 'A noite cai…',     durationMs: 700 },
  { icon: '⭐', label: 'O grupo descansa…', durationMs: 600 },
  { icon: '☀',  label: 'Amanhece',          durationMs: 700 },
];

const DEFAULT_TOTAL_MS = SEQUENCE.reduce((sum, s) => sum + s.durationMs, 0);

export function playLongRestRitual(onDone: () => void): void {
  // Respeita reduced-motion: chama callback imediato sem overlay.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    onDone();
    return;
  }

  const overlay = el('div', { class: 'lrr-overlay', attrs: { 'aria-hidden': 'true' } });
  const stage = el('div', { class: 'lrr-stage' });
  const icon = el('div', { class: 'lrr-icon', text: SEQUENCE[0]!.icon });
  const label = el('div', { class: 'lrr-label', text: SEQUENCE[0]!.label });
  stage.appendChild(icon);
  stage.appendChild(label);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);

  let idx = 0;
  const showNext = (): void => {
    idx++;
    if (idx >= SEQUENCE.length) {
      // Fade out + callback
      overlay.classList.add('is-closing');
      window.setTimeout(() => {
        overlay.remove();
        onDone();
      }, 250);
      return;
    }
    const step = SEQUENCE[idx]!;
    icon.classList.add('is-changing');
    label.classList.add('is-changing');
    window.setTimeout(() => {
      icon.textContent = step.icon;
      label.textContent = step.label;
      icon.classList.remove('is-changing');
      label.classList.remove('is-changing');
    }, 140);
    window.setTimeout(showNext, step.durationMs);
  };

  window.setTimeout(showNext, SEQUENCE[0]!.durationMs);
}

/** Exportado pra tests verificarem total mínimo */
export const LONG_REST_RITUAL_TOTAL_MS = DEFAULT_TOTAL_MS;
export const LONG_REST_RITUAL_SEQUENCE = SEQUENCE;

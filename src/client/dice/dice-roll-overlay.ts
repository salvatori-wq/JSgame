// JSgame · γ.1 — Dice roll overlay genérico (combat attack roll, etc).
// Wrapper modal reusável pra ROLLS de combate (não substitui skill-check-overlay
// que tem botão "Rolar" + uso de inspiração; este é "fire-and-show" só).
//
// Uso (combat attack roll):
//   showDiceRollOverlay({
//     kind: 'd20',
//     preview: 'Ataque: d20+5 vs CA 13',
//     onMount: (die) => {
//       rollAndReveal(die, { final: 18, special: 'crit', onDone: () => ... });
//     },
//   });
//
// Auto-close após 1.5s do reveal. Caller pode forçar close via closeDiceRollOverlay().

import { el } from '../util';
import { renderDie, rollAndReveal, type DieKind, type DieSpecial, prefersReducedMotion } from './dice-3d';
import {
  playDiceRolling, playDiceLand, playDiceCritTing, playDiceFumble,
} from '../audio';
import { hapticTap, hapticCrit, hapticFumble, hapticSuccess } from '../haptic';
import { showToast } from '../toast';
import { trackClientMetric } from '../api';

let currentEl: HTMLDivElement | null = null;
let currentTimer: number | null = null;
/** Ω.1 — Watchdog combat: se rollAndReveal não chegar em onDone em 8s
 * (1800ms anim + 1500ms close + buffer), fecha overlay + telemetria. */
let watchdogTimer: number | null = null;
const COMBAT_WATCHDOG_MS = 8000;

export interface DiceRollOverlayOpts {
  kind: DieKind;
  /** Texto curto descrevendo o roll (ex: "Ataque: d20+5 vs CA 13"). */
  preview?: string;
  /** Label de topo (ex: "ATAQUE", "SKILL CHECK"). */
  label?: string;
  /** Final value pra revelar. */
  final: number;
  /** Special verdict. */
  special?: DieSpecial;
  /** Verdict text exibido pós-reveal. */
  verdictText?: string;
  /** Callback executado após reveal+auto-close. */
  onClose?: () => void;
  /** Duração extra pós-reveal antes de fechar. Default 1500ms. */
  showAfterMs?: number;
  /** Skip screen flash em crit (caso já tenha outra anim disparada). */
  noScreenFlash?: boolean;
}

/**
 * Abre overlay, anima dado rolando, revela final, dispara audio+haptic,
 * fecha automaticamente após showAfterMs. Idempotente — fecha overlay anterior.
 */
export function showDiceRollOverlay(opts: DiceRollOverlayOpts): void {
  closeDiceRollOverlay();

  const overlay = el('div', { class: 'dice-roll-overlay', attrs: { 'data-die-kind': opts.kind } }) as HTMLDivElement;
  const stage = el('div', { class: 'dro-stage' });

  if (opts.label) {
    stage.appendChild(el('div', { class: 'dro-label', text: opts.label }));
  }
  if (opts.preview) {
    stage.appendChild(renderPreviewChips(opts.preview));
  }

  const die = renderDie({ kind: opts.kind, value: '?' });
  stage.appendChild(die);

  const verdict = el('div', { class: 'dro-verdict', text: '…' });
  stage.appendChild(verdict);

  overlay.appendChild(stage);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  // Camada 1 (visual+som): roll start
  playDiceRolling();
  hapticTap();

  // Ω.1 — Watchdog combat. Se algo travar (DOM removido, anim engasgada),
  // garante que overlay não fica órfão na tela.
  if (watchdogTimer !== null) window.clearTimeout(watchdogTimer);
  watchdogTimer = window.setTimeout(() => {
    if (currentEl) {
      try {
        showToast({ kind: 'warn', message: 'A rolagem demorou. Voltando ao combate.', durationMs: 3000 });
      } catch { /* silent */ }
      try {
        trackClientMetric('dice_roll_timeout', { kind: 'combat' });
      } catch { /* silent */ }
      closeDiceRollOverlay();
      opts.onClose?.();
    }
  }, COMBAT_WATCHDOG_MS);

  // Animação spin + reveal
  rollAndReveal(die, {
    final: opts.final,
    special: opts.special,
    // ψ.1 — playDiceLand no impacto físico (35% do duration), não no fim.
    // Som "tac" agora sincroniza com o bounce visual.
    onLand: () => {
      playDiceLand();
    },
    onDone: () => {
      // Camada 3 (opcional): crit ting OU fumble dread
      if (opts.special === 'crit') {
        playDiceCritTing();
        hapticCrit();
        if (!opts.noScreenFlash) flashScreen();
      } else if (opts.special === 'fumble') {
        playDiceFumble();
        hapticFumble();
      } else if (opts.special === 'success') {
        hapticSuccess();
      }

      // Verdict text
      if (opts.verdictText) {
        verdict.textContent = opts.verdictText;
      }
      if (opts.special === 'crit') verdict.classList.add('is-crit');
      else if (opts.special === 'fumble') verdict.classList.add('is-fumble');
      else if (opts.special === 'success') verdict.classList.add('is-success');
      else if (opts.special === 'fail') verdict.classList.add('is-fail');

      // ARIA — anuncia resultado pra screen readers
      const ariaLive = el('div', {
        class: 'visually-hidden',
        attrs: { role: 'alert', 'aria-live': 'polite' },
        text: `Resultado: ${opts.final}${opts.verdictText ? ` — ${opts.verdictText}` : ''}`,
      });
      stage.appendChild(ariaLive);

      const closeAfter = opts.showAfterMs ?? 1500;
      currentTimer = window.setTimeout(() => {
        closeDiceRollOverlay();
        opts.onClose?.();
      }, closeAfter);
    },
  });
}

export function closeDiceRollOverlay(): void {
  if (currentTimer !== null) {
    window.clearTimeout(currentTimer);
    currentTimer = null;
  }
  if (watchdogTimer !== null) {
    window.clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  currentEl?.remove();
  currentEl = null;
}

/** Screen flash dourado pulsante — crit em combate. Respeita reduced-motion. */
function flashScreen(): void {
  if (prefersReducedMotion()) return;
  const flash = el('div', { class: 'dice-screen-flash', attrs: { 'aria-hidden': 'true' } });
  document.body.appendChild(flash);
  window.setTimeout(() => flash.remove(), 700);
}

/**
 * T3.2 — Quebra preview "Ataque: d20+5 vs CA 13" em chips visuais separados:
 *   [Ataque:] [d20] [+5] [vs CA 13]
 * Cada parte ganha classe distinta pra CSS colorir. Se não der match no padrão,
 * cai pro texto plano (graceful fallback).
 *
 * Exportado pra tests.
 */
export function parsePreviewParts(preview: string): {
  prefix: string | null;
  die: string | null;
  bonus: string | null;
  vs: string | null;
  fallback: string | null;
} {
  // Tenta extrair: "<prefix>: <die>[+-]<bonus> vs <target>"
  // Ex: "Ataque: d20+5 vs CA 13" / "d20+3 vs CD 12" / "Save: d20-1 vs CD 14"
  const m = preview.match(/^(?:(.+?):\s*)?(d\d+)\s*([+\-]\s*\d+)?\s*(?:vs\s+(.+))?$/i);
  if (!m) return { prefix: null, die: null, bonus: null, vs: null, fallback: preview };
  const [, prefix, die, bonus, vs] = m;
  return {
    prefix: prefix ? prefix.trim() : null,
    die: die ?? null,
    bonus: bonus ? bonus.replace(/\s/g, '') : null,
    vs: vs ? vs.trim() : null,
    fallback: null,
  };
}

function renderPreviewChips(preview: string): HTMLElement {
  const parts = parsePreviewParts(preview);
  const wrap = el('div', { class: 'dro-preview' });
  if (parts.fallback) {
    // Sem match — texto puro como antes
    wrap.textContent = parts.fallback;
    return wrap;
  }
  if (parts.prefix) wrap.appendChild(el('span', { class: 'dro-prev-prefix', text: parts.prefix }));
  if (parts.die) wrap.appendChild(el('span', { class: 'dro-prev-die', text: parts.die }));
  if (parts.bonus) wrap.appendChild(el('span', { class: 'dro-prev-bonus', text: parts.bonus }));
  if (parts.vs) wrap.appendChild(el('span', { class: 'dro-prev-vs', text: `vs ${parts.vs}` }));
  return wrap;
}

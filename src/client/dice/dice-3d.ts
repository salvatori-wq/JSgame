// JSgame · Componente Dado 3D-ish CSS reusável.
// Encapsula um "die" visual com sombra projetada, rotação 3D e revelação animada.
//
// Uso típico (skill check ou combate):
//   const die = renderDie({ kind: 'd20', value: 18, special: undefined });
//   container.appendChild(die);
//   await rollAndReveal(die, { final: 18, special: 'crit', onDone });
//
// O CSS vive em styles/dice.css. Animação respeita prefers-reduced-motion
// (anima 200ms em vez de 1100ms; sem screen shake; flash sólido).
//
// IMPORTANT: este componente é PURO display — não toca audio nem haptic.
// Caller (dice-roll-overlay.ts) é quem orquestra audio+haptic+visual.

import { el } from '../util';

export type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type DieSpecial = 'crit' | 'fumble' | 'success' | 'fail' | null;

export interface RenderDieOpts {
  kind: DieKind;
  /** Initial face shown. Use '?' pra antes de rolar. */
  value?: number | string;
  special?: DieSpecial;
}

/**
 * Cria um Dado visual 3D-ish. Pure DOM — chamador insere no container desejado.
 * data-kind / data-value pra testabilidade (testes leem atributos).
 */
export function renderDie(opts: RenderDieOpts): HTMLDivElement {
  const value = opts.value ?? '?';
  const die = el('div', {
    class: `die-3d die-${opts.kind} ${opts.special ? `die-${opts.special}` : ''}`,
    attrs: {
      'data-kind': opts.kind,
      'data-value': String(value),
      'role': 'img',
      'aria-label': `${opts.kind.toUpperCase()} mostrando ${value}`,
    },
  }) as HTMLDivElement;

  // Layered: shadow + face. Shadow é um pseudo-element via CSS, face é o text.
  const face = el('span', { class: 'die-face', text: String(value) });
  die.appendChild(face);

  // Sombra projetada — div absoluta sob o dado pra dar profundidade
  const shadow = el('span', { class: 'die-shadow', attrs: { 'aria-hidden': 'true' } });
  die.appendChild(shadow);

  return die;
}

export interface RollAndRevealOpts {
  /** Valor final a revelar (será setado em data-value e text). */
  final: number;
  /** Tipo do verdict. Determina classes CSS e som extra. */
  special?: DieSpecial;
  /** Callback quando a animação completa. */
  onDone?: () => void;
  /** ψ.1 — Callback quando dado "pousa" (35% do duration). Usar pra audio sync
   * (playDiceLand bate no impacto, não no fim). */
  onLand?: () => void;
  /** Callback a cada "tick" durante o spin — útil pra tocar sons em camadas. */
  onTick?: (intermediate: number) => void;
  /** Override duração da animação (ms). Default 1800ms (ψ.1), reduced-motion = 600ms (Ω.1 dramatic). */
  durationMs?: number;
  /** Max value pra mostrar números aleatórios durante o spin (depende do tipo do dado). */
  maxFace?: number;
}

/** Fase 1 — Opções de `startSpinning` (giro infinito sem valor final ainda). */
export interface StartSpinningOpts {
  /** Max value pra números aleatórios durante o spin (deriva do data-kind se omitido). */
  maxFace?: number;
  /** Callback a cada tick (número aleatório intermediário) — pra sons em camadas. */
  onTick?: (intermediate: number) => void;
}

/** Fase 1 — Opções de `settle` (assentar o giro no valor final). */
export interface SettleOpts {
  /** Tipo do verdict. Determina classes CSS e som extra. */
  special?: DieSpecial;
  /** Callback quando o reveal final completa. */
  onDone?: () => void;
  /** ψ.1 — Callback no "pouso" (35% da durationMs de aterrissagem). */
  onLand?: () => void;
  /** Duração da aterrissagem antes de revelar (ms). Default 1800 (reduced 600).
   * 0 = revela na hora (sem drama extra). */
  durationMs?: number;
}

/**
 * Fase 1 — Handle de um dado girando. O giro é 100% client-side e começa no
 * toque (não depende do servidor). Quando o número final chega, `settle()`
 * assenta o dado nele; se nunca chegar, `stop()` volta pro "?" (watchdog).
 */
export interface SpinHandle {
  /** Para o loop infinito e revela o valor final (com drama de durationMs). */
  settle(final: number, opts?: SettleOpts): void;
  /** Aborta o giro e volta o dado pro "?" (sem revelar). Pro watchdog. */
  stop(): void;
  /** True depois que settle revelou OU stop abortou (terminal). */
  readonly done: boolean;
}

/** Ω.1 — Telemetria opt-in: caller passa uma fn quando quer log. Sem default. */
let _telemetryHook: ((kind: string, data?: Record<string, unknown>) => void) | null = null;
export function setDiceTelemetryHook(hook: ((kind: string, data?: Record<string, unknown>) => void) | null): void {
  _telemetryHook = hook;
}

/**
 * Fase 1 — Começa a girar o dado AGORA, sem saber o valor final. Roda o tick
 * loop (números aleatórios) indefinidamente e retorna um handle. Use no toque
 * (skill-check), antes de qualquer ida ao servidor — o dado nunca congela.
 *
 * Compõe `rollAndReveal` (giro + assenta imediato) sem mudar a assinatura dele.
 */
export function startSpinning(die: HTMLDivElement, opts: StartSpinningOpts = {}): SpinHandle {
  const reduced = prefersReducedMotion();
  const maxFace = opts.maxFace ?? maxFaceForKind(die.getAttribute('data-kind') as DieKind);

  // Ω.1 — Re-query defensive: caller pode ter mutado DOM entre renderDie e o spin.
  let face = die.querySelector('.die-face') as HTMLSpanElement | null;
  if (!face) {
    face = el('span', { class: 'die-face', text: '?' }) as HTMLSpanElement;
    die.appendChild(face);
    _telemetryHook?.('dice_roll_face_missing', { kind: die.getAttribute('data-kind') });
  }

  // ψ.1 — Variação angular do drop (cada roll fica visualmente distinto).
  if (!reduced) {
    const tilt = (Math.random() * 30 - 15).toFixed(1);
    die.style.setProperty('--dieTilt', `${tilt}deg`);
  }

  // Ω.1 — Limpa state antigo antes de aplicar rolling. Re-roll consecutivo
  // não fica preso em die-success/fail residual. Force reflow reinicia keyframe.
  die.classList.remove('is-rolling', 'die-crit', 'die-fumble', 'die-success', 'die-fail');
  void die.offsetWidth;
  die.classList.add('is-rolling');

  const startedAt = Date.now();
  _telemetryHook?.('dice_roll_visual_started', { reduced, kind: die.getAttribute('data-kind') });

  const tickIntervalMs = reduced ? 120 : 55;
  let tickTimer: number | null = window.setInterval(() => {
    const intermediate = 1 + Math.floor(Math.random() * maxFace);
    if (face) face.textContent = String(intermediate);
    opts.onTick?.(intermediate);
  }, tickIntervalMs);

  let landTimer: number | null = null;
  let revealTimer: number | null = null;
  let done = false;
  let settleStarted = false;

  const stopTick = (): void => {
    if (tickTimer !== null) { window.clearInterval(tickTimer); tickTimer = null; }
  };
  const clearPending = (): void => {
    if (landTimer !== null) { window.clearTimeout(landTimer); landTimer = null; }
    if (revealTimer !== null) { window.clearTimeout(revealTimer); revealTimer = null; }
  };

  return {
    get done(): boolean { return done; },
    stop(): void {
      if (done) return;
      done = true;
      stopTick();
      clearPending();
      die.classList.remove('is-rolling');
      if (face) face.textContent = '?';
      die.setAttribute('data-value', '?');
      _telemetryHook?.('dice_roll_spin_stopped', { elapsed: Date.now() - startedAt });
    },
    settle(final: number, sOpts: SettleOpts = {}): void {
      if (done || settleStarted) return;
      settleStarted = true;
      const duration = sOpts.durationMs ?? (reduced ? 600 : 1800);

      let landFired = false;
      const fireLand = (): void => {
        if (landFired) return;
        landFired = true;
        if (landTimer !== null) { window.clearTimeout(landTimer); landTimer = null; }
        sOpts.onLand?.();
      };
      const doReveal = (): void => {
        if (done) return;
        done = true;
        stopTick();
        clearPending();
        die.classList.remove('is-rolling');
        if (face) {
          face.textContent = String(final);
          void face.offsetWidth; // força repaint
        }
        die.setAttribute('data-value', String(final));
        if (sOpts.special) die.classList.add(`die-${sOpts.special}`);
        fireLand(); // garante onLand (race extrema)
        const elapsed = Date.now() - startedAt;
        _telemetryHook?.('dice_roll_visual_completed', { elapsed, expected: duration, kind: die.getAttribute('data-kind') });
        sOpts.onDone?.();
      };

      if (duration <= 0) { doReveal(); return; }
      // Continua girando por `duration` (aterrissagem), com onLand a 35% (50% reduced).
      const landAt = reduced ? duration * 0.5 : duration * 0.35;
      landTimer = window.setTimeout(fireLand, landAt);
      revealTimer = window.setTimeout(doReveal, duration);
    },
  };
}

/**
 * Anima o dado: spin com números rotativos aleatórios, depois revela o final.
 * Adiciona/remove classes CSS pra disparar keyframes definidos em dice.css.
 *
 * Fase 1 — agora é só `startSpinning` + `settle` imediato. Mesma assinatura,
 * mesmo timing → combate e saving-throw (que já passam o `final`) não mudam.
 */
export function rollAndReveal(die: HTMLDivElement, opts: RollAndRevealOpts): void {
  const handle = startSpinning(die, { maxFace: opts.maxFace, onTick: opts.onTick });
  handle.settle(opts.final, {
    special: opts.special,
    onDone: opts.onDone,
    onLand: opts.onLand,
    durationMs: opts.durationMs,
  });
}

function maxFaceForKind(kind: DieKind | null): number {
  switch (kind) {
    case 'd4': return 4;
    case 'd6': return 6;
    case 'd8': return 8;
    case 'd10': return 10;
    case 'd12': return 12;
    case 'd20': return 20;
    case 'd100': return 100;
    default: return 20;
  }
}

export function prefersReducedMotion(): boolean {
  // Ω.1 — Override: se user marcou "Forçar animações cinematográficas" em UX Settings
  // (default ON), body.force-motion vence prefers-reduced-motion do OS. Player com
  // Android Settings → Acessibilidade → "Remover animações" ativo vê dado completo.
  try {
    if (typeof document !== 'undefined' && document.body?.classList.contains('force-motion')) {
      return false;
    }
  } catch { /* SSR or no body */ }
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

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

/** Ω.1 — Telemetria opt-in: caller passa uma fn quando quer log. Sem default. */
let _telemetryHook: ((kind: string, data?: Record<string, unknown>) => void) | null = null;
export function setDiceTelemetryHook(hook: ((kind: string, data?: Record<string, unknown>) => void) | null): void {
  _telemetryHook = hook;
}

/**
 * Anima o dado: spin com números rotativos aleatórios, depois revela o final.
 * Adiciona/remove classes CSS pra disparar keyframes definidos em dice.css.
 */
export function rollAndReveal(die: HTMLDivElement, opts: RollAndRevealOpts): void {
  const reduced = prefersReducedMotion();
  // Ω.1 — Duração default: ψ.1 1800ms drama, reduced-motion sobe pra 600ms (dramatic
  // reveal: scale 0.6→1.15→1 + ticks de números, não fade invisível de 200ms).
  const duration = opts.durationMs ?? (reduced ? 600 : 1800);
  const maxFace = opts.maxFace ?? maxFaceForKind(die.getAttribute('data-kind') as DieKind);

  // Ω.1 — Re-query defensive: caller pode ter mutado DOM entre renderDie e rollAndReveal.
  let face = die.querySelector('.die-face') as HTMLSpanElement | null;
  if (!face) {
    // Estrutura inválida — fallback dramático: cria face faltante e segue normal.
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
  // não fica preso em die-success/fail residual.
  die.classList.remove('is-rolling', 'die-crit', 'die-fumble', 'die-success', 'die-fail');
  // Force reflow pra browser reiniciar keyframe (caso re-roll mesmo elemento).
  void die.offsetWidth;
  die.classList.add('is-rolling');

  _telemetryHook?.('dice_roll_visual_started', { duration, reduced, kind: die.getAttribute('data-kind') });
  const startedAt = Date.now();

  // ψ.1 — onLand callback no momento de pouso (35% do duration). Caller usa pra
  // tocar playDiceLand() exatamente no impacto físico, não no fim.
  let landFired = false;
  const landAt = reduced ? duration * 0.5 : duration * 0.35;
  const landTimer = window.setTimeout(() => {
    landFired = true;
    opts.onLand?.();
  }, landAt);

  // Ω.1 — Em reduced-motion mostra ticks também (4-5 números) pra ter drama mínimo.
  // Antes: tickInterval=0 = number swap direto (invisível). Agora: tick 120ms.
  const tickIntervalMs = reduced ? 120 : 55;
  const spinStart = Date.now();

  const finish = (): void => {
    die.classList.remove('is-rolling');
    if (face) {
      face.textContent = String(opts.final);
      // Ω.1 — Force browser repaint pra garantir number visível.
      void face.offsetWidth;
    }
    die.setAttribute('data-value', String(opts.final));
    if (opts.special) {
      die.classList.add(`die-${opts.special}`);
    }
    // Garante onLand foi disparado (race condition extrema)
    if (!landFired) {
      landFired = true;
      window.clearTimeout(landTimer);
      opts.onLand?.();
    }
    const elapsed = Date.now() - startedAt;
    _telemetryHook?.('dice_roll_visual_completed', { elapsed, expected: duration, kind: die.getAttribute('data-kind') });
    if (elapsed > duration + 1500) {
      _telemetryHook?.('dice_roll_visual_slow', { elapsed, expected: duration });
    }
    opts.onDone?.();
  };

  const tick = window.setInterval(() => {
    const elapsed = Date.now() - spinStart;
    if (elapsed >= duration) {
      window.clearInterval(tick);
      finish();
      return;
    }
    const intermediate = 1 + Math.floor(Math.random() * maxFace);
    if (face) face.textContent = String(intermediate);
    opts.onTick?.(intermediate);
  }, tickIntervalMs);
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

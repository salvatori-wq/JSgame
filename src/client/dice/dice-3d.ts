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
  /** Callback a cada "tick" durante o spin — útil pra tocar sons em camadas. */
  onTick?: (intermediate: number) => void;
  /** Override duração da animação (ms). Default 1100ms, reduced-motion = 200ms. */
  durationMs?: number;
  /** Max value pra mostrar números aleatórios durante o spin (depende do tipo do dado). */
  maxFace?: number;
}

/**
 * Anima o dado: spin com números rotativos aleatórios, depois revela o final.
 * Adiciona/remove classes CSS pra disparar keyframes definidos em dice.css.
 */
export function rollAndReveal(die: HTMLDivElement, opts: RollAndRevealOpts): void {
  const reduced = prefersReducedMotion();
  const duration = opts.durationMs ?? (reduced ? 200 : 1100);
  const maxFace = opts.maxFace ?? maxFaceForKind(die.getAttribute('data-kind') as DieKind);

  const face = die.querySelector('.die-face') as HTMLSpanElement | null;
  if (!face) {
    // Estrutura inválida — fallback: só seta valor final e chama onDone.
    die.setAttribute('data-value', String(opts.final));
    opts.onDone?.();
    return;
  }

  // Adiciona classe rolling (CSS aplica keyframes)
  die.classList.add('is-rolling');
  die.classList.remove('die-crit', 'die-fumble', 'die-success', 'die-fail');

  // Em reduced-motion, pula a animação de números rolando — só fade-swap rápido.
  const tickIntervalMs = reduced ? 0 : 55;
  const spinStart = Date.now();

  const finish = (): void => {
    die.classList.remove('is-rolling');
    face.textContent = String(opts.final);
    die.setAttribute('data-value', String(opts.final));
    if (opts.special) {
      die.classList.add(`die-${opts.special}`);
    }
    opts.onDone?.();
  };

  if (tickIntervalMs === 0) {
    window.setTimeout(finish, duration);
    return;
  }

  const tick = window.setInterval(() => {
    const elapsed = Date.now() - spinStart;
    if (elapsed >= duration) {
      window.clearInterval(tick);
      finish();
      return;
    }
    const intermediate = 1 + Math.floor(Math.random() * maxFace);
    face.textContent = String(intermediate);
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
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

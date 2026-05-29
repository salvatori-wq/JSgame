// JSgame · κ.1 — Tutorial Duolingo-style guiado pra primeira sessão.
//
// Diferente do exploration-tutorial.ts (modal central com cards passivos),
// este é UM TUTORIAL ATIVO COM SPOTLIGHT: cada passo destaca visualmente um
// componente real da tela (narration, action dock, party panel, tab bar) com
// hole na backdrop + tooltip flutuante apontando.
//
// Dispara na PRIMEIRA SESSÃO (sessionNumber=1) após primeira narração chegar.
// Dismissable a qualquer momento via "Pular ✕" canto sup-direito.
// localStorage flag pra não reaparecer. Telemetria por step.

import { el } from '../util';
import { trackClientMetric } from '../api';

const STORAGE_KEY = 'jsgame.tutorial.duolingo.v1';

export function shouldShowDuolingoTutorial(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== '1'; } catch { return false; }
}

/** Há um overlay de ROLAGEM aberto (skill-check z-9000 ou dado de combate)?
 * O tutorial Duolingo é z-10000 — se abrir junto, a folha central dele TAPA o
 * dado + o botão "Rolar". O cold-open mostra um skill-check imediatamente, então
 * o disparo do tutorial precisa adiar enquanto isto for true (senão o player vê
 * o dado escondido = "dado não joga"). Exportado pra ser testável. */
export function isRollOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('.sc-overlay, .dice-roll-overlay');
}

export function markDuolingoTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

/** Reset pra tests. */
export function resetDuolingoTutorialForTest(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  // Cleanup listeners de qualquer instance ainda viva (test prior não fechou)
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  const existing = document.querySelectorAll('.dt-overlay');
  existing.forEach((el) => el.remove());
  // Reset module-level state pra cada test começar limpo
  overlayEl = null;
  currentStepIdx = 0;
}

interface Step {
  /** Selector do componente alvo. Null = modal central (intro/outro). */
  targetSelector: string | null;
  glyph: string;
  title: string;
  text: string;
  /** Default 'auto' — calcula best position. 'top'/'bottom'/'center'. */
  position?: 'top' | 'bottom' | 'center' | 'auto';
}

const STEPS: Step[] = [
  {
    targetSelector: null,
    position: 'center',
    glyph: '🌒',
    title: 'Bem-vindo à mesa',
    text: 'D&D 5e com Mestre IA. Vou te mostrar a tela rapidinho — pula quando quiser.',
  },
  {
    targetSelector: '.ch-narration-host',
    position: 'auto',
    glyph: '👁',
    title: 'O Mestre narra aqui',
    text: 'Leia cada cena. Cada palavra importa — locais, NPCs, ameaças, ganchos. O Mestre lembra de tudo.',
  },
  {
    targetSelector: '.ch-slot-main-content',
    position: 'top',
    glyph: '👆',
    title: 'Aqui você age',
    text: 'Escolha um tópico (Combate · Explorar · Social · Magia) ou escreva uma ação livre. O Mestre interpreta tudo.',
  },
  {
    // Sub-sprint D3 — Step novo focado em como rolar dado (era invisível
    // pra Henrique). Aponta pra qualquer chip-skill (.is-skill) se houver;
    // senão fallback no slot main-content.
    targetSelector: '.cn-chip.is-skill, .ch-slot-main-content',
    position: 'top',
    glyph: '🎲',
    title: 'Como rolar o dado?',
    text: 'Chips com 🎲 e badge dourado rolam d20 (ex: "Observar 🔸PERCEPÇÃO"). Sem chip à mão? Use o slot "🎲 Tentar" no dock pra escolher qual perícia rolar.',
  },
  {
    targetSelector: '.ch-slot-party',
    position: 'bottom',
    glyph: '🛡',
    title: 'Sua ficha viva',
    text: 'HP, CA, conditions, slots de magia. Em coop, todos os PJs aparecem aqui. Cuide deles — death save é real.',
  },
  {
    targetSelector: '.bottom-tab-bar',
    position: 'top',
    glyph: '🗺',
    title: 'Tudo num tap',
    text: 'Missões, Glórias, NPCs, Chat e Mais (sons, glossário, dificuldade). Tab bar persistente — não precisa caçar.',
  },
  {
    targetSelector: null,
    position: 'center',
    glyph: '✨',
    title: 'Boa aventura',
    text: 'O Mestre te espera. Em caso de dúvida, abre "Mais → Glossário". Dúvida tá no PHB? Tá no glossário.',
  },
];

let overlayEl: HTMLElement | null = null;
let currentStepIdx = 0;
let currentCleanup: (() => void) | null = null;

interface OpenOpts {
  onClose?: () => void;
}

export function openDuolingoTutorial(opts: OpenOpts = {}): void {
  if (overlayEl) return;
  currentStepIdx = 0;

  const overlay = el('div', {
    class: 'dt-overlay',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tutorial JSgame' },
  });
  const backdrop = el('div', { class: 'dt-backdrop' });
  const spotlight = el('div', { class: 'dt-spotlight', attrs: { 'aria-hidden': 'true' } });
  const tooltip = el('div', { class: 'dt-tooltip' });

  overlay.appendChild(backdrop);
  overlay.appendChild(spotlight);
  overlay.appendChild(tooltip);

  const finish = (skipped: boolean): void => {
    trackClientMetric('duolingo_tutorial_step', {
      step: currentStepIdx + 1,
      total: STEPS.length,
      skipped,
      completed: !skipped,
    });
    markDuolingoTutorialDone();
    overlay.remove();
    overlayEl = null;
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    opts.onClose?.();
  };

  const renderStep = (): void => {
    tooltip.replaceChildren();
    const step = STEPS[currentStepIdx]!;
    const isFirst = currentStepIdx === 0;
    const isLast = currentStepIdx === STEPS.length - 1;

    // Header — progress + skip
    tooltip.appendChild(el('div', { class: 'dt-tooltip-header' }, [
      el('span', {
        class: 'dt-progress',
        text: `${currentStepIdx + 1} / ${STEPS.length}`,
      }),
      isLast ? null : el('button', {
        class: 'dt-skip',
        text: 'Pular ✕',
        attrs: { type: 'button', 'aria-label': 'Pular tutorial' },
        on: { click: () => finish(true) },
      }),
    ].filter(Boolean) as HTMLElement[]));

    // Content
    tooltip.appendChild(el('div', { class: 'dt-tooltip-glyph', text: step.glyph, attrs: { 'aria-hidden': 'true' } }));
    tooltip.appendChild(el('h3', { class: 'dt-tooltip-title', text: step.title }));
    tooltip.appendChild(el('p', { class: 'dt-tooltip-text', text: step.text }));

    // Nav
    const nav = el('div', { class: 'dt-tooltip-nav' });
    if (!isFirst) {
      nav.appendChild(el('button', {
        class: 'dt-nav-btn dt-back',
        text: '← Voltar',
        attrs: { type: 'button' },
        on: { click: () => { currentStepIdx--; renderStep(); } },
      }));
    }
    if (isLast) {
      nav.appendChild(el('button', {
        class: 'dt-nav-btn dt-done',
        text: '✓ Bora jogar',
        attrs: { type: 'button' },
        on: { click: () => finish(false) },
      }));
    } else {
      nav.appendChild(el('button', {
        class: 'dt-nav-btn dt-next',
        text: 'Próximo →',
        attrs: { type: 'button' },
        on: { click: () => { currentStepIdx++; renderStep(); } },
      }));
    }
    tooltip.appendChild(nav);

    positionSpotlightAndTooltip(step, spotlight, tooltip);

    // Telemetria por step
    trackClientMetric('duolingo_tutorial_step', {
      step: currentStepIdx + 1,
      total: STEPS.length,
      viewed: true,
    });
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      finish(true);
      return;
    }
    if (e.key === 'ArrowRight' && currentStepIdx < STEPS.length - 1) {
      currentStepIdx++;
      renderStep();
    } else if (e.key === 'ArrowLeft' && currentStepIdx > 0) {
      currentStepIdx--;
      renderStep();
    }
  };

  const onResize = (): void => {
    const step = STEPS[currentStepIdx]!;
    positionSpotlightAndTooltip(step, spotlight, tooltip);
  };

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });

  currentCleanup = (): void => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
  };

  document.body.appendChild(overlay);
  overlayEl = overlay;
  renderStep();
}

/** Posiciona spotlight em volta do target + tooltip flutuante. */
function positionSpotlightAndTooltip(
  step: Step,
  spotlight: HTMLElement,
  tooltip: HTMLElement,
): void {
  // Center step: sem spotlight, tooltip centralizado
  if (step.position === 'center' || !step.targetSelector) {
    spotlight.classList.remove('is-visible');
    tooltip.classList.remove('is-anchored');
    tooltip.classList.add('is-center');
    tooltip.style.removeProperty('top');
    tooltip.style.removeProperty('bottom');
    tooltip.style.removeProperty('left');
    tooltip.style.removeProperty('right');
    return;
  }

  const target = document.querySelector(step.targetSelector) as HTMLElement | null;
  if (!target) {
    // Componente não montado — fallback pra centro
    spotlight.classList.remove('is-visible');
    tooltip.classList.remove('is-anchored');
    tooltip.classList.add('is-center');
    return;
  }

  const rect = target.getBoundingClientRect();
  const PAD = 6;
  const spotLeft = Math.max(0, rect.left - PAD);
  const spotTop = Math.max(0, rect.top - PAD);
  const spotWidth = Math.min(window.innerWidth, rect.width + PAD * 2);
  const spotHeight = Math.min(window.innerHeight, rect.height + PAD * 2);

  spotlight.style.left = `${spotLeft}px`;
  spotlight.style.top = `${spotTop}px`;
  spotlight.style.width = `${spotWidth}px`;
  spotlight.style.height = `${spotHeight}px`;
  spotlight.classList.add('is-visible');

  tooltip.classList.remove('is-center');
  tooltip.classList.add('is-anchored');

  // Auto-position: prefere abaixo se sobra espaço, senão acima
  const vh = window.innerHeight;
  const tooltipApproxHeight = 220;
  let position = step.position ?? 'auto';
  if (position === 'auto') {
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    position = spaceBelow > tooltipApproxHeight || spaceBelow > spaceAbove ? 'bottom' : 'top';
  }

  tooltip.style.removeProperty('top');
  tooltip.style.removeProperty('bottom');
  if (position === 'bottom') {
    tooltip.style.top = `${Math.min(rect.bottom + 12, vh - tooltipApproxHeight - 12)}px`;
  } else {
    tooltip.style.bottom = `${Math.max(vh - rect.top + 12, 12)}px`;
  }
  // Horizontal centrado mas com clamp pra não vazar
  tooltip.style.left = '50%';
  tooltip.style.right = 'auto';
}

/** Pública pra outros módulos checarem se está aberto. */
export function isDuolingoTutorialOpen(): boolean {
  return overlayEl !== null;
}

/** Fecha sem marcar como done (use em destroy). */
export function closeDuolingoTutorial(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
}

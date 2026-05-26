// JSgame · F21 — Onboarding tour. Popup welcome+steps no primeiro acesso.
// Persiste flag em localStorage. Pula em sessions subsequentes.

import { el } from './util';

const STORAGE_KEY = 'jsgame.onboarded.v1';

interface Step {
  title: string;
  text: string;
  icon: string;
}

const STEPS: Step[] = [
  {
    icon: '⚔',
    title: 'Bem-vindo a JSgame',
    text: 'D&D 5e online com Mestre IA. Crie um PJ, comece uma crônica e jogue solo ou em coop com amigos.',
  },
  {
    icon: '🎭',
    title: 'Crie seu Personagem',
    text: 'Wizard de 5 passos: raça, classe, atributos (point buy 27), antecedente, identidade. Tudo PHB autêntico.',
  },
  {
    icon: '🎲',
    title: 'O Mestre Narra',
    text: 'Você descreve a ação ("explorar caverna"). O Mestre IA narra consequência e pede testes (d20+modifier vs DC) quando há incerteza.',
  },
  {
    icon: '🏆',
    title: 'Progresso Persistente',
    text: 'Combata, vença, ganhe XP → suba de nível. Faça login (magic link) pra ter conquistas, streak diário e cemitério dos seus PJs caídos.',
  },
];

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch { /* ignore */ }
}

export function openOnboardingTour(): void {
  const backdrop = el('div', { class: 'ot-backdrop' });
  let stepIdx = 0;

  const card = el('div', { class: 'ot-card' });
  const body = el('div', { class: 'ot-body' });
  const dots = el('div', { class: 'ot-dots' });
  const actions = el('div', { class: 'ot-actions' });

  const renderStep = (): void => {
    body.innerHTML = '';
    dots.innerHTML = '';
    actions.innerHTML = '';
    const s = STEPS[stepIdx]!;
    body.appendChild(el('div', { class: 'ot-icon', text: s.icon }));
    body.appendChild(el('h2', { class: 'ot-title', text: s.title }));
    body.appendChild(el('p', { class: 'ot-text', text: s.text }));

    for (let i = 0; i < STEPS.length; i++) {
      dots.appendChild(el('span', { class: `ot-dot ${i === stepIdx ? 'is-active' : ''}` }));
    }

    if (stepIdx > 0) {
      actions.appendChild(el('button', {
        class: 'ot-btn ot-btn-back',
        text: '← Anterior',
        attrs: { type: 'button' },
        on: { click: () => { stepIdx--; renderStep(); } },
      }));
    } else {
      // Skip
      actions.appendChild(el('button', {
        class: 'ot-btn ot-btn-back',
        text: 'Pular',
        attrs: { type: 'button' },
        on: { click: () => closeAndMark() },
      }));
    }

    const isLast = stepIdx === STEPS.length - 1;
    actions.appendChild(el('button', {
      class: 'ot-btn ot-btn-next',
      text: isLast ? 'Começar!' : 'Próximo →',
      attrs: { type: 'button' },
      on: { click: () => {
        if (isLast) {
          closeAndMark();
        } else {
          stepIdx++;
          renderStep();
        }
      } },
    }));
  };

  const closeAndMark = (): void => {
    markTourDone();
    backdrop.classList.add('is-closing');
    setTimeout(() => backdrop.remove(), 200);
  };

  card.appendChild(body);
  card.appendChild(dots);
  card.appendChild(actions);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  renderStep();

  backdrop.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') closeAndMark();
  });
}

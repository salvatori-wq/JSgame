// JSgame · F21 — Onboarding tour. Popup welcome+steps no primeiro acesso.
// Persiste flag em localStorage. Pula em sessions subsequentes.

import { el } from './util';

const STORAGE_KEY = 'jsgame.onboarded.v1';

interface Step {
  title: string;
  text: string;
  icon: string;
}

// Round 3 fix (Mariana/Henrique) — microcopy mais cinematográfica + family-friendly:
// "cemitério" → "Heróis Caídos", "wizard" inglês mantido como termo D&D (livro mago),
// adicionado verbos vivos ao invés de listagem técnica.
// T1.1 (Henrique família) — Step 2 "PHB" inglês virou "Livro do Jogador (D&D 5e)"
// pra ficar PT-BR na primeira impressão.
const STEPS: Step[] = [
  {
    icon: '⚔',
    title: 'Bem-vindo à mesa',
    text: 'D&D 5e online com Mestre IA que narra. Crie um herói, viva uma crônica de 30 minutos — sozinho ou com até 3 amigos.',
  },
  {
    icon: '🎭',
    title: 'Crie seu Herói',
    text: 'Cinco passos: raça, classe, atributos (point buy 27), antecedente, identidade. Tudo direto do Livro do Jogador (D&D 5e).',
  },
  {
    icon: '🎲',
    title: 'O Mestre conduz',
    text: 'Você descreve sua ação ("invado a caverna"). O Mestre IA narra o que acontece e pede testes (d20 + modificador vs CD) quando o resultado é incerto.',
  },
  {
    icon: '🏆',
    title: 'Tudo persiste',
    text: 'Cada vitória vira XP. Faça login com magic link e seus heróis, conquistas e os caídos ficam salvos entre dispositivos.',
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

// JSgame · B7 — Tutorial first-exploration. Dispara na PRIMEIRA sessão
// (sessionNumber=1 + narração chegou) e persiste flag pra não reaparecer.
//
// BUG-002 fix (2026-05-26): trigger usado a verificar `!this.currentState` em
// onState, o que falhava em rejoin (state chega antes de narration). Agora
// trigger é função pura chamável de QUALQUER evento (onState + onNarration),
// idempotente via flag local `alreadyFiredThisSession`.

import { el } from '../util';

const STORAGE_KEY = 'jsgame.tutorial.exploration.v1';

export function shouldShowExplorationTutorial(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== '1'; } catch { return false; }
}

export function markExplorationTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

export interface TutorialTriggerInput {
  sessionNumber: number;
  narrationsArrived: boolean;
  alreadyFiredThisSession: boolean;
  tutorialNotDoneYet: boolean;
}

// Pura: testável sem JSDOM. Dispara se TODOS os 4 critérios verdadeiros.
export function shouldTriggerExplorationTutorial(input: TutorialTriggerInput): boolean {
  return input.sessionNumber === 1
    && input.narrationsArrived
    && !input.alreadyFiredThisSession
    && input.tutorialNotDoneYet;
}

interface Card {
  icon: string;
  title: string;
  text: string;
}

const CARDS: Card[] = [
  {
    icon: '🎲',
    title: 'O Mestre é uma IA',
    text: 'Tudo que aparece em "Mestre" é gerado por IA D&D 5e. Pede skill check quando há incerteza. Pivota pra combate quando você diz "atacar". Tem persona — pode ser sombrio, épico, cômico, noir ou pulp (escolha no lobby).',
  },
  {
    icon: '▶',
    title: 'Ações de Exploração',
    text: 'Os botões abaixo do log (explorar / falar / procurar / atacar / descansar / etc) são sugestões rápidas. Você pode misturar: "atacar" abre combate. "falar" + nome de NPC abre interação.',
  },
  {
    icon: '✍',
    title: 'Ação livre por texto',
    text: 'Quer fazer algo único? Digite no campo "Ou digite uma ação livre" (ex: "subo na árvore pra ver longe", "tento abrir a porta com gancho"). O Mestre interpreta e pede skill check se precisar.',
  },
  {
    icon: '🎯',
    title: 'Skill checks',
    text: 'Quando o Mestre pede teste de perícia, aparece overlay com d20. Você rola, ele narra a consequência. Nat 20 = info bônus. Nat 1 = complicação extra (não só falha — algo pior).',
  },
  {
    icon: '💬',
    title: 'Chat livre com a party',
    text: 'No coop, há campo "Falar pra party (Enter pra enviar)" — chat lateral pra coordenar fora da narrativa. Aparece em todos os players da sessão.',
  },
  {
    icon: '🧠',
    title: 'O mundo lembra',
    text: 'Cada NPC, local e promessa fica na memória RAG da campanha. Sessão 2+ começa com recap automático dos eventos importantes. O Mestre não inventa NPCs novos quando já conhece um — usa os existentes.',
  },
];

let overlayEl: HTMLElement | null = null;

export function openExplorationTutorial(): void {
  if (overlayEl) return; // já aberto

  const overlay = el('div', { class: 'ct-overlay' });
  const backdrop = el('div', { class: 'ct-backdrop' });
  overlay.appendChild(backdrop);

  let currentIdx = 0;
  const modal = el('div', { class: 'ct-modal' });

  const renderCard = (): void => {
    modal.innerHTML = '';
    const c = CARDS[currentIdx]!;
    modal.appendChild(el('div', { class: 'ct-progress', text: `${currentIdx + 1} / ${CARDS.length}` }));
    modal.appendChild(el('div', { class: 'ct-icon', text: c.icon }));
    modal.appendChild(el('h2', { class: 'ct-title', text: c.title }));
    modal.appendChild(el('p', { class: 'ct-text', text: c.text }));

    const nav = el('div', { class: 'ct-nav' });
    if (currentIdx > 0) {
      nav.appendChild(el('button', {
        class: 'ct-btn ct-btn-back',
        text: '← Voltar',
        on: { click: () => { currentIdx--; renderCard(); } },
      }));
    }
    if (currentIdx < CARDS.length - 1) {
      nav.appendChild(el('button', {
        class: 'ct-btn ct-btn-next',
        text: 'Próximo →',
        on: { click: () => { currentIdx++; renderCard(); } },
      }));
    } else {
      nav.appendChild(el('button', {
        class: 'ct-btn ct-btn-done',
        text: '✓ Entendi, vamos jogar!',
        on: { click: close },
      }));
    }
    modal.appendChild(nav);

    modal.appendChild(el('button', {
      class: 'ct-skip',
      text: 'Pular tutorial',
      on: { click: close },
    }));
  };

  const close = (): void => {
    markExplorationTutorialDone();
    overlay.remove();
    overlayEl = null;
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' && currentIdx < CARDS.length - 1) { currentIdx++; renderCard(); }
    if (e.key === 'ArrowLeft' && currentIdx > 0) { currentIdx--; renderCard(); }
  };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', close);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  renderCard();
}

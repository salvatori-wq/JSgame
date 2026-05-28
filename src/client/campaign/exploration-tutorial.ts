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

// S1.5 — Reescrita PT-BR família (Henrique): "skill check" → "teste de perícia",
// "overlay" → "tela do d20", "pivota" → "vira", "memória RAG" → "memória do
// Mestre", "party" → "amigos" (mantém "party" quando termo do jogo é claro).
// Mariana mantém precisão (Nat 20 / Nat 1 são termos D&D conhecidos).
// Exportado pra tests; consumido localmente como EXPLORATION_TUTORIAL_CARDS.
export const EXPLORATION_TUTORIAL_CARDS: Card[] = [
  {
    icon: '🎲',
    title: 'O Mestre é uma IA',
    text: 'Tudo em "Mestre" é gerado por IA seguindo D&D 5e. Ele pede testes quando há incerteza, vira combate quando você diz "atacar", e tem uma persona — sombrio, épico, cômico, noir ou pulp (escolhe no lobby).',
  },
  {
    icon: '▶',
    title: 'Ações rápidas',
    text: 'Os botões abaixo da história (explorar / falar / procurar / atacar / descansar) são atalhos. Você pode misturar: "atacar" começa combate, "falar [NPC]" abre conversa.',
  },
  {
    icon: '✍',
    title: 'Ação livre por texto',
    text: 'Quer fazer algo único? Digite no campo "Ou digite uma ação livre" (ex: "subo na árvore pra ver longe", "tento abrir a porta com gancho"). O Mestre interpreta e pede teste se for o caso.',
  },
  {
    icon: '🎯',
    title: 'Testes de perícia',
    text: 'Quando o Mestre pede um teste, aparece a tela do d20. Você rola e ele narra o resultado. Tirou 20 natural? Sucesso épico + bônus. Tirou 1 natural? Não é só falha — algo pior acontece.',
  },
  {
    icon: '💬',
    title: 'Chat com seus amigos',
    text: 'No coop, há um campo "Falar pra party (Enter pra enviar)" — chat à parte pra combinar coisas fora da história. Todos os amigos da sessão veem.',
  },
  {
    icon: '🧠',
    title: 'O mundo lembra',
    text: 'Cada NPC, lugar e promessa fica na memória do Mestre. Da sessão 2 em diante, ele começa recapitulando o importante e usa os NPCs que já conhece — não inventa novos do nada.',
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
    const c = EXPLORATION_TUTORIAL_CARDS[currentIdx]!;
    modal.appendChild(el('div', { class: 'ct-progress', text: `${currentIdx + 1} / ${EXPLORATION_TUTORIAL_CARDS.length}` }));
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
    if (currentIdx < EXPLORATION_TUTORIAL_CARDS.length - 1) {
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
    if (e.key === 'ArrowRight' && currentIdx < EXPLORATION_TUTORIAL_CARDS.length - 1) { currentIdx++; renderCard(); }
    if (e.key === 'ArrowLeft' && currentIdx > 0) { currentIdx--; renderCard(); }
  };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', close);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  renderCard();
}

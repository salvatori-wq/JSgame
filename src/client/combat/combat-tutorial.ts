// JSgame · B2 — Tutorial first-combat. Dispara no início do PRIMEIRO combate
// (combatStartCount === 1) e persiste flag pra não reaparecer.

import { el } from '../util';

const STORAGE_KEY = 'jsgame.tutorial.combat.v1';

export function shouldShowCombatTutorial(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== '1'; } catch { return false; }
}

export function markCombatTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

interface Card {
  icon: string;
  title: string;
  text: string;
}

const CARDS: Card[] = [
  {
    icon: '⚔',
    title: 'Atacar',
    text: 'Clica em "Atacar" no painel → depois clica no inimigo alvo (acima). d20 + bônus do PJ vs CA do alvo. Nat 20 = crítico (dano 2x). Nat 1 = falha crítica.',
  },
  {
    icon: '🛡',
    title: 'Esquivar / Desengajar',
    text: 'Esquivar: ataques contra você têm desvantagem. Disparar: movimento dobrado. Desengajar: sai sem provocar ataque de oportunidade.',
  },
  {
    icon: '👊',
    title: 'Habilidades de Classe',
    text: 'Barra roxa logo abaixo: Rage (Bárbaro), Action Surge (Guerreiro), Ki (Monge), etc. Cada uma tem usos limitados (curto/longo descanso).',
  },
  {
    icon: '🤼',
    title: 'Ações Especiais',
    text: 'Agarrar/Empurrar: Atletismo contestado. Ajudar: aliado ganha vantagem. 2ª Arma: ataque bônus com off-hand (gasta bonus-action).',
  },
  {
    icon: '📜',
    title: 'Glossário rápido',
    text: 'CA = Classe de Armadura (quanto mais alto, mais difícil acertar). DC = Dificuldade de Save (rolar ≥ DC). Vantagem = rola 2d20, pega o maior. Desvantagem = pega o menor.',
  },
];

let overlayEl: HTMLElement | null = null;

export function openCombatTutorial(): void {
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
        text: '✓ Entendi, jogar!',
        on: { click: close },
      }));
    }
    modal.appendChild(nav);

    // Skip link (sempre disponível)
    modal.appendChild(el('button', {
      class: 'ct-skip',
      text: 'Pular tutorial',
      on: { click: close },
    }));
  };

  const close = (): void => {
    markCombatTutorialDone();
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

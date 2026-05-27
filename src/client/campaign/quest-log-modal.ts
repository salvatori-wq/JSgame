// JSgame · F18 — Quest log modal. Mostra quests ativas/completas/falhas.
// Lê CampaignState.quests do estado atual passado pelo campaign-screen.

import { el, onSwipeDown } from '../util';
import type { Quest } from '../../shared/types';

interface Opts {
  quests: Quest[];
  onClose: () => void;
}

let currentModal: HTMLElement | null = null;

export function openQuestLog(opts: Opts): void {
  if (currentModal) closeQuestLog();
  currentModal = renderModal(opts);
  document.body.appendChild(currentModal);
  // Foco no botão fechar pra ESC funcionar bem
  setTimeout(() => (currentModal?.querySelector('.qlm-close-btn') as HTMLButtonElement | null)?.focus(), 30);
}

export function closeQuestLog(): void {
  currentModal?.remove();
  currentModal = null;
}

function renderModal(opts: Opts): HTMLElement {
  const active = opts.quests.filter((q) => q.status === 'active');
  const completed = opts.quests.filter((q) => q.status === 'completed');
  const failed = opts.quests.filter((q) => q.status === 'failed');

  const backdrop = el('div', { class: 'qlm-backdrop' });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      opts.onClose();
      closeQuestLog();
    }
  });
  backdrop.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      opts.onClose();
      closeQuestLog();
    }
  });

  const card = el('div', { class: 'qlm-card' });

  card.appendChild(el('header', { class: 'qlm-header' }, [
    el('h2', { class: 'qlm-title', text: '📜 Quest Log' }),
    el('button', {
      class: 'qlm-close-btn',
      text: '✕',
      attrs: { type: 'button', title: 'Fechar (ESC)' },
      on: {
        click: () => {
          opts.onClose();
          closeQuestLog();
        },
      },
    }),
  ]));

  if (opts.quests.length === 0) {
    card.appendChild(el('div', { class: 'qlm-empty', text: 'Nenhuma quest ainda. Explore e converse com NPCs.' }));
  } else {
    if (active.length > 0) {
      card.appendChild(el('h3', { class: 'qlm-section', text: `▶ Ativas (${active.length})` }));
      for (const q of active) card.appendChild(renderQuest(q));
    }
    if (completed.length > 0) {
      card.appendChild(el('h3', { class: 'qlm-section qlm-section-done', text: `✓ Concluídas (${completed.length})` }));
      for (const q of completed) card.appendChild(renderQuest(q));
    }
    if (failed.length > 0) {
      card.appendChild(el('h3', { class: 'qlm-section qlm-section-failed', text: `✗ Falhadas (${failed.length})` }));
      for (const q of failed) card.appendChild(renderQuest(q));
    }
  }

  // MP3 — swipe-down close em mobile
  onSwipeDown(card, () => {
    opts.onClose();
    closeQuestLog();
  });

  backdrop.appendChild(card);
  return backdrop;
}

function renderQuest(q: Quest): HTMLElement {
  const card = el('div', { class: `qlm-quest qlm-quest-${q.status}` });
  card.appendChild(el('div', { class: 'qlm-quest-hdr' }, [
    el('div', { class: 'qlm-quest-title', text: q.title }),
    q.giver ? el('div', { class: 'qlm-quest-giver', text: `📍 ${q.giver}` }) : null,
  ].filter(Boolean) as HTMLElement[]));
  card.appendChild(el('div', { class: 'qlm-quest-desc', text: q.description }));

  if (q.objectives.length > 0) {
    const list = el('ul', { class: 'qlm-quest-objs' });
    for (const o of q.objectives) {
      list.appendChild(el('li', { class: `qlm-obj ${o.done ? 'is-done' : ''}` }, [
        el('span', { class: 'qlm-obj-mark', text: o.done ? '✓' : '○' }),
        el('span', { class: 'qlm-obj-desc', text: o.description }),
      ]));
    }
    card.appendChild(list);
  }

  card.appendChild(el('div', { class: 'qlm-quest-reward', text: `🏆 Reward ${q.rewardXp} XP` }));
  return card;
}

// JSgame · 2A — Counterspell prompt modal.
// Aparece quando CampaignState.pendingEnemySpell existe e o player conhece counterspell.
// 5s countdown auto-fecha. Botão "Counter" disparar castReaction socket event.

import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet, PendingEnemySpell } from '../../shared/types';
import { el } from '../util';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

let activeOverlay: HTMLElement | null = null;
let activeTimer: number | null = null;
let activeReactionId: string | null = null;

export function maybeShowCounterspellPrompt(opts: {
  pending: PendingEnemySpell;
  me: CharacterSheet;
  socket: SocketT;
}): void {
  // Já mostrando essa mesma reaction? skip.
  if (activeReactionId === opts.pending.id) return;
  closeCounterspellPrompt();

  // Validações cliente-side (UX) — server re-valida.
  if (opts.pending.cancelled) return;
  if (!opts.pending.visible) return;
  if (!opts.me.spellsKnown.includes('counterspell')) return;
  // Precisa de slot 3+
  const slot3 = opts.me.spellSlots[3];
  const slot4 = opts.me.spellSlots[4];
  const slot5 = opts.me.spellSlots[5];
  const availableSlots: Array<3 | 4 | 5> = [];
  if (slot3 && slot3.used < slot3.max) availableSlots.push(3);
  if (slot4 && slot4.used < slot4.max) availableSlots.push(4);
  if (slot5 && slot5.used < slot5.max) availableSlots.push(5);
  if (availableSlots.length === 0) return;

  // Tempo restante
  const elapsed = Date.now() - opts.pending.createdAt;
  const remaining = Math.max(0, opts.pending.windowMs - elapsed);
  if (remaining < 500) return; // pouco tempo, não vale mostrar

  activeReactionId = opts.pending.id;

  const overlay = el('div', { class: 'cspell-overlay' });
  const card = el('div', { class: 'cspell-card' });

  card.appendChild(el('div', { class: 'cspell-title', text: '✋ CONTRAMÁGICA?' }));
  card.appendChild(el('div', { class: 'cspell-source', text: `${opts.pending.sourceName} conjura:` }));
  card.appendChild(el('div', { class: 'cspell-spell', text: `${opts.pending.spellName} (nv ${opts.pending.spellLevel})` }));

  const timerEl = el('div', { class: 'cspell-timer', text: `${(remaining / 1000).toFixed(1)}s` });
  card.appendChild(timerEl);

  const slotRow = el('div', { class: 'cspell-slot-row' });
  for (const slotLevel of availableSlots) {
    const wouldAutoCancel = slotLevel >= opts.pending.spellLevel;
    const btn = el('button', {
      class: `cspell-slot-btn ${wouldAutoCancel ? 'is-auto' : 'is-check'}`,
      attrs: { type: 'button', title: wouldAutoCancel ? 'Auto-cancela (slot ≥ spell level)' : `Check DC ${10 + opts.pending.spellLevel}` },
      text: `Slot nv ${slotLevel}${wouldAutoCancel ? ' ✓' : ' ?'}`,
      on: {
        click: () => {
          opts.socket.emit('castReaction', { reactionId: opts.pending.id, spellId: 'counterspell', slotLevel });
          closeCounterspellPrompt();
        },
      },
    });
    slotRow.appendChild(btn);
  }
  card.appendChild(slotRow);

  card.appendChild(el('button', {
    class: 'cspell-skip-btn',
    text: 'Deixa passar',
    attrs: { type: 'button' },
    on: { click: () => closeCounterspellPrompt() },
  }));

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Countdown
  const deadline = opts.pending.createdAt + opts.pending.windowMs;
  activeTimer = window.setInterval(() => {
    const left = Math.max(0, deadline - Date.now());
    timerEl.textContent = `${(left / 1000).toFixed(1)}s`;
    if (left <= 0) closeCounterspellPrompt();
  }, 100);
}

export function closeCounterspellPrompt(): void {
  if (activeTimer !== null) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  activeReactionId = null;
}

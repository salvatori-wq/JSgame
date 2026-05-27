// β.1 — NPC Roster modal. Lista todos NPCs conhecidos da campaign com
// contadores, atitude, relacionamento, notas. Carrega de /api/campaigns/:id/npcs.

import { el, onSwipeDown } from '../util';
import type { NpcMemory } from '../../shared/types';

interface NpcRosterModalOpts {
  campaignId: string;
  onClose: () => void;
}

let currentEl: HTMLDivElement | null = null;

export function openNpcRosterModal(opts: NpcRosterModalOpts): void {
  closeNpcRosterModal();

  const overlay = document.createElement('div');
  overlay.className = 'npc-modal-overlay inv-modal-overlay';
  overlay.innerHTML = `<div class="inv-modal-backdrop"></div>`;

  const modal = el('div', { class: 'npc-modal inv-modal' });
  const close = (): void => { closeNpcRosterModal(); opts.onClose(); };

  modal.appendChild(el('div', { class: 'inv-modal-header' }, [
    el('h3', { class: 'inv-modal-title', text: '👥 NPCs Conhecidos' }),
    el('span', { class: 'npc-modal-sub', text: 'Carregando…' }),
    el('button', { class: 'inv-modal-close', text: '✕', on: { click: close } }),
  ]));

  const body = el('div', { class: 'npc-modal-body' });
  modal.appendChild(body);

  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.inv-modal-backdrop')?.addEventListener('click', close);
  onSwipeDown(modal, close);

  void loadAndRender(opts.campaignId, body, modal);
}

export function closeNpcRosterModal(): void {
  currentEl?.remove();
  currentEl = null;
}

async function loadAndRender(campaignId: string, body: HTMLElement, modal: HTMLElement): Promise<void> {
  let npcs: NpcMemory[] = [];
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/npcs`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json() as { npcs: NpcMemory[] };
      npcs = data.npcs ?? [];
    }
  } catch {
    /* empty list = "ninguém ainda" */
  }

  const sub = modal.querySelector('.npc-modal-sub');
  if (sub) sub.textContent = `${npcs.length} conhecidos`;

  if (npcs.length === 0) {
    body.appendChild(el('div', { class: 'npc-empty', text: 'Ninguém. Saia da taverna e converse com alguém.' }));
    return;
  }

  const grid = el('div', { class: 'npc-grid' });
  for (const n of npcs) {
    grid.appendChild(renderNpcCard(n));
  }
  body.appendChild(grid);
}

function renderNpcCard(n: NpcMemory): HTMLElement {
  const relLabel = relationshipLabel(n.relationship);
  const card = el('div', { class: `npc-card attitude-${n.attitude} rel-${relTier(n.relationship)}` }, [
    el('div', { class: 'npc-card-head' }, [
      el('span', { class: 'npc-card-icon', text: attitudeIcon(n.attitude) }),
      el('div', { class: 'npc-card-name', text: n.name }),
      el('span', { class: 'npc-card-arch', text: n.archetype }),
    ]),
    el('div', { class: 'npc-card-meta' }, [
      el('span', { class: 'npc-card-rel', attrs: { title: `Relacionamento: ${n.relationship}/+10` }, text: relLabel }),
      el('span', { class: 'npc-card-count', text: `${n.interactionCount}× conversado` }),
    ]),
    el('div', { class: 'npc-card-loc', text: `📍 ${n.lastLocation}` }),
    n.notes
      ? el('div', { class: 'npc-card-notes', text: `📝 ${n.notes}` })
      : null,
    el('div', { class: 'npc-card-when', text: `Visto ${formatRelative(n.lastSeen)}` }),
  ].filter(Boolean) as HTMLElement[]);
  return card;
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers
// ════════════════════════════════════════════════════════════════════════════

export function attitudeIcon(att: NpcMemory['attitude']): string {
  switch (att) {
    case 'amigavel':   return '😊';
    case 'neutro':     return '😐';
    case 'hostil':     return '😠';
    case 'misterioso': return '🎭';
  }
}

export function relationshipLabel(rel: number): string {
  if (rel >= 8)   return '🤝 Aliado próximo';
  if (rel >= 4)   return '👍 Amigo';
  if (rel >= 1)   return '🙂 Conhecido bem';
  if (rel === 0)  return '⚖ Neutro';
  if (rel >= -3)  return '😒 Frio';
  if (rel >= -7)  return '👎 Inimigo';
  return '💀 Mortal';
}

export function relTier(rel: number): 'friend' | 'neutral' | 'enemy' {
  if (rel >= 4)  return 'friend';
  if (rel <= -4) return 'enemy';
  return 'neutral';
}

export function formatRelative(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

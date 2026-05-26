// JSgame · Memory modal — visualiza os facts que o Mestre lembra da campanha.
// Útil pra debug, mas também agência narrativa: player vê o que o Mestre "sabe".
// Lê via REST /api/campaigns/:id/memory com search + filtros por kind.

import type { MemoryFact, MemoryFactKind } from '../../shared/types';
import { el, escapeHtml, onSwipeDown } from '../util';
import { getCampaignMemory } from '../api';

export interface MemoryModalOpts {
  campaignId: string;
  onClose: () => void;
}

const ALL_KINDS: { id: MemoryFactKind; label: string; icon: string }[] = [
  { id: 'npc', label: 'NPCs', icon: '🗣' },
  { id: 'location', label: 'Locais', icon: '📍' },
  { id: 'event', label: 'Eventos', icon: '⚔' },
  { id: 'inventory', label: 'Itens', icon: '💎' },
  { id: 'promise', label: 'Promessas', icon: '🤝' },
  { id: 'lore', label: 'Lore', icon: '📜' },
  { id: 'summary', label: 'Resumos', icon: '🧾' },
];

let currentEl: HTMLDivElement | null = null;

export function openMemoryModal(opts: MemoryModalOpts): void {
  closeMemoryModal();
  const { campaignId, onClose } = opts;

  const overlay = document.createElement('div');
  overlay.className = 'mem-modal-overlay';
  overlay.innerHTML = `<div class="mem-modal-backdrop"></div>`;

  const modal = el('div', { class: 'mem-modal' });

  // Header
  modal.appendChild(el('div', { class: 'mem-modal-header' }, [
    el('h3', { class: 'mem-modal-title', text: '🧠 Memória do Mestre' }),
    el('span', { class: 'mem-modal-subtitle mm-total', text: '...' }),
    el('button', { class: 'mem-modal-close', text: '✕', on: { click: () => { closeMemoryModal(); onClose(); } } }),
  ]));

  // Controls
  type Mode = 'recent' | 'timeline';
  let mode: Mode = 'recent';
  let searchQuery = '';
  let activeKinds: Set<MemoryFactKind> = new Set();
  const listEl = el('div', { class: 'mem-modal-list' });

  const controls = el('div', { class: 'mem-modal-controls' });

  // Toggle de modo: Recentes vs Cronologia
  const modeToggle = el('div', { class: 'mem-mode-toggle' });
  const recentBtn = el('button', {
    class: 'mem-mode-btn is-active',
    attrs: { type: 'button' },
    text: '🧠 Recentes',
    on: { click: () => { setMode('recent'); } },
  });
  const timelineBtn = el('button', {
    class: 'mem-mode-btn',
    attrs: { type: 'button' },
    text: '📜 Cronologia',
    on: { click: () => { setMode('timeline'); } },
  });
  modeToggle.appendChild(recentBtn);
  modeToggle.appendChild(timelineBtn);
  controls.appendChild(modeToggle);

  function setMode(m: Mode): void {
    mode = m;
    recentBtn.classList.toggle('is-active', m === 'recent');
    timelineBtn.classList.toggle('is-active', m === 'timeline');
    void refresh();
  }

  const searchInput = el('input', {
    class: 'mem-search',
    attrs: { type: 'search', placeholder: 'Buscar (NPC, local, palavra-chave)…' },
  }) as HTMLInputElement;
  controls.appendChild(searchInput);

  const chips = el('div', { class: 'mem-kind-chips' });
  for (const k of ALL_KINDS) {
    const chip = el('button', {
      class: 'mem-chip',
      attrs: { type: 'button', 'data-kind': k.id },
      text: `${k.icon} ${k.label}`,
    });
    chip.addEventListener('click', () => {
      if (activeKinds.has(k.id)) activeKinds.delete(k.id);
      else activeKinds.add(k.id);
      chip.classList.toggle('is-active', activeKinds.has(k.id));
      void refresh();
    });
    chips.appendChild(chip);
  }
  controls.appendChild(chips);
  modal.appendChild(controls);

  modal.appendChild(listEl);
  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.mem-modal-backdrop')?.addEventListener('click', () => {
    closeMemoryModal();
    onClose();
  });

  // Swipe down no modal (mobile) — fecha
  onSwipeDown(modal, () => {
    closeMemoryModal();
    onClose();
  });

  // Debounce search input — evita disparar 1 fetch por keystroke
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      void refresh();
    }, 250);
  });

  // Refresh: pega facts do server e re-renderiza
  async function refresh(): Promise<void> {
    listEl.innerHTML = '<div class="mem-loading">Carregando…</div>';
    try {
      const { facts, total } = await getCampaignMemory(campaignId, {
        q: searchQuery || undefined,
        kinds: activeKinds.size > 0 ? Array.from(activeKinds) : undefined,
        limit: mode === 'timeline' ? 200 : 50,
      });
      const totalEl = modal.querySelector('.mm-total');
      if (totalEl) totalEl.textContent = `${facts.length} de ${total} facts`;
      renderList(facts);
    } catch (err) {
      listEl.innerHTML = `<div class="mem-error">Erro: ${escapeHtml(String(err))}</div>`;
    }
  }

  function renderList(facts: MemoryFact[]): void {
    listEl.innerHTML = '';
    if (facts.length === 0) {
      listEl.appendChild(el('div', { class: 'mem-empty', text: 'Nenhum fato lembrado ainda.' }));
      return;
    }
    if (mode === 'timeline') {
      renderTimeline(facts);
    } else {
      for (const f of facts) {
        listEl.appendChild(renderFactCard(f));
      }
    }
  }

  // Timeline: ordem cronológica ASC (mais antigo primeiro), agrupado por sessão.
  // Cabe a leitura tipo "história" da campanha — ótimo pra pegar o pulso depois
  // de tempo sem jogar.
  function renderTimeline(facts: MemoryFact[]): void {
    const sorted = [...facts].sort((a, b) => a.createdAt - b.createdAt);
    let lastSession: number | null = null;
    for (const f of sorted) {
      if (f.sessionN !== lastSession) {
        lastSession = f.sessionN;
        listEl.appendChild(el('div', {
          class: 'mem-session-divider',
          text: `── Sessão ${f.sessionN} ──`,
        }));
      }
      listEl.appendChild(renderFactCard(f));
    }
  }

  // Primeira carga
  void refresh();
}

export function closeMemoryModal(): void {
  if (currentEl) {
    currentEl.remove();
    currentEl = null;
  }
}

function renderFactCard(fact: MemoryFact): HTMLElement {
  const meta = ALL_KINDS.find((k) => k.id === fact.kind);
  const icon = meta?.icon ?? '·';
  const ageMin = Math.max(0, Math.floor((Date.now() - fact.createdAt) / 60000));
  const ageLabel = ageMin < 1 ? 'agora' : ageMin < 60 ? `${ageMin}min` : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h` : `${Math.floor(ageMin / 1440)}d`;

  const card = el('article', { class: `mem-card mem-card-${fact.kind}` });
  card.innerHTML = `
    <div class="mc-head">
      <span class="mc-kind">${icon} ${escapeHtml(meta?.label ?? fact.kind)}</span>
      <span class="mc-meta">S${fact.sessionN} · ${ageLabel}${fact.importance >= 1.4 ? ' · ★' : ''}</span>
    </div>
    <div class="mc-text">${escapeHtml(fact.text)}</div>
    ${fact.tags ? `<div class="mc-tags">${escapeHtml(fact.tags)}</div>` : ''}
  `;
  return card;
}

// β.2 — Achievements modal. Mostra 30+ achievements organizados por
// categoria com progress visual + counters reais (vindos de /api/achievements).
//
// Funciona pra users logados (mostra unlocks reais) E anônimos (mostra catálogo
// com todos lockeados — convite pra logar).

import { el, escapeHtml, onSwipeDown } from '../util';
import {
  ACHIEVEMENTS, CATEGORY_LABELS, summarizeProgress,
  type Achievement, type AchievementCategory, type AchievementTier,
} from '../../dnd/achievements';

interface AchievementsModalOpts {
  onClose: () => void;
}

interface ApiProgress {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt: number | null;
}

interface ApiResponse {
  progress: ApiProgress[];
  counters: Record<string, number>;
}

let currentEl: HTMLDivElement | null = null;

export function openAchievementsModal(opts: AchievementsModalOpts): void {
  closeAchievementsModal();

  const overlay = document.createElement('div');
  overlay.className = 'ach-modal-overlay inv-modal-overlay';
  overlay.innerHTML = `<div class="inv-modal-backdrop"></div>`;

  const modal = el('div', { class: 'ach-modal inv-modal' });
  const close = (): void => { closeAchievementsModal(); opts.onClose(); };
  modal.appendChild(el('div', { class: 'inv-modal-header' }, [
    el('h3', { class: 'inv-modal-title', text: '🏆 Conquistas' }),
    el('span', { class: 'ach-modal-sub', text: 'Carregando…' }),
    el('button', { class: 'inv-modal-close', text: '✕', on: { click: close } }),
  ]));

  const body = el('div', { class: 'ach-modal-body' });
  modal.appendChild(body);

  overlay.appendChild(modal);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  overlay.querySelector('.inv-modal-backdrop')?.addEventListener('click', close);
  onSwipeDown(modal, close);

  // Fetch e render
  void loadAndRender(body, modal);
}

export function closeAchievementsModal(): void {
  currentEl?.remove();
  currentEl = null;
}

async function loadAndRender(body: HTMLElement, modal: HTMLElement): Promise<void> {
  let data: ApiResponse | null = null;
  try {
    const res = await fetch('/api/achievements', { credentials: 'include' });
    if (res.ok) data = await res.json() as ApiResponse;
  } catch { /* falha silenciosa = renderiza catálogo locked */ }

  // Anon ou erro → renderiza catálogo todo locked
  const isAnon = data === null;
  const progress = data?.progress ?? ACHIEVEMENTS.map((a) => ({ achievement: a, unlocked: false, unlockedAt: null }));
  const counters = data?.counters ?? {};
  const unlockedSet = new Set(progress.filter((p) => p.unlocked).map((p) => p.achievement.id));

  // T2.3 — Banner anon: usuário sem login vê tudo locked sem entender porquê.
  // Aparece UMA vez no topo do body, antes das tabs.
  if (isAnon) {
    const banner = el('div', { class: 'ach-anon-banner' }, [
      el('span', { class: 'ach-anon-icon', text: '🔒' }),
      el('span', { class: 'ach-anon-text', text: 'Sem login — conquistas não salvam entre dispositivos. Click em ' }),
      el('b', { class: 'ach-anon-where', text: '💾 Salvar' }),
      el('span', { text: ' (home) pra sincronizar.' }),
    ]);
    body.appendChild(banner);
  }

  // Atualiza sub-header com stats
  const stats = summarizeProgress(unlockedSet);
  const subEl = modal.querySelector('.ach-modal-sub');
  if (subEl) {
    const pct = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;
    subEl.textContent = `${stats.unlocked} / ${stats.total} (${pct}%)`;
  }

  // Tabs
  const categories: AchievementCategory[] = ['combat', 'exploration', 'social', 'progress', 'meta'];
  let activeCat: AchievementCategory = 'combat';

  const tabs = el('div', { class: 'ach-tabs' });
  const grid = el('div', { class: 'ach-grid' });
  const counterStrip = renderCountersStrip(counters);

  const renderGrid = (): void => {
    grid.innerHTML = '';
    const filtered = progress.filter((p) => (p.achievement.category ?? 'meta') === activeCat);
    if (filtered.length === 0) {
      // T1.4 — Empty estruturado (era 1-liner sem afford). Mesma pegada de
      // gl-empty (S3.2) e qlm-empty (S3.3): icon + título + sub explicativa.
      const empty = el('div', { class: 'ach-empty' });
      empty.appendChild(el('div', { class: 'ach-empty-icon', text: '🏆' }));
      empty.appendChild(el('div', { class: 'ach-empty-title', text: 'Nada por aqui ainda' }));
      empty.appendChild(el('div', { class: 'ach-empty-sub', text: `Jogue mais para desbloquear conquistas de "${CATEGORY_LABELS[activeCat]}".` }));
      grid.appendChild(empty);
      return;
    }
    for (const p of filtered) {
      grid.appendChild(renderAchievementCard(p));
    }
  };

  for (const cat of categories) {
    const count = progress.filter((p) => (p.achievement.category ?? 'meta') === cat).length;
    const unlocked = progress.filter((p) => p.unlocked && (p.achievement.category ?? 'meta') === cat).length;
    const tab = el('button', {
      class: `ach-tab ${cat === activeCat ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      on: {
        click: () => {
          activeCat = cat;
          tabs.querySelectorAll('.ach-tab').forEach((t) => t.classList.remove('is-active'));
          tab.classList.add('is-active');
          renderGrid();
        },
      },
    }, [
      el('span', { text: CATEGORY_LABELS[cat] }),
      el('span', { class: 'ach-tab-count', text: `${unlocked}/${count}` }),
    ]);
    tabs.appendChild(tab);
  }

  body.appendChild(tabs);
  body.appendChild(counterStrip);
  body.appendChild(grid);
  renderGrid();
}

function renderAchievementCard(p: ApiProgress): HTMLElement {
  const a = p.achievement;
  // Hidden lock: se hidden=true e não unlocked, mostra "???"
  const showHidden = !!a.hidden && !p.unlocked;
  const name = showHidden ? '???' : a.name;
  const desc = showHidden ? 'Conquista oculta. Continue jogando pra revelar.' : a.description;
  const icon = showHidden ? '🔒' : a.icon;

  const card = el('div', {
    class: `ach-card tier-${a.tier} ${p.unlocked ? 'is-unlocked' : 'is-locked'} ${showHidden ? 'is-hidden' : ''}`,
  }, [
    el('div', { class: 'ach-card-icon', text: icon }),
    el('div', { class: 'ach-card-info' }, [
      el('div', { class: 'ach-card-name', text: name }),
      el('div', { class: 'ach-card-desc', text: desc }),
      p.unlocked && p.unlockedAt
        ? el('div', { class: 'ach-card-date', text: `✓ ${formatDate(p.unlockedAt)}` })
        : null,
    ].filter(Boolean) as HTMLElement[]),
    el('div', { class: 'ach-card-tier', text: tierLabel(a.tier) }),
  ]);
  return card;
}

function renderCountersStrip(counters: Record<string, number>): HTMLElement {
  const strip = el('div', { class: 'ach-counters' });
  const entries: Array<[string, string, string]> = [
    ['kills',            '💀',  'Kills'],
    ['crits',            '⚡',  'Crits'],
    ['spells_cast',      '🔮',  'Magias'],
    ['long_rests',       '🏕',  'Descansos'],
    ['unique_locations', '🗺',  'Locais'],
    ['unique_npcs',      '🗣',  'NPCs'],
    ['stabilizations',   '❤',  'Estabilizado'],
  ];
  for (const [key, icon, label] of entries) {
    const v = counters[key] ?? 0;
    strip.appendChild(el('div', { class: `ach-counter ${v > 0 ? 'has-value' : ''}` }, [
      el('span', { class: 'ach-counter-icon', text: icon }),
      el('span', { class: 'ach-counter-val', text: String(v) }),
      el('span', { class: 'ach-counter-lbl', text: label }),
    ]));
  }
  return strip;
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (testable)
// ════════════════════════════════════════════════════════════════════════════

export function formatDate(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '';
  }
}

export function tierLabel(t: AchievementTier): string {
  switch (t) {
    case 'bronze':   return '🥉 BRONZE';
    case 'silver':   return '🥈 PRATA';
    case 'gold':     return '🥇 OURO';
    case 'platinum': return '💎 PLATINA';
  }
}

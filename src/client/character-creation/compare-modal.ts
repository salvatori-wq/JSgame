// JSgame · F33 — Modal de comparação lado a lado.
// Permite marcar até 3 raças OU 3 classes pra comparar atributos rapidamente.
// Tray flutuante aparece quando há 2+ itens marcados. Click no tray abre modal.

import { ALL_RACES, getRace } from '../../dnd/races';
import { ALL_CLASSES, getClass } from '../../dnd/classes';
import { ABILITY_SHORT, formatModifier } from '../../dnd/attributes';
import { el, escapeHtml } from '../util';

type CompareKind = 'race' | 'class';
type CompareEntry = { kind: CompareKind; id: string };

const MAX_COMPARE = 3;
const tray: CompareEntry[] = [];
let trayElement: HTMLElement | null = null;

// === API pública ===

export function toggleCompare(kind: CompareKind, id: string): boolean {
  const idx = tray.findIndex((t) => t.kind === kind && t.id === id);
  if (idx >= 0) {
    tray.splice(idx, 1);
  } else {
    // Misturar kinds não faz sentido — limpa quando muda de tipo
    if (tray.length > 0 && tray[0]!.kind !== kind) tray.length = 0;
    if (tray.length >= MAX_COMPARE) return false;
    tray.push({ kind, id });
  }
  refreshTray();
  return true;
}

export function isInCompareTray(kind: CompareKind, id: string): boolean {
  return tray.some((t) => t.kind === kind && t.id === id);
}

export function clearCompareTray(): void {
  tray.length = 0;
  refreshTray();
}

// Garante que o tray flutua na tela quando há ≥2 itens
function refreshTray(): void {
  if (tray.length < 2) {
    trayElement?.remove();
    trayElement = null;
    return;
  }
  if (!trayElement) {
    trayElement = el('div', { class: 'wiz-compare-tray', attrs: { role: 'region', 'aria-label': 'Comparação' } });
    document.body.appendChild(trayElement);
  }
  trayElement.innerHTML = '';
  trayElement.appendChild(el('span', { class: 'wct-label', text: `Comparar (${tray.length}):` }));
  for (const entry of tray) {
    const name = entry.kind === 'race' ? getRace(entry.id as Parameters<typeof getRace>[0]).name : getClass(entry.id as Parameters<typeof getClass>[0]).name;
    trayElement.appendChild(el('span', { class: 'wct-chip', text: name }));
  }
  trayElement.appendChild(el('button', {
    class: 'wct-btn',
    text: '⚖ Abrir comparação',
    attrs: { type: 'button' },
    on: { click: () => openCompareModal() },
  }));
  trayElement.appendChild(el('button', {
    class: 'wct-clear',
    text: '✕',
    attrs: { type: 'button', title: 'Limpar' },
    on: {
      click: () => {
        clearCompareTray();
        document.dispatchEvent(new CustomEvent('wiz:rerender'));
      },
    },
  }));
}

function openCompareModal(): void {
  if (tray.length < 2) return;
  const overlay = el('div', { class: 'wiz-compare-overlay' });
  const modal = el('div', { class: 'wiz-compare-modal' });

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const header = el('header', { class: 'wcm-head' }, [
    el('h2', { class: 'wcm-title', text: tray[0]!.kind === 'race' ? 'Comparar Raças' : 'Comparar Classes' }),
    el('button', { class: 'wcm-close', text: '✕', attrs: { type: 'button' }, on: { click: close } }),
  ]);
  modal.appendChild(header);

  if (tray[0]!.kind === 'race') {
    modal.appendChild(renderRaceCompareTable(tray.map((t) => t.id as Parameters<typeof getRace>[0])));
  } else {
    modal.appendChild(renderClassCompareTable(tray.map((t) => t.id as Parameters<typeof getClass>[0])));
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function renderRaceCompareTable(ids: ReturnType<typeof rIds>): HTMLElement {
  const races = ids.map((id) => getRace(id));
  const table = el('table', { class: 'wcm-table' });
  const head = el('thead');
  head.appendChild(el('tr', {}, [
    el('th', { text: '' }),
    ...races.map((r) => el('th', { text: r.name })),
  ]));
  table.appendChild(head);
  const body = el('tbody');
  body.appendChild(rowFromCells('Bônus atributo', races.map((r) => {
    const entries = Object.entries(r.abilityBonuses).filter(([, v]) => (v ?? 0) !== 0);
    return entries.map(([k, v]) => `${ABILITY_SHORT[k as keyof typeof ABILITY_SHORT]} ${formatModifier(v ?? 0)}`).join(', ') || '—';
  })));
  body.appendChild(rowFromCells('Tamanho', races.map((r) => r.size === 'pequeno' ? 'Pequeno' : 'Médio')));
  body.appendChild(rowFromCells('Velocidade', races.map((r) => `${r.speed} ft`)));
  body.appendChild(rowFromCells('Visão Escuro', races.map((r) => r.darkvision ? `${r.darkvision} ft` : '—')));
  body.appendChild(rowFromCells('Idiomas', races.map((r) => r.languages.join(', '))));
  body.appendChild(rowFromCells('Traços', races.map((r) => `${r.traits.length}: ${r.traits.slice(0, 3).join('; ')}${r.traits.length > 3 ? '…' : ''}`)));
  body.appendChild(rowFromCells('Descrição', races.map((r) => r.description)));
  table.appendChild(body);
  return table;
}

function renderClassCompareTable(ids: ReturnType<typeof cIds>): HTMLElement {
  const klasses = ids.map((id) => getClass(id));
  const table = el('table', { class: 'wcm-table' });
  const head = el('thead');
  head.appendChild(el('tr', {}, [
    el('th', { text: '' }),
    ...klasses.map((k) => el('th', { text: k.name })),
  ]));
  table.appendChild(head);
  const body = el('tbody');
  body.appendChild(rowFromCells('Hit Die', klasses.map((k) => `d${k.hitDie}`)));
  body.appendChild(rowFromCells('Atributo primário', klasses.map((k) => Array.isArray(k.primaryAbility)
    ? k.primaryAbility.map((a) => ABILITY_SHORT[a]).join('/')
    : ABILITY_SHORT[k.primaryAbility])));
  body.appendChild(rowFromCells('Saves prof.', klasses.map((k) => k.savingThrowProficiencies.map((a) => ABILITY_SHORT[a]).join(' · '))));
  body.appendChild(rowFromCells('Conjurador', klasses.map((k) => k.isSpellcaster ? '✓ sim' : '— marcial')));
  body.appendChild(rowFromCells('Perícias', klasses.map((k) => `escolhe ${k.skillChoices.count} de ${k.skillChoices.from.length}`)));
  body.appendChild(rowFromCells('Armaduras', klasses.map((k) => k.armorProficiencies.join(', ') || 'nenhuma')));
  body.appendChild(rowFromCells('Armas (amostra)', klasses.map((k) => k.weaponProficiencies.slice(0, 4).join(', ') + (k.weaponProficiencies.length > 4 ? '…' : ''))));
  body.appendChild(rowFromCells('Descrição', klasses.map((k) => k.description)));
  table.appendChild(body);
  return table;
}

function rowFromCells(label: string, cells: string[]): HTMLElement {
  const tr = el('tr');
  tr.appendChild(el('th', { class: 'wcm-row-label', text: label }));
  for (const c of cells) {
    const td = el('td');
    td.innerHTML = escapeHtml(c);
    tr.appendChild(td);
  }
  return tr;
}

// type-only helpers pra inferir IDs (evita import circular)
function rIds(): Parameters<typeof getRace>[0][] { return ALL_RACES.map((r) => r.id); }
function cIds(): Parameters<typeof getClass>[0][] { return ALL_CLASSES.map((c) => c.id); }

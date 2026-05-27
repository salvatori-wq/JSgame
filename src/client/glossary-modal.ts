// JSgame · κ.2 — Glossary Modal.
// Modal acessível via overflow menu OU botão "?" universal. Termos D&D pt-BR.
// Search + categorias + scroll. Usa sheet-stack pra empilhar.

import { el, escapeHtml } from './util';
import { GLOSSARY, searchGlossary, GLOSSARY_CATEGORIES, type GlossaryEntry } from '../dnd/glossary';
import { push as pushSheet, pop as popSheet, isSheetOpen } from './sheet-stack-manager';

const SHEET_ID = 'glossary';

export function openGlossaryModal(opts: { focusTerm?: string } = {}): void {
  if (isSheetOpen(SHEET_ID)) return;

  let searchQuery = opts.focusTerm ?? '';

  const root = el('div', {
    class: 'glossary-sheet',
    attrs: { role: 'dialog', 'aria-label': 'Glossário D&D' },
  });

  root.appendChild(el('div', { class: 'cs-handlebar', attrs: { 'aria-hidden': 'true' } }));

  root.appendChild(el('header', { class: 'cs-header' }, [
    el('div', { class: 'cs-title', text: '📖 Glossário D&D' }),
    el('button', {
      class: 'cs-close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Fechar' },
      on: { click: () => closeGlossary() },
    }),
  ]));

  const searchInput = el('input', {
    class: 'gl-search',
    attrs: {
      type: 'text',
      placeholder: '🔍 Buscar termo (ex: DC, advantage, slot)',
      'aria-label': 'Buscar no glossário',
    },
  }) as HTMLInputElement;
  searchInput.value = searchQuery;
  root.appendChild(el('div', { class: 'gl-search-row' }, [searchInput]));

  const body = el('div', { class: 'gl-body' });
  root.appendChild(body);

  const renderResults = (): void => {
    body.innerHTML = '';
    const matches = searchGlossary(searchQuery);
    if (matches.length === 0) {
      body.appendChild(el('div', { class: 'gl-empty', text: 'Nenhum termo encontrado. Tente outra busca.' }));
      return;
    }

    // Agrupa por categoria (preserva ordem do array original dentro de cada categoria)
    const byCat = new Map<string, GlossaryEntry[]>();
    for (const e of matches) {
      if (!byCat.has(e.category)) byCat.set(e.category, []);
      byCat.get(e.category)!.push(e);
    }

    for (const [cat, entries] of byCat) {
      const section = el('section', { class: 'gl-category' });
      section.appendChild(el('h3', { class: 'gl-cat-h3', text: GLOSSARY_CATEGORIES[cat as keyof typeof GLOSSARY_CATEGORIES] ?? cat }));
      for (const entry of entries) {
        section.appendChild(renderEntry(entry));
      }
      body.appendChild(section);
    }
  };

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderResults();
  });
  renderResults();

  pushSheet({
    id: SHEET_ID,
    element: root,
    onClose: () => { /* nothing */ },
  });

  if (opts.focusTerm) {
    setTimeout(() => searchInput.focus(), 240);
  }
}

export function closeGlossary(): void {
  if (isSheetOpen(SHEET_ID)) popSheet();
}

function renderEntry(entry: GlossaryEntry): HTMLElement {
  const card = el('article', { class: 'gl-entry' });
  const aliases = entry.aliases && entry.aliases.length > 0
    ? ` <span class="gl-aliases">(${entry.aliases.slice(0, 2).join(', ')})</span>`
    : '';
  const phbRef = entry.phbRef
    ? `<div class="gl-phb">${escapeHtml(entry.phbRef)}</div>`
    : '';
  const example = entry.example
    ? `<div class="gl-example"><b>Ex:</b> ${escapeHtml(entry.example)}</div>`
    : '';
  card.innerHTML = `
    <h4 class="gl-term">${escapeHtml(entry.term)}${aliases}</h4>
    <p class="gl-desc">${escapeHtml(entry.description)}</p>
    ${example}
    ${phbRef}
  `;
  return card;
}

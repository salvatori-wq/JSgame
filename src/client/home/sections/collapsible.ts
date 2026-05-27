// JSgame · Ω.2 — Collapsible section reusável.
// Header tap-toggle + lazy renderContent + localStorage persist do collapsed state.
// Usado em "Meus PJs", "Crônicas", "Cemitério", "Highlights" da home tavern.

import { el } from '../../util';

export interface CollapsibleSectionOpts {
  /** ID estável (vira chave localStorage `home.section.{id}.collapsed`). */
  id: string;
  title: string;
  icon: string;
  /** Mostra "(N)" no header. */
  count?: number;
  /** Texto pequeno destacado (ex: "⚠ vidas em risco"). */
  badge?: string;
  /** Default fechado/aberto (overridado por localStorage se setado). */
  defaultOpen?: boolean;
  /** Função que produz o conteúdo. Chamado lazy no primeiro expand. */
  renderContent: () => HTMLElement | Promise<HTMLElement>;
}

const STORAGE_PREFIX = 'home.section.';

export function makeCollapsibleSection(opts: CollapsibleSectionOpts): HTMLElement {
  const stored = readStored(opts.id);
  const open = stored !== null ? stored : (opts.defaultOpen ?? false);

  const section = el('section', {
    class: `home-collapsible ${open ? 'is-open' : ''}`,
    attrs: { 'data-section-id': opts.id },
  });

  const headerLeft = el('div', { class: 'hc-header-left' }, [
    el('span', { class: 'hc-icon', text: opts.icon }),
    el('span', { class: 'hc-title', text: opts.title }),
  ]);
  if (typeof opts.count === 'number') {
    headerLeft.appendChild(el('span', { class: 'hc-count', text: `(${opts.count})` }));
  }
  if (opts.badge) {
    headerLeft.appendChild(el('span', { class: 'hc-badge', text: opts.badge }));
  }

  const chevron = el('span', { class: 'hc-chevron', text: open ? '▲' : '▼' });

  const header = el('button', {
    class: 'hc-header',
    attrs: {
      type: 'button',
      'aria-expanded': String(open),
      'aria-controls': `hc-body-${opts.id}`,
    },
  }, [headerLeft, chevron]);

  const body = el('div', {
    class: 'hc-body',
    attrs: { id: `hc-body-${opts.id}`, role: 'region', 'aria-hidden': String(!open) },
  });

  let contentLoaded = false;
  const loadContent = async (): Promise<void> => {
    if (contentLoaded) return;
    contentLoaded = true;
    try {
      const content = await opts.renderContent();
      body.appendChild(content);
    } catch (err) {
      body.appendChild(el('div', { class: 'home-empty', text: `Erro: ${String(err)}` }));
    }
  };

  if (open) void loadContent();

  header.addEventListener('click', () => {
    const wasOpen = section.classList.contains('is-open');
    const nextOpen = !wasOpen;
    section.classList.toggle('is-open', nextOpen);
    chevron.textContent = nextOpen ? '▲' : '▼';
    header.setAttribute('aria-expanded', String(nextOpen));
    body.setAttribute('aria-hidden', String(!nextOpen));
    writeStored(opts.id, nextOpen);
    if (nextOpen) void loadContent();
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function readStored(id: string): boolean | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}.collapsed`);
    if (raw === null) return null;
    return raw === 'false' ? true : false; // collapsed=false → open=true
  } catch {
    return null;
  }
}

function writeStored(id: string, open: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}.collapsed`, String(!open));
  } catch { /* silent */ }
}

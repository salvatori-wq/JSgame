// JSgame · Ω.2 — Cemitério collapsible (logged-in only).
// Tombstones com epitaph + portrait grayscale.

import { el } from '../../util';
import { listTombstones, type TombstoneDTO } from '../../api';
import { portraitFor } from '../../../dnd/portrait';
import { makeCollapsibleSection } from './collapsible';
import { humanizeServerError } from '../../humanize-error';

export function renderGraveyard(): HTMLElement {
  // Round 1 fix (Henrique pai 35a + filho 12a) — "Cemitério" trocado pra "Heróis
  // Caídos" (tom cinematográfico, menos macabro pra família). Mecânica idêntica.
  return makeCollapsibleSection({
    id: 'graveyard',
    title: 'Heróis Caídos',
    icon: '🪦',
    defaultOpen: false,
    renderContent: async () => {
      const list = el('div', { class: 'graveyard-list' });
      try {
        const tombs = await listTombstones();
        if (tombs.length === 0) {
          list.appendChild(el('div', { class: 'graveyard-empty', text: 'Nenhum herói caiu ainda. Mantenha-os vivos.' }));
        } else {
          for (const t of tombs.slice(0, 10)) {
            list.appendChild(renderTombstoneCard(t));
          }
          if (tombs.length > 10) {
            list.appendChild(el('div', { class: 'graveyard-more', text: `+${tombs.length - 10} mortes mais antigas` }));
          }
        }
      } catch (err) {
        list.appendChild(el('div', { class: 'graveyard-empty', text: humanizeServerError(String(err)) }));
      }
      return list;
    },
  });
}

function renderTombstoneCard(t: TombstoneDTO): HTMLElement {
  const portrait = portraitFor({
    raceId: t.raceId as Parameters<typeof portraitFor>[0]['raceId'],
    classId: t.classId as Parameters<typeof portraitFor>[0]['classId'],
  });
  const when = new Date(t.diedAt);
  const whenStr = when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return el('div', { class: 'tombstone-card' }, [
    el('div', { class: 'tomb-icon', text: '🪦' }),
    el('div', { class: 'tomb-portrait', style: { background: portrait.aura, opacity: '0.5', filter: 'grayscale(0.8)' } }, [
      el('span', { text: portrait.race }),
      el('span', { text: portrait.class }),
    ]),
    el('div', { class: 'tomb-body' }, [
      el('div', { class: 'tomb-name', text: `${t.characterName}` }),
      el('div', { class: 'tomb-meta', text: `Nv ${t.level} · ${t.classId}${t.campaignName ? ` · ${t.campaignName}` : ''}` }),
      el('div', { class: 'tomb-epitaph', text: `"${t.epitaph}"` }),
      el('div', { class: 'tomb-when', text: `† ${whenStr}` }),
    ]),
  ]);
}

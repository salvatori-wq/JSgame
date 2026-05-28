// JSgame · Ω.2 — "Crônicas ativas" collapsible.
// Lista campanhas com preview rico (location + último narração + risco badge).

import { el } from '../../util';
import { listCampaigns, deleteCampaign as deleteCampaignApi, type CampaignSummary } from '../../api';
import { toastWarn } from '../../toast';
import { confirmDialog } from '../../ui-modal';
import { makeCollapsibleSection } from './collapsible';

export interface MyChroniclesOpts {
  selectedCharGetter: () => string | null;
  onJoin: (campaignId: string, characterId: string) => void;
}

export interface MyChroniclesHandle {
  element: HTMLElement;
  refresh: () => Promise<void>;
}

export async function renderMyChronicles(opts: MyChroniclesOpts): Promise<MyChroniclesHandle> {
  let listContainer: HTMLElement | null = null;
  let countLabel: HTMLElement | null = null;

  const refresh = async (): Promise<void> => {
    if (!listContainer) return;
    listContainer.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      listContainer.appendChild(el('div', { class: 'skeleton skeleton-card' }));
    }
    try {
      const camps = await listCampaigns();
      listContainer.innerHTML = '';
      if (countLabel) countLabel.textContent = camps.length > 0 ? `(${camps.length})` : '';
      if (camps.length === 0) {
        listContainer.appendChild(el('div', { class: 'home-empty', text: '🕯 Nenhuma crônica viva no momento. Comece uma — a IA tece o resto.' }));
        return;
      }
      for (const c of camps.slice(0, 8)) {
        listContainer.appendChild(renderChronicleCard(c, opts, refresh));
      }
      if (camps.length > 8) {
        listContainer.appendChild(el('div', { class: 'home-empty home-empty-small', text: `+${camps.length - 8} crônicas mais antigas` }));
      }
    } catch (err) {
      // Round 1 fix (Henrique) — empty state amigável em vez de despejar "500 Internal
      // Server Error" pro usuário. Mantém retry implícito via re-abrir o collapsible.
      listContainer.innerHTML = '';
      const msg = String(err).toLowerCase();
      const friendly = msg.includes('500') || msg.includes('failed to fetch') || msg.includes('networkerror')
        ? '🌙 Não consegui falar com o servidor. Tente abrir de novo em alguns segundos.'
        : '🕯 Nenhuma crônica viva no momento. Comece uma — a IA tece o resto.';
      listContainer.appendChild(el('div', { class: 'home-empty', text: friendly }));
      if (countLabel) countLabel.textContent = '';
    }
  };

  const section = makeCollapsibleSection({
    id: 'my-chronicles',
    title: 'Crônicas ativas',
    icon: '📖',
    defaultOpen: false,
    renderContent: () => {
      const list = el('div', { class: 'home-camps' });
      listContainer = list;
      void refresh();
      return list;
    },
  });

  countLabel = section.querySelector('.hc-count') as HTMLElement | null;
  if (!countLabel) {
    const headerLeft = section.querySelector('.hc-header-left');
    countLabel = el('span', { class: 'hc-count', text: '' });
    headerLeft?.appendChild(countLabel);
  }

  return { element: section, refresh };
}

function renderChronicleCard(
  c: CampaignSummary,
  opts: MyChroniclesOpts,
  onAfterDelete: () => Promise<void>,
): HTMLElement {
  const when = new Date(c.lastPlayedAt);
  const whenStr = when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bodyChildren: (HTMLElement | null)[] = [
    el('div', { class: 'hcamp-name', text: c.name }),
    el('div', { class: 'hcamp-meta', text: `Sessão ${c.sessionNumber} · ${whenStr}` }),
    c.currentLocation ? el('div', { class: 'hcamp-location', text: `📍 ${c.currentLocation}` }) : null,
    c.lastNarrationSnippet ? el('div', { class: 'hcamp-preview', text: `"${c.lastNarrationSnippet}"` }) : null,
    c.partyAnyAtRisk
      ? el('div', { class: 'hcamp-risk-badge', text: `⚠ ${c.partyAtRiskName ?? 'Aliado'} em risco!` })
      : null,
    el('div', { class: 'hcamp-id', text: `ID: ${c.id}` }),
  ];
  return el('div', { class: `home-camp-card ${c.partyAnyAtRisk ? 'is-risk' : ''}` }, [
    el('div', { class: 'hcamp-body' }, bodyChildren.filter(Boolean) as HTMLElement[]),
    el('button', {
      class: 'hcamp-join-btn',
      text: '🤝 Entrar',
      on: {
        click: () => {
          const charId = opts.selectedCharGetter();
          if (!charId) { toastWarn('Selecione um personagem em "Meus PJs" primeiro.'); return; }
          opts.onJoin(c.id, charId);
        },
      },
    }),
    el('button', {
      class: 'hcamp-del-btn',
      text: '🗑',
      attrs: { title: 'Excluir crônica (irreversível)', type: 'button', 'aria-label': 'Excluir crônica' },
      on: {
        click: async () => {
          const ok = await confirmDialog({
            title: '🗑 Excluir crônica?',
            text: `"${c.name}" (sessão ${c.sessionNumber})\n\nMemória do Mestre, highlights e progresso vão sumir. Não tem volta.`,
            confirmText: 'Excluir pra sempre',
            cancelText: 'Manter',
            danger: true,
          });
          if (!ok) return;
          try {
            await deleteCampaignApi(c.id);
            await onAfterDelete();
          } catch (err) {
            toastWarn(`Falha ao excluir: ${String(err)}`);
          }
        },
      },
    }),
  ]);
}

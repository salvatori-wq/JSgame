// JSgame · Ω.2 — "Meus PJs" collapsible.
// Lista PJs do owner + actions (Nova Crônica / Ficha / Apagar). Click no card seleciona.

import { el, getOwnerName } from '../../util';
import { listCharacters, deleteCharacter } from '../../api';
import { confirmDialog } from '../../ui-modal';
import { getRace } from '../../../dnd/races';
import { getClass } from '../../../dnd/classes';
import { portraitFor } from '../../../dnd/portrait';
import { makeCollapsibleSection } from './collapsible';

export interface MyCharactersOpts {
  onPlayChronicle: (characterId: string) => void;
  onOpenSheet: (characterId: string) => void;
  /** Chamado quando o player muda a seleção atual (impacta join via coop). */
  onSelectionChange: (characterId: string | null) => void;
  /** Reset hook: chamado em refresh — pra outras secções saberem que mudou. */
  onAfterRefresh?: () => void;
}

export interface MyCharactersHandle {
  element: HTMLElement;
  refresh: () => Promise<void>;
  getSelectedId: () => string | null;
}

export async function renderMyCharacters(opts: MyCharactersOpts): Promise<MyCharactersHandle> {
  let selectedCharId: string | null = null;
  let listContainer: HTMLElement | null = null;
  let countLabel: HTMLElement | null = null;

  const refresh = async (): Promise<void> => {
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const owner = getOwnerName().trim();
    if (!owner) {
      listContainer.appendChild(el('div', { class: 'home-empty', text: '🪶 Diga seu nome no topo — PJs e cemitério aparecem aqui.' }));
      if (countLabel) countLabel.textContent = '';
      selectedCharId = null;
      opts.onSelectionChange(null);
      return;
    }
    for (let i = 0; i < 2; i++) {
      listContainer.appendChild(el('div', { class: 'skeleton skeleton-card' }));
    }
    try {
      const chars = await listCharacters(owner);
      listContainer.innerHTML = '';
      if (countLabel) countLabel.textContent = chars.length > 0 ? `(${chars.length})` : '';
      if (chars.length === 0) {
        listContainer.appendChild(el('div', { class: 'home-empty', text: '🏚 Câmaras vazias. Forje o primeiro PJ — o mundo aguarda.' }));
        selectedCharId = null;
        opts.onSelectionChange(null);
        return;
      }
      if (!selectedCharId || !chars.find((c) => c.id === selectedCharId)) {
        selectedCharId = chars[0]?.id ?? null;
        opts.onSelectionChange(selectedCharId);
      }
      for (const c of chars) {
        const race = getRace(c.raceId as Parameters<typeof getRace>[0]);
        const klass = getClass(c.classId as Parameters<typeof getClass>[0]);
        const isSelected = c.id === selectedCharId;
        const portrait = portraitFor({
          raceId: c.raceId as Parameters<typeof portraitFor>[0]['raceId'],
          classId: c.classId as Parameters<typeof portraitFor>[0]['classId'],
        });
        const card = el('div', { class: `home-char-card${isSelected ? ' is-selected' : ''}` }, [
          el('div', {
            class: 'hcc-body',
            on: {
              click: () => {
                selectedCharId = c.id;
                opts.onSelectionChange(c.id);
                void refresh();
              },
            },
          }, [
            el('div', { class: 'hcc-portrait', style: { background: portrait.aura }, attrs: { title: `${c.raceId} ${c.classId}` } }, [
              el('span', { class: 'hcc-portrait-race', text: portrait.race }),
              el('span', { class: 'hcc-portrait-class', text: portrait.class }),
            ]),
            el('div', { class: 'hcc-info' }, [
              el('div', { class: 'hcc-name', text: c.characterName }),
              el('div', { class: 'hcc-meta', text: `${race?.name ?? c.raceId} · ${klass?.name ?? c.classId} · Nv ${c.level}` }),
            ]),
          ]),
          el('div', { class: 'hcc-actions' }, [
            el('button', {
              class: 'hcc-play-btn',
              text: '▶ Nova Crônica',
              attrs: { title: 'Começar sessão nova com este PJ' },
              on: {
                click: (e) => {
                  e.stopPropagation();
                  opts.onPlayChronicle(c.id);
                },
              },
            }),
            el('button', {
              class: 'hcc-sheet-btn',
              text: 'Ficha',
              attrs: { title: 'Ver ficha completa' },
              on: {
                click: (e) => {
                  e.stopPropagation();
                  opts.onOpenSheet(c.id);
                },
              },
            }),
            el('button', {
              class: 'hcc-del-btn',
              text: '🗑',
              attrs: { title: 'Apagar', 'aria-label': `Apagar ${c.characterName}` },
              on: {
                click: async (e) => {
                  e.stopPropagation();
                  const ok = await confirmDialog({
                    title: '⚠ Banir do mundo?',
                    text: `${c.characterName} desaparece pra sempre. Sem retorno.`,
                    confirmText: '🗡 Banir',
                    cancelText: 'Cancelar',
                    danger: true,
                  });
                  if (ok) {
                    await deleteCharacter(c.id);
                    await refresh();
                  }
                },
              },
            }),
          ]),
        ]);
        listContainer.appendChild(card);
      }
      opts.onAfterRefresh?.();
    } catch (err) {
      listContainer.innerHTML = '';
      listContainer.appendChild(el('div', { class: 'home-empty', text: `Erro: ${String(err)}` }));
    }
  };

  const section = makeCollapsibleSection({
    id: 'my-chars',
    title: 'Meus PJs',
    icon: '📚',
    defaultOpen: true,
    renderContent: () => {
      const list = el('div', { class: 'home-characters' });
      listContainer = list;
      // First-time load
      void refresh();
      return list;
    },
  });

  // Pega ref do span de count no header pra atualizar dinâmico
  countLabel = section.querySelector('.hc-count') as HTMLElement | null;
  if (!countLabel) {
    // Se header não criou hc-count (count não foi passado), insere manualmente
    const headerLeft = section.querySelector('.hc-header-left');
    countLabel = el('span', { class: 'hc-count', text: '' });
    headerLeft?.appendChild(countLabel);
  }

  return {
    element: section,
    refresh,
    getSelectedId: () => selectedCharId,
  };
}

// JSgame · Ω.2 — Play Now (3 PJs prontos + link wizard discreto).
// 3 cards grandes: tap → cria PJ instantâneo + entra em cold-open.
// Link "Criar PJ do zero" abaixo, discreto (descobrabilidade sem poluição).

import { el, ensureOwnerName } from '../../util';
import { toastError } from '../../toast';
import { trackClientMetric } from '../../api';

export interface PrefabCard {
  id: 'borin' | 'lyra' | 'sina';
  icon: string;
  label: string;
  archetype: string;
  teaser: string;
}

// Round 1 fix (Mariana DM 10+ anos) — archetype agora usa terminologia PHB correta
// (Classe Raça · habilidade icônica) em vez de gamer-speak "TANK · BATE FORTE".
// Teaser fica como flavor narrativo, sem repetir raça/classe.
export const PREFAB_CARDS: readonly PrefabCard[] = [
  { id: 'borin', icon: '🪨', label: 'Borin Forjarocha', archetype: 'Lutador Anão · Linha de frente',     teaser: 'Veterano de guerras. Dois golpes por turno.' },
  { id: 'lyra',  icon: '🌟', label: 'Lyra Estrelaluz', archetype: 'Maga Alta-elfa · Mistérios arcanos',   teaser: 'Arquivista das torres. Magias e segredos antigos.' },
  { id: 'sina',  icon: '🗡', label: 'Sina Tribuna',    archetype: 'Ladina Halfling · Ataque furtivo',    teaser: 'Mãos leves nas sombras. Acerto crítico ao surpreender.' },
] as const;

export interface PlayNowOpts {
  onChronicleStart: (characterId: string) => void;
  onWizardClick: () => void;
}

export function renderPlayNow(opts: PlayNowOpts): HTMLElement {
  const section = el('section', { class: 'home-playnow', attrs: { 'aria-label': 'Jogar já com PJs prontos' } });
  section.appendChild(el('div', { class: 'home-section-header' }, [
    el('span', { class: 'home-section-eyebrow', text: '⚔ JOGAR JÁ' }),
    el('span', { class: 'home-section-hint', text: 'PJs prontos, cena com tensão, em 10s' }),
  ]));

  const grid = el('div', { class: 'home-playnow-grid' });
  for (const card of PREFAB_CARDS) {
    grid.appendChild(renderPrefabCard(card, opts));
  }
  section.appendChild(grid);

  // Link discreto pro wizard (D3 — power user descobre mas não polui home).
  // S1.2 (Henrique) — "Wizard" era jargão dev (família pensava "preciso ser bruxo?").
  // Substituído por "modo detalhado" + title explicando passos + tempo estimado.
  section.appendChild(el('button', {
    class: 'home-wizard-link',
    text: '✎ Criar PJ no detalhe',
    attrs: {
      type: 'button',
      title: 'Escolhe raça, classe, atributos e perícias passo a passo (~3 min)',
    },
    on: {
      click: () => {
        // Sem fricção: garante um owner (anônimo se preciso) e segue.
        ensureOwnerName();
        opts.onWizardClick();
      },
    },
  }));

  return section;
}

function renderPrefabCard(card: PrefabCard, opts: PlayNowOpts): HTMLElement {
  const btn = el('button', {
    class: 'home-prefab-card',
    attrs: { type: 'button', 'data-prefab': card.id, title: `Jogar como ${card.label} agora` },
    on: {
      click: async () => {
        // "Jogar já" = zero portões. Sem nome digitado, cria um anônimo
        // (trocável depois no identity bar) em vez de morrer em silêncio.
        const owner = ensureOwnerName();
        trackClientMetric('prefab_clicked', { prefab_id: card.id });
        btn.setAttribute('disabled', '');
        btn.classList.add('is-loading');
        try {
          const res = await fetch('/api/characters/prefab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ prefabId: card.id, ownerName: owner }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok || !data.sheet?.id) {
            toastError(data?.error ?? 'falha ao criar prefab');
            btn.removeAttribute('disabled');
            btn.classList.remove('is-loading');
            return;
          }
          opts.onChronicleStart(data.sheet.id);
        } catch (err) {
          toastError(`erro: ${String(err)}`);
          btn.removeAttribute('disabled');
          btn.classList.remove('is-loading');
        }
      },
    },
  }, [
    el('div', { class: 'home-prefab-icon', text: card.icon }),
    el('div', { class: 'home-prefab-label', text: card.label }),
    el('div', { class: 'home-prefab-archetype', text: card.archetype }),
    el('div', { class: 'home-prefab-teaser', text: card.teaser }),
    el('div', { class: 'home-prefab-cta', text: '▶ JOGAR' }),
  ]);
  return btn;
}

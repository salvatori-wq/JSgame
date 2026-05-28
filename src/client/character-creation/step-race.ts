// JSgame · Step 1: escolha de raça (13 cards).

import { ALL_RACES } from '../../dnd/races';
import { ABILITY_SHORT, abilityModifier, formatModifier } from '../../dnd/attributes';
import { el, escapeHtml } from '../util';
import { toggleCompare, isInCompareTray } from './compare-modal';
import type { WizardState } from './wizard';

export function renderRaceStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void },
): HTMLElement {
  // Agrupa por parentName pra UI ficar Anão > [Colina, Montanha]
  const groups = new Map<string, typeof ALL_RACES>();
  for (const r of ALL_RACES) {
    const list = groups.get(r.parentName) ?? [];
    list.push(r);
    groups.set(r.parentName, list);
  }

  const container = el('div', { class: 'wiz-step wiz-step-race' });

  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Escolha sua Raça' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'Sua raça molda quem você é. Define bônus de atributo, deslocamento, e traços especiais.' }));

  const grid = el('div', { class: 'wiz-grid wiz-grid-race' });
  for (const [parentName, races] of groups) {
    if (races.length === 1) {
      grid.appendChild(renderRaceCard(races[0]!, state, callbacks));
    } else {
      for (const race of races) {
        grid.appendChild(renderRaceCard(race, state, callbacks, parentName));
      }
    }
  }
  container.appendChild(grid);

  // Botão continuar
  const continueBtn = el('button', {
    class: 'wiz-cta',
    text: 'Continuar →',
    attrs: { type: 'button', disabled: !state.raceId },
    on: { click: () => callbacks.next() },
  });
  container.appendChild(el('footer', { class: 'wiz-footer' }, [continueBtn]));
  return container;
}

function renderRaceCard(
  race: typeof ALL_RACES[number],
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void },
  parentLabel?: string,
): HTMLElement {
  const isSelected = state.raceId === race.id;
  const isComparing = isInCompareTray('race', race.id);
  const bonusEntries = Object.entries(race.abilityBonuses)
    .filter(([, v]) => (v ?? 0) !== 0)
    .map(([k, v]) => `${ABILITY_SHORT[k as keyof typeof ABILITY_SHORT]} ${formatModifier(v ?? 0)}`)
    .join(', ');

  const card = el('article', {
    class: `wiz-card wiz-card-race ${isSelected ? 'is-selected' : ''} ${isComparing ? 'is-comparing' : ''}`,
    attrs: { role: 'button', tabindex: 0 },
    on: {
      click: () => {
        callbacks.update({ raceId: race.id });
        document.dispatchEvent(new CustomEvent('wiz:rerender'));
      },
    },
  });

  card.innerHTML = `
    ${parentLabel ? `<div class="wc-parent">${escapeHtml(parentLabel)}</div>` : ''}
    <div class="wc-name">${escapeHtml(race.name)}</div>
    <div class="wc-bonus">${bonusEntries}</div>
    <div class="wc-desc">${escapeHtml(race.description)}</div>
    <div class="wc-meta">
      <span class="wc-meta-item" title="Deslocamento por turno (1 quadrado = 1.5m)">⊳ ${Math.round(race.speed * 0.3)}m</span>
      ${race.darkvision ? `<span class="wc-meta-item" title="Visão no escuro">👁 ${Math.round(race.darkvision * 0.3)}m</span>` : ''}
      <span class="wc-meta-item">${race.size === 'pequeno' ? 'Pequeno' : 'Médio'}</span>
    </div>
    <ul class="wc-traits">
      ${race.traits.slice(0, 3).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
      ${race.traits.length > 3 ? `<li class="wc-traits-more">+ ${race.traits.length - 3} traços</li>` : ''}
    </ul>
  `;

  card.appendChild(el('button', {
    class: `wc-compare-btn ${isComparing ? 'is-on' : ''}`,
    text: isComparing ? '⚖ comparando' : '⚖ comparar',
    attrs: { type: 'button', title: 'Adicionar à comparação (até 3)' },
    on: {
      click: (e) => {
        e.stopPropagation();
        toggleCompare('race', race.id);
        document.dispatchEvent(new CustomEvent('wiz:rerender'));
      },
    },
  }));

  return card;
}

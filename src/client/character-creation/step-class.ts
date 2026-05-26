// JSgame · Step 2: escolha de classe (12 cards).

import { ALL_CLASSES } from '../../dnd/classes';
import { ABILITY_LABELS, ABILITY_SHORT } from '../../dnd/attributes';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';

export function renderClassStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-class' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Escolha sua Classe' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'A classe define sua vocação — guerreiro, mago, ladino... Determina hit die, perícias e poderes especiais.' }));

  const grid = el('div', { class: 'wiz-grid wiz-grid-class' });
  for (const klass of ALL_CLASSES) {
    grid.appendChild(renderClassCard(klass, state, callbacks));
  }
  container.appendChild(grid);

  const footer = el('footer', { class: 'wiz-footer' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button', disabled: !state.classId },
      on: { click: () => callbacks.next() },
    }),
  ]);
  container.appendChild(footer);

  return container;
}

function renderClassCard(
  klass: typeof ALL_CLASSES[number],
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
): HTMLElement {
  const isSelected = state.classId === klass.id;
  const primary = Array.isArray(klass.primaryAbility)
    ? klass.primaryAbility.map((a) => ABILITY_SHORT[a]).join('/')
    : ABILITY_SHORT[klass.primaryAbility];
  const saves = klass.savingThrowProficiencies.map((a) => ABILITY_SHORT[a]).join(' · ');

  const card = el('article', {
    class: `wiz-card wiz-card-class ${isSelected ? 'is-selected' : ''}`,
    attrs: { role: 'button', tabindex: 0 },
    on: {
      click: () => {
        // Subclass é dependente da classe — limpa pra evitar PJ com subclass de classe errada.
        callbacks.update({ classId: klass.id, chosenSkills: [], subclassId: null });
        document.dispatchEvent(new CustomEvent('wiz:rerender'));
      },
    },
  });

  card.innerHTML = `
    <div class="wc-name">${escapeHtml(klass.name)}</div>
    <div class="wc-tag">d${klass.hitDie} HP · ${primary} · ${klass.isSpellcaster ? 'Conjurador' : 'Marcial'}</div>
    <div class="wc-desc">${escapeHtml(klass.description)}</div>
    <div class="wc-meta">
      <span class="wc-meta-item">⚔ ${escapeHtml(klass.weaponProficiencies.slice(0, 2).join(', '))}${klass.weaponProficiencies.length > 2 ? '…' : ''}</span>
      <span class="wc-meta-item">🛡 Saves: ${saves}</span>
    </div>
    <div class="wc-skills-hint">Escolhe ${klass.skillChoices.count} perícias de ${klass.skillChoices.from.length}</div>
  `;
  return card;
}

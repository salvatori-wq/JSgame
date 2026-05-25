// JSgame · Step 4: escolha de antecedente + perícias de classe.

import { ALL_BACKGROUNDS, getBackground } from '@dnd/backgrounds';
import { getClass } from '@dnd/classes';
import { getSkill } from '@dnd/skills';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';
import type { SkillId } from '@shared/types';

export function renderBackgroundStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-background' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Escolha seu Antecedente' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'O antecedente revela quem você foi antes da aventura. Dá perícias garantidas + característica especial.' }));

  // Render container que se re-popula
  const dynamic = el('div', { class: 'bg-dynamic' });
  const renderAll = (): void => {
    dynamic.innerHTML = '';
    dynamic.appendChild(renderBackgroundsList(state, callbacks, renderAll));
    if (state.backgroundId && state.classId) {
      dynamic.appendChild(renderClassSkillsPicker(state, callbacks, renderAll));
    }
  };
  renderAll();
  container.appendChild(dynamic);

  const klass = state.classId ? getClass(state.classId) : null;
  const skillsNeeded = klass?.skillChoices.count ?? 0;
  const skillsChosen = state.chosenSkills.length;
  const canContinue = !!state.backgroundId && skillsChosen === skillsNeeded;

  const footer = el('footer', { class: 'wiz-footer' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button', disabled: !canContinue },
      on: { click: () => callbacks.next() },
    }),
  ]);
  container.appendChild(footer);

  return container;
}

function renderBackgroundsList(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
  rerender: () => void,
): HTMLElement {
  const grid = el('div', { class: 'wiz-grid wiz-grid-bg' });
  for (const bg of ALL_BACKGROUNDS) {
    const isSelected = state.backgroundId === bg.id;
    const card = el('article', {
      class: `wiz-card wiz-card-bg ${isSelected ? 'is-selected' : ''}`,
      attrs: { role: 'button', tabindex: 0 },
      on: {
        click: () => {
          callbacks.update({ backgroundId: bg.id });
          rerender();
        },
      },
    });
    const skillNames = bg.skillProficiencies.map((s) => getSkill(s).name).join(', ');
    card.innerHTML = `
      <div class="wc-name">${escapeHtml(bg.name)}</div>
      <div class="wc-tag">${escapeHtml(skillNames)}</div>
      <div class="wc-desc">${escapeHtml(bg.description)}</div>
      <div class="wc-feature">
        <b>${escapeHtml(bg.feature.name)}:</b> ${escapeHtml(bg.feature.description)}
      </div>
      <div class="wc-meta">
        <span class="wc-meta-item">💰 ${bg.startingGold} po</span>
        ${bg.languageCount > 0 ? `<span class="wc-meta-item">📜 +${bg.languageCount} idioma${bg.languageCount > 1 ? 's' : ''}</span>` : ''}
      </div>
    `;
    grid.appendChild(card);
  }
  return grid;
}

function renderClassSkillsPicker(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
  rerender: () => void,
): HTMLElement {
  const klass = getClass(state.classId!);
  const bg = getBackground(state.backgroundId!);
  const bgSkills = new Set(bg.skillProficiencies);

  const section = el('div', { class: 'bg-skill-picker' });
  section.appendChild(el('h3', { class: 'wiz-h3', text: `Escolha ${klass.skillChoices.count} perícias da classe ${klass.name}` }));
  section.appendChild(el('p', { class: 'bg-skill-hint', text: `Já garantidas pelo antecedente ${bg.name}: ${bg.skillProficiencies.map((s) => getSkill(s).name).join(', ')}` }));

  const grid = el('div', { class: 'bg-skill-grid' });
  for (const skillId of klass.skillChoices.from) {
    const isFromBg = bgSkills.has(skillId);
    const isChosen = state.chosenSkills.includes(skillId);
    const skill = getSkill(skillId);
    const isAtMax = state.chosenSkills.length >= klass.skillChoices.count && !isChosen;

    const btn = el('button', {
      class: `bg-skill-btn ${isChosen ? 'is-chosen' : ''} ${isFromBg ? 'is-redundant' : ''}`,
      attrs: { type: 'button', disabled: isAtMax || isFromBg, title: skill.description },
      on: {
        click: () => {
          if (isFromBg) return;
          let next: SkillId[];
          if (isChosen) {
            next = state.chosenSkills.filter((s) => s !== skillId);
          } else if (state.chosenSkills.length < klass.skillChoices.count) {
            next = [...state.chosenSkills, skillId];
          } else {
            return;
          }
          callbacks.update({ chosenSkills: next });
          rerender();
        },
      },
    });
    btn.innerHTML = `
      <span class="bsb-name">${escapeHtml(skill.name)}</span>
      <span class="bsb-ability">${escapeHtml(skill.ability.toUpperCase())}</span>
      ${isFromBg ? `<span class="bsb-tag">já tem (antecedente)</span>` : ''}
    `;
    grid.appendChild(btn);
  }
  section.appendChild(grid);

  section.appendChild(el('div', {
    class: 'bg-skill-counter',
    text: `Escolhidas: ${state.chosenSkills.length}/${klass.skillChoices.count}`,
  }));

  return section;
}

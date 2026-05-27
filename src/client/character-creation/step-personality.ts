// JSgame · η.2 — Step Personality (Traits/Ideals/Bonds/Flaws).
// PHB cap 4: cada background tem pool de 8 traits + 6 ideals + 6 bonds + 6 flaws.
// Player sorteia 2+1+1+1 ou edita livre. Step OPCIONAL (skip permitido).

import { el, escapeHtml } from '../util';
import { getBackground } from '../../dnd/backgrounds';
import { getPersonalityPool, rollRandomPersonality } from '../../dnd/personality-tables';
import type { WizardState } from './wizard';

export function renderPersonalityStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-personality' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Personalidade (opcional)' }));
  container.appendChild(el('p', {
    class: 'wiz-intro',
    text: 'Defina como seu PJ se comporta. O Mestre vai usar pra ancorar narração — citar seus traços em momentos certos. Pode pular.',
  }));

  if (!state.backgroundId) {
    container.appendChild(el('p', { class: 'wiz-warn', text: '⚠ Escolha um antecedente primeiro pra ter o pool de personalidade certo.' }));
    return container;
  }

  const bg = getBackground(state.backgroundId);
  const pool = getPersonalityPool(state.backgroundId);

  // Estado local (espelha state)
  if (!state.personalityTraits) state.personalityTraits = [];
  if (!state.personalityIdeals) state.personalityIdeals = [];
  if (!state.personalityBonds) state.personalityBonds = [];
  if (!state.personalityFlaws) state.personalityFlaws = [];

  const body = el('div', { class: 'wiz-personality-body' });

  const renderAll = (): void => {
    body.innerHTML = '';

    // Botão Sortear Tudo
    body.appendChild(el('button', {
      class: 'wiz-personality-roll-all',
      attrs: { type: 'button' },
      text: `🎲 Sortear personalidade (${bg.name})`,
      on: {
        click: () => {
          const rolled = rollRandomPersonality(state.backgroundId!);
          state.personalityTraits = rolled.traits;
          state.personalityIdeals = rolled.ideals;
          state.personalityBonds = rolled.bonds;
          state.personalityFlaws = rolled.flaws;
          callbacks.update({
            personalityTraits: rolled.traits,
            personalityIdeals: rolled.ideals,
            personalityBonds: rolled.bonds,
            personalityFlaws: rolled.flaws,
          });
          renderAll();
        },
      },
    }));

    body.appendChild(renderSection(
      'TRAÇOS (2)',
      state.personalityTraits ?? [],
      pool.traits,
      2,
      (next) => {
        state.personalityTraits = next;
        callbacks.update({ personalityTraits: next });
        renderAll();
      },
    ));

    body.appendChild(renderSection(
      'IDEAL (1)',
      state.personalityIdeals ?? [],
      pool.ideals,
      1,
      (next) => {
        state.personalityIdeals = next;
        callbacks.update({ personalityIdeals: next });
        renderAll();
      },
    ));

    body.appendChild(renderSection(
      'VÍNCULO (1)',
      state.personalityBonds ?? [],
      pool.bonds,
      1,
      (next) => {
        state.personalityBonds = next;
        callbacks.update({ personalityBonds: next });
        renderAll();
      },
    ));

    body.appendChild(renderSection(
      'DEFEITO (1)',
      state.personalityFlaws ?? [],
      pool.flaws,
      1,
      (next) => {
        state.personalityFlaws = next;
        callbacks.update({ personalityFlaws: next });
        renderAll();
      },
    ));
  };

  renderAll();
  container.appendChild(body);

  // Footer
  const footer = el('footer', { class: 'wiz-footer wiz-footer-sticky' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    el('div', {
      class: 'wiz-hint is-ready',
      text: state.personalityTraits?.length
        ? `✓ ${(state.personalityTraits?.length ?? 0) + (state.personalityIdeals?.length ?? 0) + (state.personalityBonds?.length ?? 0) + (state.personalityFlaws?.length ?? 0)} traços definidos`
        : '✓ Pode pular — Mestre improvisa',
    }),
    el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button' },
      on: { click: () => callbacks.next() },
    }),
  ]);
  container.appendChild(footer);

  return container;
}

function renderSection(
  label: string,
  selected: string[],
  pool: string[],
  maxSelect: number,
  onChange: (next: string[]) => void,
): HTMLElement {
  const wrap = el('div', { class: 'wiz-personality-section' });
  wrap.appendChild(el('h3', { class: 'wiz-personality-h3', text: label }));

  // Selecionados — mostra primeiro com botão pra trocar
  if (selected.length > 0) {
    const selWrap = el('div', { class: 'wiz-personality-selected' });
    for (const s of selected) {
      selWrap.appendChild(el('div', { class: 'wpi-chip is-selected' }, [
        el('span', { class: 'wpi-chip-text', text: s }),
        el('button', {
          class: 'wpi-chip-remove',
          attrs: { type: 'button', 'aria-label': 'Remover' },
          text: '×',
          on: {
            click: () => {
              const next = selected.filter((x) => x !== s);
              onChange(next);
            },
          },
        }),
      ]));
    }
    wrap.appendChild(selWrap);
  }

  // Opções do pool não selecionadas (mostra apenas se ainda não atingiu max)
  if (selected.length < maxSelect) {
    const optsWrap = el('div', { class: 'wiz-personality-options' });
    for (const opt of pool) {
      if (selected.includes(opt)) continue;
      optsWrap.appendChild(el('button', {
        class: 'wpi-option',
        attrs: { type: 'button' },
        text: opt,
        on: {
          click: () => {
            onChange([...selected, opt]);
          },
        },
      }));
    }
    wrap.appendChild(optsWrap);
  } else {
    wrap.appendChild(el('div', {
      class: 'wiz-personality-full',
      text: `✓ ${maxSelect}/${maxSelect} selecionados`,
    }));
  }

  return wrap;
}

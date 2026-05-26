// JSgame · Step 3: point buy de atributos (27 pontos).

import {
  ABILITY_KEYS, ABILITY_LABELS, ABILITY_SHORT, ABILITY_GLYPHS,
  POINT_BUY_BUDGET, POINT_BUY_MIN, POINT_BUY_MAX,
  pointBuyCost, totalPointBuyCost, abilityModifier, formatModifier,
  applyRacialBonuses,
} from '../../dnd/attributes';
import { getRace } from '../../dnd/races';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';
import type { AbilityKey } from '../../shared/types';

export function renderAbilitiesStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-abilities' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Distribua seus Atributos' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: `Você tem ${POINT_BUY_BUDGET} pontos pra distribuir. Cada atributo começa em 8 (custa 0). Subir até 13 custa 1pt por nível. De 14-15 custa 2pts por nível.` }));

  // Re-render quando ability score muda
  const renderScores = (): HTMLElement => {
    const race = state.raceId ? getRace(state.raceId) : null;
    const racialFinal = race ? applyRacialBonuses(state.abilityScoresBase, race.abilityBonuses) : state.abilityScoresBase;
    const cost = totalPointBuyCost(state.abilityScoresBase) ?? 0;
    const remaining = POINT_BUY_BUDGET - cost;
    const isValid = cost <= POINT_BUY_BUDGET;

    const wrapper = el('div', { class: 'ab-wrapper' });

    // Budget header
    wrapper.appendChild(el('div', { class: 'ab-budget' }, [
      el('span', { class: 'ab-budget-label', text: 'Pontos restantes' }),
      el('span', {
        class: `ab-budget-val ${remaining < 0 ? 'is-over' : remaining === 0 ? 'is-zero' : ''}`,
        text: `${remaining}/${POINT_BUY_BUDGET}`,
      }),
    ]));

    // Ability rows
    const table = el('div', { class: 'ab-table' });
    for (const key of ABILITY_KEYS) {
      table.appendChild(renderAbilityRow(key, state, racialFinal[key], callbacks, renderAll));
    }
    wrapper.appendChild(table);

    if (!isValid) {
      wrapper.appendChild(el('div', { class: 'ab-error', text: `⚠ Você gastou ${cost} de ${POINT_BUY_BUDGET} pontos. Reduza algum atributo.` }));
    }
    return wrapper;
  };

  // closure pra re-render tudo (scores + footer) — footer precisa reagir a mudanças
  const dynamic = el('div', { class: 'ab-dynamic' });
  const renderAll = (): void => {
    dynamic.innerHTML = '';
    dynamic.appendChild(renderScores());
    dynamic.appendChild(renderFooter(state, callbacks));
  };
  renderAll();
  container.appendChild(dynamic);

  return container;
}

function renderFooter(
  state: WizardState,
  callbacks: { next: () => void; back: () => void },
): HTMLElement {
  const cost = totalPointBuyCost(state.abilityScoresBase) ?? 99;
  const remaining = POINT_BUY_BUDGET - cost;
  const isValid = cost <= POINT_BUY_BUDGET;
  const hint = !isValid
    ? `Excedeu ${cost - POINT_BUY_BUDGET} pts — reduza algum atributo`
    : remaining > 0
      ? `Sobram ${remaining} pts (pode gastar tudo ou seguir assim)`
      : null;

  return el('footer', { class: 'wiz-footer' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    hint ? el('div', { class: 'wiz-hint', text: hint }) : null,
    el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button', disabled: !isValid },
      on: { click: () => { if (isValid) callbacks.next(); } },
    }),
  ].filter(Boolean) as HTMLElement[]);
}

function renderAbilityRow(
  key: AbilityKey,
  state: WizardState,
  finalScore: number,
  callbacks: { update: (patch: Partial<WizardState>) => void },
  rerender: () => void,
): HTMLElement {
  const baseScore = state.abilityScoresBase[key];
  const race = state.raceId ? getRace(state.raceId) : null;
  const racialBonus = (race?.abilityBonuses[key] ?? 0);
  const finalMod = abilityModifier(finalScore);

  const row = el('div', { class: 'ab-row' });

  const dec = el('button', {
    class: 'ab-btn ab-dec',
    text: '−',
    attrs: { type: 'button', disabled: baseScore <= POINT_BUY_MIN },
    on: {
      click: () => {
        if (baseScore > POINT_BUY_MIN) {
          state.abilityScoresBase[key] = baseScore - 1;
          callbacks.update({ abilityScoresBase: { ...state.abilityScoresBase } });
          rerender();
        }
      },
    },
  });

  const inc = el('button', {
    class: 'ab-btn ab-inc',
    text: '+',
    attrs: { type: 'button', disabled: baseScore >= POINT_BUY_MAX },
    on: {
      click: () => {
        if (baseScore < POINT_BUY_MAX) {
          // Check se cabe no budget
          const newScores = { ...state.abilityScoresBase, [key]: baseScore + 1 };
          const newCost = totalPointBuyCost(newScores);
          if (newCost !== null && newCost <= POINT_BUY_BUDGET) {
            state.abilityScoresBase[key] = baseScore + 1;
            callbacks.update({ abilityScoresBase: { ...state.abilityScoresBase } });
            rerender();
          }
        }
      },
    },
  });

  row.innerHTML = `
    <div class="ab-glyph">${escapeHtml(ABILITY_GLYPHS[key])}</div>
    <div class="ab-name">
      <span class="ab-full">${escapeHtml(ABILITY_LABELS[key])}</span>
      <span class="ab-short">${escapeHtml(ABILITY_SHORT[key])}</span>
    </div>
  `;

  row.appendChild(dec);
  row.appendChild(el('div', { class: 'ab-value' }, [
    el('span', { class: 'ab-base', text: String(baseScore) }),
    racialBonus !== 0
      ? el('span', { class: 'ab-bonus', text: `+${racialBonus}` })
      : null,
  ].filter(Boolean) as HTMLElement[]));
  row.appendChild(inc);

  row.appendChild(el('div', { class: 'ab-final' }, [
    el('span', { class: 'ab-final-val', text: String(finalScore) }),
    el('span', { class: 'ab-final-mod', text: formatModifier(finalMod) }),
  ]));

  row.appendChild(el('div', { class: 'ab-cost', text: `${pointBuyCost(baseScore) ?? '?'} pts` }));

  // F33 — Slider (substitui drag dos +/- em sequência rápida; clamp via budget check)
  const slider = el('input', {
    class: 'ab-slider',
    attrs: {
      type: 'range',
      min: String(POINT_BUY_MIN),
      max: String(POINT_BUY_MAX),
      step: '1',
      value: String(baseScore),
      'aria-label': `Score base ${key}`,
    },
    on: {
      input: (e) => {
        const desired = Number((e.target as HTMLInputElement).value);
        // Tenta aplicar, mas se exceder budget, clampa pro maior valor possível.
        let chosen = desired;
        if (desired > baseScore) {
          // Subindo — encontra maior valor ≤ desired que cabe no budget.
          while (chosen > baseScore) {
            const candidate = { ...state.abilityScoresBase, [key]: chosen };
            const cost = totalPointBuyCost(candidate);
            if (cost !== null && cost <= POINT_BUY_BUDGET) break;
            chosen--;
          }
        }
        state.abilityScoresBase[key] = chosen;
        callbacks.update({ abilityScoresBase: { ...state.abilityScoresBase } });
        rerender();
      },
    },
  }) as HTMLInputElement;
  row.appendChild(slider);

  return row;
}

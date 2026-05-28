// JSgame · η.6 — Saving Throw fórmula explícita.
// Banner inline mostra: "d20 + mod SAB + prof = total" com cada componente
// explicado em tooltip. Tutorial inline 1ª vez (localStorage flag).

import type { CharacterSheet } from '../../shared/types';
import { ABILITY_SHORT, abilityModifier, proficiencyBonus, formatModifier } from '../../dnd/attributes';
import type { AbilityKey } from '../../dnd/attributes';
import { el } from '../util';

export interface SavingThrowFormulaContext {
  character: CharacterSheet;
  ability: AbilityKey;
  dc: number;
  reason: string;
  onRoll: () => void;
}

const TUTORIAL_FLAG = 'jsgame.savingThrowTutorialShown';

/**
 * Renderiza banner saving throw rico — fórmula didática + breakdown visual.
 * Substitui o banner simples por algo educativo.
 */
export function renderSavingThrowFormula(ctx: SavingThrowFormulaContext): HTMLElement {
  const { character, ability, dc, reason, onRoll } = ctx;
  const abMod = abilityModifier(character.abilityScores[ability]);
  const proficient = character.proficientSavingThrows.includes(ability);
  const pb = proficient ? proficiencyBonus(character.level) : 0;
  const totalMod = abMod + pb;

  const root = el('div', { class: 'save-formula-banner', attrs: { role: 'region', 'aria-label': 'Teste de Resistência' } });

  // Header — S1.4: "Save SAB" → "Save de SAB" alinha com tutorial body
  // (line 73-74) e com glossary "Save Throw" PT-BR. Mais conversacional.
  root.appendChild(el('div', { class: 'sfb-header' }, [
    el('span', { class: 'sfb-icon', text: '🛡' }),
    el('span', { class: 'sfb-title', text: `Save de ${ABILITY_SHORT[ability]}` }),
    el('span', { class: 'sfb-dc', text: `DC ${dc}` }),
  ]));

  // Reason narrativa
  if (reason) {
    root.appendChild(el('div', { class: 'sfb-reason', text: reason }));
  }

  // Fórmula explícita
  const formula = el('div', { class: 'sfb-formula' });
  formula.appendChild(el('span', { class: 'sfb-die', text: 'd20', attrs: { title: 'Rolagem aleatória de 1 a 20' } }));
  formula.appendChild(el('span', { class: 'sfb-op', text: '+' }));
  formula.appendChild(el('span', {
    class: 'sfb-mod',
    text: formatModifier(abMod),
    attrs: { title: `Modificador de ${ABILITY_SHORT[ability]} (${character.abilityScores[ability]})` },
  }));
  if (proficient) {
    formula.appendChild(el('span', { class: 'sfb-op', text: '+' }));
    formula.appendChild(el('span', {
      class: 'sfb-prof',
      text: `+${pb}`,
      attrs: { title: `Bônus de proficiência (você é proficiente em saves de ${ABILITY_SHORT[ability]})` },
    }));
  }
  formula.appendChild(el('span', { class: 'sfb-eq', text: '=' }));
  formula.appendChild(el('span', { class: 'sfb-total-bonus', text: formatModifier(totalMod) }));
  formula.appendChild(el('span', { class: 'sfb-vs', text: `vs DC ${dc}` }));
  root.appendChild(formula);

  // Tutorial inline (1ª vez)
  if (typeof localStorage !== 'undefined' && !localStorage.getItem(TUTORIAL_FLAG)) {
    root.appendChild(el('div', { class: 'sfb-tutorial' }, [
      el('span', { class: 'sfb-tip-icon', text: '💡' }),
      el('span', {
        text: proficient
          ? `Save de ${ABILITY_SHORT[ability]} é uma habilidade sua — soma o modificador (${formatModifier(abMod)}) + bônus de proficiência (+${pb}) por ser proficiente.`
          : `Save de ${ABILITY_SHORT[ability]} usa o modificador do atributo (${formatModifier(abMod)}). Você não é proficiente em saves desse atributo.`,
      }),
    ]));
    try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch { /* ignore */ }
  }

  // Botão Rolar
  root.appendChild(el('button', {
    class: 'sfb-roll-btn',
    text: `🎲 Rolar (d20 ${formatModifier(totalMod)} vs DC ${dc})`,
    attrs: { type: 'button' },
    on: { click: () => onRoll() },
  }));

  return root;
}

/** Reset pra tests. */
export function resetSavingThrowTutorialForTest(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TUTORIAL_FLAG);
  } catch { /* ignore */ }
}

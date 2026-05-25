// JSgame · Step 5: review + nome + alinhamento + salvar.

import { getRace } from '@dnd/races';
import { getClass, startingHitPoints } from '@dnd/classes';
import { getBackground } from '@dnd/backgrounds';
import { getSkill } from '@dnd/skills';
import { ABILITY_KEYS, ABILITY_LABELS, ABILITY_SHORT, abilityModifier, formatModifier, applyRacialBonuses, proficiencyBonus } from '@dnd/attributes';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';
import type { Alignment } from '@shared/types';

const ALIGNMENT_LABELS: Record<Alignment, string> = {
  lb: 'Leal e Bom',     nb: 'Neutro e Bom',     cb: 'Caótico e Bom',
  ln: 'Leal e Neutro',  nn: 'Neutro Puro',      cn: 'Caótico e Neutro',
  lm: 'Leal e Mau',     nm: 'Neutro e Mau',     cm: 'Caótico e Mau',
};

export function renderReviewStep(
  state: WizardState,
  callbacks: {
    update: (patch: Partial<WizardState>) => void;
    back: () => void;
    finish: () => void;
  },
): HTMLElement {
  if (!state.raceId || !state.classId || !state.backgroundId) {
    return el('div', { class: 'wiz-step wiz-error', text: 'Wizard incompleto. Volte e preencha tudo.' });
  }

  const race = getRace(state.raceId);
  const klass = getClass(state.classId);
  const background = getBackground(state.backgroundId);
  const finalScores = applyRacialBonuses(state.abilityScoresBase, race.abilityBonuses);
  const conMod = abilityModifier(finalScores.con);
  const dexMod = abilityModifier(finalScores.des);
  const maxHp = startingHitPoints(state.classId, conMod);
  const pb = proficiencyBonus(1);
  const ac = 10 + dexMod;

  const container = el('div', { class: 'wiz-step wiz-step-review' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Revisão do Personagem' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'Confira sua ficha. Dê um nome e alinhamento ao seu personagem antes de salvar.' }));

  // === Sheet preview ===
  const sheet = el('div', { class: 'character-sheet' });

  // Nome + alinhamento (editáveis)
  const nameWrap = el('div', { class: 'cs-id' });
  const nameInput = el('input', {
    class: 'cs-name-input',
    attrs: {
      type: 'text',
      placeholder: 'Nome do seu personagem',
      maxlength: '40',
      value: state.characterName,
    },
    on: {
      input: (e) => callbacks.update({ characterName: (e.target as HTMLInputElement).value }),
    },
  }) as HTMLInputElement;

  const alignSelect = el('select', {
    class: 'cs-alignment',
    on: {
      change: (e) => callbacks.update({ alignment: (e.target as HTMLSelectElement).value as Alignment }),
    },
  });
  for (const [val, label] of Object.entries(ALIGNMENT_LABELS)) {
    const opt = el('option', { attrs: { value: val }, text: label }) as HTMLOptionElement;
    if (val === state.alignment) opt.selected = true;
    alignSelect.appendChild(opt);
  }

  nameWrap.appendChild(nameInput);
  nameWrap.appendChild(alignSelect);
  sheet.appendChild(nameWrap);

  // Race/Class/Background headline
  sheet.appendChild(el('div', { class: 'cs-headline' }, [
    el('span', { class: 'cs-race', text: race.name }),
    el('span', { class: 'cs-class', text: klass.name }),
    el('span', { class: 'cs-bg', text: background.name }),
    el('span', { class: 'cs-level', text: 'Nível 1' }),
  ]));

  // Stats grid: HP, AC, PB, Speed
  sheet.appendChild(el('div', { class: 'cs-stats-grid' }, [
    statBlock('HP', String(maxHp), `Hit Die d${klass.hitDie} + ${formatModifier(conMod)} CON`),
    statBlock('CA', String(ac), `10 + ${formatModifier(dexMod)} DES (sem armadura)`),
    statBlock('Proficiência', formatModifier(pb), 'Bônus de proficiência nv 1'),
    statBlock('Deslocamento', `${race.speed} ft`, race.darkvision ? `Visão Escuro ${race.darkvision} ft` : ''),
  ]));

  // Abilities table
  const abilitiesEl = el('div', { class: 'cs-abilities' });
  for (const key of ABILITY_KEYS) {
    const score = finalScores[key];
    const mod = abilityModifier(score);
    abilitiesEl.appendChild(el('div', { class: 'cs-ab-box' }, [
      el('div', { class: 'csab-name', text: ABILITY_SHORT[key] }),
      el('div', { class: 'csab-score', text: String(score) }),
      el('div', { class: 'csab-mod', text: formatModifier(mod) }),
    ]));
  }
  sheet.appendChild(abilitiesEl);

  // Skills
  const allSkillIds = Array.from(new Set([...background.skillProficiencies, ...state.chosenSkills]));
  sheet.appendChild(el('section', { class: 'cs-section' }, [
    el('h3', { class: 'cs-h3', text: 'Perícias' }),
    el('ul', { class: 'cs-skill-list' },
      allSkillIds.map((s) => {
        const skill = getSkill(s);
        const skillMod = abilityModifier(finalScores[skill.ability]) + pb;
        return el('li', {}, [
          el('span', { class: 'cs-skill-name', text: skill.name }),
          el('span', { class: 'cs-skill-ab', text: `(${ABILITY_SHORT[skill.ability]})` }),
          el('span', { class: 'cs-skill-mod', text: formatModifier(skillMod) }),
        ]);
      }),
    ),
  ]));

  // Saving throws
  sheet.appendChild(el('section', { class: 'cs-section' }, [
    el('h3', { class: 'cs-h3', text: 'Testes de Resistência (proficiente)' }),
    el('div', { class: 'cs-saves' },
      klass.savingThrowProficiencies.map((ab) => {
        const mod = abilityModifier(finalScores[ab]) + pb;
        return el('span', { class: 'cs-save' }, [
          el('b', { text: ABILITY_LABELS[ab] }),
          el('span', { text: ` ${formatModifier(mod)}` }),
        ]);
      }),
    ),
  ]));

  // Equipamento inicial
  sheet.appendChild(el('section', { class: 'cs-section' }, [
    el('h3', { class: 'cs-h3', text: 'Equipamento Inicial' }),
    el('ul', { class: 'cs-equip-list' }, [
      ...klass.startingEquipment.map((e) => el('li', { text: `(classe) ${e}` })),
      ...background.startingEquipment.map((e) => el('li', { text: `(antecedente) ${e}` })),
      el('li', { class: 'cs-equip-gold', text: `${background.startingGold} po (peças de ouro)` }),
    ]),
  ]));

  // Característica do antecedente
  sheet.appendChild(el('section', { class: 'cs-section' }, [
    el('h3', { class: 'cs-h3', text: `Característica: ${background.feature.name}` }),
    el('p', { class: 'cs-feature-desc', text: background.feature.description }),
  ]));

  // Idiomas + proficiências
  sheet.appendChild(el('section', { class: 'cs-section' }, [
    el('h3', { class: 'cs-h3', text: 'Idiomas + Proficiências' }),
    el('div', { class: 'cs-prof-row' }, [
      el('b', { text: 'Idiomas:' }),
      el('span', { text: ' ' + race.languages.join(', ') }),
    ]),
    el('div', { class: 'cs-prof-row' }, [
      el('b', { text: 'Armaduras:' }),
      el('span', { text: ' ' + (klass.armorProficiencies.join(', ') || 'nenhuma') }),
    ]),
    el('div', { class: 'cs-prof-row' }, [
      el('b', { text: 'Armas:' }),
      el('span', { text: ' ' + klass.weaponProficiencies.join(', ') }),
    ]),
  ]));

  container.appendChild(sheet);

  // Footer
  const footer = el('footer', { class: 'wiz-footer' }, [
    el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }),
    el('button', {
      class: 'wiz-cta wiz-cta-finish',
      text: '✓ Salvar Personagem',
      attrs: { type: 'button' },
      on: { click: () => callbacks.finish() },
    }),
  ]);
  container.appendChild(footer);

  return container;
}

function statBlock(label: string, value: string, sub: string): HTMLElement {
  return el('div', { class: 'cs-stat-block' }, [
    el('div', { class: 'csb-label', text: label }),
    el('div', { class: 'csb-value', text: value }),
    el('div', { class: 'csb-sub', text: sub }),
  ]);
}

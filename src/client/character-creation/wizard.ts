// JSgame · Character creation wizard. State machine simples — 5 steps.
// Cada step é um módulo que renderiza no container e chama next(state).

import type { CharacterSheet, AbilityScores, RaceId, ClassId, SkillId, AbilityKey } from '../../shared/types';
import type { BackgroundId } from '../../dnd/backgrounds';
import { defaultPointBuyScores, applyRacialBonuses, abilityModifier } from '../../dnd/attributes';
import { getRace, RACES } from '../../dnd/races';
import { getClass } from '../../dnd/classes';
import { getBackground } from '../../dnd/backgrounds';
import { startingHitPoints } from '../../dnd/classes';
import { applySpellcasterDefaults } from '../../dnd/spell-slots';
import { el, uuid, getOwnerName } from '../util';
import { saveCharacter } from '../api';
import { renderRaceStep } from './step-race';
import { renderClassStep } from './step-class';
import { renderAbilitiesStep } from './step-abilities';
import { renderBackgroundStep } from './step-background';
import { renderReviewStep } from './step-review';

export type WizardStep = 'race' | 'class' | 'abilities' | 'background' | 'review';

export interface WizardState {
  step: WizardStep;
  raceId: RaceId | null;
  classId: ClassId | null;
  abilityScoresBase: AbilityScores;       // após point buy, antes racial
  backgroundId: BackgroundId | null;
  chosenSkills: SkillId[];                // perícias escolhidas da classe (background dá próprias)
  characterName: string;
  alignment: import('../../shared/types').Alignment;
}

const STEP_ORDER: WizardStep[] = ['race', 'class', 'abilities', 'background', 'review'];

export class CharacterWizard {
  private state: WizardState;
  private container: HTMLElement;
  private onComplete: (sheet: CharacterSheet) => void;
  private onCancel: () => void;

  constructor(
    container: HTMLElement,
    onComplete: (sheet: CharacterSheet) => void,
    onCancel: () => void,
  ) {
    this.container = container;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.state = {
      step: 'race',
      raceId: null,
      classId: null,
      abilityScoresBase: defaultPointBuyScores(),
      backgroundId: null,
      chosenSkills: [],
      characterName: '',
      alignment: 'nn',
    };
  }

  start(): void {
    document.addEventListener('wiz:rerender', this.handleRerender);
    this.render();
  }

  destroy(): void {
    document.removeEventListener('wiz:rerender', this.handleRerender);
  }

  private handleRerender = (): void => {
    this.render();
  };

  private render(): void {
    this.container.innerHTML = '';
    const root = el('div', { class: 'wizard' }, [
      this.renderHeader(),
      this.renderStepContent(),
    ]);
    this.container.appendChild(root);
  }

  private renderHeader(): HTMLElement {
    const currentIdx = STEP_ORDER.indexOf(this.state.step);
    const stepLabels: Record<WizardStep, string> = {
      race: 'Raça',
      class: 'Classe',
      abilities: 'Atributos',
      background: 'Antecedente',
      review: 'Revisão',
    };

    return el('header', { class: 'wiz-header' }, [
      el('div', { class: 'wiz-cancel' }, [
        el('button', {
          class: 'wiz-back-btn',
          text: '← Cancelar',
          on: { click: () => this.onCancel() },
        }),
      ]),
      el('h1', { class: 'wiz-title', text: 'Criação de Personagem' }),
      el('nav', { class: 'wiz-progress', attrs: { 'aria-label': 'Progresso' } }, [
        ...STEP_ORDER.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          const isClickable = isDone;  // só permite voltar pra steps já feitos
          return el('button', {
            class: `wp-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`,
            attrs: { type: 'button', disabled: !isClickable && !isCurrent },
            on: isClickable ? { click: () => { this.state.step = s; this.render(); } } : {},
          }, [
            el('span', { class: 'wp-num', text: String(i + 1) }),
            el('span', { class: 'wp-label', text: stepLabels[s] }),
          ]);
        }),
      ]),
    ]);
  }

  private renderStepContent(): HTMLElement {
    const next = () => this.goNext();
    const back = () => this.goBack();
    // BUG FIX: muta in-place pra preservar referência. Os steps recebem `state`
    // como parâmetro e fazem rerender local; se trocássemos o objeto, a referência
    // dentro do step continuaria apontando pro state antigo (sem o último update),
    // e o renderAll local re-renderizaria com dado obsoleto. Object.assign mantém
    // a mesma referência entre wizard.state e state-do-step.
    const update = (patch: Partial<WizardState>) => {
      Object.assign(this.state, patch);
    };

    switch (this.state.step) {
      case 'race':
        return renderRaceStep(this.state, { update, next });
      case 'class':
        return renderClassStep(this.state, { update, next, back });
      case 'abilities':
        return renderAbilitiesStep(this.state, { update, next, back });
      case 'background':
        return renderBackgroundStep(this.state, { update, next, back });
      case 'review':
        return renderReviewStep(this.state, {
          update,
          back,
          finish: () => this.finish(),
        });
    }
  }

  private goNext(): void {
    const idx = STEP_ORDER.indexOf(this.state.step);
    if (idx < STEP_ORDER.length - 1) {
      this.state.step = STEP_ORDER[idx + 1]!;
      this.render();
    }
  }

  private goBack(): void {
    const idx = STEP_ORDER.indexOf(this.state.step);
    if (idx > 0) {
      this.state.step = STEP_ORDER[idx - 1]!;
      this.render();
    }
  }

  private async finish(): Promise<void> {
    const sheet = buildCharacterSheet(this.state);
    try {
      await saveCharacter(sheet);
      this.onComplete(sheet);
    } catch (err) {
      console.error('[wizard] save failed:', err);
      alert(`Erro ao salvar: ${String(err)}`);
    }
  }
}

// Constrói CharacterSheet completo a partir do state do wizard.
function buildCharacterSheet(state: WizardState): CharacterSheet {
  if (!state.raceId || !state.classId || !state.backgroundId) {
    throw new Error('wizard incompleto');
  }
  const race = getRace(state.raceId);
  const klass = getClass(state.classId);
  const background = getBackground(state.backgroundId);

  const abilityScores = applyRacialBonuses(state.abilityScoresBase, race.abilityBonuses);
  const conMod = abilityModifier(abilityScores.con);
  const dexMod = abilityModifier(abilityScores.des);
  const maxHp = startingHitPoints(state.classId, conMod);

  // Skills: classe + background — dedup
  const allSkills = new Set<SkillId>([...state.chosenSkills, ...background.skillProficiencies]);

  // AC: sem armadura = 10 + Des. Com armaduras vem depois (F2 minimal — sem armor).
  const armorClass = 10 + dexMod;

  // Hit Dice começa = nível (1 inicialmente)
  const now = Date.now();
  const ownerName = getOwnerName() || 'Anônimo';

  const sheet: CharacterSheet = {
    id: uuid(),
    ownerName,
    characterName: state.characterName.trim() || 'Sem Nome',
    raceId: state.raceId,
    classId: state.classId,
    backgroundId: state.backgroundId,
    alignment: state.alignment,
    level: 1,
    xp: 0,
    abilityScoresBase: state.abilityScoresBase,
    abilityScores,
    maxHp,
    currentHp: maxHp,
    tempHp: 0,
    hitDiceRemaining: 1,
    armorClass,
    proficientSkills: Array.from(allSkills),
    proficientSavingThrows: klass.savingThrowProficiencies as AbilityKey[],
    languages: [...race.languages],
    toolProficiencies: [...klass.toolProficiencies, ...background.toolProficiencies],
    armorProficiencies: [...klass.armorProficiencies],
    weaponProficiencies: [...klass.weaponProficiencies],
    conditions: [],
    inventory: [],
    equippedWeapons: [],
    gold: background.startingGold,
    spellsKnown: [],
    spellsPrepared: [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    backstory: '',
    createdAt: now,
    lastPlayedAt: now,
    deathCount: 0,
    campaignsPlayed: [],
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
  };

  // Preenche slots/cantrips/spells iniciais se for caster
  applySpellcasterDefaults(sheet);

  return sheet;
}

// Re-export pra debug
export { applyRacialBonuses, abilityModifier };
export { RACES };

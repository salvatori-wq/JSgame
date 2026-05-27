// JSgame · POLISH α.3 — Randomizar tudo no wizard.
// Cria PJ válido balanceado em 1 click, leva direto pra step Review pra player
// editar antes de salvar. Reduz onboarding de 5+ min pra ~30s na primeira vez.

import type { WizardState } from './wizard';
import type { AbilityKey, AbilityScores, Alignment, ClassId, RaceId, SkillId, SubclassId } from '../../shared/types';
import type { BackgroundId } from '../../dnd/backgrounds';
import { ALL_RACES } from '../../dnd/races';
import { ALL_CLASSES } from '../../dnd/classes';
import { ALL_BACKGROUNDS } from '../../dnd/backgrounds';
import { rollRandomPersonality } from '../../dnd/personality-tables';

const ALIGNMENTS: Alignment[] = ['lb', 'nb', 'cb', 'ln', 'nn', 'cn', 'lm', 'nm', 'cm'];

const NAMES_FANTASY = [
  'Borin', 'Lyra', 'Sina', 'Aelar', 'Mira', 'Kade', 'Tessa', 'Rurik',
  'Vex', 'Selene', 'Drog', 'Niamh', 'Korr', 'Sela', 'Bran', 'Astra',
  'Galen', 'Iris', 'Thane', 'Mira', 'Cassio', 'Yenna', 'Ravi', 'Sora',
];

const SURNAMES_FANTASY = [
  'Forjarocha', 'Estrelaluz', 'Tribuna', 'Sombraveloz', 'Punhocerto',
  'Lâmina-Negra', 'Lobosolo', 'Penaprata', 'Tormentaviva',
  'Furtacasaco', 'Cervorrunico', 'Tecedor-de-Sombras',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Retorna PJ randomizado válido pronto pra review. Mantém abilityScoresBase
 *  no point buy default (15/14/13/12/10/8) — balanceado. */
export function randomizeWizardState(): WizardState {
  const race = pick(ALL_RACES);
  const klass = pick(ALL_CLASSES);
  const background = pick(ALL_BACKGROUNDS);

  // Pega skills da lista skillChoices.from da classe (D&D 5e: classes dão 2-4)
  const classSkills = klass.skillChoices.from;
  const chosenSkills: SkillId[] = [];
  const numToChoose = Math.min(klass.skillChoices.count, classSkills.length);
  const shuffled = [...classSkills].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numToChoose; i++) {
    chosenSkills.push(shuffled[i]!);
  }

  // Subclass — só se já é nível mínimo da classe. Wizard começa nível 1,
  // então maioria não tem subclass yet. Deixa null e o step subclass lida.
  const subclassId: SubclassId | null = null;

  const characterName = `${pick(NAMES_FANTASY)} ${pick(SURNAMES_FANTASY)}`;

  // Point buy clássico 27 pontos = 15/14/13/12/10/8. Distribui random nas
  // 6 abilities pra não dar sempre o mesmo build. Player edita na review.
  const ARRANGEMENT = [15, 14, 13, 12, 10, 8];
  const ABILITIES: AbilityKey[] = ['for', 'des', 'con', 'int', 'sab', 'car'];
  const shuffledAbilities = [...ABILITIES].sort(() => Math.random() - 0.5);
  const abilityScoresBase: AbilityScores = { for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 };
  shuffledAbilities.forEach((k, i) => { abilityScoresBase[k] = ARRANGEMENT[i]!; });

  // η.2 — Personality sortear automático
  const personality = rollRandomPersonality(background.id as BackgroundId);

  return {
    step: 'review',  // pula direto pra review pra player editar/confirmar
    raceId: race.id as RaceId,
    classId: klass.id as ClassId,
    subclassId,
    abilityScoresBase,
    backgroundId: background.id as BackgroundId,
    chosenSkills,
    plannedLevel4Choice: null,
    additionalClasses: [],
    characterName,
    alignment: pick(ALIGNMENTS),
    personalityTraits: personality.traits,
    personalityIdeals: personality.ideals,
    personalityBonds: personality.bonds,
    personalityFlaws: personality.flaws,
  };
}

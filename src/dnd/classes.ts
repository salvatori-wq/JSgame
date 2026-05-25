// JSgame · D&D 5e classes (PHB cap 3).
// 12 classes principais. Define hit die, atributo primário, saves proficiência,
// perícias disponíveis pra escolha, equipamento inicial.
//
// Features de nível ficam separadas (em src/dnd/class-features.ts no futuro).

import type { AbilityKey } from './attributes';
import type { SkillId } from './skills';

export type ClassId =
  | 'barbaro' | 'bardo' | 'bruxo' | 'clerigo' | 'druida'
  | 'feiticeiro' | 'guerreiro' | 'ladino' | 'mago' | 'monge'
  | 'paladino' | 'patrulheiro';

export type HitDie = 6 | 8 | 10 | 12;

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  hitDie: HitDie;
  primaryAbility: AbilityKey | AbilityKey[];  // 1 ou múltiplos
  savingThrowProficiencies: [AbilityKey, AbilityKey];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillChoices: { count: number; from: SkillId[] };
  startingEquipment: string[];   // descrição em PT — UI mostra como bullets
  isSpellcaster: boolean;
  spellcastingAbility?: AbilityKey;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  barbaro: {
    id: 'barbaro',
    name: 'Bárbaro',
    description: 'Guerreiro selvagem movido a fúria. Aguenta dano monstruoso, ataca como animal acuado.',
    hitDie: 12,
    primaryAbility: 'for',
    savingThrowProficiencies: ['for', 'con'],
    armorProficiencies: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weaponProficiencies: ['Armas simples', 'Armas marciais'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['adestrar-animais', 'atletismo', 'intimidacao', 'natureza', 'percepcao', 'sobrevivencia'] },
    startingEquipment: [
      '(a) machado grande OU (b) qualquer arma marcial corpo-a-corpo',
      '(a) duas machadinhas OU (b) qualquer arma simples',
      'Pacote de explorador + 4 azagaias',
    ],
    isSpellcaster: false,
  },
  bardo: {
    id: 'bardo',
    name: 'Bardo',
    description: 'Conjurador inspirado pela música. Apoia aliados com Inspiração e magias versáteis.',
    hitDie: 8,
    primaryAbility: 'car',
    savingThrowProficiencies: ['des', 'car'],
    armorProficiencies: ['Armaduras leves'],
    weaponProficiencies: ['Armas simples', 'Bestas de mão', 'Espadas longas', 'Rapieiras', 'Espadas curtas'],
    toolProficiencies: ['3 instrumentos musicais à escolha'],
    skillChoices: { count: 3, from: ['acrobacia', 'adestrar-animais', 'arcanismo', 'atletismo', 'atuacao', 'enganacao', 'furtividade', 'historia', 'intimidacao', 'intuicao', 'investigacao', 'medicina', 'natureza', 'percepcao', 'persuasao', 'prestidigitacao', 'religiao', 'sobrevivencia'] },
    startingEquipment: [
      '(a) rapieira OU (b) espada longa OU (c) qualquer arma simples',
      "(a) pacote do diplomata OU (b) pacote do artista",
      '(a) alaúde OU (b) qualquer instrumento musical',
      'Armadura de couro + adaga',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'car',
  },
  bruxo: {
    id: 'bruxo',
    name: 'Bruxo',
    description: 'Conjurador vinculado a um Patrono sobrenatural. Truques poderosos, poucas magias por descanso curto.',
    hitDie: 8,
    primaryAbility: 'car',
    savingThrowProficiencies: ['sab', 'car'],
    armorProficiencies: ['Armaduras leves'],
    weaponProficiencies: ['Armas simples'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['arcanismo', 'enganacao', 'historia', 'intimidacao', 'investigacao', 'natureza', 'religiao'] },
    startingEquipment: [
      '(a) besta leve + 20 virotes OU (b) qualquer arma simples',
      '(a) componente arcano OU (b) foco arcano',
      '(a) pacote do estudioso OU (b) pacote do mascate',
      'Armadura de couro + arma simples + 2 adagas',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'car',
  },
  clerigo: {
    id: 'clerigo',
    name: 'Clérigo',
    description: 'Conduto divino. Cura, protege e pune em nome de seu deus.',
    hitDie: 8,
    primaryAbility: 'sab',
    savingThrowProficiencies: ['sab', 'car'],
    armorProficiencies: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weaponProficiencies: ['Armas simples'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['historia', 'intuicao', 'medicina', 'persuasao', 'religiao'] },
    startingEquipment: [
      '(a) maça OU (b) martelo de guerra (se proficiente)',
      '(a) cota de escamas OU (b) armadura de couro OU (c) cota de malha (se proficiente)',
      '(a) besta leve + 20 virotes OU (b) qualquer arma simples',
      '(a) pacote do sacerdote OU (b) pacote do explorador',
      'Escudo + símbolo sagrado',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'sab',
  },
  druida: {
    id: 'druida',
    name: 'Druida',
    description: 'Conjurador natural. Transforma-se em animais, conjura raízes e tempestades.',
    hitDie: 8,
    primaryAbility: 'sab',
    savingThrowProficiencies: ['int', 'sab'],
    armorProficiencies: ['Armaduras leves (não-metálicas)', 'Armaduras médias (não-metálicas)', 'Escudos (não-metálicos)'],
    weaponProficiencies: ['Clavas', 'Adagas', 'Dardos', 'Azagaias', 'Maças', 'Bordões', 'Cimitarras', 'Foices', 'Fundas', 'Lanças'],
    toolProficiencies: ['Kit de Herbalista'],
    skillChoices: { count: 2, from: ['arcanismo', 'adestrar-animais', 'intuicao', 'medicina', 'natureza', 'percepcao', 'religiao', 'sobrevivencia'] },
    startingEquipment: [
      '(a) escudo de madeira OU (b) qualquer arma simples',
      '(a) cimitarra OU (b) qualquer arma simples corpo-a-corpo',
      'Armadura de couro + pacote do explorador + foco druídico',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'sab',
  },
  feiticeiro: {
    id: 'feiticeiro',
    name: 'Feiticeiro',
    description: 'Conjurador inato. Magia flui pelo sangue. Metamagia altera magias na hora.',
    hitDie: 6,
    primaryAbility: 'car',
    savingThrowProficiencies: ['con', 'car'],
    armorProficiencies: [],
    weaponProficiencies: ['Adagas', 'Dardos', 'Fundas', 'Bordões', 'Bestas leves'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['arcanismo', 'enganacao', 'intimidacao', 'intuicao', 'persuasao', 'religiao'] },
    startingEquipment: [
      '(a) besta leve + 20 virotes OU (b) qualquer arma simples',
      '(a) componente arcano OU (b) foco arcano',
      '(a) pacote do estudioso OU (b) pacote do explorador',
      '2 adagas',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'car',
  },
  guerreiro: {
    id: 'guerreiro',
    name: 'Guerreiro',
    description: 'Mestre das armas e armaduras. Versátil em combate corpo-a-corpo ou à distância. Surto de Ação dá ação extra.',
    hitDie: 10,
    primaryAbility: ['for', 'des'],
    savingThrowProficiencies: ['for', 'con'],
    armorProficiencies: ['Todas armaduras', 'Escudos'],
    weaponProficiencies: ['Armas simples', 'Armas marciais'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['acrobacia', 'adestrar-animais', 'atletismo', 'historia', 'intuicao', 'intimidacao', 'percepcao', 'sobrevivencia'] },
    startingEquipment: [
      '(a) cota de malha OU (b) gibão de peles + arco longo + 20 flechas',
      '(a) arma marcial + escudo OU (b) duas armas marciais',
      '(a) besta leve + 20 virotes OU (b) dois machados de arremesso',
      '(a) pacote do explorador OU (b) pacote do guarda',
    ],
    isSpellcaster: false,
  },
  ladino: {
    id: 'ladino',
    name: 'Ladino',
    description: 'Mestre da furtividade e ataques precisos. Ataque Furtivo causa dano extra massivo.',
    hitDie: 8,
    primaryAbility: 'des',
    savingThrowProficiencies: ['des', 'int'],
    armorProficiencies: ['Armaduras leves'],
    weaponProficiencies: ['Armas simples', 'Bestas de mão', 'Espadas longas', 'Rapieiras', 'Espadas curtas'],
    toolProficiencies: ['Ferramentas de Ladino'],
    skillChoices: { count: 4, from: ['acrobacia', 'atletismo', 'enganacao', 'furtividade', 'intimidacao', 'intuicao', 'investigacao', 'percepcao', 'persuasao', 'prestidigitacao'] },
    startingEquipment: [
      '(a) rapieira OU (b) espada longa',
      '(a) arco curto + aljava com 20 flechas OU (b) espada longa',
      '(a) pacote do larápio OU (b) pacote do explorador',
      'Armadura de couro + 2 adagas + ferramentas de ladino',
    ],
    isSpellcaster: false,
  },
  mago: {
    id: 'mago',
    name: 'Mago',
    description: 'Estudioso da magia. Grimório recheado de feitiços. Prepara magias diferentes a cada descanso longo.',
    hitDie: 6,
    primaryAbility: 'int',
    savingThrowProficiencies: ['int', 'sab'],
    armorProficiencies: [],
    weaponProficiencies: ['Adagas', 'Dardos', 'Fundas', 'Bordões', 'Bestas leves'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['arcanismo', 'historia', 'intuicao', 'investigacao', 'medicina', 'religiao'] },
    startingEquipment: [
      '(a) cajado OU (b) adaga',
      '(a) componente arcano OU (b) foco arcano',
      '(a) pacote do estudioso OU (b) pacote do explorador',
      'Grimório com 6 magias de 1º nível',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'int',
  },
  monge: {
    id: 'monge',
    name: 'Monge',
    description: 'Mestre marcial sem armadura. Pontos de Ki impulsionam técnicas rápidas e devastadoras.',
    hitDie: 8,
    primaryAbility: ['des', 'sab'],
    savingThrowProficiencies: ['for', 'des'],
    armorProficiencies: [],
    weaponProficiencies: ['Armas simples', 'Espadas curtas'],
    toolProficiencies: ['1 tipo de ferramentas de artesão OU 1 instrumento musical'],
    skillChoices: { count: 2, from: ['acrobacia', 'atletismo', 'furtividade', 'historia', 'intuicao', 'religiao'] },
    startingEquipment: [
      '(a) espada curta OU (b) qualquer arma simples',
      '(a) pacote do aventureiro OU (b) pacote do explorador',
      '10 dardos',
    ],
    isSpellcaster: false,
  },
  paladino: {
    id: 'paladino',
    name: 'Paladino',
    description: 'Guerreiro abençoado por um juramento sagrado. Cura, smites divinos e proteção em aura.',
    hitDie: 10,
    primaryAbility: ['for', 'car'],
    savingThrowProficiencies: ['sab', 'car'],
    armorProficiencies: ['Todas armaduras', 'Escudos'],
    weaponProficiencies: ['Armas simples', 'Armas marciais'],
    toolProficiencies: [],
    skillChoices: { count: 2, from: ['atletismo', 'intimidacao', 'intuicao', 'medicina', 'persuasao', 'religiao'] },
    startingEquipment: [
      '(a) arma marcial + escudo OU (b) duas armas marciais',
      '(a) 5 azagaias OU (b) qualquer arma simples corpo-a-corpo',
      '(a) pacote do sacerdote OU (b) pacote do explorador',
      'Cota de malha + símbolo sagrado',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'car',
  },
  patrulheiro: {
    id: 'patrulheiro',
    name: 'Patrulheiro',
    description: 'Caçador-rastreador. Inimigo Favorito + Explorador Nato + magias da natureza.',
    hitDie: 10,
    primaryAbility: ['des', 'sab'],
    savingThrowProficiencies: ['for', 'des'],
    armorProficiencies: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
    weaponProficiencies: ['Armas simples', 'Armas marciais'],
    toolProficiencies: [],
    skillChoices: { count: 3, from: ['adestrar-animais', 'atletismo', 'intuicao', 'investigacao', 'natureza', 'percepcao', 'furtividade', 'sobrevivencia'] },
    startingEquipment: [
      '(a) cota de escamas OU (b) armadura de couro',
      '(a) duas espadas curtas OU (b) duas armas simples corpo-a-corpo',
      '(a) pacote do explorador OU (b) pacote do guarda',
      'Arco longo + aljava com 20 flechas',
    ],
    isSpellcaster: true,
    spellcastingAbility: 'sab',
  },
};

export function getClass(id: ClassId): ClassDef {
  return CLASSES[id];
}

export const ALL_CLASSES: ClassDef[] = Object.values(CLASSES);

// Hit points no nível 1: max do hit die + modifier de Constituição. PHB pág 12.
export function startingHitPoints(classId: ClassId, conModifier: number): number {
  const c = CLASSES[classId];
  return c.hitDie + conModifier;
}

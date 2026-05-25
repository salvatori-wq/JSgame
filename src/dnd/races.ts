// JSgame · D&D 5e raças (PHB cap 2).
// 9 raças principais + sub-raças onde aplicável. Cada raça dá:
// - Bônus de atributo (somado APÓS point buy)
// - Velocidade de deslocamento (em pés D&D — 30 ft default)
// - Idiomas iniciais
// - Traits especiais (visão no escuro, resistências, etc)

import type { AbilityScores } from './attributes';

export type RaceId =
  | 'humano'
  | 'anao-colina' | 'anao-montanha'
  | 'alto-elfo' | 'elfo-floresta'
  | 'halfling-pes-leve' | 'halfling-robusto'
  | 'draconato'
  | 'gnomo-floresta' | 'gnomo-rochas'
  | 'meio-elfo'
  | 'meio-orc'
  | 'tiefling';

export interface RaceDef {
  id: RaceId;
  parentName: string;          // "Anão" / "Elfo" — pra agrupar sub-raças na UI
  name: string;                // display name completo: "Anão da Montanha"
  description: string;
  abilityBonuses: Partial<AbilityScores>;
  speed: number;               // em pés D&D 5e (30 default — converter se precisar metros: × 0.3)
  size: 'pequeno' | 'medio';
  languages: string[];
  darkvision?: number;         // em pés (0 = nenhum)
  traits: string[];            // descrições curtas pra UI
}

export const RACES: Record<RaceId, RaceDef> = {
  humano: {
    id: 'humano',
    parentName: 'Humano',
    name: 'Humano',
    description: 'Versátil e ambicioso. Sem traços especiais, mas dispõe de +1 em todos os atributos.',
    abilityBonuses: { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 },
    speed: 30,
    size: 'medio',
    languages: ['Comum', '+1 idioma à escolha'],
    traits: ['Versátil — +1 em todos os atributos'],
  },

  'anao-colina': {
    id: 'anao-colina',
    parentName: 'Anão',
    name: 'Anão da Colina',
    description: 'Anão sábio e resistente. Cura extra a cada nível (+1 HP).',
    abilityBonuses: { con: 2, sab: 1 },
    speed: 25,
    size: 'medio',
    languages: ['Comum', 'Anão'],
    darkvision: 60,
    traits: ['Resiliência Anã (vant em saves contra veneno)', 'Tenacidade Anã (+1 HP por nível)', 'Visão no Escuro 60 ft'],
  },
  'anao-montanha': {
    id: 'anao-montanha',
    parentName: 'Anão',
    name: 'Anão da Montanha',
    description: 'Anão forte e marcial. Proficiência em armaduras leves e médias.',
    abilityBonuses: { con: 2, for: 2 },
    speed: 25,
    size: 'medio',
    languages: ['Comum', 'Anão'],
    darkvision: 60,
    traits: ['Resiliência Anã (vant vs veneno)', 'Treinamento com Armadura Anã (leves+médias)', 'Visão no Escuro 60 ft'],
  },

  'alto-elfo': {
    id: 'alto-elfo',
    parentName: 'Elfo',
    name: 'Alto Elfo',
    description: 'Elfo arcano. Conhece um truque (cantrip) de mago.',
    abilityBonuses: { des: 2, int: 1 },
    speed: 30,
    size: 'medio',
    languages: ['Comum', 'Élfico', '+1 idioma'],
    darkvision: 60,
    traits: ['Ancestralidade Élfica (vant vs encantamento)', 'Transe (4h descanso longo)', 'Truque de Mago (1 cantrip)', 'Visão no Escuro 60 ft'],
  },
  'elfo-floresta': {
    id: 'elfo-floresta',
    parentName: 'Elfo',
    name: 'Elfo da Floresta',
    description: 'Elfo ágil e selvagem. Deslocamento 35 ft + furtividade natural.',
    abilityBonuses: { des: 2, sab: 1 },
    speed: 35,
    size: 'medio',
    languages: ['Comum', 'Élfico'],
    darkvision: 60,
    traits: ['Ancestralidade Élfica', 'Pés Ligeiros (desloc 35 ft)', 'Máscara da Natureza (esconder em vegetação)', 'Visão no Escuro 60 ft'],
  },

  'halfling-pes-leve': {
    id: 'halfling-pes-leve',
    parentName: 'Halfling',
    name: 'Halfling Pés-Leve',
    description: 'Halfling carismático e furtivo.',
    abilityBonuses: { des: 2, car: 1 },
    speed: 25,
    size: 'pequeno',
    languages: ['Comum', 'Halfling'],
    traits: ['Sortudo (rerolla 1 em ataques/teste/save)', 'Bravo (vant vs medo)', 'Agilidade Halfling (move-se através de criaturas maiores)', 'Furtividade Natural'],
  },
  'halfling-robusto': {
    id: 'halfling-robusto',
    parentName: 'Halfling',
    name: 'Halfling Robusto',
    description: 'Halfling resistente a venenos.',
    abilityBonuses: { des: 2, con: 1 },
    speed: 25,
    size: 'pequeno',
    languages: ['Comum', 'Halfling'],
    traits: ['Sortudo', 'Bravo', 'Agilidade Halfling', 'Resiliência Robusta (vant vs veneno + resist dano de veneno)'],
  },

  draconato: {
    id: 'draconato',
    parentName: 'Draconato',
    name: 'Draconato',
    description: 'Descendente de dragão. Sopro elemental + resistência ao tipo de dano.',
    abilityBonuses: { for: 2, car: 1 },
    speed: 30,
    size: 'medio',
    languages: ['Comum', 'Dracônico'],
    traits: ['Ancestralidade Dracônica (escolhe tipo: fogo/frio/raio/ácido/veneno)', 'Sopro (cone/linha, 2d6, save Des/Con)', 'Resistência ao tipo de dano ancestral'],
  },

  'gnomo-floresta': {
    id: 'gnomo-floresta',
    parentName: 'Gnomo',
    name: 'Gnomo da Floresta',
    description: 'Gnomo místico e furtivo. Cantrip de ilusão menor.',
    abilityBonuses: { int: 2, des: 1 },
    speed: 25,
    size: 'pequeno',
    languages: ['Comum', 'Gnômico'],
    darkvision: 60,
    traits: ['Esperteza Gnômica (vant em saves INT/SAB/CAR vs magia)', 'Ilusão Menor (cantrip)', 'Falar com Pequenos Animais', 'Visão no Escuro 60 ft'],
  },
  'gnomo-rochas': {
    id: 'gnomo-rochas',
    parentName: 'Gnomo',
    name: 'Gnomo das Rochas',
    description: 'Gnomo engenheiro. Conhecimento de tecnologia rústica.',
    abilityBonuses: { int: 2, con: 1 },
    speed: 25,
    size: 'pequeno',
    languages: ['Comum', 'Gnômico'],
    darkvision: 60,
    traits: ['Esperteza Gnômica', 'Conhecimento de Artificie (+dobro proficiência em História sobre tech)', 'Tinkerer (constrói brinquedos mecânicos)', 'Visão no Escuro 60 ft'],
  },

  'meio-elfo': {
    id: 'meio-elfo',
    parentName: 'Meio-Elfo',
    name: 'Meio-Elfo',
    description: 'Híbrido carismático. +2 CAR + 2 atributos à escolha em +1.',
    abilityBonuses: { car: 2 },  // +1 em 2 outros à escolha — UI trata
    speed: 30,
    size: 'medio',
    languages: ['Comum', 'Élfico', '+1 idioma'],
    darkvision: 60,
    traits: ['Ancestralidade Élfica', 'Versatilidade nas Perícias (proficiência em 2 perícias à escolha)', '+1 em 2 atributos à escolha', 'Visão no Escuro 60 ft'],
  },

  'meio-orc': {
    id: 'meio-orc',
    parentName: 'Meio-Orc',
    name: 'Meio-Orc',
    description: 'Híbrido feroz. Resistência à morte + crítico devastador.',
    abilityBonuses: { for: 2, con: 1 },
    speed: 30,
    size: 'medio',
    languages: ['Comum', 'Orc'],
    darkvision: 60,
    traits: ['Aguentar Firme (1×/descanso longo, ao chegar a 0 HP, fica em 1 HP)', 'Ataques Selvagens (1 dado extra em crit corpo-a-corpo)', 'Ameaçador (prof Intimidação)', 'Visão no Escuro 60 ft'],
  },

  tiefling: {
    id: 'tiefling',
    parentName: 'Tiefling',
    name: 'Tiefling',
    description: 'Descendente infernal. Resistência ao fogo + magias arcanas inatas.',
    abilityBonuses: { int: 1, car: 2 },
    speed: 30,
    size: 'medio',
    languages: ['Comum', 'Infernal'],
    darkvision: 60,
    traits: ['Resistência Infernal (resist dano de fogo)', 'Legado Infernal (cantrip Taumaturgia; nv3 Repreensão Infernal; nv5 Escuridão)', 'Visão no Escuro 60 ft'],
  },
};

export function getRace(id: RaceId): RaceDef {
  return RACES[id];
}

export const ALL_RACES: RaceDef[] = Object.values(RACES);

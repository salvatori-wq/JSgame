// JSgame · F1 — Personagens pré-fabricados pra "Primeiro Minuto Magia".
//
// 3 arquétipos icônicos D&D — Tank/Caster/Skirmisher. Cards no Home mostram
// portrait + teaser + botão. Click → POST /api/characters com sheet pronto
// → entra direto numa sessão com cold open background-aware.
//
// Objetivo: reduzir time_to_first_roll de 5-15min → <60s.

import type { CharacterSheet, AbilityScores, ItemRarity } from '../shared/types.js';
import type { RaceId } from './races.js';
import type { ClassId } from './classes.js';
import type { BackgroundId } from './backgrounds.js';
import type { SkillId } from './skills.js';
import type { Alignment } from '../shared/types.js';
import type { SpellId } from './spells.js';
import { applyRacialBonuses, abilityModifier } from './attributes.js';
import { getRace } from './races.js';
import { startingHitPoints } from './classes.js';
import { applySpellcasterDefaults } from './spell-slots.js';

export type PrefabId = 'borin' | 'lyra' | 'sina';

interface PrefabDef {
  id: PrefabId;
  label: string;                  // "Borin Forjarocha"
  archetype: string;              // "Tank — Bate e segura porrada"
  icon: string;                   // emoji card
  teaser: string;                 // 1 frase
  classId: ClassId;
  raceId: RaceId;
  backgroundId: BackgroundId;
  alignment: Alignment;
  abilityScoresBase: AbilityScores;
  proficientSkills: SkillId[];
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  backstory: string;
  initialGold: number;
  inventory: Array<{
    id: string;
    name: string;
    type: 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc';
    quantity: number;
    rarity?: ItemRarity;
    description?: string;
  }>;
  equippedWeapons?: string[];
  equippedArmor?: string;
  equippedShield?: string;
  // Magia (só caster prepara)
  spellsKnown?: SpellId[];
  spellsPrepared?: SpellId[];
  // Armor class override — quando armor + shield equipped, calcular fora
  armorClassOverride?: number;
}

export const PREFAB_DEFS: Record<PrefabId, PrefabDef> = {
  borin: {
    id: 'borin',
    label: 'Borin Forjarocha',
    archetype: 'Tank · Bate e segura porrada',
    icon: '🪨',
    teaser: 'Veterano anão. Cicatrizes contam histórias. Bate forte, segura porrada.',
    classId: 'guerreiro',
    raceId: 'anao-montanha',
    backgroundId: 'soldado',
    alignment: 'ln',
    abilityScoresBase: { for: 16, des: 12, con: 15, int: 8, sab: 13, car: 10 },
    proficientSkills: ['atletismo', 'intimidacao'],
    personalityTraits: ['Carrega marcas de cada inimigo que matou. Mostra com orgulho.'],
    ideals: ['Lealdade. Honro quem me honra, esmago quem trai.'],
    bonds: ['Meu pelotão foi morto na Campanha do Vale Negro. Vingo cada um.'],
    flaws: ['Tenho medo de magia que não entendo. Reajo agredindo.'],
    backstory: 'Veterano da guerra do Vale Negro. Único sobrevivente do pelotão. Carrega o machado do capitão.',
    initialGold: 10,
    inventory: [
      { id: 'machado-dois-gumes', name: 'Machado Dois-gumes', type: 'arma', quantity: 1, description: 'd10 cortante. Versátil (2 mãos).' },
      { id: 'escudo', name: 'Escudo', type: 'escudo', quantity: 1, description: '+2 AC' },
      { id: 'cota-malha', name: 'Cota de Malha', type: 'armadura', quantity: 1, description: 'AC 16. Desvantagem em Furtividade.' },
      { id: 'pocao-cura', name: 'Poção de Cura', type: 'consumivel', quantity: 2, description: 'Cura 2d4+2 HP.' },
      { id: 'racao-3-dias', name: 'Ração (3 dias)', type: 'misc', quantity: 3 },
    ],
    equippedWeapons: ['machado-dois-gumes'],
    equippedArmor: 'cota-malha',
    equippedShield: 'escudo',
    armorClassOverride: 18,  // cota-malha (16) + escudo (+2)
  },

  lyra: {
    id: 'lyra',
    label: 'Lyra Estrelaluz',
    archetype: 'Caster · Sabe magias e segredos',
    icon: '🌟',
    teaser: 'Arquivista alta-elfa. Conhece magia antiga e segredos perigosos. Frágil mas mortal.',
    classId: 'mago',
    raceId: 'alto-elfo',
    backgroundId: 'sabio',
    alignment: 'cb',
    abilityScoresBase: { for: 8, des: 14, con: 12, int: 16, sab: 14, car: 10 },
    proficientSkills: ['arcanismo', 'historia'],
    personalityTraits: ['Estudo o que outros temem entender. Anoto tudo.'],
    ideals: ['Saber liberta. Esconder conhecimento é tirania.'],
    bonds: ['Uma relíquia foi roubada do meu mestre. Vou encontrá-la, custe o que custar.'],
    flaws: ['Subestimo brutos. Acho que palavras sempre vencem força.'],
    backstory: 'Arquivista da Torre de Cristal até o roubo da Lâmina de Vorthos. Saiu pra recuperar.',
    initialGold: 12,
    inventory: [
      { id: 'cajado-arcano', name: 'Cajado Arcano', type: 'arma', quantity: 1, description: 'd6 contundente. Foco arcano.' },
      { id: 'livro-magia', name: 'Livro de Magias', type: 'misc', quantity: 1, description: 'Spellbook do mago.' },
      { id: 'componentes-magia', name: 'Bolsa de Componentes', type: 'misc', quantity: 1 },
      { id: 'pocao-cura', name: 'Poção de Cura Menor', type: 'consumivel', quantity: 2, description: 'Cura 2d4+2 HP.' },
      { id: 'tomos-velhos', name: 'Tomos do Mestre', type: 'tesouro', quantity: 3, description: 'Anotações pessoais.', rarity: 'incomum' },
    ],
    equippedWeapons: ['cajado-arcano'],
    spellsKnown: ['magic-missile', 'shield', 'mage-hand', 'fire-bolt', 'detect-magic'],
    spellsPrepared: ['magic-missile', 'shield'],
  },

  sina: {
    id: 'sina',
    label: 'Sina Tribuna',
    archetype: 'Skirmisher · Rápida e sneaky',
    icon: '🗡',
    teaser: 'Trapaceira halfling. Foge rápido, ataca preciso. Vive de palavras e dedos leves.',
    classId: 'ladino',
    raceId: 'halfling-pes-leve',
    backgroundId: 'charlatao',
    alignment: 'cn',
    abilityScoresBase: { for: 8, des: 16, con: 13, int: 14, sab: 12, car: 14 },
    proficientSkills: ['furtividade', 'enganacao', 'prestidigitacao', 'persuasao'],
    personalityTraits: ['Sorrio quando minto. Especialmente quando vejo que acreditaram.'],
    ideals: ['Independência. Não devo nada a ninguém.'],
    bonds: ['Minha irmã caçula está num convento. Mando dinheiro toda lua nova — sem falhar.'],
    flaws: ['Nunca resisto a um cofre cheio. Ou um homem perigoso. Ou os dois.'],
    backstory: 'Trapaceira de tavernas. Expulsa de 3 cidades. Sempre precisa de ouro pro convento da irmã.',
    initialGold: 15,
    inventory: [
      { id: 'adaga', name: 'Adagas (par)', type: 'arma', quantity: 2, description: 'd4 perfurante. Off-hand bonus action.' },
      { id: 'ferramentas-ladrao', name: 'Ferramentas de Ladrão', type: 'ferramenta', quantity: 1, description: 'Arrombamento, picklock.' },
      { id: 'couro', name: 'Armadura de Couro', type: 'armadura', quantity: 1, description: 'AC 11+Des.' },
      { id: 'capa-marrom', name: 'Capa Marrom', type: 'misc', quantity: 1, description: 'Vantagem em furtividade urbana.' },
      { id: 'baralho-marcado', name: 'Baralho Marcado', type: 'tesouro', quantity: 1, description: 'Trapaça em jogos.', rarity: 'incomum' },
    ],
    equippedWeapons: ['adaga', 'adaga'],
    equippedArmor: 'couro',
    armorClassOverride: 14,  // couro (11) + DES 16 mod (+3)
  },
};

/**
 * Constrói um CharacterSheet completo a partir de um prefab id.
 * Aplica bônus racial, calcula HP, AC, spell slots se caster.
 */
export function buildPrefabCharacter(
  id: PrefabId,
  ownerName = 'Anônimo',
  userId?: string | null,
): CharacterSheet {
  const def = PREFAB_DEFS[id];
  if (!def) throw new Error(`prefab not found: ${id}`);

  const race = getRace(def.raceId);
  const abilityScores = applyRacialBonuses(def.abilityScoresBase, race.abilityBonuses);
  const conMod = abilityModifier(abilityScores.con);
  const dexMod = abilityModifier(abilityScores.des);
  const maxHp = startingHitPoints(def.classId, conMod);

  const armorClass = def.armorClassOverride ?? (10 + dexMod);
  const now = Date.now();

  const sheet: CharacterSheet = {
    id: `prefab-${id}-${Math.random().toString(36).slice(2, 8)}`,
    ownerName,
    userId: userId ?? null,
    characterName: def.label,
    raceId: def.raceId,
    classId: def.classId,
    subclassId: null,
    backgroundId: def.backgroundId,
    alignment: def.alignment,
    level: 1,
    xp: 0,
    abilityScoresBase: def.abilityScoresBase,
    abilityScores,
    maxHp,
    currentHp: maxHp,
    tempHp: 0,
    hitDiceRemaining: 1,
    armorClass,
    proficientSkills: [...def.proficientSkills],
    proficientSavingThrows: classToSaves(def.classId),
    languages: [...race.languages],
    toolProficiencies: [],
    armorProficiencies: classToArmorProf(def.classId),
    weaponProficiencies: classToWeaponProf(def.classId),
    conditions: [],
    inventory: def.inventory.map((i) => ({ ...i })),
    equippedWeapons: def.equippedWeapons ? [...def.equippedWeapons] : [],
    equippedArmor: def.equippedArmor,
    equippedShield: def.equippedShield,
    gold: def.initialGold,
    spellsKnown: def.spellsKnown ? [...def.spellsKnown] : [],
    spellsPrepared: def.spellsPrepared ? [...def.spellsPrepared] : [],
    spellSlots: {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    },
    personalityTraits: [...def.personalityTraits],
    ideals: [...def.ideals],
    bonds: [...def.bonds],
    flaws: [...def.flaws],
    backstory: def.backstory,
    createdAt: now,
    lastPlayedAt: now,
    deathCount: 0,
    campaignsPlayed: [],
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    exhaustion: 0,
  };

  // Damage profile racial
  if (race.defaultResistances?.length) sheet.resistances = [...race.defaultResistances];
  if (race.defaultImmunities?.length) sheet.immunities = [...race.defaultImmunities];
  if (race.defaultVulnerabilities?.length) sheet.vulnerabilities = [...race.defaultVulnerabilities];

  // Spell slots iniciais se caster
  applySpellcasterDefaults(sheet);

  return sheet;
}

// Helpers — replicam o que o wizard faz, sem depender de WizardState.

function classToSaves(classId: ClassId): import('../dnd/attributes.js').AbilityKey[] {
  // Hardcoded pros 3 prefab classes — evita importar getClass aqui (circular)
  switch (classId) {
    case 'guerreiro': return ['for', 'con'];
    case 'mago':      return ['int', 'sab'];
    case 'ladino':    return ['des', 'int'];
    default:          return ['for', 'des'];
  }
}

function classToArmorProf(classId: ClassId): string[] {
  switch (classId) {
    case 'guerreiro': return ['Armaduras leves', 'Armaduras médias', 'Armaduras pesadas', 'Escudos'];
    case 'mago':      return [];
    case 'ladino':    return ['Armaduras leves'];
    default:          return [];
  }
}

function classToWeaponProf(classId: ClassId): string[] {
  switch (classId) {
    case 'guerreiro': return ['Armas simples', 'Armas marciais'];
    case 'mago':      return ['Adagas', 'Cajados', 'Fundas', 'Bestas leves'];
    case 'ladino':    return ['Armas simples', 'Bestas de mão', 'Espadas longas', 'Rapieiras', 'Espadas curtas'];
    default:          return ['Armas simples'];
  }
}

/** Lista todos prefabs disponíveis pra UI mostrar como cards. */
export function listPrefabs(): PrefabDef[] {
  return Object.values(PREFAB_DEFS);
}

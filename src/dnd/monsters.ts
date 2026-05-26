// JSgame · D&D 5e Bestiary (Monster Manual essentials).
// 35+ monstros pré-cadastrados por Challenge Rating (CR).
// DM declara monsterId em start_combat ou usa pickMonsterByCR pra encontros random.

export type MonsterType =
  | 'humanoide' | 'fera' | 'morto-vivo' | 'fey' | 'dragão'
  | 'elemental' | 'aberração' | 'celestial' | 'demônio' | 'diabólico'
  | 'gigante' | 'monstro' | 'planta' | 'construto';

export type MonsterSize =
  | 'minúsculo' | 'pequeno' | 'médio' | 'grande' | 'enorme' | 'colossal';

// Challenge Rating — D&D 5e usa fracionários pra CR baixo.
// 0 = trivial; 1 = encontro pra party nv 1; 10 = boss pra party nv 8-10; 20+ = lendário.
export type CR = 0 | 0.125 | 0.25 | 0.5 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 15 | 17 | 20 | 21 | 23 | 24;

export interface MonsterDef {
  id: string;
  name: string;
  type: MonsterType;
  size: MonsterSize;
  cr: CR;
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
  damageBonus: number;
  speed?: number;          // ft, default 30
  attackName?: string;     // ex: "Mordida", "Cimitarra", "Sopro Flamejante"
  abilities?: string[];    // ex: ["Multiataque", "Visão no Escuro"]
  description: string;
  isBoss: boolean;
  // F26 — Resistance/immunity/vulnerability por tipo de dano (DamageType[]).
  resistances?: import('./damage-types').DamageType[];
  immunities?: import('./damage-types').DamageType[];
  vulnerabilities?: import('./damage-types').DamageType[];
  // F23 — tag pra Turn Undead detectar morto-vivo via type. (Já temos type field.)
  // F26 — Damage type principal do ataque desse monstro (default cortante)
  attackDamageType?: import('./damage-types').DamageType;
}

export const MONSTERS: Record<string, MonsterDef> = {
  // ═════════ CR 0 — trivial, ambient ═════════
  rato: {
    id: 'rato', name: 'Rato', type: 'fera', size: 'minúsculo', cr: 0,
    hp: 1, ac: 10, attackBonus: 0, damageDice: '1d1', damageBonus: -4,
    speed: 20, attackName: 'Mordida',
    description: 'Rato comum esgueirando-se entre as sombras. Mais cheiro que ameaça.',
    isBoss: false,
  },
  'cobra-venenosa': {
    id: 'cobra-venenosa', name: 'Cobra Venenosa', type: 'fera', size: 'minúsculo', cr: 0.125,
    hp: 2, ac: 13, attackBonus: 5, damageDice: '1d1', damageBonus: 0,
    attackName: 'Mordida', abilities: ['Veneno: 2d4 dano de veneno extra (CON DC 10 metade)'],
    description: 'Cobra ágil, marrom-amarelada. O bote é rápido. O veneno é mais.',
    isBoss: false,
  },

  // ═════════ CR 1/8 ═════════
  bandido: {
    id: 'bandido', name: 'Bandido', type: 'humanoide', size: 'médio', cr: 0.125,
    hp: 11, ac: 12, attackBonus: 3, damageDice: '1d6', damageBonus: 1,
    attackName: 'Cimitarra', abilities: ['Besta leve à distância (1d8+1)'],
    description: 'Couro maltratado, olhar de quem perdeu coisa importante. Trabalha em grupo.',
    isBoss: false,
  },
  'esqueleto': {
    id: 'esqueleto', name: 'Esqueleto', type: 'morto-vivo', size: 'médio', cr: 0.25,
    hp: 13, ac: 13, attackBonus: 4, damageDice: '1d6', damageBonus: 2,
    attackName: 'Espada Curta',
    abilities: ['Vulnerável a contundente', 'Imune a veneno + envenenado', 'Visão no Escuro 18m'],
    description: 'Ossos amarelados de quem ousou desafiar a morte mal. Chacoalha quando anda.',
    isBoss: false,
    vulnerabilities: ['contundente'],
    immunities: ['veneno'],
    attackDamageType: 'cortante',
  },

  // ═════════ CR 1/4 ═════════
  goblin: {
    id: 'goblin', name: 'Goblin', type: 'humanoide', size: 'pequeno', cr: 0.25,
    hp: 7, ac: 15, attackBonus: 4, damageDice: '1d6', damageBonus: 2,
    speed: 30, attackName: 'Cimitarra',
    abilities: ['Fugir Astutamente (ação bônus pra Disparada/Desengajar/Esconder)', 'Visão no Escuro 18m'],
    description: 'Pele esverdeada, dentes pontudos, sorriso cruel. Anda em bando. Cheira a fumaça.',
    isBoss: false,
  },
  kobold: {
    id: 'kobold', name: 'Kobold', type: 'humanoide', size: 'pequeno', cr: 0.125,
    hp: 5, ac: 12, attackBonus: 4, damageDice: '1d4', damageBonus: 2,
    speed: 30, attackName: 'Adaga',
    abilities: ['Tática de Bando (vantagem em ataques se aliado a 1.5m do alvo)', 'Sensibilidade ao Sol'],
    description: 'Réptil pequeno escamoso, covarde quando sozinho, perigoso em grupo.',
    isBoss: false,
  },
  lobo: {
    id: 'lobo', name: 'Lobo', type: 'fera', size: 'médio', cr: 0.25,
    hp: 11, ac: 13, attackBonus: 4, damageDice: '2d4', damageBonus: 2,
    speed: 40, attackName: 'Mordida',
    abilities: ['Tática de Bando', 'Faro Aguçado (vantagem em Percepção via cheiro)'],
    description: 'Olhar inteligente, dentes brancos, pelo grisalho. Caça em bando organizado.',
    isBoss: false,
  },
  zumbi: {
    id: 'zumbi', name: 'Zumbi', type: 'morto-vivo', size: 'médio', cr: 0.25,
    hp: 22, ac: 8, attackBonus: 3, damageDice: '1d6', damageBonus: 1,
    speed: 20, attackName: 'Soco',
    abilities: ['Fortitude do Morto-vivo (sobrevive a 0 HP com CON save DC 5+dmg)', 'Imune a veneno'],
    description: 'Cadáver reanimado, carne podre, movimento gauche. Não para fácil.',
    isBoss: false,
  },

  // ═════════ CR 1/2 ═════════
  cultista: {
    id: 'cultista', name: 'Cultista', type: 'humanoide', size: 'médio', cr: 0.125,
    hp: 9, ac: 12, attackBonus: 3, damageDice: '1d6', damageBonus: 1,
    attackName: 'Cimitarra',
    abilities: ['Devoção Maluca (vantagem em saves contra amedrontado/encantado)'],
    description: 'Túnica escura, símbolo gravado na testa, olhar perdido em algum deus errado.',
    isBoss: false,
  },
  hobgoblin: {
    id: 'hobgoblin', name: 'Hobgoblin', type: 'humanoide', size: 'médio', cr: 0.5,
    hp: 11, ac: 18, attackBonus: 3, damageDice: '1d8', damageBonus: 1,
    attackName: 'Espada Longa',
    abilities: ['Vantagem Marcial (+2d6 dano se aliado a 1.5m do alvo)', 'Visão no Escuro 18m'],
    description: 'Disciplinado, armadura de placas, expressão de soldado veterano. Eficaz.',
    isBoss: false,
  },
  orc: {
    id: 'orc', name: 'Orc', type: 'humanoide', size: 'médio', cr: 0.5,
    hp: 15, ac: 13, attackBonus: 5, damageDice: '1d12', damageBonus: 3,
    attackName: 'Machado Grande',
    abilities: ['Investida Agressiva (ação bônus: move até velocidade em direção a inimigo)', 'Visão no Escuro 18m'],
    description: 'Largo, verde-acinzentado, presas inferiores. Brame antes de atacar.',
    isBoss: false,
  },

  // ═════════ CR 1 ═════════
  bugbear: {
    id: 'bugbear', name: 'Bugbear', type: 'humanoide', size: 'médio', cr: 1,
    hp: 27, ac: 16, attackBonus: 4, damageDice: '2d8', damageBonus: 2,
    attackName: 'Mangual',
    abilities: ['Furtivo: Surpresa = +2d6 dano', 'Visão no Escuro 18m', 'Alcance Estendido (braços longos)'],
    description: 'Goblinóide grande, pelo eriçado, dentes amarelos. Caça em silêncio, golpeia forte.',
    isBoss: false,
  },
  'aranha-gigante': {
    id: 'aranha-gigante', name: 'Aranha Gigante', type: 'fera', size: 'grande', cr: 1,
    hp: 26, ac: 14, attackBonus: 5, damageDice: '1d8', damageBonus: 3,
    speed: 30, attackName: 'Mordida',
    abilities: ['Veneno: 2d8 (CON DC 11 metade)', 'Visão no Escuro 18m', 'Escalada de Teia'],
    description: 'Tamanho de cachorro grande. 8 olhos. Veneno na mandíbula. Constrói teias mortais.',
    isBoss: false,
  },
  'lobo-atroz': {
    id: 'lobo-atroz', name: 'Lobo Atroz', type: 'fera', size: 'grande', cr: 1,
    hp: 37, ac: 14, attackBonus: 5, damageDice: '2d6', damageBonus: 3,
    speed: 50, attackName: 'Mordida',
    abilities: ['Tática de Bando', 'Faro Aguçado'],
    description: 'Lobo do tamanho de cavalo. Pelo grisalho de inverno. Olhar de fome ancestral.',
    isBoss: false,
  },

  // ═════════ CR 2 ═════════
  ogro: {
    id: 'ogro', name: 'Ogro', type: 'gigante', size: 'grande', cr: 2,
    hp: 59, ac: 11, attackBonus: 6, damageDice: '2d8', damageBonus: 4,
    attackName: 'Tacape Enorme',
    abilities: ['Investida Brutal', 'Visão no Escuro 18m'],
    description: 'Dobro de altura humana, barriga gorda, peles maltratadas, cheiro de morte velha.',
    isBoss: false,
  },
  'cavaleiro-esqueleto': {
    id: 'cavaleiro-esqueleto', name: 'Cavaleiro Esqueleto', type: 'morto-vivo', size: 'médio', cr: 2,
    hp: 32, ac: 17, attackBonus: 5, damageDice: '1d8', damageBonus: 3,
    attackName: 'Espada Longa',
    abilities: ['Multiataque (2x espada)', 'Visão no Escuro 18m', 'Imune a veneno'],
    description: 'Cota de malha enferrujada, capa rasgada, escudo com brasão esquecido. Comandante morto.',
    isBoss: false,
  },

  // ═════════ CR 3 ═════════
  'mago-cinza': {
    id: 'mago-cinza', name: 'Mago Cinza', type: 'humanoide', size: 'médio', cr: 6,
    hp: 40, ac: 12, attackBonus: 3, damageDice: '1d4', damageBonus: 1,
    attackName: 'Adaga',
    abilities: [
      'Spells: Magic Missile (3 dardos 1d4+1)',
      'Spells: Burning Hands (3d6 cone, DC 14 metade)',
      'Spells: Fireball nv 3 (8d6 raio 6m, DC 14 metade)',
      'Mage Armor (CA 15)',
    ],
    description: 'Túnica cinza desgastada, olho esquerdo coberto. Murmura silabas antigas antes de cada gesto.',
    isBoss: false,
  },
  gargula: {
    id: 'gargula', name: 'Gárgula', type: 'elemental', size: 'médio', cr: 2,
    hp: 52, ac: 15, attackBonus: 4, damageDice: '1d6', damageBonus: 2,
    attackName: 'Garras',
    abilities: ['Multiataque', 'Voo 18m', 'Resistência a perfurante/contundente/cortante de armas comuns', 'Falsa Aparência (estátua)'],
    description: 'Pedra viva talhada como gárgula medieval. Imóvel até atacar. Bate como martelo.',
    isBoss: false,
  },
  gnoll: {
    id: 'gnoll', name: 'Gnoll', type: 'humanoide', size: 'médio', cr: 0.5,
    hp: 22, ac: 15, attackBonus: 4, damageDice: '1d8', damageBonus: 2,
    attackName: 'Lança',
    abilities: ['Frenesi de Sangue (ação bônus pra atacar de novo se baixou inimigo)'],
    description: 'Híbrido hiena-humanoide, ri enquanto mata. Caça em alcateia, devora os mortos.',
    isBoss: false,
  },

  // ═════════ CR 4 ═════════
  ettin: {
    id: 'ettin', name: 'Ettin', type: 'gigante', size: 'grande', cr: 4,
    hp: 85, ac: 12, attackBonus: 7, damageDice: '2d8', damageBonus: 5,
    attackName: 'Machado de Batalha',
    abilities: ['Duas Cabeças (vantagem em Percepção, Sabedoria, saves contra amedrontado/cego/atordoado/inconsciente)', 'Multiataque (2x)'],
    description: 'Gigante de duas cabeças. Cada uma discute com a outra. Ambas concordam em matar você.',
    isBoss: false,
  },
  banshee: {
    id: 'banshee', name: 'Banshee', type: 'morto-vivo', size: 'médio', cr: 4,
    hp: 58, ac: 12, attackBonus: 4, damageDice: '3d6', damageBonus: 2,
    attackName: 'Toque Corruptor (necrótico)',
    abilities: ['Lamento (CON DC 13 ou 3d6 psíquico + assustado)', 'Imune a fogo/frio/necrótico/perfurante/cortante/contundente de não-mágicas', 'Voo 40ft'],
    description: 'Elfa morta de saudade. Translúcida. Quando grita, lágrimas viram lâminas no ar.',
    isBoss: false,
  },

  // ═════════ CR 5 ═════════
  troll: {
    id: 'troll', name: 'Troll', type: 'gigante', size: 'grande', cr: 5,
    hp: 84, ac: 15, attackBonus: 7, damageDice: '2d6', damageBonus: 4,
    attackName: 'Garras',
    abilities: ['Regeneração 10/turno (não regenera fogo ou ácido)', 'Multiataque (3x: 1 mordida + 2 garras)', 'Faro Aguçado'],
    description: 'Verde-amarelado, regenera carne em segundos. Só pára de levantar se queimar ou dissolver.',
    isBoss: true,
  },
  'gigante-da-colina': {
    id: 'gigante-da-colina', name: 'Gigante da Colina', type: 'gigante', size: 'enorme', cr: 5,
    hp: 105, ac: 13, attackBonus: 8, damageDice: '3d8', damageBonus: 5,
    attackName: 'Clava Enorme',
    abilities: ['Multiataque (2x)', 'Arremessar Pedra (60m, 3d10+5)'],
    description: 'Burros e fortes. Vivem em colinas, comem o que cruza o caminho. Cheiro de couro mofado.',
    isBoss: true,
  },

  // ═════════ CR 6+ ═════════
  'mago': {
    id: 'mago', name: 'Mago Veterano', type: 'humanoide', size: 'médio', cr: 6,
    hp: 40, ac: 12, attackBonus: 4, damageDice: '1d4', damageBonus: 2,
    attackName: 'Adaga',
    abilities: [
      'Spell DC 14',
      'Cantrips: Fire Bolt (1d10), Mage Hand, Light',
      'Nv 1: Mage Armor, Magic Missile, Shield',
      'Nv 2: Misty Step, Suggestion',
      'Nv 3: Counterspell, Fireball, Fly',
      'Nv 4: Greater Invisibility, Ice Storm',
    ],
    description: 'Túnica azul, barba cinza, olhar agudo. Memorizou 4 grimórios. Cuidado.',
    isBoss: true,
  },
  'mind-flayer': {
    id: 'mind-flayer', name: 'Mind Flayer', type: 'aberração', size: 'médio', cr: 7,
    hp: 71, ac: 15, attackBonus: 7, damageDice: '2d10', damageBonus: 4,
    attackName: 'Tentáculos (psíquico)',
    abilities: ['Explosão Mental (cone 18m: 4d8 psíquico + atordoado, INT DC 15 metade)', 'Telepatia 36m', 'Visão no Escuro 36m'],
    description: 'Cabeça de polvo, pele violácea, vestes refinadas. Quer seu cérebro — literalmente.',
    isBoss: true,
  },
  'gigante-de-pedra': {
    id: 'gigante-de-pedra', name: 'Gigante de Pedra', type: 'gigante', size: 'enorme', cr: 7,
    hp: 126, ac: 17, attackBonus: 9, damageDice: '3d8', damageBonus: 6,
    attackName: 'Maço',
    abilities: ['Multiataque (2x)', 'Arremessar Pedra (4d10+6)', 'Aderência à Pedra'],
    description: 'Cinza-pedra, calmo, expressão contemplativa. Decide brigar depois de pensar muito.',
    isBoss: true,
  },
  'gigante-de-fogo': {
    id: 'gigante-de-fogo', name: 'Gigante de Fogo', type: 'gigante', size: 'enorme', cr: 9,
    hp: 162, ac: 18, attackBonus: 11, damageDice: '6d6', damageBonus: 7,
    attackName: 'Espadão Flamejante',
    abilities: ['Imune a fogo', 'Multiataque (2x)'],
    description: 'Pele negra fuliginosa, cabelo de chamas, vestes de bronze. Forja seus próprios braços.',
    isBoss: true,
  },

  // ═════════ CR 10+ ═════════
  aboleth: {
    id: 'aboleth', name: 'Aboleth', type: 'aberração', size: 'grande', cr: 10,
    hp: 135, ac: 17, attackBonus: 9, damageDice: '3d6', damageBonus: 5,
    attackName: 'Tentáculo',
    abilities: ['Multiataque (3 tentáculos)', 'Servidão (CON DC 14 ou enfeitiçado pra sempre)', 'Aquatico/Anfíbio'],
    description: 'Peixe-monstro ancestral, três olhos verticais, escamas viscosas. Sabe coisas que ninguém devia.',
    isBoss: true,
  },
  'dragão-jovem-vermelho': {
    id: 'dragão-jovem-vermelho', name: 'Dragão Jovem Vermelho', type: 'dragão', size: 'grande', cr: 10,
    hp: 178, ac: 18, attackBonus: 10, damageDice: '2d10', damageBonus: 6,
    attackName: 'Mordida (10ft + 7 fogo)',
    abilities: ['Multiataque (1 mordida + 2 garras)', 'Sopro Flamejante (cone 9m, 16d6 fogo, DEX DC 17)', 'Imune a fogo', 'Voo 80ft'],
    description: 'Escamas rubras como brasa, asas amplas, hálito que cheira a enxofre. Já matou cavaleiros.',
    isBoss: true,
  },
  archmage: {
    id: 'archmage', name: 'Arquimago', type: 'humanoide', size: 'médio', cr: 12,
    hp: 99, ac: 12, attackBonus: 9, damageDice: '1d4', damageBonus: 4,
    attackName: 'Adaga',
    abilities: [
      'Spell DC 17',
      'Nv 5: Cone of Cold, Scrying',
      'Nv 6: Globe of Invulnerability, True Seeing',
      'Nv 7: Teleport',
      'Nv 8: Mind Blank',
      'Nv 9: Time Stop',
    ],
    description: 'Vestes adornadas, anéis cintilantes em cada dedo. Não precisa atacar primeiro — espera você atacar.',
    isBoss: true,
  },
  vampiro: {
    id: 'vampiro', name: 'Vampiro', type: 'morto-vivo', size: 'médio', cr: 13,
    hp: 144, ac: 16, attackBonus: 9, damageDice: '1d8', damageBonus: 4,
    attackName: 'Mordida (drena vida)',
    abilities: [
      'Multiataque (2x — agarrar + mordida)',
      'Regeneração 20/turno (fora de luz solar)',
      'Encanto (WIS DC 17 ou enfeitiçado 24h)',
      'Imune a perfurante/cortante/contundente de não-mágicas',
      'Filhos da Noite (invoca lobos ou morcegos)',
    ],
    description: 'Pálido, gracioso, olhos vermelhos. Atravessa séculos. Aprende sua mente antes de matar.',
    isBoss: true,
  },
  'dragão-adulto-vermelho': {
    id: 'dragão-adulto-vermelho', name: 'Dragão Adulto Vermelho', type: 'dragão', size: 'enorme', cr: 17,
    hp: 256, ac: 19, attackBonus: 14, damageDice: '2d10', damageBonus: 8,
    attackName: 'Mordida (15ft + 14 fogo)',
    abilities: [
      'Multiataque (1 frightful presence + 1 mordida + 2 garras)',
      'Sopro Flamejante (cone 18m, 18d6 fogo, DEX DC 21)',
      'Presença Aterrorizante (WIS DC 16 ou amedrontado)',
      'Ações Lendárias 3/turno',
      'Voo 80ft',
    ],
    description: 'Asas largas como velas, escamas em brasa. Voz grave como avalanche. Acumula tesouro por séculos.',
    isBoss: true,
  },
  lich: {
    id: 'lich', name: 'Lich', type: 'morto-vivo', size: 'médio', cr: 21,
    hp: 135, ac: 17, attackBonus: 12, damageDice: '3d6', damageBonus: 4,
    attackName: 'Toque Paralisante (necrótico)',
    abilities: [
      'Spell DC 20',
      'Nv 9: Power Word Kill, Time Stop',
      'Nv 8: Mind Blank, Dominate Monster',
      'Resistência a frio/relâmpago/necrótico',
      'Imune a venenoso/paralisado/exaustão/agarrado/atordoado',
      'Rejuvenescimento (volta em 1d10 dias se filactério intacto)',
      'Ações Lendárias 3/turno',
    ],
    description: 'Esqueleto vestido em mantos antigos, olhos de fogo verde. Já era arquimago — agora é eternidade.',
    isBoss: true,
  },
  'pit-fiend': {
    id: 'pit-fiend', name: 'Diabo do Abismo', type: 'diabólico', size: 'grande', cr: 20,
    hp: 300, ac: 19, attackBonus: 14, damageDice: '4d8', damageBonus: 8,
    attackName: 'Garras + Cauda + Aleta',
    abilities: [
      'Multiataque (4 ataques diferentes)',
      'Imune a fogo/veneno',
      'Magia Inata: Wall of Fire, Power Word Stun, Fireball at will',
      'Aura de Medo 6m (WIS DC 21 ou amedrontado)',
      'Voo 60ft',
    ],
    description: 'Lorde do Inferno em pessoa. Asas membranosas, presas de granito, cauda farpada. Faz contratos com almas.',
    isBoss: true,
  },
};

export const ALL_MONSTERS: MonsterDef[] = Object.values(MONSTERS);

export function getMonster(id: string): MonsterDef | null {
  return MONSTERS[id] ?? null;
}

// Helper pro DM: escolhe N monstros próximos a um CR alvo.
// Retorna [{ monster, count }] balanceado.
export function pickMonstersByCR(targetCR: number, partySize = 3): Array<{ monster: MonsterDef; count: number }> {
  // CR aproximado pro encontro: targetCR é a soma total
  // Encontro de party 3 contra CR 5 = pode ser 1 troll OU 4 goblins
  const eligible = ALL_MONSTERS.filter((m) => m.cr > 0 && m.cr <= targetCR);
  if (eligible.length === 0) return [];

  // Escolhe 1-3 tipos diferentes pra fazer o encontro
  const sorted = eligible.sort((a, b) => Math.abs(a.cr - targetCR / partySize) - Math.abs(b.cr - targetCR / partySize));
  const main = sorted[0];
  if (!main) return [];

  // Quantos: targetCR / main.cr, mínimo 1
  const count = Math.max(1, Math.min(8, Math.floor(targetCR / Math.max(0.125, main.cr))));
  return [{ monster: main, count }];
}

// Helper: lista monstros por tipo
export function monstersByType(type: MonsterType): MonsterDef[] {
  return ALL_MONSTERS.filter((m) => m.type === type);
}

// Helper: lista monstros até um CR máximo
export function monstersUpToCR(maxCR: number): MonsterDef[] {
  return ALL_MONSTERS.filter((m) => m.cr <= maxCR);
}

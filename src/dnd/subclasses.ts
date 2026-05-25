// JSgame · D&D 5e Subclasses (Archetypes / Domains / Schools / Patrons).
// PHB padrão: player escolhe subclass no nível 3. Aqui temos 2-3 subclasses
// por classe — 30+ no total. Cada uma com features que vão sendo ganhas em
// níveis específicos (3, 6, 10, 14, 18).

import type { ClassId } from './classes';

export type SubclassId =
  // Bárbaro
  | 'berserker' | 'totem-warrior'
  // Bardo
  | 'lore' | 'valor'
  // Bruxo
  | 'fiend' | 'archfey' | 'great-old-one'
  // Clérigo
  | 'life' | 'light' | 'war' | 'tempest' | 'trickery' | 'knowledge'
  // Druida
  | 'land' | 'moon'
  // Feiticeiro
  | 'draconic' | 'wild-magic'
  // Guerreiro
  | 'champion' | 'battle-master' | 'eldritch-knight'
  // Ladino
  | 'thief' | 'assassin' | 'arcane-trickster'
  // Mago
  | 'abjuration' | 'conjuration' | 'divination' | 'enchantment'
  | 'evocation' | 'illusion' | 'necromancy' | 'transmutation'
  // Monge
  | 'open-hand' | 'shadow' | 'four-elements'
  // Paladino
  | 'devotion' | 'ancients' | 'vengeance'
  // Patrulheiro
  | 'hunter' | 'beast-master';

export interface SubclassFeature {
  level: number;       // nv que ganha (3, 6, 10, 14, 18)
  name: string;
  description: string;
}

export interface SubclassDef {
  id: SubclassId;
  name: string;
  classId: ClassId;
  description: string;       // tom narrativo (2-3 frases)
  features: SubclassFeature[];
}

export const SUBCLASSES: Record<SubclassId, SubclassDef> = {
  // ═════════ Bárbaro ═════════
  berserker: {
    id: 'berserker', name: 'Caminho do Berserker', classId: 'barbaro',
    description: 'Fúria pura sem retorno. Pega seu próprio sangue como motivação. Ataca até cair.',
    features: [
      { level: 3, name: 'Frenesi', description: 'Em Fúria: ataque extra como ação bônus. Após Fúria, exaustão 1 nível.' },
      { level: 6, name: 'Mente Insensata', description: 'Imune a amedrontado e enfeitiçado durante Fúria.' },
      { level: 10, name: 'Presença Intimidadora', description: 'Ação: WIS save DC 8+prof+CHA, alvo amedrontado.' },
      { level: 14, name: 'Retaliação', description: 'Quando levar dano corpo-a-corpo, reação pra contra-atacar.' },
    ],
  },
  'totem-warrior': {
    id: 'totem-warrior', name: 'Caminho do Guerreiro Totêmico', classId: 'barbaro',
    description: 'Espírito animal canaliza pelo corpo. Urso = resistência. Lobo = caça. Águia = velocidade.',
    features: [
      { level: 3, name: 'Espírito do Totem (Urso/Lobo/Águia)', description: 'Escolhe um totem que define poderes.' },
      { level: 6, name: 'Aspecto da Fera', description: 'Habilidade passiva do animal escolhido.' },
      { level: 10, name: 'Andando Espiritual', description: 'Pode conjurar Commune with Nature como ritual.' },
      { level: 14, name: 'Investida Totêmica', description: 'Em Fúria: poder devastador do totem.' },
    ],
  },

  // ═════════ Bardo ═════════
  lore: {
    id: 'lore', name: 'Colégio do Conhecimento', classId: 'bardo',
    description: 'Bardo erudito que coleciona segredos. Sabe demais. Fala demais. Usa palavras como armas.',
    features: [
      { level: 3, name: 'Magias Adicionais (mais 3 perícias)', description: 'Proficiência em 3 perícias extras.' },
      { level: 3, name: 'Palavras Cortantes', description: 'Reação: subtrai 1d6 de ataque/teste/dano de inimigo (usa Inspiração).' },
      { level: 6, name: 'Segredos Mágicos Adicionais', description: 'Aprende 2 magias de qualquer classe.' },
      { level: 14, name: 'Segredos Mágicos Aperfeiçoados', description: 'Mais 2 magias de qualquer lista.' },
    ],
  },
  valor: {
    id: 'valor', name: 'Colégio da Bravura', classId: 'bardo',
    description: 'Bardo guerreiro. Mais armadura, mais aço. Cantar enquanto luta como Aragorn.',
    features: [
      { level: 3, name: 'Proficiência em Armaduras Médias + Escudos', description: 'Mais armadura, mais aço.' },
      { level: 3, name: 'Inspiração de Combate', description: 'Inspiração também adiciona dano em ataques.' },
      { level: 6, name: 'Ataque Extra', description: 'Ataca 2x por ação.' },
      { level: 14, name: 'Inspiração Marcial', description: 'Inspiração inflige dano extra grande.' },
    ],
  },

  // ═════════ Bruxo ═════════
  fiend: {
    id: 'fiend', name: 'O Diabólico', classId: 'bruxo',
    description: 'Pacto com diabo do Inferno. Poderes infernais. Alma comprometida. Você sabia.',
    features: [
      { level: 1, name: 'Magias Adicionais (Burning Hands, Command, Scorching Ray, etc)', description: 'Acesso a magias temáticas do fogo/dor.' },
      { level: 1, name: 'Dádiva Sombria do Diabólico', description: 'Quando reduz inimigo a 0: ganha HP temp = CHA + nv bruxo.' },
      { level: 6, name: 'Resistência Diabólica', description: 'Curto rest: ganha resistência a 1 tipo dano (escolha).' },
      { level: 10, name: 'Tormento Cruel', description: 'Sob ataque: força inimigo a rolar de novo (1/rest curto).' },
    ],
  },
  archfey: {
    id: 'archfey', name: 'O Senhor das Fadas', classId: 'bruxo',
    description: 'Pacto com Rainha/Rei da Floresta Feérica. Encantos sutis, brumas, ilusões.',
    features: [
      { level: 1, name: 'Magias Adicionais (Faerie Fire, Sleep, Calm Emotions, Phantasmal Force)', description: 'Magia feérica de encantamento e ilusão.' },
      { level: 1, name: 'Escape do Feérico', description: 'Ação bônus: teleporte 18m + invisível até próximo turno (1/rest curto).' },
      { level: 6, name: 'Olhar Misterioso', description: 'Olhe um inimigo (60ft): WIS save ou amedrontado/encantado.' },
      { level: 10, name: 'Drow da Defesa', description: 'Vantagem em saves contra encantado.' },
    ],
  },
  'great-old-one': {
    id: 'great-old-one', name: 'O Grande Antigo', classId: 'bruxo',
    description: 'Pacto com algo lovecraftiano que nem sabe que você existe. Telepatia, loucura, abismo.',
    features: [
      { level: 1, name: 'Magias Adicionais (Dissonant Whispers, Detect Thoughts, Sending, Telekinesis)', description: 'Magia mental e telepática.' },
      { level: 1, name: 'Telepatia Sussurrante', description: 'Pode falar telepaticamente a 9m.' },
      { level: 6, name: 'Investigador Entropia', description: 'Reação: quando levar dano critical, inimigo INT save ou 3d6 psíquico.' },
      { level: 10, name: 'Quebrar a Realidade', description: 'Imunidade a sono mágico, resistência psíquico.' },
    ],
  },

  // ═════════ Clérigo ═════════
  life: {
    id: 'life', name: 'Domínio da Vida', classId: 'clerigo',
    description: 'Servo de deuses da cura, fertilidade, recomeço. Mãos brilhantes que fazem ferida virar pó.',
    features: [
      { level: 1, name: 'Discípulo da Vida', description: 'Magias de cura curam +2 + nível da magia HP extra.' },
      { level: 1, name: 'Magias Adicionais (Bless, Cure Wounds, Lesser Restoration, Spiritual Weapon, Beacon of Hope, Revivify)', description: 'Cura e ressurreição.' },
      { level: 2, name: 'Canalizar Divindade: Preservar Vida', description: 'Cura 5×nv distribuído entre aliados.' },
      { level: 6, name: 'Toque Bem-Aventurado', description: 'Quando cura magia, cura também damage 0.' },
    ],
  },
  light: {
    id: 'light', name: 'Domínio da Luz', classId: 'clerigo',
    description: 'Servo do Sol. Banho de chamas radiantes. Bom contra mortos-vivos, aberrações, escuridão.',
    features: [
      { level: 1, name: 'Magias Adicionais (Faerie Fire, Burning Hands, Scorching Ray, Daylight, Fireball)', description: 'Fogo e luz radiante.' },
      { level: 1, name: 'Aura Luminescente', description: 'Reação: ataque contra você ou aliado a 30ft tem desvantagem.' },
      { level: 2, name: 'Canalizar Divindade: Chama Radiante', description: 'Ação: 2d10 radiante num alvo a 18m (sobe com nível).' },
      { level: 6, name: 'Aviso da Luz', description: 'Conjura Daylight uma vez por rest longo, sem componente.' },
    ],
  },
  war: {
    id: 'war', name: 'Domínio da Guerra', classId: 'clerigo',
    description: 'Servo de deuses guerreiros. Cota de malha, armas marciais, smite divino.',
    features: [
      { level: 1, name: 'Proficiência em armas marciais + armaduras pesadas', description: 'Combate físico forte.' },
      { level: 1, name: 'Magias Adicionais (Divine Favor, Shield of Faith, Magic Weapon, Spiritual Weapon, Crusader\'s Mantle, Spirit Guardians)', description: 'Buffs de combate.' },
      { level: 1, name: 'Sacerdote de Guerra', description: 'Ataque + ação bônus pra ataque adicional.' },
      { level: 2, name: 'Canalizar Divindade: Inspiração Guerreira', description: 'Aliado ganha +10 num ataque ou save.' },
    ],
  },
  tempest: {
    id: 'tempest', name: 'Domínio da Tempestade', classId: 'clerigo',
    description: 'Servo de deuses do trovão e dos mares. Relâmpagos pelas mãos. Voz de tempestade.',
    features: [
      { level: 1, name: 'Magias Adicionais (Fog Cloud, Thunderwave, Gust of Wind, Shatter, Sleet Storm, Call Lightning)', description: 'Tempestade e elementos.' },
      { level: 1, name: 'Fúria da Tempestade', description: 'Reação: quando atingido em melee, 2d8 elétrico/trovejante no atacante.' },
      { level: 2, name: 'Canalizar Divindade: Destruição da Tempestade', description: 'Maximiza dano de magia de relâmpago/trovão.' },
      { level: 6, name: 'Curandeiro da Tempestade', description: 'Aliado próximo: vantagem em saves contra trovão.' },
    ],
  },
  trickery: {
    id: 'trickery', name: 'Domínio da Trapaça', classId: 'clerigo',
    description: 'Servo de deuses bandidos. Ilusões, furtividade, falas de duas faces. Cura mas mente.',
    features: [
      { level: 1, name: 'Magias Adicionais (Charm Person, Disguise Self, Mirror Image, Pass Without Trace, Blink)', description: 'Ilusão e engano.' },
      { level: 1, name: 'Bênção da Trapaça', description: 'Aliado ganha vantagem em furtividade por 1h.' },
      { level: 2, name: 'Canalizar Divindade: Invocar Duplicado', description: 'Cria duplicata ilusória que dura 1min.' },
    ],
  },
  knowledge: {
    id: 'knowledge', name: 'Domínio do Conhecimento', classId: 'clerigo',
    description: 'Servo de deuses do saber. Lê mentes, lê livros, lê estrelas. Crítica com fatos.',
    features: [
      { level: 1, name: 'Bênção do Conhecimento', description: '2 línguas + 2 perícias (Arcana/Religion/História/Natureza).' },
      { level: 1, name: 'Magias Adicionais (Identify, Command, Augury, Suggestion, Speak with Dead, Nondetection)', description: 'Adivinhação e influência.' },
      { level: 2, name: 'Canalizar Divindade: Ler Pensamentos', description: 'WIS save ou você lê pensamentos por 1min.' },
    ],
  },

  // ═════════ Druida ═════════
  land: {
    id: 'land', name: 'Círculo da Terra', classId: 'druida',
    description: 'Guardião de bioma (floresta, deserto, montanha, etc). Magias adicionais conforme terreno.',
    features: [
      { level: 2, name: 'Recuperação Natural', description: 'Rest curto recupera metade dos slots gastos (1×/rest longo).' },
      { level: 3, name: 'Magias do Círculo (varia por terreno)', description: 'Magias bônus baseadas em terreno escolhido.' },
      { level: 6, name: 'Andar pela Terra', description: 'Mov ignora terreno difícil natural. Imune a venenos vegetais.' },
      { level: 10, name: 'Aspecto Imutável', description: 'Imune a doenças, venenos, não envelhece.' },
    ],
  },
  moon: {
    id: 'moon', name: 'Círculo da Lua', classId: 'druida',
    description: 'Druida transformista. Vira urso, lobo terrível, dinossauro. Combate em forma animal.',
    features: [
      { level: 2, name: 'Forma Selvagem Combatente', description: 'Pode virar fera CR ≤ 1 (urso, panthera) e usar pra combate.' },
      { level: 2, name: 'Combate Primitivo', description: 'Ataques de forma animal contam como mágicas.' },
      { level: 6, name: 'Strike Primitivo', description: 'Mais dano em ataques de forma animal.' },
      { level: 10, name: 'Forma Elemental', description: 'Wild Shape pra elemental ar/terra/fogo/água.' },
    ],
  },

  // ═════════ Feiticeiro ═════════
  draconic: {
    id: 'draconic', name: 'Linhagem Dracônica', classId: 'feiticeiro',
    description: 'Antepassado era dragão. Escamas afloram em pele. Resistência elemental. Voz que ressoa.',
    features: [
      { level: 1, name: 'Ancestral Dracônico', description: 'Escolhe tipo (vermelho, azul, etc). Idioma Dracônico.' },
      { level: 1, name: 'Resiliência Dracônica', description: '+1 HP por nível. CA base 13 + DEX (sem armadura).' },
      { level: 6, name: 'Afinidade Elemental', description: 'Adiciona CHA mod a dano do tipo do dragão.' },
      { level: 14, name: 'Asas Dracônicas', description: 'Cresce asas, voa 18m permanentemente.' },
    ],
  },
  'wild-magic': {
    id: 'wild-magic', name: 'Magia Selvagem', classId: 'feiticeiro',
    description: 'Magia caótica nasceu em você. Cada conjuração tem 1d20 chance de fazer algo estranho.',
    features: [
      { level: 1, name: 'Surto de Magia Selvagem', description: 'A cada nv1+ magia: 1/20 chance de tabela de efeito aleatório.' },
      { level: 1, name: 'Lance do Acaso', description: 'Adiciona/subtrai d20 a save ou ataque (1/rest curto).' },
      { level: 6, name: 'Bender Sortudo', description: 'Antes de uma magia: aliado ganha vantagem em 1 d20.' },
    ],
  },

  // ═════════ Guerreiro ═════════
  champion: {
    id: 'champion', name: 'Campeão', classId: 'guerreiro',
    description: 'Simples e mortal. Mais críticos, mais HP, mais atletismo. Brutos puros.',
    features: [
      { level: 3, name: 'Crítico Aperfeiçoado', description: 'Crit em 19-20 (não só 20).' },
      { level: 7, name: 'Atleta Notável', description: 'Vantagem em Athletics. Salto/escala +mod.' },
      { level: 10, name: 'Estilo de Combate Adicional', description: 'Escolhe segundo Fighting Style.' },
      { level: 15, name: 'Crítico Superior', description: 'Crit em 18-20.' },
    ],
  },
  'battle-master': {
    id: 'battle-master', name: 'Mestre de Batalha', classId: 'guerreiro',
    description: 'Tático supremo. Manobras: Trip Attack, Disarming, Riposte, Goading. Dados de Superioridade.',
    features: [
      { level: 3, name: 'Manobras', description: 'Escolhe 3 manobras. 4 dados de superioridade d8 (recarrega rest).' },
      { level: 3, name: 'Conhecedor de Estudo', description: 'Vantagem em Insight contra criatura escolhida.' },
      { level: 7, name: 'Conhecimento de Armas', description: 'Identifica armas mágicas com 1 min de exame.' },
      { level: 10, name: 'Manobras Aperfeiçoadas', description: '+2 manobras, dados sobem pra d10.' },
    ],
  },
  'eldritch-knight': {
    id: 'eldritch-knight', name: 'Cavaleiro Élfico', classId: 'guerreiro',
    description: 'Guerreiro que aprendeu magia. Escola de Abjuração/Evocação preferidas. Lança Shield, Magic Missile, etc.',
    features: [
      { level: 3, name: 'Spellcasting (terceiro caster)', description: '3 cantrips + 2 spells nv 1 (escola Abjuração/Evocação).' },
      { level: 3, name: 'Vínculo de Arma', description: 'Vincula arma — pode invocar como ação bônus.' },
      { level: 7, name: 'Strike de Guerra', description: 'Conjura cantrip + atacar com ação bônus.' },
      { level: 10, name: 'Magia Aperfeiçoada', description: 'Mais spells, mais slots.' },
    ],
  },

  // ═════════ Ladino ═════════
  thief: {
    id: 'thief', name: 'Ladrão', classId: 'ladino',
    description: 'Furtivo clássico. Climber, fast-hands, magia de Use Item à distância.',
    features: [
      { level: 3, name: 'Mãos Rápidas', description: 'Ação bônus: Sleight of Hand, usar item, desativar armadilha.' },
      { level: 3, name: 'Segundo Andar', description: 'Escala dobra velocidade. Salto sem arrancada.' },
      { level: 9, name: 'Roubo Reflexivo', description: 'Reação a ataque: rouba item visível.' },
      { level: 13, name: 'Uso de Itens Mágicos', description: 'Ignora restrição de classe pra itens mágicos.' },
    ],
  },
  assassin: {
    id: 'assassin', name: 'Assassino', classId: 'ladino',
    description: 'Mata em silêncio. Disguise expert. Surpresa = crit automático.',
    features: [
      { level: 3, name: 'Bônus de Proficiência', description: 'Proficiência em disfarce + kit de envenenamento.' },
      { level: 3, name: 'Assassinar', description: 'Vantagem em ataques contra alvo surpreendido. Crit automático se acertar.' },
      { level: 9, name: 'Infiltrador', description: 'Em 1h prepara identidade falsa convincente.' },
      { level: 13, name: 'Impostor', description: 'Imita perfeitamente fala/jeito de outra pessoa.' },
    ],
  },
  'arcane-trickster': {
    id: 'arcane-trickster', name: 'Trapaceiro Arcano', classId: 'ladino',
    description: 'Ladrão + mago. Escola de Encantamento/Ilusão. Mão Mágica avançada que rouba à distância.',
    features: [
      { level: 3, name: 'Spellcasting (terceiro caster Encantamento/Ilusão)', description: '3 cantrips + 2 spells nv 1.' },
      { level: 3, name: 'Mão Mágica Acrobática', description: 'Mage Hand invisível + roubar, plantar, etc.' },
      { level: 9, name: 'Pensamentos Mágicos', description: 'Conjura Detect Thoughts 1/rest curto.' },
      { level: 13, name: 'Engano Versátil', description: 'Vantagem em Deception e Stealth.' },
    ],
  },

  // ═════════ Mago — 8 escolas ═════════
  abjuration: {
    id: 'abjuration', name: 'Escola da Abjuração', classId: 'mago',
    description: 'Especialista em proteção. Wards, dispelling, counter-magic. Tanque arcano.',
    features: [
      { level: 2, name: 'Selo Abjurador', description: 'Cria ward que absorve dano = 2×nv mago.' },
      { level: 6, name: 'Resistência Projetada', description: 'Aliado tocado ganha resistência a 1 tipo de dano.' },
      { level: 10, name: 'Mestre Abjurador', description: 'Vantagem em saves contra magias.' },
      { level: 14, name: 'Adepto da Abjuração', description: 'Ward auto-renova em rest longo.' },
    ],
  },
  conjuration: {
    id: 'conjuration', name: 'Escola da Conjuração', classId: 'mago',
    description: 'Especialista em invocar criaturas, objetos, portas. Logística mágica.',
    features: [
      { level: 2, name: 'Conjuração Menor', description: 'Manifesta objeto não-mágico 5kg.' },
      { level: 6, name: 'Teletransporte Benigno', description: 'Quando conjura criatura, ela teleporta junto.' },
      { level: 10, name: 'Mestre Convocador', description: 'Criaturas conjuradas têm HP máximo.' },
    ],
  },
  divination: {
    id: 'divination', name: 'Escola da Adivinhação', classId: 'mago',
    description: 'Vê o futuro. Roll a roll do dia, salva pra usar quando quiser.',
    features: [
      { level: 2, name: 'Portento', description: '2× rolagens dos d20 no rest longo: pode substituir qualquer d20.' },
      { level: 6, name: 'Visão Expert', description: 'Magia de adivinhação nv ≤ 2: conjura sem gastar slot.' },
      { level: 10, name: 'Portento Aperfeiçoado', description: '3 dados de Portento.' },
    ],
  },
  enchantment: {
    id: 'enchantment', name: 'Escola do Encantamento', classId: 'mago',
    description: 'Controla mentes. Charme, sleep, dominação. Manipulador social máximo.',
    features: [
      { level: 2, name: 'Hipnose Sutil', description: 'Encantamento sem ver gestos. 1 alvo: WIS save ou amigo temp.' },
      { level: 6, name: 'Encanto Instintivo', description: 'Reação: força alvo a atacar outro inimigo.' },
      { level: 10, name: 'Charme Dividido', description: 'Spells de encantamento podem afetar 2 alvos.' },
    ],
  },
  evocation: {
    id: 'evocation', name: 'Escola da Evocação', classId: 'mago',
    description: 'Especialista em dano elemental. Fireball maior, sem queimar aliados.',
    features: [
      { level: 2, name: 'Escultura de Magia', description: 'Em AOE de evocação: protege 1+slot aliados (sem dano).' },
      { level: 6, name: 'Cantrip Potente', description: 'Cantrip de dano sempre causa metade no miss.' },
      { level: 10, name: 'Evocação Empoderada', description: '+ INT mod ao dano de uma magia/turno.' },
    ],
  },
  illusion: {
    id: 'illusion', name: 'Escola da Ilusão', classId: 'mago',
    description: 'Especialista em enganos visuais. Cria, modifica, desfaz. Mestre dos truques.',
    features: [
      { level: 2, name: 'Ilusão Aperfeiçoada', description: 'Minor Illusion cria som E imagem. Move 1.5m/turno.' },
      { level: 6, name: 'Auto-Disfarce Maleável', description: 'Disguise Self com expressão dinâmica.' },
      { level: 10, name: 'Realidade Ilusória', description: 'Ilusão fica real por 1 minuto (objeto inofensivo).' },
    ],
  },
  necromancy: {
    id: 'necromancy', name: 'Escola da Necromancia', classId: 'mago',
    description: 'Mestre da morte e da vida-após. Animate Dead com bonus. Drena vida pra HP.',
    features: [
      { level: 2, name: 'Colheita Sombria', description: 'Quando mata com magia, ganha HP = 2×nv magia + INT.' },
      { level: 6, name: 'Animadores Mortos', description: 'Mais zumbis/esqueletos do que normal. +HP, +ataques.' },
      { level: 10, name: 'Comandar Mortos-vivos', description: 'WIS save ou morto-vivo CR ≤ INT obedece.' },
    ],
  },
  transmutation: {
    id: 'transmutation', name: 'Escola da Transmutação', classId: 'mago',
    description: 'Muda objetos, criaturas, elementos. Polymorph, Stone to Mud, Reincarnate.',
    features: [
      { level: 2, name: 'Pedra Transmutadora', description: 'Cria pedra com 1 propriedade (darkvision, +CON, etc).' },
      { level: 6, name: 'Pedra Aprimorada', description: 'Pedra pode ser usada 1×/rest curto.' },
      { level: 10, name: 'Forma Sombria', description: 'Polymorph em si mesmo (animal ou planta).' },
    ],
  },

  // ═════════ Monge ═════════
  'open-hand': {
    id: 'open-hand', name: 'Caminho da Mão Aberta', classId: 'monge',
    description: 'Combate desarmado puro. Knockback, knockdown, knockout. Wuxia clássico.',
    features: [
      { level: 3, name: 'Técnica da Mão Aberta', description: 'Após flurry of blows: empurra/derruba/sem reação.' },
      { level: 6, name: 'Cura por Mãos', description: 'Cura HP = nv monge × 3 num descanso curto.' },
      { level: 11, name: 'Tranquilidade', description: 'Aliados próximos: vantagem em saves contra cargas hostis.' },
      { level: 17, name: 'Vibrar a Alma', description: 'Toque que mata em horas (CON save).' },
    ],
  },
  shadow: {
    id: 'shadow', name: 'Caminho da Sombra', classId: 'monge',
    description: 'Ninja. Camuflagem, teleporte por sombras, invisibilidade. Mata sem ser visto.',
    features: [
      { level: 3, name: 'Artes Sombrias', description: '2 ki: cast Darkness/Darkvision/Pass without Trace/Silence.' },
      { level: 6, name: 'Passo Sombrio', description: 'Em escuridão: teleporta 18m como ação bônus.' },
      { level: 11, name: 'Cloak of Shadows', description: 'Em escuridão: invisível como ação.' },
      { level: 17, name: 'Oportunista', description: 'Reação contra alvo recém-atingido.' },
    ],
  },
  'four-elements': {
    id: 'four-elements', name: 'Caminho dos Quatro Elementos', classId: 'monge',
    description: 'Avatar wannabe. Aprende disciplinas elementais: fogo, água, terra, ar. Usa ki.',
    features: [
      { level: 3, name: 'Disciplina de Elementos', description: 'Aprende 1 disciplina inicialmente, custo ki.' },
      { level: 6, name: 'Mais Disciplinas', description: '+1 disciplina.' },
      { level: 11, name: 'Disciplina Mestre', description: 'Aprende disciplinas potentes.' },
      { level: 17, name: 'Adepto Elemental', description: 'Custos ki reduzidos.' },
    ],
  },

  // ═════════ Paladino ═════════
  devotion: {
    id: 'devotion', name: 'Juramento da Devoção', classId: 'paladino',
    description: 'Templário clássico. Honra, ordem, virtude. Smite contra mortos-vivos e demônios.',
    features: [
      { level: 3, name: 'Smite Sagrado', description: 'Use slot pra adicionar 2d8 radiante a ataque (+1d8/slot acima).' },
      { level: 3, name: 'Canalizar Divindade: Arma Sagrada', description: 'Arma +CHA mod em ataques. 1min.' },
      { level: 7, name: 'Aura de Devoção', description: 'Aliados a 9m: imunes a enfeitiçado.' },
      { level: 15, name: 'Pureza de Espírito', description: 'Sempre sob Protection from Evil and Good.' },
    ],
  },
  ancients: {
    id: 'ancients', name: 'Juramento dos Anciões', classId: 'paladino',
    description: 'Paladino-druida. Luz contra trevas. Magia da natureza. Aura que reduz dano elemental.',
    features: [
      { level: 3, name: 'Magia Natural', description: 'Spells: Ensnaring Strike, Speak with Animals, Misty Step, Plant Growth, etc.' },
      { level: 3, name: 'Canalizar Divindade: Natureza Anciã', description: 'Esfera radiante: criaturas no raio assustadas.' },
      { level: 7, name: 'Aura do Guardião', description: 'Aliados a 9m: resistência a dano de magia.' },
      { level: 15, name: 'Imortal Indeficiente', description: 'Não envelhece. Imune a doenças.' },
    ],
  },
  vengeance: {
    id: 'vengeance', name: 'Juramento da Vingança', classId: 'paladino',
    description: 'Caçador implacável. Marca alvo. Não desiste. Sem misericórdia.',
    features: [
      { level: 3, name: 'Marcado pela Vingança', description: 'Aliado pode usar reação pra atacar mesmo alvo.' },
      { level: 3, name: 'Canalizar Divindade: Voto de Inimizade', description: 'Alvo: vantagem em ataques contra ele 1 minuto.' },
      { level: 7, name: 'Implacável', description: 'Reage com ataque a alvo marcado se ele atacar você.' },
      { level: 15, name: 'Alma Inflexível', description: 'Vantagem em saves contra encantado.' },
    ],
  },

  // ═════════ Patrulheiro ═════════
  hunter: {
    id: 'hunter', name: 'Caçador', classId: 'patrulheiro',
    description: 'Especialista em matar grupos. Volley em ranged, Whirlwind em melee.',
    features: [
      { level: 3, name: 'Preza do Caçador', description: 'Escolhe: Colossus Slayer / Giant Killer / Horde Breaker.' },
      { level: 7, name: 'Tática Defensiva', description: 'Escolhe: Escape from Horde / Multiattack Defense / Steel Will.' },
      { level: 11, name: 'Multiataque', description: 'Volley (atira a todos no raio) ou Whirlwind (corta em volta).' },
      { level: 15, name: 'Defesa Superior', description: 'Escolhe: Evasion / Stand Against Tide / Uncanny Dodge.' },
    ],
  },
  'beast-master': {
    id: 'beast-master', name: 'Mestre das Feras', classId: 'patrulheiro',
    description: 'Tem um animal companheiro inteligente. Lobo, falcão, pantera. Lutam juntos.',
    features: [
      { level: 3, name: 'Companheiro Bestial', description: 'Adquire animal companheiro CR ≤ 1/4. HP = 4×nv ranger.' },
      { level: 7, name: 'Exemplar de Combate', description: 'Companheiro vence ataques de oportunidade.' },
      { level: 11, name: 'Ataque Bestial', description: 'Quando você ataca, companheiro pode atacar usando sua reação.' },
      { level: 15, name: 'Hábil', description: 'Companheiro evita áreas de efeito.' },
    ],
  },
};

export const ALL_SUBCLASSES: SubclassDef[] = Object.values(SUBCLASSES);

export function getSubclass(id: SubclassId): SubclassDef {
  return SUBCLASSES[id];
}

export function subclassesByClass(classId: ClassId): SubclassDef[] {
  return ALL_SUBCLASSES.filter((s) => s.classId === classId);
}

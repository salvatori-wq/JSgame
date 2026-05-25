// JSgame · D&D 5e Feats / Talentos (PHB cap 6 + algumas Xanathar comuns).
// Player ganha 1 feat OU +2 ASI no nv 4, 8, 12, 16, 19.
// Feats com pré-requisitos validados ao escolher.

import type { AbilityKey } from './attributes';

export type FeatId =
  | 'great-weapon-master' | 'sharpshooter' | 'lucky' | 'tough'
  | 'resilient' | 'mobile' | 'war-caster' | 'sentinel'
  | 'alert' | 'magic-initiate' | 'observant' | 'crossbow-expert'
  | 'polearm-master' | 'shield-master' | 'tavern-brawler' | 'inspiring-leader'
  | 'savage-attacker' | 'healer' | 'dual-wielder' | 'mage-slayer'
  | 'lightly-armored' | 'medium-armored' | 'heavily-armored'
  | 'martial-adept' | 'mounted-combatant' | 'spell-sniper'
  | 'athlete' | 'actor' | 'durable' | 'linguist';

export interface FeatPrerequisite {
  // Pré-req: ability mínima ou proficiência
  ability?: { key: AbilityKey; min: number };
  proficiency?: 'light-armor' | 'medium-armor' | 'heavy-armor' | 'martial-weapon' | 'spellcaster';
}

export interface FeatDef {
  id: FeatId;
  name: string;
  description: string;          // tom direto + tom de jogo
  benefit: string[];            // efeitos mecânicos (bullets)
  prerequisite?: FeatPrerequisite;
  abilityIncrease?: Partial<Record<AbilityKey, number>>;  // se feat dá +1 em ability
}

export const FEATS: Record<FeatId, FeatDef> = {
  'great-weapon-master': {
    id: 'great-weapon-master', name: 'Mestre de Arma Pesada',
    description: 'Aprende a swingar duas mãos como artista. Trade accuracy por dano absurdo.',
    benefit: [
      'Crit/kill com arma pesada: ação bônus pra ataque extra',
      '-5 ataque, +10 dano (opcional toggle) com armas pesadas',
    ],
  },
  sharpshooter: {
    id: 'sharpshooter', name: 'Atirador de Elite',
    description: 'Mira em pontos vitais. Ignora cobertura. Atira de longe sem penalidade.',
    benefit: [
      'Ataques à distância: ignora cobertura 1/2 ou 3/4',
      'Sem desvantagem em ataque a distância longa',
      '-5 ataque, +10 dano (opcional toggle) com armas à distância',
    ],
  },
  lucky: {
    id: 'lucky', name: 'Sortudo',
    description: 'O destino te ama. Reroll qualquer d20 importante. 3 vezes por dia.',
    benefit: [
      '3 pontos de sorte/rest longo',
      'Reroll qualquer d20 (próprio ou contra você)',
    ],
  },
  tough: {
    id: 'tough', name: 'Resistente',
    description: 'Couro grosso. Mais HP, sempre.',
    benefit: ['+2 HP por nível (retro-ativo + futuro)'],
  },
  resilient: {
    id: 'resilient', name: 'Resiliente',
    description: 'Escolhe uma ability. Ganha proficiência em save dela. +1 score.',
    benefit: [
      '+1 em ability escolhida',
      'Proficiência em save dessa ability',
    ],
  },
  mobile: {
    id: 'mobile', name: 'Móvel',
    description: 'Mais rápido. Não tomado oportunidade pelos que você atacou.',
    benefit: [
      '+3m deslocamento',
      'Disparada/Dash em terreno difícil sem custo',
      'Após melee attack: alvo não pode AoO em você',
    ],
  },
  'war-caster': {
    id: 'war-caster', name: 'Conjurador de Guerra',
    description: 'Pra casters em melee. Conjura mesmo de mãos cheias. AoO com magia.',
    prerequisite: { proficiency: 'spellcaster' },
    benefit: [
      'Vantagem em saves CON pra manter concentração',
      'Conjurar com mãos ocupadas (segurando armas/escudo)',
      'AoO: pode lançar cantrip de 1-ação em vez de ataque',
    ],
  },
  sentinel: {
    id: 'sentinel', name: 'Sentinela',
    description: 'Trava inimigos no lugar. Bom tanque. Aliados em melee = proteção.',
    benefit: [
      'AoO mesmo se alvo usar Disengage',
      'Hit em AoO: velocidade do alvo = 0 até fim do turno',
      'Se aliado a 1.5m for atacado: AoO grátis no atacante',
    ],
  },
  alert: {
    id: 'alert', name: 'Alerta',
    description: 'Nunca surpreendido. Sentidos afiados. +5 iniciativa.',
    benefit: [
      '+5 iniciativa',
      'Nunca surpreendido',
      'Invisíveis não têm vantagem em ataques contra você',
    ],
  },
  'magic-initiate': {
    id: 'magic-initiate', name: 'Iniciante na Magia',
    description: 'Aprende 2 cantrips + 1 spell nv 1 de qualquer classe.',
    benefit: [
      '2 cantrips de uma lista de classe (Bardo/Clérigo/Druida/Feiticeiro/Bruxo/Mago)',
      '1 spell nv 1 da mesma lista (1×/rest longo)',
    ],
  },
  observant: {
    id: 'observant', name: 'Observador',
    description: 'Lê lábios. Vê detalhes que outros perdem. +5 Investigação/Percepção passivas.',
    benefit: [
      '+1 INT ou WIS',
      'Lê lábios',
      '+5 Percepção e Investigação passivas',
    ],
    abilityIncrease: { int: 1 },
  },
  'crossbow-expert': {
    id: 'crossbow-expert', name: 'Especialista em Besta',
    description: 'Atira besta em melee. Carrega besta leve com uma mão. Ataque bônus de besta de mão.',
    benefit: [
      'Sem desvantagem em ranged adjacente a inimigo',
      'Sem reload action pra bestas',
      'Besta de mão: ação bônus pra atirar de novo',
    ],
  },
  'polearm-master': {
    id: 'polearm-master', name: 'Mestre de Lança',
    description: 'Cabo do bastão também ataca (1d4). AoO quando inimigo entra no alcance.',
    benefit: [
      'Glaive/halberd/quarterstaff: ataque bônus com a base (1d4)',
      'AoO quando inimigo entra no alcance (5ft com glaive)',
    ],
  },
  'shield-master': {
    id: 'shield-master', name: 'Mestre do Escudo',
    description: 'Escudo bate. Esquiva-protege aliados. AoO com escudo.',
    benefit: [
      'Ataque bônus: shove com escudo (knockdown ou push 1.5m)',
      '+2 a saves DEX vs área se escudo equipado',
      'Saves DEX em área: nenhum dano se sucesso',
    ],
  },
  'tavern-brawler': {
    id: 'tavern-brawler', name: 'Brigão de Bar',
    description: 'Brigas de bar viraram disciplina. Soco/garrafa/cadeira viram armas legítimas.',
    benefit: [
      '+1 STR ou CON',
      'Soco/improvised conta como proficiente',
      'Ataque desarmado: 1d4 dano',
      'Hit melee: ação bônus pra agarrar',
    ],
    abilityIncrease: { for: 1 },
  },
  'inspiring-leader': {
    id: 'inspiring-leader', name: 'Líder Inspirador',
    description: '10min de pep talk = HP temp pra todos.',
    prerequisite: { ability: { key: 'car', min: 13 } },
    benefit: [
      '10min discurso: até 6 aliados ganham CHA mod + nv HP temp',
      'Uso 1×/rest curto',
    ],
  },
  'savage-attacker': {
    id: 'savage-attacker', name: 'Atacante Selvagem',
    description: 'Reroll dano de melee 1×/turno. Crit é exemplar.',
    benefit: ['1×/turno: reroll dano de melee, pega o melhor'],
  },
  healer: {
    id: 'healer', name: 'Curandeiro',
    description: 'Kit médico curando bem. Estabiliza moribundos sem rolagem.',
    benefit: [
      'Kit médico estabiliza criatura a 0 HP (sem teste)',
      'Healer\'s kit ação: cura 1d6+4 + 1/nv (1×/rest curto por alvo)',
    ],
  },
  'dual-wielder': {
    id: 'dual-wielder', name: 'Mestre das Duas Armas',
    description: 'Luta com 2 armas não-light. +1 CA enquanto isso.',
    benefit: [
      '+1 CA com 2 armas em mãos',
      'Pode dual-wield armas não-light (longsword + longsword)',
      'Saca 2 armas com 1 interação',
    ],
  },
  'mage-slayer': {
    id: 'mage-slayer', name: 'Matador de Magos',
    description: 'Cassador de magos. Reaction attack quando conjuram perto. Vantagem em saves.',
    benefit: [
      'Reação: quando caster a 5ft conjura, ataca melee',
      'Vantagem em saves contra magia de adjacente',
      'Caster perde concentração se você acerta',
    ],
  },
  'lightly-armored': {
    id: 'lightly-armored', name: 'Treinamento em Armadura Leve',
    description: 'Aprende a usar armaduras leves.',
    benefit: ['Proficiência em armaduras leves', '+1 STR ou DEX'],
    abilityIncrease: { des: 1 },
  },
  'medium-armored': {
    id: 'medium-armored', name: 'Treinamento em Armadura Média',
    description: 'Aprende a usar armaduras médias + escudos.',
    prerequisite: { proficiency: 'light-armor' },
    benefit: ['Proficiência em armaduras médias + escudos', '+1 STR ou DEX'],
    abilityIncrease: { for: 1 },
  },
  'heavily-armored': {
    id: 'heavily-armored', name: 'Treinamento em Armadura Pesada',
    description: 'Aprende a usar armaduras pesadas. Lentos mas fortes.',
    prerequisite: { proficiency: 'medium-armor' },
    benefit: ['Proficiência em armaduras pesadas', '+1 STR'],
    abilityIncrease: { for: 1 },
  },
  'martial-adept': {
    id: 'martial-adept', name: 'Adepto Marcial',
    description: 'Aprende 2 manobras de Battle Master. 1 dado de superioridade d6.',
    benefit: [
      '2 maneuvers',
      '1 dado de superioridade d6 (rest curto recarrega)',
    ],
  },
  'mounted-combatant': {
    id: 'mounted-combatant', name: 'Combatente Montado',
    description: 'Cavaleiro. Bonus contra inimigos a pé. Protege a montaria.',
    benefit: [
      'Vantagem em ataques contra inimigos a pé menores que sua montaria',
      'Pode forçar ataque a montaria virar pra você',
      'Montaria evade área de efeito (save = 0 dano se passa)',
    ],
  },
  'spell-sniper': {
    id: 'spell-sniper', name: 'Atirador Mágico',
    description: 'Spells ataque dobram de alcance. Aprende cantrip de ataque novo.',
    prerequisite: { proficiency: 'spellcaster' },
    benefit: [
      'Range de spells de ataque × 2',
      'Spells ignoram cobertura 1/2 e 3/4',
      'Aprende 1 cantrip de ataque de qualquer classe',
    ],
  },
  athlete: {
    id: 'athlete', name: 'Atleta',
    description: 'Escala mais rápido. Salta mais longe. Levanta do chão com mov de 5ft.',
    benefit: [
      '+1 STR ou DEX',
      'Levanta do chão com 5ft de mov (não metade)',
      'Escala em velocidade total',
      'Standing long jump: STR (sem arrancada)',
    ],
    abilityIncrease: { des: 1 },
  },
  actor: {
    id: 'actor', name: 'Ator',
    description: 'Performance/Disfarce vantagem. Imita vozes. CHA +1.',
    benefit: [
      '+1 CHA',
      'Vantagem em Deception e Performance pra imitar',
      'Imita voz/forma de fala',
    ],
    abilityIncrease: { car: 1 },
  },
  durable: {
    id: 'durable', name: 'Vigoroso',
    description: 'Curas em descanso curto: mínimo de 2×CON mod.',
    benefit: [
      '+1 CON',
      'Hit Dice em rest curto: mínimo 2×CON mod por die',
    ],
    abilityIncrease: { con: 1 },
  },
  linguist: {
    id: 'linguist', name: 'Linguista',
    description: 'Aprende 3 línguas. Cria códigos. +1 INT.',
    benefit: [
      '+1 INT',
      'Aprende 3 línguas',
      'Cria códigos cifrados que só quem souber DC 20 INT (Investigation) decifra',
    ],
    abilityIncrease: { int: 1 },
  },
};

export const ALL_FEATS: FeatDef[] = Object.values(FEATS);

export function getFeat(id: FeatId): FeatDef {
  return FEATS[id];
}

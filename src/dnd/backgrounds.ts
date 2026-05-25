// JSgame · D&D 5e antecedentes (PHB cap 4, pág 127).
// 13 antecedentes principais. Cada um dá:
// - 2 perícias garantidas (proficiência)
// - 0-2 ferramentas / idiomas
// - Equipamento inicial
// - Uma característica especial (feature) descrita em PT

import type { SkillId } from './skills';

export type BackgroundId =
  | 'acolito' | 'artesao' | 'artista' | 'charlatao' | 'criminoso'
  | 'eremita' | 'forasteiro' | 'herois-do-povo' | 'marinheiro' | 'nobre'
  | 'orfao' | 'sabio' | 'soldado';

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  description: string;
  skillProficiencies: SkillId[];           // sempre 2 garantidas
  toolProficiencies: string[];             // 0-2
  languageCount: number;                   // 0-2 (escolhe ao criar)
  startingEquipment: string[];
  feature: { name: string; description: string };
  startingGold: number;                    // peças de ouro iniciais
}

export const BACKGROUNDS: Record<BackgroundId, BackgroundDef> = {
  acolito: {
    id: 'acolito',
    name: 'Acólito',
    description: 'Você serviu em um templo. Intermediário entre o divino e mortal. Conhece ritos e a hierarquia sagrada.',
    skillProficiencies: ['intuicao', 'religiao'],
    toolProficiencies: [],
    languageCount: 2,
    startingEquipment: ['Símbolo sagrado', 'Livro de preces', '5 varetas de incenso', 'Vestimentas', 'Roupas comuns'],
    feature: {
      name: 'Abrigo dos Fiéis',
      description: 'Você e seus aliados recebem cura/caridade gratuita em templos da sua fé. Estilo de vida modesto custeado.',
    },
    startingGold: 15,
  },

  artesao: {
    id: 'artesao',
    name: 'Artesão de Guilda',
    description: 'Membro de uma guilda. Mestre em um ofício (ferreiro, alquimista, joalheiro…). Conhece mercados e camaradas.',
    skillProficiencies: ['intuicao', 'persuasao'],
    toolProficiencies: ['1 ferramenta de artesão à escolha'],
    languageCount: 1,
    startingEquipment: ['Conjunto de ferramentas de artesão', 'Carta de apresentação da guilda', 'Roupas de viajante'],
    feature: {
      name: 'Associados da Guilda',
      description: 'Camaradas da guilda oferecem hospedagem e comida. Pagam funeral. Acesso a figuras políticas via guilda. Custa 5po/mês.',
    },
    startingGold: 15,
  },

  artista: {
    id: 'artista',
    name: 'Artista',
    description: 'Animou tavernas, palácios, ruas. Sabe ler plateia, encantar com palavra ou voz.',
    skillProficiencies: ['acrobacia', 'atuacao'],
    toolProficiencies: ['Kit de disfarce', '1 instrumento musical à escolha'],
    languageCount: 0,
    startingEquipment: ['Instrumento musical à escolha', 'Favor de admirador (carta, mecha de cabelo, bugiganga)', 'Fantasia'],
    feature: {
      name: 'Por Demanda Popular',
      description: 'Você atua de graça em tavernas em troca de comida + cama (modesto). Plateia te idolatra na cidade onde se apresentou.',
    },
    startingGold: 15,
  },

  charlatao: {
    id: 'charlatao',
    name: 'Charlatão',
    description: 'Mentiroso profissional. Vende remédios falsos, conta cartas, troca identidades. Conhece o golpe perfeito.',
    skillProficiencies: ['enganacao', 'prestidigitacao'],
    toolProficiencies: ['Kit de disfarce', 'Kit de falsificação'],
    languageCount: 0,
    startingEquipment: ['Roupas finas', 'Kit de disfarce', 'Ferramentas de trapaça (cartas marcadas / dados viciados / anel de selo falso)'],
    feature: {
      name: 'Identidade Falsa',
      description: 'Você tem uma 2ª identidade documentada (nome, profissão, cartas de recomendação). Pode forjar documentos com tempo + materiais.',
    },
    startingGold: 15,
  },

  criminoso: {
    id: 'criminoso',
    name: 'Criminoso',
    description: 'Ladrão, contrabandista, assassino, espião. Conhece o submundo, contatos sombrios, e a arte de não ser pego.',
    skillProficiencies: ['enganacao', 'furtividade'],
    toolProficiencies: ['Jogo de cartas OU dados', 'Ferramentas de ladrão'],
    languageCount: 0,
    startingEquipment: ['Pé-de-cabra', 'Roupas escuras com capuz', 'Algibeira'],
    feature: {
      name: 'Contato Criminoso',
      description: 'Você tem um contato confiável que age como elo entre você e outros criminosos. Sabe como mandar e receber mensagens sem ser detectado.',
    },
    startingGold: 15,
  },

  eremita: {
    id: 'eremita',
    name: 'Eremita',
    description: 'Viveu em isolamento. Em busca de revelação espiritual, conhecimento secreto, ou paz fora da civilização.',
    skillProficiencies: ['medicina', 'religiao'],
    toolProficiencies: ['Kit de herbalismo'],
    languageCount: 1,
    startingEquipment: ['Pergaminho com notas do seu estudo / oração', 'Cobertor de inverno', 'Roupas comuns', 'Kit de herbalismo'],
    feature: {
      name: 'Descoberta',
      description: 'Você descobriu uma verdade rara durante seu isolamento — segredo cósmico, magia esquecida, profecia. Decidam com o Mestre o quê.',
    },
    startingGold: 5,
  },

  forasteiro: {
    id: 'forasteiro',
    name: 'Forasteiro',
    description: 'Cresceu na natureza, longe de cidades. Sabe sobreviver, caçar, ler o céu. Tribos, ermos, montanhas.',
    skillProficiencies: ['atletismo', 'sobrevivencia'],
    toolProficiencies: ['1 instrumento musical à escolha'],
    languageCount: 1,
    startingEquipment: ['Cajado', 'Armadilha de caça', 'Troféu de animal abatido', 'Roupas de viajante'],
    feature: {
      name: 'Errante',
      description: 'Você tem memória excelente de mapas e geografia. Sempre consegue encontrar comida e água fresca pra si + 5 pessoas em terra selvagem.',
    },
    startingGold: 10,
  },

  'herois-do-povo': {
    id: 'herois-do-povo',
    name: 'Heróis do Povo',
    description: 'Veio de uma vila comum. Mas sempre foi diferente — destinado a feitos grandes. O povo reconhece um campeão em você.',
    skillProficiencies: ['adestrar-animais', 'sobrevivencia'],
    toolProficiencies: ['1 ferramenta de artesão à escolha', 'Veículos terrestres'],
    languageCount: 0,
    startingEquipment: ['Conjunto de ferramentas de artesão', 'Pá', 'Panela de ferro', 'Roupas comuns'],
    feature: {
      name: 'Hospitalidade Rústica',
      description: 'Pessoas comuns te dão hospedagem grátis (estilo modesto). Esconderão você de autoridades, contanto que não causem perigo.',
    },
    startingGold: 10,
  },

  marinheiro: {
    id: 'marinheiro',
    name: 'Marinheiro',
    description: 'Anos a bordo de navios. Conhece nós, ventos, motins. A maresia ainda gruda na sua barba.',
    skillProficiencies: ['atletismo', 'percepcao'],
    toolProficiencies: ['Ferramentas de navegação', 'Veículos aquáticos'],
    languageCount: 0,
    startingEquipment: ['Gato de ferro', '15m de corda de seda', 'Amuleto da sorte', 'Roupas comuns'],
    feature: {
      name: 'Passagem de Navio',
      description: 'Você arruma carona grátis pra si + companheiros em navio mercante. Tripulação te conhece — pode levar tempo pra chegar (segue rota do navio).',
    },
    startingGold: 10,
  },

  nobre: {
    id: 'nobre',
    name: 'Nobre',
    description: 'Sangue azul. Berço de privilégio. Etiqueta, política, intriga. Talvez você fugiu da família. Ou ainda serve a ela.',
    skillProficiencies: ['historia', 'persuasao'],
    toolProficiencies: ['1 jogo (xadrez/dados/cartas) à escolha'],
    languageCount: 1,
    startingEquipment: ['Roupas finas', 'Anel de selo familiar', 'Pergaminho de pedigree (linhagem)'],
    feature: {
      name: 'Posição de Privilégio',
      description: 'Pessoas comuns te tratam com deferência. Você consegue audiência com outros nobres. Hospedagem digna garantida.',
    },
    startingGold: 25,
  },

  orfao: {
    id: 'orfao',
    name: 'Órfão',
    description: 'Cresceu nas ruas. Roubando pra comer, fugindo de guardas. Aprendeu cedo: ninguém te salva — só você.',
    skillProficiencies: ['prestidigitacao', 'furtividade'],
    toolProficiencies: ['1 instrumento musical à escolha', 'Ferramentas de ladrão'],
    languageCount: 0,
    startingEquipment: ['Faca pequena', 'Mapa da cidade onde cresceu', 'Animalzinho de estimação (rato/cachorro/pássaro)', 'Roupas comuns'],
    feature: {
      name: 'Segredos da Cidade',
      description: 'Você conhece padrões secretos de uma grande cidade — atalhos, becos, esconderijos. Movimento 2x mais rápido em cidade que conhece.',
    },
    startingGold: 10,
  },

  sabio: {
    id: 'sabio',
    name: 'Sábio',
    description: 'Anos de estudo em bibliotecas, universidades, torres arcanas. Você sabe coisas — e sabe onde encontrar o que não sabe.',
    skillProficiencies: ['arcanismo', 'historia'],
    toolProficiencies: [],
    languageCount: 2,
    startingEquipment: ['Tinta', 'Pena de escrita', 'Faquinha de cortar penas', 'Carta de colega estudioso (pergunta sem resposta)', 'Vestes comuns'],
    feature: {
      name: 'Pesquisador',
      description: 'Quando você não sabe um fato — você sabe ONDE encontrá-lo. Biblioteca, universidade, sábio mais velho, plano alternativo.',
    },
    startingGold: 10,
  },

  soldado: {
    id: 'soldado',
    name: 'Soldado',
    description: 'Veterano de guerra. Conhece disciplina, cadeia de comando, e o peso da espada na cintura quando o tambor toca.',
    skillProficiencies: ['atletismo', 'intimidacao'],
    toolProficiencies: ['1 jogo (cartas/dados/xadrez) à escolha', 'Veículos terrestres'],
    languageCount: 0,
    startingEquipment: ['Insígnia de patente', 'Troféu de inimigo abatido (orelha/escudo/punho)', 'Jogo de cartas/dados', 'Roupas comuns'],
    feature: {
      name: 'Patente Militar',
      description: 'Você tem patente militar reconhecida. Soldados aliados te obedecem. Acesso a fortificações, suprimentos, e cavalgaduras militares.',
    },
    startingGold: 10,
  },
};

export function getBackground(id: BackgroundId): BackgroundDef {
  return BACKGROUNDS[id];
}

export const ALL_BACKGROUNDS: BackgroundDef[] = Object.values(BACKGROUNDS);

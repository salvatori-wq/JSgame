// JSgame · F1 — Cold opens background-aware pra primeira cena de sessão nova.
//
// Server-side templates por backgroundId (13 backgrounds, 13 cold opens
// pré-escritos). Substitui "Você está numa taverna" genérico por cena com
// TENSÃO REAL desde o segundo zero. Termina sempre com pendingCheck setado —
// player vê o dado, rola, sente.
//
// Pure function — sem LLM call, sem persistência, sem side effects.
// Substitui o primeiro narrate da sessão (Campaign.startSession).

import type { BackgroundId, SkillId } from '../shared/types.js';

export interface ColdOpen {
  narration: string;
  speaker: string;     // "Mestre"
  mood: 'sombrio' | 'sarcastico' | 'trickster' | 'neutral';
  pendingCheck: {
    skill: SkillId;
    dc: number;
    reason: string;
  };
}

// Cada template tem {name} placeholder pro nome do PJ.
const COLD_OPENS: Record<BackgroundId, Omit<ColdOpen, 'narration'> & { template: string }> = {
  soldado: {
    template:
      'Chuva fina. {name} marcha por um caminho que conhece de outra vida. À frente, três figuras encapuzadas barram a estrada. Mãos próximas das armas. Silêncio incomum — nenhum pássaro canta. Algo está errado antes mesmo do primeiro golpe.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'percepcao', dc: 12, reason: 'Notar a emboscada antes que ataquem' },
  },
  charlatao: {
    template:
      'O brutamonte com cicatriz no olho avança devagar. "Você roubou meu pai", ele rosna. {name} sequer reconhece o homem — mas o tom diz que isso não importa. Ele está atrás de você há semanas. A multidão se abriu. Ninguém vai ajudar.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'enganacao', dc: 14, reason: 'Convencer que ele se enganou de pessoa' },
  },
  sabio: {
    template:
      'Cela fria. Cheiro de mofo. A porta range, e o carcereiro joga um pergaminho aos pés de {name}. Está escrito em fenício antigo — runas que sangram nas pontas. "Lê", ele diz. "Se ler certo, talvez saia daqui."',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'arcanismo', dc: 13, reason: 'Decifrar o pergaminho rúnico' },
  },
  acolito: {
    template:
      'O abade do templo de {name} está morto — pescoço quebrado, mão estendida pra cruz. {name} foi a última pessoa a vê-lo vivo. Agora os outros irmãos cercam {name} em semicírculo, expressões frias. "Conte exatamente o que aconteceu", o mais velho ordena.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'persuasao', dc: 13, reason: 'Defender-se da suspeita dos irmãos' },
  },
  artesao: {
    template:
      'A oficina de {name} foi queimada esta noite. Cinzas ainda quentes. No meio dos escombros, um caco de cerâmica com brasão familiar — o brasão da casa Marfim. Vingança ou justiça? Os dedos de {name} tremem ao recolher o caco. As pegadas dos incendiários ainda estão visíveis na lama.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'investigacao', dc: 12, reason: 'Achar pistas além do caco' },
  },
  artista: {
    template:
      'O nobre Lorde Vexar está em pé, dedo em riste. A multidão silencia. A performance de {name} ofendeu — e a guarda já se aproxima. {name} tem segundos antes que sejam algemados. Talvez ainda dê pra recuperar o público — ou seria melhor correr.',
    speaker: 'Mestre',
    mood: 'sarcastico',
    pendingCheck: { skill: 'atuacao', dc: 14, reason: 'Reverter a multidão antes da prisão' },
  },
  criminoso: {
    template:
      'A patrulha alcançou {name} no beco sem saída. Quatro guardas. Trinta segundos antes de cercarem. {name} conhece estes telhados — pulou-os crianças atrás. Mas a perna ainda dói do último trabalho, e a noite mascara mal demais.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'furtividade', dc: 13, reason: 'Sumir antes que cerquem' },
  },
  eremita: {
    template:
      'Após dez anos no eremitério da montanha, {name} desce pela primeira vez. A vila ao pé deveria estar viva — chaminés fumegando, crianças nos campos. Está vazia. Cadáveres recentes. Algo grande passou — e talvez ainda esteja por perto.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'sobrevivencia', dc: 13, reason: 'Rastrear o que matou os aldeões' },
  },
  forasteiro: {
    template:
      'A floresta se abre numa clareira queimada. No centro, um símbolo gigante esculpido no chão — círculos concêntricos com runas que {name} nunca viu, mas reconhece de instinto. Algo respira no centro da clareira. Algo que não deveria existir.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'natureza', dc: 13, reason: 'Identificar o que produziu o símbolo' },
  },
  'herois-do-povo': {
    template:
      'A vila chamou {name}. O moinho de farinha está sangrando — literalmente. Líquido vermelho escorre pelas tábuas do segundo andar. Aldeões estão de mãos juntas na porta, esperando que {name} entre e resolva. Ninguém mais teve coragem.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'investigacao', dc: 12, reason: 'Descobrir o que está sangrando' },
  },
  marinheiro: {
    template:
      'A vela mestra rasgou. O céu virou breu. Capitão grita: "ANCORA OU CORRE?" — e a tripulação olha pra {name}, esperando decisão. A tempestade vai engolir o navio em minutos. O leme está duro, a corrente puxa pra recife.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'atletismo', dc: 12, reason: 'Manobrar o leme contra a corrente' },
  },
  nobre: {
    template:
      'O baile virou banho de sangue. O anfitrião — Lorde Castelar — caiu de costas, garganta aberta. {name} está em pé sobre ele, coberto do sangue. A faca caiu ao lado. A guarda vem aí, e nenhum dos nobres presentes está disposto a defender {name}.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'persuasao', dc: 14, reason: 'Convencer alguém da inocência' },
  },
  orfao: {
    template:
      'O homem errado. {name} percebeu tarde demais. A bolsa que roubou estava marcada, e ele seguiu {name} pelo beco até o fim. A adaga dele brilha sob a lanterna. Tem cicatrizes demais pra ser amador. As saídas: telhado acima, esgoto abaixo, ou enfrentar.',
    speaker: 'Mestre',
    mood: 'sombrio',
    pendingCheck: { skill: 'furtividade', dc: 13, reason: 'Escapar antes que ele alcance' },
  },
};

/**
 * Retorna um cold open completo pra começar a sessão.
 * Substitui {name} pelo nome do PJ. Pure function.
 */
export function getColdOpen(
  backgroundId: BackgroundId,
  characterName: string,
): ColdOpen {
  const template = COLD_OPENS[backgroundId];
  if (!template) {
    // Fallback genérico (não deveria acontecer — todos os 13 backgrounds têm templates)
    return {
      narration: `${characterName} desperta. O dia mal começou e algo já não parece certo. O ar tem um cheiro que não deveria estar aí. Algo vai acontecer.`,
      speaker: 'Mestre',
      mood: 'sombrio',
      pendingCheck: { skill: 'percepcao', dc: 12, reason: 'Notar o que está errado' },
    };
  }
  return {
    narration: template.template.replace(/\{name\}/g, characterName),
    speaker: template.speaker,
    mood: template.mood,
    pendingCheck: { ...template.pendingCheck },
  };
}

/** Lista IDs cobertos — útil pra testes garantirem que todos os backgrounds têm template. */
export function listCoveredBackgrounds(): BackgroundId[] {
  return Object.keys(COLD_OPENS) as BackgroundId[];
}

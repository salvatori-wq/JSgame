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
  /** Location curta pra setar state.currentLocation (impede arrastar de volta pra "taverna"). */
  locationLabel: string;
  pendingCheck: {
    skill: SkillId;
    dc: number;
    reason: string;
  };
}

// Cada template tem {name} placeholder pro nome do PJ.
// locationLabel: substitui o default "Início — taverna" no state pra que LLM
// subsequente nunca arraste de volta. Locations VARIADAS por design.
// Ω.8 — Cold opens reescritos com PT-BR impecável.
// Antes: nome do PJ repetido 2-3x ("Aelar... Aelar... Aelar"), frases truncadas
// ("pulou-os crianças atrás", "mascara mal demais"). Agora: nome só na 1ª
// menção, depois "você". Frases naturais, tom sombrio+sarcástico+trickster
// validado, detalhes sensoriais pra imersão imediata.
const COLD_OPENS: Record<BackgroundId, Omit<ColdOpen, 'narration'> & { template: string }> = {
  soldado: {
    template:
      'Chuva fina cai sobre a estrada. {name} reconhece o caminho — marchou aqui em outra vida, outra farda. À frente, três figuras encapuzadas bloqueiam a passagem. Mãos próximas das espadas, postura de quem já matou antes. Nenhum pássaro canta. O silêncio diz tudo.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Estrada sob chuva fina',
    pendingCheck: { skill: 'percepcao', dc: 12, reason: 'Notar a emboscada antes do primeiro golpe' },
  },
  charlatao: {
    template:
      'O brutamonte com a cicatriz no olho avança devagar pelo mercado. "Você roubou meu pai", ele rosna. {name} jura nunca ter visto o homem na vida — mas o ódio nos olhos dele diz que isso não importa. Ele te caça há semanas. A multidão abriu espaço. Ninguém vai te defender.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Praça do mercado, círculo de gente em volta',
    pendingCheck: { skill: 'enganacao', dc: 14, reason: 'Convencer que ele se enganou de pessoa' },
  },
  sabio: {
    template:
      'Cela fria, cheiro de mofo, ratos correndo nos cantos. A porta range, o carcereiro joga um pergaminho aos pés de {name}. Runas fenícias antigas — algumas sangram nas pontas, ainda úmidas. "Lê", ele diz, sem encarar. "Lê direito e talvez veja o sol de novo."',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Cela úmida da fortaleza',
    pendingCheck: { skill: 'arcanismo', dc: 13, reason: 'Decifrar o pergaminho rúnico' },
  },
  acolito: {
    template:
      'O abade está morto — pescoço quebrado, mão estendida em direção à cruz, como se tentasse alcançá-la no último segundo. {name} foi a última pessoa a vê-lo vivo. Os outros irmãos do templo te cercam em semicírculo, expressões frias como a pedra das paredes. "Conte exatamente o que aconteceu", o mais velho ordena. "E não minta."',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Nave do templo de pedra fria',
    pendingCheck: { skill: 'persuasao', dc: 13, reason: 'Defender-se da suspeita dos irmãos' },
  },
  artesao: {
    template:
      'A oficina de {name} foi queimada esta noite. As cinzas ainda estão quentes sob suas botas. No meio dos escombros, um caco de cerâmica com um brasão familiar gravado — Casa Marfim, a família mais rica da região. Vingança ou justiça? Suas mãos tremem ao recolher o caco. As pegadas dos incendiários ainda estão visíveis na lama do quintal.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Oficina incendiada, cinzas quentes',
    pendingCheck: { skill: 'investigacao', dc: 12, reason: 'Achar pistas além do caco' },
  },
  artista: {
    template:
      'Lorde Vexar está em pé, dedo em riste, rosto vermelho de raiva. A multidão silencia de uma vez. Sua performance ofendeu — pior, foi entendida. A guarda do nobre já se aproxima por trás, mãos nos cintos. {name} tem segundos antes do ferro frio nos pulsos. Talvez ainda dê pra reverter o público com uma última cartada. Ou seria mais sábio simplesmente correr.',
    speaker: 'Mestre',
    mood: 'sarcastico',
    locationLabel: 'Salão do nobre, fim da performance',
    pendingCheck: { skill: 'atuacao', dc: 14, reason: 'Reverter a multidão antes da prisão' },
  },
  criminoso: {
    template:
      'A patrulha encurralou {name} no beco sem saída. Quatro guardas avançam, lanternas em punho. Trinta segundos antes do cerco fechar. Você conhece esses telhados — pulava por eles quando moleque, antes da cana. Mas a perna ainda dói do último trabalho, e a noite não cobre tão bem quanto você lembrava.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Beco sem saída, telhados acima',
    pendingCheck: { skill: 'furtividade', dc: 13, reason: 'Sumir antes que cerquem' },
  },
  eremita: {
    template:
      'Dez anos no eremitério da montanha. {name} desce pela primeira vez ao mundo dos homens. A vila ao pé deveria estar viva — chaminés fumegando, crianças correndo entre os campos. Está vazia. Cadáveres recentes nas portas, ainda não cheiram. Algo grande passou por aqui há poucas horas. E talvez não tenha ido muito longe.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Vila ao pé da montanha, vazia e morta',
    pendingCheck: { skill: 'sobrevivencia', dc: 13, reason: 'Rastrear o que matou os aldeões' },
  },
  forasteiro: {
    template:
      'A floresta se abre numa clareira queimada, redonda demais pra ser natural. No centro, esculpido fundo na terra preta: círculos concêntricos com runas que {name} nunca viu — mas que reconhece de algum instinto antigo, herdado. Algo respira no meio do símbolo. Devagar. Pacientemente. Algo que não deveria estar acordado.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Clareira queimada com símbolo no chão',
    pendingCheck: { skill: 'natureza', dc: 13, reason: 'Identificar o que produziu o símbolo' },
  },
  'herois-do-povo': {
    template:
      'A vila chamou {name} pra resolver. O moinho de farinha está sangrando — não é metáfora, é literal. Líquido vermelho escuro escorre pelas tábuas do segundo andar, pinga no chão. Os aldeões estão de mãos juntas na porta, em silêncio, esperando que você entre. Ninguém mais teve coragem desde ontem.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Porta do moinho da vila, multidão atrás',
    pendingCheck: { skill: 'investigacao', dc: 12, reason: 'Descobrir o que está sangrando lá dentro' },
  },
  marinheiro: {
    template:
      'A vela mestra rasgou em dois. O céu virou breu numa hora que era pra ser tarde. O capitão grita do tombadilho: "ÂNCORA OU CORRE?" — e toda a tripulação vira a cabeça pra {name}, esperando a decisão. A tempestade vai engolir o navio em minutos. O leme está duro como pedra, a corrente puxando pro recife.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Convés do navio na tempestade',
    pendingCheck: { skill: 'atletismo', dc: 12, reason: 'Manobrar o leme contra a corrente' },
  },
  nobre: {
    template:
      'O baile virou banho de sangue. Lorde Castelar — o anfitrião — caiu de costas no mármore, garganta aberta de orelha a orelha. {name} está em pé sobre o corpo, manto encharcado de vermelho. A faca caiu ao seu lado. A guarda já vem pelo corredor, e nenhum dos outros nobres presentes vai erguer a voz pra te defender.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Salão do baile, anfitrião morto no chão',
    pendingCheck: { skill: 'persuasao', dc: 14, reason: 'Convencer alguém da sua inocência' },
  },
  orfao: {
    template:
      'Você escolheu o homem errado dessa vez. {name} percebeu tarde demais. A bolsa que roubou estava marcada — e o dono te seguiu pelo beco até o ponto onde não tem mais saída. A adaga dele cintila sob a luz da lanterna lá no fim. Cicatrizes demais nas mãos pra ser amador. Suas opções: telhado acima, esgoto abaixo, ou enfrentar de frente.',
    speaker: 'Mestre',
    mood: 'sombrio',
    locationLabel: 'Beco escuro, lanterna ao fundo',
    pendingCheck: { skill: 'furtividade', dc: 13, reason: 'Escapar antes que ele te alcance' },
  },
};

// Locations alternativas pra sessões coop / sessão 2+ / quando cold open não dispara.
// Server escolhe random — LLM vê a label e improvisa a cena. NUNCA "taverna".
const FALLBACK_LOCATIONS = [
  'Estrada de terra ao entardecer',
  'Entrada de ruína antiga, vento gélido',
  'Mercado fechando, lampiões acesos',
  'Borda de floresta sombria',
  'Ponte de pedra sobre rio negro',
  'Vila destruída, casas queimadas',
  'Cripta com sarcófagos abertos',
  'Templo abandonado, símbolos quebrados',
  'Acampamento à beira-fogueira',
  'Mina invadida, escoras quebradas',
  'Píer enevoado, navio atracado',
  'Praça de cidade, multidão tensa',
] as const;

/** Sorteia uma location alternativa quando cold open não se aplica. */
export function pickFallbackLocation(seed = Date.now()): string {
  const idx = Math.abs(seed | 0) % FALLBACK_LOCATIONS.length;
  return FALLBACK_LOCATIONS[idx]!;
}

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
      locationLabel: pickFallbackLocation(),
      pendingCheck: { skill: 'percepcao', dc: 12, reason: 'Notar o que está errado' },
    };
  }
  return {
    narration: template.template.replace(/\{name\}/g, characterName),
    speaker: template.speaker,
    mood: template.mood,
    locationLabel: template.locationLabel,
    pendingCheck: { ...template.pendingCheck },
  };
}

/** Lista IDs cobertos — útil pra testes garantirem que todos os backgrounds têm template. */
export function listCoveredBackgrounds(): BackgroundId[] {
  return Object.keys(COLD_OPENS) as BackgroundId[];
}

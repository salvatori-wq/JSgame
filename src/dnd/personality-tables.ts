// JSgame · η.2 — Personality Pools (PHB cap 4).
// Cada background tem 8 traits + 6 ideals + 6 bonds + 6 flaws.
// Wizard sorteia 2 traits + 1 ideal + 1 bond + 1 flaw (PHB pág 125).
// Tom fiel ao PHB pt-BR, adaptado pra mundo sombrio do JSgame.

import type { BackgroundId } from './backgrounds';

export interface PersonalityPool {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

export const PERSONALITY_POOLS: Record<BackgroundId, PersonalityPool> = {
  acolito: {
    traits: [
      'Cito passagens sagradas em cada conversa.',
      'Sou tolerante com pecadores — todos podem ser redimidos.',
      'Mergulho no estudo de textos religiosos — vejo o mundo através deles.',
      'Distraio-me com facilidade dos meus deveres litúrgicos.',
      'Modos cerimoniais em todas as situações — formal demais.',
      'Vejo presságios em todos os eventos.',
      'Nada destrói meu otimismo.',
      'Profecias guiam minhas ações.',
    ],
    ideals: [
      'Tradição — os antigos rituais devem ser preservados (Leal).',
      'Caridade — sempre ajudo os necessitados (Bom).',
      'Mudança — uma nova ordem deve nascer (Caótico).',
      'Poder — buscarei a maior autoridade na fé (Leal Mau).',
      'Fé — confio que a divindade me guia em tudo (Qualquer).',
      'Aspiração — me tornarei aquilo que sirvo (Qualquer).',
    ],
    bonds: [
      'Morri pelo templo — devo a vida aos clérigos.',
      'Tudo que faço é pela minha comunidade.',
      'Recuperarei uma relíquia perdida da minha fé.',
      'Destruirei aqueles que desonraram minha igreja.',
      'Sou o último membro vivo de minha ordem.',
      'Tenho dívida com quem me ensinou.',
    ],
    flaws: [
      'Julgo duramente — outros e a mim mesmo.',
      'Confio cegamente nas autoridades religiosas.',
      'Hipócrita — prego virtudes que não pratico.',
      'Suspeito de qualquer fé diferente da minha.',
      'Inflexível em interpretação literal.',
      'Visões me consomem — não consigo focar.',
    ],
  },

  artesao: {
    traits: [
      'Acredito que o trabalho duro vence qualquer obstáculo.',
      'Mestre na arte da matéria-prima e do produto.',
      'Sempre tenho uma sugestão prática pra cada situação.',
      'Calculista — penso no custo de cada decisão.',
      'Falo da minha guilda com orgulho excessivo.',
      'Detalho cada criação como se fosse a primeira vez.',
      'Sou econômico até demais — guardo moedas como tesouro.',
      'Acredito em justiça baseada em mérito.',
    ],
    ideals: [
      'Comunidade — minha guilda é minha família (Leal).',
      'Generosidade — meu sucesso é pra ajudar outros (Bom).',
      'Liberdade — todos merecem reger seus próprios destinos (Caótico).',
      'Ganância — sucesso material é tudo (Mau).',
      'Maestria — sou o melhor no meu ofício (Qualquer).',
      'Pessoas — quem cria, importa (Neutro).',
    ],
    bonds: [
      'Devo lealdade ao mestre que me ensinou.',
      'Minha guilda é mais importante que minha vida.',
      'Trabalho em obra-prima que me imortalizará.',
      'Resgatarei a herança da família perdida em desastre.',
      'Vinguei-me daqueles que destruíram minha oficina.',
      'Aprendi com minha família — quero honrá-los.',
    ],
    flaws: [
      'Não confio em quem não sabe trabalhar com as mãos.',
      'Obcecado por riquezas materiais.',
      'Esquento ao menor sinal de injustiça.',
      'Sempre faço promessas que não posso cumprir.',
      'Detesto qualquer crítica ao meu trabalho.',
      'Pensei apenas no lucro — perdi amigos.',
    ],
  },

  artista: {
    traits: [
      'Sei contar uma piada melhor que ninguém.',
      'Improviso poemas e canções de improviso.',
      'Sempre sei o que dizer pra encantar uma plateia.',
      'Tenho um problema sério com autoridade.',
      'Conheço uma fala perfeita pra cada situação.',
      'Já vivi mais do que vinte vidas de pessoas comuns.',
      'Choro com facilidade — meus sentimentos são teatro.',
      'Tudo é uma performance.',
    ],
    ideals: [
      'Beleza — a arte salva almas (Bom).',
      'Tradição — as antigas canções devem ressoar (Leal).',
      'Criatividade — o mundo precisa de obras novas (Caótico).',
      'Fama — preciso ser lembrado pela eternidade (Qualquer).',
      'Sinceridade — não me pinto além do que sou (Bom).',
      'Generosidade — entreterei a quem precisar de alegria (Bom).',
    ],
    bonds: [
      'Meu instrumento é minha vida — perdi tudo se o perder.',
      'Alguém roubou meus segredos artísticos — vou recuperar.',
      'Devo todo meu sucesso ao meu mentor falecido.',
      'Buscarei o palco mais importante de todos os reinos.',
      'Minha família foi assassinada — interpreto pra eles.',
      'Apaixonei-me pela rainha — viverei por essa lembrança.',
    ],
    flaws: [
      'Cairei se houver elogio fácil.',
      'Sou ciumento de qualquer artista melhor que eu.',
      'Cobro favores demais por minhas apresentações.',
      'Bebo quando estou triste — e estou sempre triste.',
      'Vejo todos como audiência potencial.',
      'Cometo as mesmas mentiras desde a juventude.',
    ],
  },

  charlatao: {
    traits: [
      'Falo com sotaque diferente cada vez que conheço alguém.',
      'Já tenho 3 identidades preparadas pra esse mês.',
      'Sempre sei achar o ponto fraco de cada pessoa.',
      'Trapaceio em qualquer jogo — não consigo evitar.',
      'Mudo de plano a cada hora — improviso é meu sangue.',
      'Estou sempre em movimento — parar é morrer.',
      'Vendo qualquer coisa, mesmo nada — especialmente nada.',
      'Estudo cada vítima como cientista estuda inseto.',
    ],
    ideals: [
      'Independência — ninguém me diz o que fazer (Caótico).',
      'Justiça — só roubo dos ricos e cruéis (Bom).',
      'Caridade — divido com quem precisa mais (Bom).',
      'Criatividade — cada golpe é arte (Caótico).',
      'Sobrevivência — mato ou morro (Neutro).',
      'Riqueza — só ouro importa (Mau).',
    ],
    bonds: [
      'Eu deveria proteger uma criança — falhei. Vou redimir.',
      'Devo tudo que sei a um vigarista lendário.',
      'Roubei do homem errado — agora me persegue.',
      'Tenho uma família secreta que precisa de mim.',
      'Minha vítima virou minha amada — não posso mais mentir pra ela.',
      'Vou enriquecer minha terra natal com o que roubo.',
    ],
    flaws: [
      'Nunca consigo resistir a um alvo fácil.',
      'Já gastei mais do que ganho — devo pra meio mundo.',
      'Sou facilmente reconhecido em certas cidades.',
      'Apaixono-me por minhas vítimas — sempre dá errado.',
      'Confio só em mim mesmo — e mal.',
      'Nunca aprendi a parar de mentir, nem pra aliados.',
    ],
  },

  criminoso: {
    traits: [
      'Planejo cada movimento com cuidado.',
      'Calculei a saída antes mesmo de entrar.',
      'Não falo muito — palavras são pistas.',
      'Sempre tenho uma lâmina escondida em algum lugar.',
      'Confio nos meus instintos — me salvaram tantas vezes.',
      'Aprecio o silêncio acima de tudo.',
      'Olho pra cada estranho como possível ameaça.',
      'Movo-me como sombra mesmo em multidão.',
    ],
    ideals: [
      'Honra — não traio meus camaradas (Leal).',
      'Liberdade — correntes não me prendem (Caótico).',
      'Caridade — roubo dos cruéis pra ajudar fracos (Bom).',
      'Ganância — mais ouro é sempre melhor (Mau).',
      'Pessoas — meu bando é minha família (Neutro).',
      'Redenção — provarei que sou mais que meu passado (Qualquer).',
    ],
    bonds: [
      'Vou pagar dívida com o homem que me salvou da forca.',
      'Roubei algo que preciso devolver antes de morrer.',
      'Quem matou meu mentor pagará com sangue.',
      'Tenho uma família escondida — protejo de longe.',
      'Faltam ouro pra livrar irmã caçula da escravidão.',
      'Vou recuperar herança que minha família perdeu pra nobres corruptos.',
    ],
    flaws: [
      'Quando estou desesperado, qualquer coisa parece justa.',
      'Quando bebo demais, falo demais.',
      'Sou impulsivo — atiro primeiro, raciocino depois.',
      'Não confio em ninguém — nem em mim mesmo.',
      'Tenho dívida grande com gente perigosa.',
      'Estou viciado em risco — sem ele não vivo.',
    ],
  },

  eremita: {
    traits: [
      'Falo pouco — quando falo, vale ouvir.',
      'Estudo profundamente cada novo lugar.',
      'Levo meu tempo pra decidir.',
      'Acolho o desconhecido sem preconceito.',
      'Falo com plantas e animais — eles respondem mais que humanos.',
      'Tenho hábitos místicos que confundem outros.',
      'Conheço silêncios mais úteis que palavras.',
      'Vejo presságios em sonhos.',
    ],
    ideals: [
      'Maior Bem — sirvo a algo além de mim (Bom).',
      'Lógica — emoções nublam julgamento (Leal).',
      'Liberdade — o eremitério escolhi por amor à independência (Caótico).',
      'Curiosidade — verdade vale qualquer sacrifício (Neutro).',
      'Conhecimento — aprender é a meta (Qualquer).',
      'Auto-conhecimento — primeiro me entenda (Neutro).',
    ],
    bonds: [
      'Nada importa mais que a verdade que descobri.',
      'Aprendi sobre uma profecia que poucos sabem.',
      'Vou voltar pra eremitério depois desta jornada.',
      'A vida me deu segredo — protegerei até morrer.',
      'Devo a vida àqueles que me acolheram no exílio.',
      'Vingarei os que destruíram o santuário.',
    ],
    flaws: [
      'Pego segredos pesados — não consigo soltar.',
      'Sou esquisito demais — não entendo civilidade.',
      'Vivi sozinho tanto que conversa demais me cansa.',
      'Sigo demais minha bússola interna — perco norte coletivo.',
      'Tenho fobia de cidades grandes.',
      'Acho que sei mais que todos — frequentemente erro.',
    ],
  },

  forasteiro: {
    traits: [
      'Comuno-me com a natureza como velho amigo.',
      'Sou parado e silencioso — economizo palavras.',
      'Tenho hábito de farejar o ar antes de entrar em ambientes.',
      'Não confio em paredes — prefiro o céu aberto.',
      'Posso ficar dias sem dormir — caça me ensinou.',
      'Conto minha história em metáforas da floresta.',
      'Como qualquer carne — qualquer uma.',
      'Estou sempre alerta — instinto não dorme.',
    ],
    ideals: [
      'Mudança — a natureza muda e a gente também (Caótico).',
      'Vida — proteger a vida em todas as formas (Bom).',
      'Honra — meu povo me ensinou códigos antigos (Leal).',
      'Sobrevivência — primeiro eu, depois o resto (Neutro).',
      'Liberdade — civilização aprisiona (Caótico).',
      'Natureza — terras não pertencem aos homens (Qualquer).',
    ],
    bonds: [
      'Minha aldeia foi destruída — preciso reerguer.',
      'Devo a um animal que me salvou quando criança.',
      'Vou proteger as terras dos meus antepassados.',
      'Há tribos perdidas que preciso encontrar.',
      'Devo viver dignamente pra honrar quem morreu por mim.',
      'A floresta me chama — sempre voltarei.',
    ],
    flaws: [
      'Estou desconfortável em qualquer cidade.',
      'Sou impaciente com civilidade desnecessária.',
      'Atinjo primeiro, pergunto depois — terras selvagens ensinam.',
      'Confio mais em animais que em humanos.',
      'Não consigo seguir liderança que não merece.',
      'Bebo demais quando sinto saudade.',
    ],
  },

  'herois-do-povo': {
    traits: [
      'Modesto — não gosto de elogios.',
      'Falo a verdade nua — boa ou má.',
      'Pratico bondade simples — pequenos gestos.',
      'Trabalho honesto vence preguiça.',
      'Conheço cada família da minha aldeia pelo nome.',
      'Defendo o fraco — instinto, não razão.',
      'Tenho fé num futuro melhor.',
      'Conto histórias do meu povo com orgulho.',
    ],
    ideals: [
      'Honra — minha palavra vale ouro (Leal).',
      'Bondade — o mundo precisa de mais (Bom).',
      'Mudança — o povo merece nova ordem (Caótico).',
      'Liberdade — todos merecem escolher seu destino (Caótico).',
      'Comunidade — a vila acima do indivíduo (Leal).',
      'Justiça — os opressores devem cair (Bom).',
    ],
    bonds: [
      'Minha família é tudo — luto por eles.',
      'Defenderei minha vila com a vida.',
      'Devo a alguém que me protegeu de menino.',
      'Vingarei os que arrasaram minha terra.',
      'Sou destinado a algo maior — sinto na alma.',
      'Acredito numa profecia sobre mim — provarei verdadeira.',
    ],
    flaws: [
      'Subestimo nobres — penso que todos são corruptos.',
      'Caminho cego quando vejo injustiça — ajo sem pensar.',
      'Tenho vergonha das minhas origens humildes.',
      'Confio demais em estranhos.',
      'Tenho dificuldade em receber ajuda.',
      'Acredito em destinos — fico paralisado em escolhas.',
    ],
  },

  marinheiro: {
    traits: [
      'Praguejo como — bem, marinheiro.',
      'Conto histórias de mar com gestos largos.',
      'Sempre tenho uma frase de capitão pra encerrar conversa.',
      'Faço amizades rápidas em qualquer porto.',
      'Trabalho duro e bebo com mais vontade ainda.',
      'Vejo cada cliente como possível tripulante.',
      'Confio em homens do mar mais que em qualquer outro.',
      'Tenho pavor secreto de afogamento.',
    ],
    ideals: [
      'Camaradagem — meus marujos são meu sangue (Leal).',
      'Liberdade — o mar não tem fronteiras (Caótico).',
      'Aspiração — terei meu próprio navio (Qualquer).',
      'Gratidão — quem me salvou no mar terá meu lado (Bom).',
      'Mestria — sou mestre nas águas (Neutro).',
      'Ouro — riqueza paga o silêncio do mar (Mau).',
    ],
    bonds: [
      'Devo lealdade ao capitão que me deu primeira chance.',
      'Sobrevivi a um naufrágio — preciso devolver favor à divindade do mar.',
      'Há tesouro perdido nos mares que vou encontrar.',
      'Minha família espera meu retorno num porto distante.',
      'Vingarei o ataque que matou meus camaradas.',
      'Há criatura marinha que me persegue — preciso enfrentar.',
    ],
    flaws: [
      'Bebo demais — sempre.',
      'Não sigo ordens facilmente em terra firme.',
      'Briga é meu primeiro recurso de diplomacia.',
      'Falo demais sobre mares que nunca naveguei.',
      'Tenho dívidas em três portos diferentes.',
      'Acho que todo mundo de terra é fraco.',
    ],
  },

  nobre: {
    traits: [
      'Tenho boas maneiras refinadas — uso sempre.',
      'Mantenho postura impecável em qualquer circunstância.',
      'Aposto que sou mais culto que qualquer presente.',
      'Conheço cada protocolo de cortes de pelo menos três reinos.',
      'Falo de família com orgulho excessivo.',
      'Acho que dinheiro resolve qualquer problema.',
      'Não suporto desonestidade — ofende minha linhagem.',
      'Sempre tenho criados ou amigos pra serviços menores.',
    ],
    ideals: [
      'Respeito — todos têm valor por seu papel (Bom).',
      'Responsabilidade — nobreza serve, não governa (Leal).',
      'Independência — escolho meu destino, não a família (Caótico).',
      'Poder — meu sangue manda (Leal Mau).',
      'Família — honro minha linhagem em tudo (Qualquer).',
      'Nobreza Obriga — uso meu poder pra proteger (Bom).',
    ],
    bonds: [
      'Vou recuperar a honra da família perdida em escândalo.',
      'Devo proteger o herdeiro do trono — está em fuga.',
      'Tenho uma irmã/o que preciso resgatar de inimigo poderoso.',
      'Restaurarei castelo destruído da família.',
      'Tenho um filho secreto que preciso reconhecer.',
      'Vou desmascarar nobre traidor que aniquilou minha casa.',
    ],
    flaws: [
      'Acho meu sangue superior — disfarço mal.',
      'Esnobe — gente comum me cansa.',
      'Não suporto perder — em jogos, debates, batalhas.',
      'Acumulo dívidas com banqueiros — finjo que não.',
      'Coleção de inimigos políticos é maior que de aliados.',
      'Já comprometi a honra da família com escândalo amoroso.',
    ],
  },

  orfao: {
    traits: [
      'Sou pequeno e ágil — passo despercebido.',
      'Confio em poucas pessoas — quem ganhou meu coração.',
      'Nunca falo de minha infância — dói demais.',
      'Aprendi a roubar pra comer — instinto sobrevive.',
      'Conheço cada beco, cada esgoto, cada esconderijo.',
      'Sorrio fácil pra desarmar suspeitas.',
      'Sou imediato — uso o que tem agora.',
      'Vejo crianças de rua como família distante.',
    ],
    ideals: [
      'Liberdade — ninguém me prende novamente (Caótico).',
      'Caridade — divido com quem precisa mais (Bom).',
      'Comunidade — quem sobreviveu comigo é minha família (Leal).',
      'Vingança — quem me fez sofrer pagará (Mau).',
      'Sobrevivência — eu vivo, mesmo se for sujo (Neutro).',
      'Esperança — talvez haja família verdadeira lá fora (Bom).',
    ],
    bonds: [
      'Vou descobrir quem foram meus pais reais.',
      'Devo lealdade ao chefe de gangue que me acolheu menino.',
      'Há crianças que protejo nas ruas — não posso falhar.',
      'Quero comprar minha liberdade de débito antigo.',
      'Quem traiu minha gangue pagará caro.',
      'Há um amigo de infância que preciso resgatar.',
    ],
    flaws: [
      'Roubo por impulso, mesmo sem precisar.',
      'Não confio em quem nunca passou fome.',
      'Bebo quando tenho dinheiro — gasto tudo de vez.',
      'Sou impaciente com sermões morais.',
      'Mata primeiro quando sente medo — antigo treino.',
      'Tenho pesadelos que me deixam violento ao acordar.',
    ],
  },

  sabio: {
    traits: [
      'Já existe livro sobre tudo — eu lerei.',
      'Cito autoridades em qualquer debate.',
      'Adoro provar que estou certo — e geralmente estou.',
      'Sou metódico — passo por passo.',
      'Pergunto antes de agir — sempre.',
      'Disperso em conversas — minha mente vagueia em hipóteses.',
      'Faço anotações de tudo.',
      'Cuido pouco de aparência — conhecimento é maior.',
    ],
    ideals: [
      'Conhecimento — entender é maior que ouro (Neutro).',
      'Beleza — verdade é beleza, e beleza é verdade (Bom).',
      'Lógica — emoção atrapalha (Leal).',
      'Sem Limites — nenhum conhecimento deve ser proibido (Caótico).',
      'Poder — saber é poder (Mau).',
      'Auto-melhoria — sempre cresço (Qualquer).',
    ],
    bonds: [
      'Quero recuperar manuscrito perdido.',
      'Devo a antigo mestre que me educou.',
      'Há uma teoria que vou provar custe o que custar.',
      'Minha biblioteca foi queimada — vou reconstruir.',
      'Buscarei a verdade sobre profecia antiga.',
      'Tenho dever de pesquisa que ninguém entende.',
    ],
    flaws: [
      'Não sei o quão pouco sei — finjo onisciência.',
      'Sou desastrado em situações sociais.',
      'Distrações me consomem — começo mil projetos.',
      'Acho leigos burros — mostro isso facilmente.',
      'Esqueço da realidade quando estudo.',
      'Não admito quando estou errado.',
    ],
  },

  soldado: {
    traits: [
      'Conheço todos os xingamentos de soldado em três línguas.',
      'Trato qualquer um como cadete — bom ou mau.',
      'Comando facilmente — instinto, não escolha.',
      'Aprecio disciplina rigorosa.',
      'Tenho cicatrizes pra cada história que conto.',
      'Bebo com camaradas, em silêncio com inimigos.',
      'Tenho rotina militar — não rompo nem em férias.',
      'Vejo cada ambiente como campo de batalha potencial.',
    ],
    ideals: [
      'Maior Bem — sirvo aquilo que protege o povo (Bom).',
      'Responsabilidade — sou útil onde colocaram (Leal).',
      'Independência — só me submeto a quem merece (Caótico).',
      'Força — fraqueza é fraqueza (Mau).',
      'Honra — cumpro minha palavra (Leal).',
      'Comunidade — protejo minha gente (Bom).',
    ],
    bonds: [
      'Devo a vida ao sargento que me salvou.',
      'Meus camaradas mortos pedem vingança.',
      'Vou encontrar o desertor que abandonou minha unidade.',
      'A guerra acabou pra outros — pra mim, nunca.',
      'Devo proteger família de soldado caído.',
      'Recuperarei o estandarte da minha unidade.',
    ],
    flaws: [
      'Resolvo tudo com violência — é meu reflexo.',
      'Não posso recusar uma boa briga.',
      'Bebo até esquecer o que vi na guerra.',
      'Acho que civis não entendem nada.',
      'Sigo ordens sem questionar — mesmo as ruins.',
      'Tenho pesadelos que me acordam gritando.',
    ],
  },
};

export function getPersonalityPool(bgId: BackgroundId): PersonalityPool {
  return PERSONALITY_POOLS[bgId];
}

/** Sorteia um conjunto aleatório PHB: 2 traits + 1 ideal + 1 bond + 1 flaw. */
export function rollRandomPersonality(bgId: BackgroundId): {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
} {
  const pool = PERSONALITY_POOLS[bgId];
  const t = sample(pool.traits, 2);
  const i = sample(pool.ideals, 1);
  const b = sample(pool.bonds, 1);
  const f = sample(pool.flaws, 1);
  return { traits: t, ideals: i, bonds: b, flaws: f };
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

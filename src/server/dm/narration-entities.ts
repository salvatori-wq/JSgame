// Cenas com peso — Extrai entidades narrativas (NPCs visíveis, landmarks)
// da última narração do Mestre. Usado pra gerar chips contextuais quando
// suggest_actions do DM falha ou está vazio.
//
// Estratégia: regex defensivo. Não-LLM, fast, sem dependências externas.
// NPCs: palavras capitalizadas precedidas/seguidas de verbos de fala/ação,
//       OU substantivos de papel ("guarda", "taverneiro", "homem", etc).
// Landmarks: substantivos comuns de cenário (porta, baú, altar, etc).
//
// Retorna até 3 NPCs + 3 landmarks ordenados por proeminência (ordem de
// aparição na narração).

export interface NarrationEntities {
  npcs: string[];        // ex: ["guarda", "taverneiro", "Lorde Vexar"]
  landmarks: string[];   // ex: ["porta", "baú", "altar"]
}

// Substantivos que identificam NPCs por PAPEL (não nome próprio).
// Detectados em lowercase; chip vira "Falar com o guarda".
const NPC_ROLES = [
  'guarda', 'taverneiro', 'homem', 'mulher', 'velho', 'velha', 'menino',
  'menina', 'mendigo', 'soldado', 'capitão', 'capitao', 'mercador',
  'lojista', 'cliente', 'estranho', 'forasteiro', 'monge', 'sacerdote',
  'padre', 'abade', 'bispo', 'rei', 'rainha', 'príncipe', 'principe',
  'princesa', 'cavaleiro', 'arqueiro', 'mago', 'feiticeiro', 'curandeira',
  'curandeiro', 'aldeão', 'aldeao', 'aldeã', 'aldea', 'caçador', 'cacador',
  'ferreiro', 'carcereiro', 'nobre', 'lacaio', 'servo', 'criado', 'patrão',
  'patrao', 'chefe', 'líder', 'lider', 'oficial', 'tenente',
];

// Substantivos de landmark — coisas que dá pra investigar/interagir.
const LANDMARK_NOUNS = [
  'porta', 'baú', 'bau', 'janela', 'parede', 'altar', 'escada', 'túmulo',
  'tumulo', 'fechadura', 'pergaminho', 'símbolo', 'simbolo', 'corpo',
  'cadáver', 'cadaver', 'mesa', 'cadeira', 'fogueira', 'tocha', 'lanterna',
  'caixa', 'armário', 'armario', 'estante', 'livro', 'tomo', 'estátua',
  'estatua', 'fonte', 'poço', 'poco', 'ponte', 'portão', 'portao', 'gradil',
  'porta secreta', 'alçapão', 'alçapao', 'alcapao', 'sarcófago', 'sarcofago',
  'esqueleto', 'caco', 'caixote', 'tonel', 'barril', 'saco', 'bolsa', 'mapa',
  'runa', 'glifo', 'inscrição', 'inscricao', 'arma', 'machado', 'espada',
  'arco', 'adaga', 'escudo', 'armadura', 'poção', 'pocao', 'frasco', 'urna',
];

const NPC_ROLES_SET = new Set(NPC_ROLES);
const LANDMARK_NOUNS_SET = new Set(LANDMARK_NOUNS);

/**
 * Normaliza palavra: lowercase + remove acentos comuns + tira pontuação adjacente.
 * "Taverneiro," → "taverneiro". "Águia." → "aguia".
 */
function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove combining diacriticals
    .replace(/[^\w-]/g, '');
}

/**
 * Extrai NPCs + landmarks de uma narração.
 * Pure function — sem side effects, fast.
 */
export function extractNarrationEntities(narration: string): NarrationEntities {
  const npcs: string[] = [];
  const landmarks: string[] = [];
  const seenNpcs = new Set<string>();
  const seenLandmarks = new Set<string>();

  // Split em tokens preservando words com acentos
  const tokens = narration.split(/[\s,.!?;:"'`()\[\]{}—–-]+/);

  // 1) Nomes próprios (palavras Capitalizadas que NÃO são início de frase comum)
  //    Heurística simples: capitalizada + tem >2 letras + não é stop-word comum.
  const STOP_CAPS = new Set([
    'Você', 'Voce', 'A', 'O', 'As', 'Os', 'Um', 'Uma', 'Uns', 'Umas',
    'De', 'Da', 'Do', 'Das', 'Dos', 'Em', 'Na', 'No', 'Nas', 'Nos',
    'Mas', 'E', 'Ou', 'Se', 'Que', 'Quem', 'Quando', 'Onde', 'Como',
    'Por', 'Para', 'Pra', 'Com', 'Sem', 'Sobre', 'Algo', 'Alguém', 'Alguem',
    'Tem', 'É', 'E', 'São', 'Sao', 'Está', 'Esta', 'Estão', 'Estao',
    'Mestre', 'Esse', 'Essa', 'Este', 'Esta', 'Esses', 'Essas', 'Isso',
    'Há', 'Ha', 'Não', 'Nao', 'Sim', 'Já', 'Ja',
  ]);
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]/.test(tok)) continue;
    if (STOP_CAPS.has(tok)) continue;
    const cleaned = tok.replace(/[.,;:!?"']+$/, '');
    if (seenNpcs.has(cleaned)) continue;
    seenNpcs.add(cleaned);
    npcs.push(cleaned);
    if (npcs.length >= 3) break;
  }

  // 2) NPCs por papel (lowercase) — só adiciona se não já tem 3 npcs próprios
  if (npcs.length < 3) {
    for (const tok of tokens) {
      const norm = normalize(tok);
      if (norm.length < 3) continue;
      if (NPC_ROLES_SET.has(norm) && !seenNpcs.has(norm)) {
        seenNpcs.add(norm);
        npcs.push(norm);
        if (npcs.length >= 3) break;
      }
    }
  }

  // 3) Landmarks
  for (const tok of tokens) {
    const norm = normalize(tok);
    if (norm.length < 3) continue;
    if (LANDMARK_NOUNS_SET.has(norm) && !seenLandmarks.has(norm)) {
      seenLandmarks.add(norm);
      landmarks.push(norm);
      if (landmarks.length >= 3) break;
    }
  }

  return { npcs, landmarks };
}

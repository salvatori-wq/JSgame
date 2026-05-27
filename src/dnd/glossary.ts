// JSgame · κ.2 — Glossário D&D pt-BR.
// Termos centrais explicados em linguagem coloquial. Usado em modal global
// (overflow → "?") e em links inline ("o que é DC?" → abre direto na entrada).

export interface GlossaryEntry {
  /** Termo principal (display). */
  term: string;
  /** Aliases pra search (DC, classe de dificuldade, dificuldade). */
  aliases?: string[];
  /** Categoria pra agrupar visualmente. */
  category: 'rolagem' | 'combate' | 'magia' | 'condicao' | 'social' | 'progressao' | 'descanso';
  /** Explicação em PT-BR coloquial (2-4 frases). */
  description: string;
  /** Exemplo curto (1 frase). */
  example?: string;
  /** Referência PHB pra player querer aprofundar. */
  phbRef?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  // ──────────────── Rolagem ────────────────
  {
    term: 'DC',
    aliases: ['classe de dificuldade', 'dificuldade'],
    category: 'rolagem',
    description: 'Classe de Dificuldade. O número que sua rolagem precisa igualar ou superar pra ter sucesso. Trivial: 5. Fácil: 10. Médio: 15. Difícil: 20. Impossível: 25-30.',
    example: 'DC 15 de Atletismo pra escalar um muro liso.',
    phbRef: 'PHB pág 174',
  },
  {
    term: 'AC',
    aliases: ['classe de armadura', 'CA', 'armor class'],
    category: 'combate',
    description: 'Classe de Armadura. Quanto MAIS difícil é te acertar. Atacante rola d20 + bônus dele — precisa igualar ou superar sua AC pra acertar.',
    example: 'CA 16 = atacante precisa rolar 16+ no d20+bônus pra acertar.',
    phbRef: 'PHB pág 14',
  },
  {
    term: 'Nat 20',
    aliases: ['natural 20', '20 natural', 'crit'],
    category: 'rolagem',
    description: 'Quando o d20 cai em 20 (sem somar nada). Em ATAQUES = crítico (dado de dano dobra). Em skill checks = sucesso espetacular (mas não auto-success por PHB RAW).',
    example: 'Rolou 20 no ataque com espada longa: 2d8 em vez de 1d8.',
    phbRef: 'PHB pág 196',
  },
  {
    term: 'Nat 1',
    aliases: ['natural 1', 'fumble'],
    category: 'rolagem',
    description: 'Quando o d20 cai em 1. Em ATAQUES = miss automático. Em outros rolls = falha (mas não morte). DM pode narrar complicação extra.',
    example: 'Nat 1 ao escalar = você cai 3m, faz barulho e alerta o guarda.',
    phbRef: 'PHB pág 196',
  },
  {
    term: 'Vantagem',
    aliases: ['advantage', 'vant'],
    category: 'rolagem',
    description: 'Rola 2d20 e PEGA O MAIOR. Acontece quando você tem condição favorável: aliado ajudando (Help), inimigo caído (melee), você invisível atacando, etc.',
    example: 'Cego ataca = você ataca com vantagem.',
    phbRef: 'PHB pág 174',
  },
  {
    term: 'Desvantagem',
    aliases: ['disadvantage', 'desv'],
    category: 'rolagem',
    description: 'Rola 2d20 e PEGA O MENOR. Acontece em condições ruins: você cego, atacando ranged em melee, exausto, prone fazendo ataque ranged, etc. Vantagem + desvantagem CANCELAM (rola normal).',
    phbRef: 'PHB pág 174',
  },
  {
    term: 'Modificador',
    aliases: ['mod', 'modifier'],
    category: 'rolagem',
    description: 'Soma ou subtração no d20 baseada em ability score. Fórmula: floor((score - 10) / 2). Score 10 = mod 0; 14 = +2; 18 = +4; 20 = +5.',
    example: 'FOR 16 = mod +3. Ataque com espada: d20 + 3 + prof.',
    phbRef: 'PHB pág 13',
  },
  {
    term: 'Bônus de Proficiência',
    aliases: ['prof bonus', 'proficiência', 'proficiency'],
    category: 'progressao',
    description: 'Bônus que aplicas em rolls onde és PROFICIENTE: ataques com armas que conheces, skills treinadas, saves de sua classe. Escala com nível: +2 (nv 1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17+).',
    phbRef: 'PHB pág 15',
  },

  // ──────────────── Combate ────────────────
  {
    term: 'Initiative',
    aliases: ['iniciativa'],
    category: 'combate',
    description: 'Rolagem d20 + DEX mod no início do combate pra determinar ordem dos turnos. Quem rola mais alto age primeiro.',
    phbRef: 'PHB pág 189',
  },
  {
    term: 'Ação',
    aliases: ['action'],
    category: 'combate',
    description: 'O que você faz como AÇÃO PRINCIPAL no turno: Atacar, Lançar Magia, Esquivar (Dodge), Correr (Dash), Recuar (Disengage), Ajudar (Help), Esconder, Procurar, Usar Objeto. 1 por turno.',
    phbRef: 'PHB pág 192',
  },
  {
    term: 'Ação Bônus',
    aliases: ['bonus action', 'ação bonus'],
    category: 'combate',
    description: 'Ação extra POR TURNO se uma feature/spell te der (NÃO ganha de graça). Ex: Two-Weapon Fighting, Healing Word, Misty Step.',
    phbRef: 'PHB pág 189',
  },
  {
    term: 'Reação',
    aliases: ['reaction'],
    category: 'combate',
    description: 'UMA ação por ROUND (não turno) — usável fora do seu turno. Mais comuns: Ataque de Oportunidade (inimigo sai do alcance), Shield (caster gasta slot pra +5 CA), Counterspell, Hellish Rebuke.',
    phbRef: 'PHB pág 190',
  },
  {
    term: 'Movimento',
    aliases: ['speed'],
    category: 'combate',
    description: 'Pés de deslocamento no turno (default 30ft pra humanos). Pode dividir entre antes/depois de outras ações. Anão = 25ft; Monk = 30+. Disparada (Dash) dobra.',
    phbRef: 'PHB pág 191',
  },
  {
    term: 'AoE',
    aliases: ['área de efeito', 'area of effect'],
    category: 'combate',
    description: 'Área de Efeito. Spells/habilidades que afetam zona em vez de alvo único: cone, esfera, cilindro, linha. Alvos rolam save pra resistir.',
    example: 'Bola de Fogo: esfera 20ft. Todos dentro fazem DES save pra metade do dano.',
    phbRef: 'PHB pág 204',
  },

  // ──────────────── Magia ────────────────
  {
    term: 'Cantrip',
    aliases: ['cantripo', 'spell nv 0', 'truque'],
    category: 'magia',
    description: 'Magia de nível 0. NÃO gasta slot. Pode ser lançada infinitamente. Escala com level do caster. Ex: Fire Bolt, Sacred Flame, Mage Hand.',
    phbRef: 'PHB pág 201',
  },
  {
    term: 'Slot',
    aliases: ['spell slot', 'slot mágico'],
    category: 'magia',
    description: 'Capacidade de lançar magia. Cada slot tem um NÍVEL (1-9). Lança spell nv X gastando slot de nv X+ . Magos têm 4 slots nv 1 + 3 nv 2... Long rest restaura tudo.',
    example: 'Mago nv 5 tem 4/3/2 slots (nv 1/2/3).',
    phbRef: 'PHB pág 201',
  },
  {
    term: 'Upcast',
    aliases: ['upcasting'],
    category: 'magia',
    description: 'Lançar uma spell de nível X usando slot de nível MAIOR pra efeito amplificado. Ex: Magic Missile nv 1 usado em slot nv 3 = 5 mísseis em vez de 3.',
    phbRef: 'PHB pág 201',
  },
  {
    term: 'Save DC',
    aliases: ['DC da magia'],
    category: 'magia',
    description: 'DC do save vs sua magia. Fórmula: 8 + prof bonus + casting ability mod. Alvos rolam save vs essa DC. Falhou = sofre efeito completo.',
    example: 'Mago INT 18 nv 5 = DC 8 + 3 + 4 = 15.',
    phbRef: 'PHB pág 205',
  },
  {
    term: 'Concentração',
    aliases: ['concentration'],
    category: 'magia',
    description: 'Magias com "Concentration" exigem foco. Só UMA por vez. Quebra se: receber dano (save CON DC max(10, dmg/2)), ficar inconsciente, lançar outra magia de concentração.',
    example: 'Bless é concentração — perdeu ela, perde o buff em todos aliados.',
    phbRef: 'PHB pág 203',
  },
  {
    term: 'Ritual',
    category: 'magia',
    description: 'Algumas magias têm tag "ritual" — podem ser lançadas SEM gastar slot, mas levam 10 minutos extras. Só fora de combate. Útil pra magias utilitárias diárias (Detect Magic, Identify).',
    phbRef: 'PHB pág 201',
  },

  // ──────────────── Condições ────────────────
  {
    term: 'Condição',
    aliases: ['condition'],
    category: 'condicao',
    description: 'Estado mecânico que afeta comportamento: caído, envenenado, paralisado, etc. PHB tem 14 condições padrão. Aplicam efeitos específicos durante duração.',
    phbRef: 'PHB Apêndice A',
  },
  {
    term: 'Inconsciente',
    aliases: ['unconscious'],
    category: 'condicao',
    description: 'HP = 0. Cai no chão. Falha auto save STR/DEX. Ataques contra você têm vantagem. Crit automático se ataque corpo-a-corpo a 1.5m. Faz Death Saves.',
    phbRef: 'PHB pág 291',
  },
  {
    term: 'Death Save',
    aliases: ['save de morte', 'rolagem de morte'],
    category: 'condicao',
    description: 'Quando HP=0, role d20 a cada turno. 10+ = sucesso. 3 sucessos = estabiliza (inconsciente mas vivo). 3 falhas = morte. Nat 20 = ganha 1 HP. Nat 1 = 2 falhas de uma vez.',
    phbRef: 'PHB pág 197',
  },
  {
    term: 'Exaustão',
    aliases: ['exhaustion'],
    category: 'condicao',
    description: '6 níveis cumulativos. Nv 1: desvant em testes. Nv 2: speed/2. Nv 3: desvant em ataques+saves. Nv 4: HP máx/2. Nv 5: speed 0. Nv 6: morte. Long rest -1 nível.',
    phbRef: 'PHB pág 291',
  },

  // ──────────────── Social/Skills ────────────────
  {
    term: 'Skill Check',
    aliases: ['teste de perícia', 'rolagem de perícia'],
    category: 'rolagem',
    description: 'd20 + mod ability + (prof bonus se proficiente em skill) vs DC. Skills: Atletismo, Acrobacia, Furtividade, Percepção, Investigação, Persuasão, etc. (18 totais).',
    phbRef: 'PHB pág 174',
  },
  {
    term: 'Save Throw',
    aliases: ['saving throw', 'teste de resistência'],
    category: 'rolagem',
    description: 'd20 + mod ability + (prof se proficiente) vs DC. Resistir a magia, veneno, queda, etc. Cada classe é proficiente em 2 saves (PHB pág 15).',
    phbRef: 'PHB pág 179',
  },
  {
    term: 'Passive Score',
    aliases: ['perception passiva', 'passive'],
    category: 'rolagem',
    description: 'Score = 10 + mod skill. Usado SILENCIOSAMENTE pelo DM pra detecções automáticas (passive Perception detecta emboscadas; passive Insight detecta mentiras).',
    phbRef: 'PHB pág 175',
  },
  {
    term: 'Inspiração',
    aliases: ['inspiration'],
    category: 'rolagem',
    description: 'Recurso DM concede por bom roleplay. Você gasta antes de rolar pra ganhar vantagem em UM d20. Max 1 por vez (default) ou até 3 (variante).',
    phbRef: 'PHB pág 125',
  },

  // ──────────────── Progressão ────────────────
  {
    term: 'Level Up',
    aliases: ['subir de nível', 'level up'],
    category: 'progressao',
    description: 'XP suficiente → sobe 1 nível. Ganha HP (avg hit die + CON mod), novos features de classe, possivelmente novos slots. Em nv 4/8/12/16/19 (mais 6/14 Fighter, 10 Rogue): ASI ou Feat.',
    phbRef: 'PHB pág 15',
  },
  {
    term: 'ASI',
    aliases: ['ability score improvement'],
    category: 'progressao',
    description: 'Ability Score Improvement. +2 num atributo OU +1 em dois. Cap em 20 (sem magic items). Acontece em nv 4/8/12/16/19. Pode trocar por Feat (talento).',
    phbRef: 'PHB pág 15',
  },
  {
    term: 'Feat',
    aliases: ['talento'],
    category: 'progressao',
    description: 'Talento opcional em vez de ASI. Cada feat dá habilidades únicas: Alert (+5 init), Tough (+2 HP/nv), Lucky (3 rerolls/dia), Sentinel (oportunidades), etc. PHB cap 6.',
    phbRef: 'PHB pág 165',
  },

  // ──────────────── Descanso ────────────────
  {
    term: 'Short Rest',
    aliases: ['descanso curto'],
    category: 'descanso',
    description: '1 hora descansando. Você pode gastar Hit Dice (rolando + CON mod) pra recuperar HP. Bruxo restaura spell slots. Outras features curtas (Action Surge, Channel Divinity, Ki).',
    phbRef: 'PHB pág 186',
  },
  {
    term: 'Long Rest',
    aliases: ['descanso longo'],
    category: 'descanso',
    description: '8 horas (6h dormindo + 2h leves). Restaura HP cheio, todos os slots, metade dos Hit Dice usados, todas as features de classe. Exhaustion -1.',
    phbRef: 'PHB pág 186',
  },
  {
    term: 'Hit Dice',
    aliases: ['dado de vida', 'HD'],
    category: 'descanso',
    description: 'Você tem N dados (= seu nível) do tipo do hit die da classe (d6/d8/d10/d12). Gasta em short rest pra curar (roll + CON mod). Long rest restaura metade.',
    example: 'Guerreiro nv 5 tem 5d10. Gasta 2 em short rest pra rolar 2d10 + 2×CON.',
    phbRef: 'PHB pág 186',
  },
];

/** Search por termo OU alias OU partial match em descrição. */
export function searchGlossary(query: string): GlossaryEntry[] {
  if (!query.trim()) return GLOSSARY;
  const q = query.toLowerCase().trim();
  return GLOSSARY.filter((e) => {
    if (e.term.toLowerCase().includes(q)) return true;
    if (e.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    if (e.description.toLowerCase().includes(q)) return true;
    if (e.category === q) return true;
    return false;
  });
}

/** Find por término exato (case-insensitive). */
export function findGlossaryEntry(term: string): GlossaryEntry | undefined {
  const t = term.toLowerCase();
  return GLOSSARY.find((e) =>
    e.term.toLowerCase() === t ||
    e.aliases?.some((a) => a.toLowerCase() === t),
  );
}

export const GLOSSARY_CATEGORIES: Record<GlossaryEntry['category'], string> = {
  rolagem: 'Rolagens & Dados',
  combate: 'Combate',
  magia: 'Magia',
  condicao: 'Condições',
  social: 'Social',
  progressao: 'Progressão',
  descanso: 'Descanso',
};

// JSgame · D&D 5e perícias (PHB cap 7, pág 177).
// 18 perícias mapeadas pra atributo associado. Player tem proficiência em
// algumas (ganha bônus de proficiência no teste); resto rola só com modifier.

import type { AbilityKey } from './attributes';

export type SkillId =
  | 'acrobacia' | 'adestrar-animais' | 'arcanismo' | 'atletismo' | 'atuacao'
  | 'enganacao' | 'furtividade' | 'historia' | 'intimidacao' | 'intuicao'
  | 'investigacao' | 'medicina' | 'natureza' | 'percepcao' | 'persuasao'
  | 'prestidigitacao' | 'religiao' | 'sobrevivencia';

export interface SkillDef {
  id: SkillId;
  name: string;
  ability: AbilityKey;
  description: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  acrobacia: {
    id: 'acrobacia', name: 'Acrobacia', ability: 'des',
    description: 'Manter equilíbrio, mergulhos, cambalhotas, fugir de agarrões.',
  },
  'adestrar-animais': {
    id: 'adestrar-animais', name: 'Adestrar Animais', ability: 'sab',
    description: 'Acalmar montaria, ler intenções de animais, treinar bichos domésticos.',
  },
  arcanismo: {
    id: 'arcanismo', name: 'Arcanismo', ability: 'int',
    description: 'Identificar magias, conhecer tradições arcanas, planos elementais, criaturas mágicas.',
  },
  atletismo: {
    id: 'atletismo', name: 'Atletismo', ability: 'for',
    description: 'Escalar, saltar, nadar, agarrar adversário, levantar peso.',
  },
  atuacao: {
    id: 'atuacao', name: 'Atuação', ability: 'car',
    description: 'Música, dança, oratória, atuação teatral — entreter ou comover plateia.',
  },
  enganacao: {
    id: 'enganacao', name: 'Enganação', ability: 'car',
    description: 'Mentir verbalmente ou via ações; trapacear no jogo; disfarçar a verdade.',
  },
  furtividade: {
    id: 'furtividade', name: 'Furtividade', ability: 'des',
    description: 'Esconder-se, mover-se sem ser ouvido, deslizar pelas sombras.',
  },
  historia: {
    id: 'historia', name: 'História', ability: 'int',
    description: 'Lembrar de eventos, reinos perdidos, guerras antigas, civilizações desaparecidas.',
  },
  intimidacao: {
    id: 'intimidacao', name: 'Intimidação', ability: 'car',
    description: 'Influenciar via ameaça, hostilidade física, demonstração de violência.',
  },
  intuicao: {
    id: 'intuicao', name: 'Intuição', ability: 'sab',
    description: 'Perceber mentiras, ler emoções, prever intenções, sentir desconforto alheio.',
  },
  investigacao: {
    id: 'investigacao', name: 'Investigação', ability: 'int',
    description: 'Procurar pistas, deduzir causas, encontrar passagens secretas, montar puzzle.',
  },
  medicina: {
    id: 'medicina', name: 'Medicina', ability: 'sab',
    description: 'Estabilizar moribundos, diagnosticar doenças, identificar causa da morte.',
  },
  natureza: {
    id: 'natureza', name: 'Natureza', ability: 'int',
    description: 'Conhecer fauna, flora, clima, ciclos naturais, plantas medicinais.',
  },
  percepcao: {
    id: 'percepcao', name: 'Percepção', ability: 'sab',
    description: 'Notar presença, ouvir conversa baixa, ver detalhes sutis. Perícia mais usada do jogo.',
  },
  persuasao: {
    id: 'persuasao', name: 'Persuasão', ability: 'car',
    description: 'Influenciar via diplomacia, etiqueta social, lábia honesta.',
  },
  prestidigitacao: {
    id: 'prestidigitacao', name: 'Prestidigitação', ability: 'des',
    description: 'Truques de mão, batedor de carteira, mágica de palco, plantar objeto em alguém.',
  },
  religiao: {
    id: 'religiao', name: 'Religião', ability: 'int',
    description: 'Conhecer deuses, ritos, hierarquias sacerdotais, cultos secretos, símbolos sagrados.',
  },
  sobrevivencia: {
    id: 'sobrevivencia', name: 'Sobrevivência', ability: 'sab',
    description: 'Seguir trilhas, caçar, abrigar-se, prever clima, evitar perigos naturais.',
  },
};

export function getSkill(id: SkillId): SkillDef {
  return SKILLS[id];
}

export const ALL_SKILLS: SkillDef[] = Object.values(SKILLS);

// Skill check bônus = ability modifier + (proficiência ? proficiency bonus : 0).
// PHB pág 176.
export function skillCheckBonus(
  skill: SkillId,
  abilityModifier: number,
  isProficient: boolean,
  proficiencyBonus: number,
): number {
  return abilityModifier + (isProficient ? proficiencyBonus : 0);
}

// DC padrão do D&D 5e (PHB pág 174).
export const STANDARD_DCS = {
  trivial: 5,
  facil: 10,
  medio: 15,
  dificil: 20,
  muitoDificil: 25,
  quaseImpossivel: 30,
} as const;

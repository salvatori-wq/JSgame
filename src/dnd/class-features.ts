// JSgame · D&D 5e Class Features (Big 7 do PHB).
// Define max uses por classe/nível + descrição. Lookup puro, sem mutação.
// Usado por server (validação + restore em rest) e cliente (UI bar).

import type { ClassId } from './classes';

export type FeatureKey =
  | 'rage'
  | 'action-surge'
  | 'second-wind'
  | 'channel-divinity'
  | 'ki'
  | 'bardic-inspiration'
  | 'wild-shape';

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  icon: string;
  classId: ClassId;
  minLevel: number;
  // Quando restaura: 'short' (curto descanso recupera tudo), 'long' (apenas longo).
  // Bardic Inspiration restaura no LONG até nv 5, depois SHORT (simplificamos: long).
  restoreOn: 'short' | 'long';
  description: string;
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  rage: {
    key: 'rage', label: 'Fúria', icon: '😡', classId: 'barbaro', minLevel: 1, restoreOn: 'long',
    description: 'Bônus +2 dano corpo-a-corpo, resistência a perfurante/cortante/concussivo, vantagem em testes de Força. Dura até fim do próximo turno sem atacar/levar dano.',
  },
  'action-surge': {
    key: 'action-surge', label: 'Surto de Ação', icon: '⚡', classId: 'guerreiro', minLevel: 2, restoreOn: 'short',
    description: 'Ganha uma ação adicional neste turno (pode atacar duas vezes seguidas).',
  },
  'second-wind': {
    key: 'second-wind', label: 'Refôlego', icon: '💨', classId: 'guerreiro', minLevel: 1, restoreOn: 'short',
    description: 'Bônus action — cura 1d10 + nível de HP.',
  },
  'channel-divinity': {
    key: 'channel-divinity', label: 'Canalizar Divindade', icon: '✝', classId: 'clerigo', minLevel: 2, restoreOn: 'short',
    description: 'Turn Undead — todo morto-vivo num raio próximo ganha condição "assustado".',
  },
  ki: {
    key: 'ki', label: 'Ki (Rajada)', icon: '👊', classId: 'monge', minLevel: 2, restoreOn: 'short',
    description: 'Gasta 1 ki: Rajada de Golpes — dois ataques desarmados como bônus action após atacar.',
  },
  'bardic-inspiration': {
    key: 'bardic-inspiration', label: 'Inspiração de Bardo', icon: '🎵', classId: 'bardo', minLevel: 1, restoreOn: 'long',
    description: 'Bônus action — aliado ganha d6 pra somar em UM ataque/teste/save até 10min.',
  },
  'wild-shape': {
    key: 'wild-shape', label: 'Forma Selvagem', icon: '🐺', classId: 'druida', minLevel: 2, restoreOn: 'short',
    description: 'Transforma em besta — bônus +HP, +1 ataque corpo-a-corpo, animal aura. Dura combate todo.',
  },
};

// Calcula uses máximos baseado em classe + nível, conforme tabela PHB.
// Retorna 0 se classe não tem ou nível insuficiente.
export function getMaxFeatureUses(classId: ClassId, level: number, key: FeatureKey, charismaMod = 0): number {
  const def = FEATURES[key];
  if (!def) return 0;
  if (def.classId !== classId || level < def.minLevel) return 0;

  switch (key) {
    case 'rage':
      // PHB Barbarian table: 2/3/3/3/4/4/4/4/4/5/5/5/5/6/6/6/6/UN/UN/UN
      if (level >= 17) return 6;
      if (level >= 12) return 5;
      if (level >= 6) return 4;
      if (level >= 3) return 3;
      return 2;
    case 'action-surge':
      return level >= 17 ? 2 : 1;
    case 'second-wind':
      return 1;
    case 'channel-divinity':
      if (level >= 18) return 3;
      if (level >= 6) return 2;
      return 1;
    case 'ki':
      // = nível
      return level;
    case 'bardic-inspiration':
      // = max(1, CHA mod) — usamos Cha mod calculado pelo caller
      return Math.max(1, charismaMod);
    case 'wild-shape':
      return level >= 20 ? Infinity : 2;
  }
}

// Lista features disponíveis pro PJ baseado em classe primária + nível.
// (Não considera multi-class adicional ainda — Big 7 features assumem class primary.)
export function featuresForClass(classId: ClassId, level: number): FeatureDef[] {
  return Object.values(FEATURES).filter((f) => f.classId === classId && level >= f.minLevel);
}

// Sneak Attack — passive, dado extra de dano. Escala +1d6 cada 2 níveis (1,3,5,7,9,11,13,15,17,19).
// Retorna número de dados extras (1d6 cada).
export function sneakAttackDiceCount(classId: ClassId, level: number): number {
  if (classId !== 'ladino') return 0;
  return Math.ceil(level / 2);
}

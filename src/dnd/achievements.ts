// JSgame · F17 — Catálogo de achievements (marcos de jogo).
// 30+ achievements pré-definidos. Unlocks persistem por user (F15 auth).
// Anon (sem user) não persiste mas mostra toast in-memory na sessão.

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
// β.2 — Categoria pra abas do modal de achievements.
export type AchievementCategory = 'combat' | 'exploration' | 'social' | 'progress' | 'meta';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;       // emoji — zero asset
  tier: AchievementTier;
  hidden?: boolean;   // não mostra na lista até unlock (spoiler)
  category?: AchievementCategory; // β.2 — drive abas do modal
}

// Catálogo. Ordem importa pra UI da página de perfil.
// β.2 — category drive abas do modal: combat/exploration/social/progress/meta
export const ACHIEVEMENTS: Achievement[] = [
  // ═════════ Bronze — primeiros passos ═════════
  { id: 'first_session',    name: 'Primeira Crônica',     description: 'Iniciou sua primeira sessão de D&D.',                  icon: '📜', tier: 'bronze',   category: 'meta' },
  { id: 'first_combat',     name: 'Sangue Novo',          description: 'Entrou no seu primeiro combate.',                       icon: '⚔', tier: 'bronze',   category: 'combat' },
  { id: 'first_kill',       name: 'Primeira Vítima',      description: 'Derrotou seu primeiro inimigo.',                        icon: '💀', tier: 'bronze',   category: 'combat' },
  { id: 'first_nat20',      name: 'Sorte dos Deuses',     description: 'Rolou um Natural 20 — perfeito.',                       icon: '🎲', tier: 'bronze',   category: 'combat' },
  { id: 'first_nat1',       name: 'Falha Crítica',        description: 'Rolou um Natural 1 — você é amaldiçoado.',              icon: '💢', tier: 'bronze',   category: 'combat' },
  { id: 'first_crit',       name: 'Primeiro Crit',        description: 'Acertou um crítico em combate.',                        icon: '✨', tier: 'bronze',   category: 'combat' },
  { id: 'first_spell',      name: 'Verbo Primeiro',       description: 'Conjurou sua primeira magia.',                          icon: '🔮', tier: 'bronze',   category: 'combat' },
  { id: 'first_levelup',    name: 'Subindo a Escada',     description: 'Atingiu o nível 2.',                                    icon: '⬆', tier: 'bronze',   category: 'progress' },
  { id: 'first_item',       name: 'Catador',              description: 'Recebeu seu primeiro item de loot.',                    icon: '📦', tier: 'bronze',   category: 'exploration' },
  { id: 'first_npc',        name: 'Boa Conversa',         description: 'Falou com seu primeiro NPC.',                           icon: '🗣', tier: 'bronze',   category: 'social' },

  // ═════════ Silver — proficiência ═════════
  { id: 'level_five',       name: 'Aventureiro Sério',    description: 'Atingiu o nível 5 (proficiência +3).',                 icon: '🛡', tier: 'silver',   category: 'progress' },
  { id: 'ten_kills',        name: 'Mãos Manchadas',       description: 'Derrotou 10 inimigos.',                                 icon: '🗡', tier: 'silver',   category: 'combat' },
  { id: 'five_crits',       name: 'Mestre da Lâmina',     description: 'Acertou 5 críticos em combates diferentes.',            icon: '⚡', tier: 'silver',   category: 'combat' },
  { id: 'survivor',         name: 'Sobrevivente',         description: 'Estabilizou após cair em 0 HP.',                        icon: '❤', tier: 'silver',   category: 'combat' },
  { id: 'multiclass',       name: 'Múltiplas Vidas',      description: 'Criou um PJ multi-classe.',                             icon: '⚖', tier: 'silver',   category: 'progress' },
  { id: 'boss_kill',        name: 'Caçador de Chefes',    description: 'Derrotou um inimigo lendário (boss).',                  icon: '👑', tier: 'silver',   category: 'combat' },
  { id: 'coop_session',     name: 'Companheiro',          description: 'Jogou uma sessão coop com aliados.',                    icon: '🤝', tier: 'silver',   category: 'social' },
  { id: 'twenty_spells',    name: 'Bibliotecário',        description: 'Conjurou 20 magias.',                                   icon: '📖', tier: 'silver',   category: 'combat' },
  { id: 'long_rest_three',  name: 'Camp Veterano',        description: 'Fez 3 descansos longos.',                               icon: '🏕', tier: 'silver',   category: 'exploration' },
  { id: 'explorer',         name: 'Mapeador',             description: 'Visitou 10 locais distintos.',                          icon: '🗺', tier: 'silver',   category: 'exploration' },

  // ═════════ Gold — proeza ═════════
  { id: 'level_ten',        name: 'Lenda em Formação',    description: 'Atingiu o nível 10.',                                   icon: '🌟', tier: 'gold',     category: 'progress' },
  { id: 'hundred_kills',    name: 'Carniceiro',           description: 'Derrotou 100 inimigos.',                                icon: '💀', tier: 'gold',     category: 'combat' },
  { id: 'dragon_slayer',    name: 'Mata-Dragão',          description: 'Derrotou um dragão.',                                   icon: '🐉', tier: 'gold',     category: 'combat' },
  { id: 'untouched',        name: 'Imaculado',            description: 'Venceu um combate sem ninguém cair a 0 HP.',            icon: '🛡', tier: 'gold',     category: 'combat' },
  { id: 'death_dodger',     name: 'Imortal',              description: 'Sobreviveu a 5 quedas em 0 HP (estabilizações).',      icon: '⏳', tier: 'gold',     category: 'combat' },
  { id: 'rich_hero',        name: 'Cofre Cheio',          description: 'Acumulou 500 peças de ouro.',                           icon: '💰', tier: 'gold',     category: 'exploration' },
  { id: 'streak_three',     name: 'Três Vinte',           description: 'Rolou 3 Naturais 20 seguidos.',                         icon: '🎯', tier: 'gold',     category: 'combat' },

  // ═════════ Platinum — proezas raras ═════════
  { id: 'level_twenty',     name: 'Apex',                 description: 'Atingiu o nível 20 — o teto.',                          icon: '🏆', tier: 'platinum', category: 'progress' },
  { id: 'first_death',      name: 'Morto na Linha',       description: 'Um PJ seu morreu (3 death-save failures).',             icon: '🪦', tier: 'platinum', hidden: true, category: 'meta' },
  { id: 'nine_lives',       name: 'Nove Vidas',           description: 'Acumulou 3 mortes entre seus personagens.',             icon: '😈', tier: 'platinum', hidden: true, category: 'meta' },
  { id: 'lone_wolf',        name: 'Lobo Solitário',       description: 'Completou uma sessão sozinho (sem party).',             icon: '🐺', tier: 'platinum', category: 'social' },
];

// β.2 — Mapping pra label PT-BR das categorias (UI das abas).
export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  combat:      '⚔ Combate',
  exploration: '🗺 Exploração',
  social:      '🗣 Social',
  progress:    '⬆ Progresso',
  meta:        '🏆 Meta',
};

// β.2 — Pure helper: estatísticas pra header do modal.
export function summarizeProgress(unlockedIds: Set<string>): { total: number; unlocked: number; pctByTier: Record<AchievementTier, { unlocked: number; total: number }> } {
  const pctByTier: Record<AchievementTier, { unlocked: number; total: number }> = {
    bronze: { unlocked: 0, total: 0 },
    silver: { unlocked: 0, total: 0 },
    gold: { unlocked: 0, total: 0 },
    platinum: { unlocked: 0, total: 0 },
  };
  for (const a of ACHIEVEMENTS) {
    pctByTier[a.tier].total++;
    if (unlockedIds.has(a.id)) pctByTier[a.tier].unlocked++;
  }
  return {
    total: ACHIEVEMENTS.length,
    unlocked: ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length,
    pctByTier,
  };
}

export function getAchievement(id: string): Achievement | null {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

// Counters — chaves usadas pelo tracker de marcos cumulativos.
export type CounterKey =
  | 'kills'
  | 'crits'
  | 'spells_cast'
  | 'long_rests'
  | 'stabilizations'
  | 'nat20_streak'
  | 'unique_locations'
  | 'unique_npcs'
  | 'character_deaths';

export const ALL_COUNTERS: CounterKey[] = [
  'kills', 'crits', 'spells_cast', 'long_rests', 'stabilizations',
  'nat20_streak', 'unique_locations', 'unique_npcs', 'character_deaths',
];

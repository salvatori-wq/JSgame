// JSgame · Types compartilhados entre cliente e servidor.
// Re-exporta D&D core + adiciona schemas de game state e socket events.

import type { AbilityScores } from '@dnd/attributes';
import type { ClassId } from '@dnd/classes';
import type { RaceId } from '@dnd/races';
import type { SkillId } from '@dnd/skills';
import type { ConditionId } from '@dnd/conditions';
import type { DiceRoll } from '@dnd/dice';

export type { AbilityScores, AbilityKey } from '@dnd/attributes';
export type { ClassId, HitDie } from '@dnd/classes';
export type { RaceId } from '@dnd/races';
export type { SkillId } from '@dnd/skills';
export type { ConditionId } from '@dnd/conditions';
export type { DiceRoll, DieKind } from '@dnd/dice';

// ════════════════════════════════════════════════════════════════════════════
// CharacterSheet — ficha de personagem completa D&D 5e.
// ════════════════════════════════════════════════════════════════════════════

export type BackgroundId =
  | 'acolito' | 'artesao' | 'artista' | 'charlatao' | 'criminoso'
  | 'eremita' | 'forasteiro' | 'herois-do-povo' | 'marinheiro' | 'nobre'
  | 'orfao' | 'sabio' | 'soldado';

export type Alignment =
  | 'lb' | 'nb' | 'cb'   // leal/neutro/caótico bom
  | 'ln' | 'nn' | 'cn'   // leal/neutro/caótico neutro
  | 'lm' | 'nm' | 'cm';  // leal/neutro/caótico mau

export interface CharacterSheet {
  // Identidade
  id: string;
  ownerName: string;       // nome do player real (login/identity)
  characterName: string;   // nome do PJ (Borin, Lyra, …)
  raceId: RaceId;
  classId: ClassId;
  backgroundId: BackgroundId;
  alignment: Alignment;

  // Progressão
  level: number;           // 1-20
  xp: number;              // accumulado

  // Atributos
  abilityScoresBase: AbilityScores;  // após point buy, antes de bônus racial
  abilityScores: AbilityScores;      // efetivo (base + racial)

  // HP / AC / Iniciativa derivados
  maxHp: number;
  currentHp: number;
  tempHp: number;
  hitDiceRemaining: number;          // gasta em descanso curto
  armorClass: number;                // CA = 10 + Des mod (sem armadura) etc

  // Proficiências
  proficientSkills: SkillId[];
  proficientSavingThrows: import('@dnd/attributes').AbilityKey[];
  languages: string[];
  toolProficiencies: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];

  // Conditions ativas
  conditions: ConditionId[];

  // Inventário
  inventory: InventoryItem[];
  equippedArmor?: string;
  equippedShield?: string;
  equippedWeapons: string[];          // até 2 mãos
  gold: number;                       // peças de ouro (po)

  // Spellcasting (se aplicável)
  spellsKnown: string[];              // ids de magias
  spellsPrepared: string[];           // subset de spellsKnown (mago/clérigo)
  spellSlots: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, { max: number; used: number }>;

  // Personalidade / antecedente
  personalityTraits: string[];        // 2 traits
  ideals: string[];                   // 1 ideal
  bonds: string[];                    // 1 bond
  flaws: string[];                    // 1 flaw
  backstory: string;                  // narrativo livre

  // Persistência
  createdAt: number;
  lastPlayedAt: number;
  deathCount: number;
  campaignsPlayed: string[];          // ids de campanhas em que esteve
}

export interface InventoryItem {
  id: string;       // weapon/armor/item id
  name: string;
  type: 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc';
  quantity: number;
  weight?: number;
  description?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign / Session state.
// ════════════════════════════════════════════════════════════════════════════

export type GameMode = 'exploration' | 'social' | 'combat' | 'rest';

export interface CampaignState {
  id: string;
  name: string;
  mode: GameMode;
  partyCharacterIds: string[];        // até 3
  currentLocation: string;
  currentSceneDescription: string;    // última narração do Mestre
  worldFlags: Record<string, string | number | boolean>;
  npcsMet: Array<{ name: string; archetype: string; attitude: 'amigavel' | 'neutro' | 'hostil' | 'misterioso'; lastSeen: string }>;
  recentEvents: string[];             // últimos N pra DM context
  sessionNumber: number;              // 1-5 dentro da campanha
  startedAt: number;
  lastPlayedAt: number;
  // Skill check pendente — quem deve rolar, qual perícia, DC. null se nenhum.
  pendingCheck: { skill: SkillId; dc: number; reason: string; playerId: string } | null;
  // Combate ativo (ou null em exploration)
  combat: CombatState | null;
}

// Combate
export interface CombatState {
  active: boolean;
  round: number;
  initiativeOrder: Array<{ id: string; kind: 'player' | 'enemy'; initiative: number; name: string }>;
  currentTurnIndex: number;            // index em initiativeOrder
  enemies: EnemySnapshot[];
  log: string[];                       // últimas ações narradas curtas
}

export interface EnemySnapshot {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  attackBonus: number;                 // d20 + X em ataques (default +3)
  damageDice: string;                  // "1d6" / "2d4" — server parseia
  damageBonus: number;                 // soma fixa ao dmg roll (default 0)
  initiative: number;                  // populado ao roleiInitiative
  conditions: ConditionId[];
  description: string;
  isBoss: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Socket events.
// ════════════════════════════════════════════════════════════════════════════

export interface ClientToServerEvents {
  joinCampaign: (payload: { campaignId?: string; ownerName: string; characterId?: string }) => void;
  rejoinCampaign: (payload: { campaignId: string; oldPlayerId: string; characterId: string }) => void;

  // Exploration
  takeAction: (payload: { action: ExplorationAction; details?: string }) => void;
  requestSkillCheck: (payload: { skill: SkillId; dc?: number }) => void;

  // Combat
  rollInitiative: () => void;
  combatAction: (payload: { action: CombatActionKind; targetId?: string; details?: Record<string, unknown> }) => void;
  endTurn: () => void;

  // Social
  speakToNpc: (payload: { npcId: string; message: string; skill?: SkillId }) => void;

  // Rest
  shortRest: () => void;
  longRest: () => void;

  // Meta
  chat: (payload: { text: string }) => void;
}

export interface ServerToClientEvents {
  campaignState: (state: CampaignState) => void;
  partyUpdate: (characters: CharacterSheet[]) => void;
  combatState: (state: CombatState | null) => void;
  dmNarration: (payload: { text: string; speaker?: string; mood?: 'sombrio' | 'sarcastico' | 'trickster' | 'neutral' }) => void;
  diceRollResult: (payload: { source: string; roll: DiceRoll; purpose: string }) => void;
  characterUpdate: (character: CharacterSheet) => void;
  combatEvent: (event: CombatEvent) => void;
  dmThinking: (payload: { playerId: string; playerName: string; action: string }) => void;
  dmDone: () => void;
  error: (msg: string) => void;
}

export type ExplorationAction =
  | 'explore' | 'investigate' | 'sneak' | 'talk' | 'attack'
  | 'rest-short' | 'rest-long' | 'travel' | 'use-item' | 'cast-spell';

export type CombatActionKind =
  | 'attack' | 'cast-spell' | 'dodge' | 'dash' | 'disengage'
  | 'help' | 'hide' | 'ready' | 'search' | 'use-object'
  | 'use-item' | 'shove' | 'grapple';

export interface CombatEvent {
  type: 'damage' | 'heal' | 'condition-applied' | 'condition-removed' | 'spell-cast' | 'death' | 'attack-miss';
  sourceId?: string;
  targetId?: string;
  value?: number;
  conditionId?: ConditionId;
  text?: string;
}

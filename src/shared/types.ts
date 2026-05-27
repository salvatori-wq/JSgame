// JSgame · Types compartilhados entre cliente e servidor.
// Re-exporta D&D core + adiciona schemas de game state e socket events.

import type { AbilityScores, AbilityKey } from '../dnd/attributes';
import type { ClassId } from '../dnd/classes';
import type { RaceId } from '../dnd/races';
import type { SkillId } from '../dnd/skills';
import type { ConditionId } from '../dnd/conditions';
import type { DiceRoll } from '../dnd/dice';
import type { SubclassId } from '../dnd/subclasses';
import type { FeatId } from '../dnd/feats';

export type { AbilityScores, AbilityKey } from '../dnd/attributes';
export type { ClassId, HitDie } from '../dnd/classes';
export type { RaceId } from '../dnd/races';
export type { SkillId } from '../dnd/skills';
export type { ConditionId } from '../dnd/conditions';
export type { DiceRoll, DieKind } from '../dnd/dice';
export type { SubclassId } from '../dnd/subclasses';
export type { FeatId } from '../dnd/feats';

// Escolha pré-planejada de ASI ou Feat — aplica quando PJ atinge nv 4/8/12/16/19 (PHB).
// η.1 — Feats com sub-escolha:
//   Resilient → ability key adicional
//   (Magic Initiate: V2 — V1 ainda não suporta seleção fina)
export type PlannedLevel4Choice =
  | { kind: 'asi'; plusTwo: AbilityKey; plusOne: AbilityKey }
  | { kind: 'feat'; featId: FeatId; resilientAbility?: AbilityKey };

// η.3 — Alias semântico (mesmo tipo, melhor nome pra Record). plannedLevel4Choice
// legacy mantido pra backwards-compat; migração on-load popula plannedAsiChoices.
export type PlannedAsiChoice = PlannedLevel4Choice;

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
  ownerName: string;       // nome do player real (login/identity) — legacy, mantido pra backwards-compat
  userId?: string | null;  // user.id quando PJ foi criado por user autenticado (F15+). null/undefined = anônimo legado.
  characterName: string;   // nome do PJ (Borin, Lyra, …)
  raceId: RaceId;
  classId: ClassId;
  subclassId?: SubclassId | null;   // escolhido no wizard; features aplicam quando PJ atinge nv do PHB (3 padrão)
  // Multi-classe PHB cap 6 — classe primária é classId+level. Adicional aqui.
  // `level` do sheet representa a primary; total efetivo é level + sum(additionalClasses.level).
  additionalClasses?: Array<{ classId: ClassId; subclassId?: SubclassId | null; level: number }>;
  backgroundId: BackgroundId;
  alignment: Alignment;

  // Escolhas pré-planejadas no wizard pra futuros level-ups (latentes até PJ subir).
  /** @deprecated η.3 — migrado pra plannedAsiChoices[4] em load. Mantido pra compat de PJs antigos. */
  plannedLevel4Choice?: PlannedLevel4Choice | null;
  // η.3 — ASI/Feat choices por nível (PHB tem ASI em 4/8/12/16/19; Fighter +6/14, Rogue +10).
  // Key = nível. Null/undefined = não planejado, será marcado em pendingAsiChoiceLevels.
  plannedAsiChoices?: Record<number, PlannedAsiChoice | null>;
  // η.3 — Níveis ASI que PJ atingiu sem choice definido. UI pode mostrar "1 escolha pendente".
  pendingAsiChoiceLevels?: number[];

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
  proficientSavingThrows: import('../dnd/attributes').AbilityKey[];
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

  // Death saves (PHB pág 197) — só relevante quando currentHp=0 em combate.
  // 3 sucessos = estabiliza (inconsciente mas estável). 3 falhas = morte.
  // Resetam ao ganhar HP > 0 ou estabilizar.
  deathSaveSuccesses: number;
  deathSaveFailures: number;

  // Exaustão (PHB pág 291) — 6 níveis cumulativos. Long rest -1 nível.
  // 1: desvantagem em testes de habilidade
  // 2: velocidade /2
  // 3: desvantagem em ataques + saves
  // 4: HP máx /2
  // 5: velocidade 0
  // 6: morte
  exhaustion: number;

  // F23 — Class Features Big 7 uses (rage, action-surge, second-wind, channel-divinity,
  // ki, bardic-inspiration, wild-shape). Sneak Attack é passive (sem use). Restauram em
  // short/long rest conforme regra de cada feature. Server calcula max via getMaxFeatureUses.
  classFeatureUses?: Record<string, { used: number; max: number }>;

  // F25 — Concentration: spellId da magia de concentração ativa. PHB pág 203 —
  // só 1 por vez. Quebra ao: lançar outra de concentração, ficar inconsciente,
  // ou falhar CON save DC max(10, dmg/2) ao receber dano.
  concentratingOn?: string | null;

  // F26 — Damage profile (race/class/item-derived). Tiefling=resist fogo, Anão Montanha=
  // resist veneno, etc. Esses arrays podem ser injetados ao criar PJ ou via magic item.
  resistances?: import('../dnd/damage-types').DamageType[];
  immunities?: import('../dnd/damage-types').DamageType[];
  vulnerabilities?: import('../dnd/damage-types').DamageType[];

  // A2 — Buff engine: lista de buffs ativos (Bardic Inspiration d6, Bless d4, Guidance,
  // Shield +5 AC, etc). Decremento por turno (turnsLeft) ou por uso (charges).
  activeBuffs?: ActiveBuff[];

  // α.3 — Inspirações DnD (PHB pág 125). DM concede por bom roleplay via
  // grant_inspiration tool; player gasta antes de rolar pra ganhar advantage.
  // Default 0, max 3 (clamp server-side). Não persiste em hard drop, mas serializa.
  inspirations?: number;

  // η.1 — Feats owned (lista PHB cap 6). Cada feat aplica mecânica via
  // feat-effects-engine.ts. Inicialmente vazio; populado em level-up via
  // plannedLevel4Choice/plannedAsiChoices ou applyFeatEffects manual.
  featsOwned?: FeatId[];
  // η.1 — Lucky points (feat Lucky): 3 pontos / long rest, gasta pra reroll d20.
  // PHB pág 167. Server consome via socket event; cliente decide gastar antes do roll.
  luckyPointsRemaining?: number;
  luckyPointsMax?: number;
}

// A2 — Buff engine
export interface ActiveBuff {
  id: string;                            // uuid pra identificar
  source: string;                        // nome amigável: "Bardic Inspiration (Lyra)" / "Bless"
  appliesTo: 'attack' | 'save' | 'skill-check' | 'ac' | 'damage-roll';
  effect: BuffEffect;
  // Duração: charges (consome ao usar) OU turnsLeft (decrementa fim turno) OU permanente.
  charges?: number;                      // ex: Bardic Insp = 1 use
  turnsLeft?: number;                    // ex: Bless = 10 turnos (1 min)
  // M2 — Nível do slot que criou o buff. Usado por Dispel Magic pra calcular DC.
  // Defaults: bardic=class-feature (treat as 1), bless=1, shield=1, faerie-fire=1.
  // Magias upcast preservam o slot original (não a level base da magia).
  sourceSpellLevel?: number;
}

export type BuffEffect =
  | { kind: 'dice-bonus'; dice: string }                 // ex: '1d6' (Bardic), '1d4' (Bless)
  | { kind: 'flat-bonus'; value: number }                // ex: +5 AC (Shield)
  | { kind: 'advantage' }                                // Faerie Fire dá vantagem
  | { kind: 'disadvantage' };                            // raro mas pra simetria

export type ItemRarity = 'comum' | 'incomum' | 'raro' | 'muito-raro' | 'lendario';

export interface InventoryItem {
  id: string;       // weapon/armor/item id
  name: string;
  type: 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc';
  quantity: number;
  weight?: number;
  description?: string;
  // α.2 — Raridade (PHB/DMG). DM declara via give_item; server default 'comum'.
  // Drive CSS visual (glow + cores DnD oficiais) + animação loot-burst no append.
  rarity?: ItemRarity;
  // α.2 — Marker pra UI: item recém-recebido (animação loot-burst só uma vez).
  // Server seta ao criar via give_item; client limpa ao primeiro render.
  isNew?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// β.1 — NPC Roster Persistente. Diferente de CampaignState.npcsMet (lista
// volátil em-memória), NpcMemory é persistido em DB e carrega contadores,
// notas, relacionamento. DM lê top-N recentes pra "mundo lembra de você".
// ════════════════════════════════════════════════════════════════════════════

export interface NpcMemory {
  id: string;              // slug do nome + local de primeiro encontro
  campaignId: string;
  name: string;
  archetype: string;
  attitude: 'amigavel' | 'neutro' | 'hostil' | 'misterioso';
  firstMet: number;
  lastSeen: number;
  lastLocation: string;
  interactionCount: number;
  notes: string;          // "morto", "deve favor", "traiu party", livre-form
  relationship: number;   // -10 (inimigo) ↔ +10 (aliado próximo). 0 = neutro.
}

// ════════════════════════════════════════════════════════════════════════════
// Quest — F18. Missões com objetivos, dadas/atualizadas/completadas por DM tools.
// Persiste em CampaignState.quests. RAG indexa como kind=promise importance=1.7.
// ════════════════════════════════════════════════════════════════════════════

export type QuestStatus = 'active' | 'completed' | 'failed';

export interface QuestObjective {
  id: string;
  description: string;
  done: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;        // narrativo curto
  objectives: QuestObjective[];
  status: QuestStatus;
  rewardXp: number;           // XP distribuído à party na complete_quest
  giver?: string;             // nome do NPC que deu (display only)
  acceptedAt: number;
  completedAt?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// MemoryFact — memória persistente do Mestre (RAG via FTS5).
// ════════════════════════════════════════════════════════════════════════════

export type MemoryFactKind =
  | 'npc'         // fala/interação de NPC
  | 'location'    // descrição de local visitado
  | 'event'       // evento marcante (combate, escolha moral, traição)
  | 'inventory'   // item recebido/perdido importante
  | 'promise'     // promessa feita / quest aceita
  | 'lore'        // pedaço de mundo/história revelado
  | 'summary';    // auto-resumo comprimido pelo Mestre

export interface MemoryFact {
  id: string;
  campaignId: string;
  kind: MemoryFactKind;
  text: string;          // conteúdo literal indexado (preferir falas/quotes exatas)
  tags: string;          // espacial: lista de tokens-tag (ex: "npc personagens taverna")
  importance: number;    // 0.0-2.0, default 1.0; >1 = boost no rank
  sessionN: number;      // qual sessão da campanha
  createdAt: number;
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
  // F27 — Saving throw pendente (paralelo ao skill check). Ability save (FOR/DES/CON/INT/SAB/CAR).
  // Disparado por spells (DM tool request_saving_throw), traps, hazards.
  pendingSave: { ability: AbilityKey; dc: number; reason: string; playerId: string } | null;
  // Combate ativo (ou null em exploration)
  combat: CombatState | null;
  // F18 — Quests dadas pelo Mestre via DM tools. Persistem entre sessões.
  quests?: Quest[];
  // 1C — DM personality preset (sombrio/épico/comédia/noir/pulp). Default sombrio.
  // Escolhido no lobby antes do start, persiste em DB.
  dmPersonality?: import('../dnd/dm-personality').DmPersonality;
  // 3B — Dificuldade preferida pra encontros. DM respeita ao chamar start_combat_balanced.
  // 'auto' = DM decide pelo contexto. Default 'auto'.
  combatDifficulty?: 'easy' | 'medium' | 'hard' | 'deadly' | 'auto';
  // 2A — Spell inimiga pendente. DM seta via enemy_casts_spell, abre janela
  // de Counterspell pros casters do party. Server limpa após windowMs ou após
  // resolução de castReaction. Não persiste — é runtime mid-turn.
  pendingEnemySpell?: PendingEnemySpell | null;
  // α.1 — Suggested actions chips. DM sugere 2-4 ações contextuais a cada cena.
  // Player clica → vira `takeAction(action, details)`. Reseta a cada nova narração.
  // Server clamp em 4 itens. Runtime — não persiste entre sessões.
  suggestedActions?: SuggestedAction[];
  // β.3 — Loja aberta. DM seta via open_shop tool quando NPC mercador aparece.
  // Cliente abre modal de compra/venda. null = sem loja ativa.
  openShop?: OpenShop | null;
  // η.4 — Pending advantages/disadvantages declarados pelo DM via apply_advantage tool.
  // Consome no próximo roll do tipo declarado (attack/save/skill). Expira em 5 turnos.
  pendingAdvantages?: Record<string, {
    mode: 'advantage' | 'disadvantage';
    targetRoll: 'next-attack' | 'next-save' | 'next-skill';
    reason: string;
    createdAt: number;
  }>;
  // ψ.3 — Active Clocks (Blades-in-the-Dark style): pressão narrativa visível.
  // DM cria via tool tick_clock, server mantém progress. Injetado no system
  // prompt cada turn pro DM lembrar de onde tá a tensão. Cliente pode mostrar.
  // Exemplos: { label: 'Ritual do culto', progress: 3, max: 6, trigger: '6/6 vilão fica imortal' }
  activeClocks?: Array<{
    id: string;
    label: string;
    progress: number;
    max: number;
    /** Trigger narrativo quando completa (DM lê e narra). */
    trigger: string;
    /** True quando completou e disparou — DM viu e narrou consequência. */
    fired?: boolean;
  }>;
}

// β.3 — Loja/Vendor schemas.
export type ShopType = 'arms' | 'alchemy' | 'general' | 'magic';

export interface ShopItem {
  // ID gerado pelo server (stable durante a session da loja). Cliente usa pra buyItem.
  id: string;
  name: string;
  type: 'arma' | 'armadura' | 'escudo' | 'consumivel' | 'tesouro' | 'ferramenta' | 'misc';
  rarity?: ItemRarity;
  priceGold: number;
  description?: string;
  stock?: number;     // null/undefined = ilimitado
}

export interface OpenShop {
  id: string;             // uuid da sessão da loja (pra dedup race)
  npcName: string;
  shopType: ShopType;
  items: ShopItem[];
  acceptsSell: boolean;   // se true, party pode vender items (50% do priceGold default)
  openedAt: number;
}

// α.1 — Ação sugerida pelo DM (chip clicável abaixo da narração).
export interface SuggestedAction {
  label: string;                                   // "Examinar o corpo"
  action: ExplorationAction | 'custom';            // routing: vira ExplorationAction no takeAction
  hint?: string;                                   // "(Investigação)" — pista de skill check
  details: string;                                 // enviado como `details` ao takeAction
}

export interface PendingEnemySpell {
  id: string;                          // uuid pra dedup
  sourceName: string;                  // nome do inimigo
  spellName: string;
  spellLevel: number;                  // 1-9
  targetIds: string[];                 // ids dos alvos (PJs/enemies)
  visible: boolean;                    // se false, Counterspell não pode reagir
  cancelled: boolean;                  // true após counterspell sucesso
  createdAt: number;                   // ts em ms — pra cliente medir o restante
  windowMs: number;                    // 5000 default
}

// Combate
export interface CombatState {
  active: boolean;
  round: number;
  initiativeOrder: Array<{ id: string; kind: 'player' | 'enemy'; initiative: number; name: string }>;
  currentTurnIndex: number;            // index em initiativeOrder
  enemies: EnemySnapshot[];
  log: string[];                       // últimas ações narradas curtas
  // β.4 — Action Economy (PHB pág 189-193). Por participante (id → economy).
  // V1: server reseta no start of turn + UI exibe. Consume é fire-and-forget pelos
  // handlers (consumeActionEconomy()) — visual + telemetria. Bloqueio mecânico em γ.
  actionEconomy?: Record<string, ActionEconomy>;
}

// β.4 — PHB pág 189-193: turn budget de cada participante.
export interface ActionEconomy {
  action: boolean;        // 1 por turno: attack/dash/dodge/disengage/cast spell padrão
  bonusAction: boolean;   // 1 por turno (só se você TEM uma feature/spell que dá)
  reaction: boolean;      // 1 por round (não turno!) — opportunity attack, counterspell
  movement: number;       // pés restantes (default 30 — varia por raça/condição)
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
  xpAward: number;                     // F16: XP que essa kill concede (PHB CR→XP). Sem CR explícito = 10 (CR 0).
  // F26 — Damage profile (resistance/immunity/vulnerability) carried do MonsterDef.
  resistances?: import('../dnd/damage-types').DamageType[];
  immunities?: import('../dnd/damage-types').DamageType[];
  vulnerabilities?: import('../dnd/damage-types').DamageType[];
  attackDamageType?: import('../dnd/damage-types').DamageType;
  // M1 — Ability scores reais do monstro (do bestiary). Server usa em saves vs spells.
  abilityScores?: { for: number; des: number; con: number; int: number; sab: number; car: number };
}

// ════════════════════════════════════════════════════════════════════════════
// Socket events.
// ════════════════════════════════════════════════════════════════════════════

export interface ClientToServerEvents {
  joinCampaign: (payload: { campaignId?: string; ownerName: string; characterId?: string }) => void;
  rejoinCampaign: (payload: { campaignId: string; oldPlayerId: string; characterId: string }) => void;

  // Exploration
  takeAction: (payload: { action: ExplorationAction; details?: string }) => void;
  // α.3 — useInspiration: gasta 1 inspiration pra advantage no roll (PHB pág 125)
  requestSkillCheck: (payload: { skill: SkillId; dc?: number; useInspiration?: boolean }) => void;
  // F27 — Saving throw genérico (FOR/DES/CON/INT/SAB/CAR vs DC).
  resolveSavingThrow: () => void;

  // Combat
  rollInitiative: () => void;
  combatAction: (payload: { action: CombatActionKind; targetId?: string; details?: Record<string, unknown> }) => void;
  endTurn: () => void;

  // F23 — Class features Big 7 (rage, action-surge, second-wind, channel-divinity,
  // ki, bardic-inspiration, wild-shape). Server valida uses + state, aplica efeito.
  useClassFeature: (payload: { feature: string; targetId?: string; details?: Record<string, unknown> }) => void;

  // Cast spell — exploration OU combat
  castSpell: (payload: { spellId: string; targetIds: string[]; slotLevel: 0 | 1 | 2 | 3 | 4 | 5 }) => void;

  // Inventory
  useItem: (payload: { itemId: string }) => void;
  equipItem: (payload: { itemId: string; slot: 'weapon' | 'armor' | 'shield' }) => void;
  unequipItem: (payload: { slot: 'weapon' | 'armor' | 'shield'; itemId?: string }) => void;

  // β.3 — Vendor/Shop. Player compra (gold→item) ou vende (item→50% gold).
  buyShopItem: (payload: { shopId: string; itemId: string }) => void;
  sellShopItem: (payload: { shopId: string; inventoryItemId: string }) => void;
  closeShop: () => void;

  // Lobby pre-game (jogadores se reúnem antes de criar campanha)
  createLobby: (payload: { ownerName: string }) => void;
  joinLobby: (payload: { lobbyId: string; ownerName: string }) => void;
  leaveLobby: () => void;
  lobbyUpdateStatus: (payload: { status: LobbyPlayerStatus; characterId?: string; wizardStep?: string }) => void;
  lobbyStartCampaign: () => void;
  // 1C — Host (e só ele) muda personality do DM antes de começar a crônica.
  lobbySetPersonality: (payload: { dmPersonality: import('../dnd/dm-personality').DmPersonality }) => void;

  // Social
  speakToNpc: (payload: { npcId: string; message: string; skill?: SkillId }) => void;

  // Rest
  shortRest: (payload: { hitDiceToSpend: number }) => void;
  longRest: () => void;
  rollDeathSave: () => void;

  // 2A — Reactions (Counterspell). Client → server quando player decide reagir
  // a pendingEnemySpell. Server resolve via reaction-engine. slotLevel = nível
  // do slot que será consumido (3-5). reactionId = pendingEnemySpell.id pra dedup.
  castReaction: (payload: { reactionId: string; spellId: 'counterspell'; slotLevel: 3 | 4 | 5 }) => void;
  // 3B — Settings da campanha em runtime (só host ou player atualiza).
  updateCampaignSettings: (payload: { combatDifficulty?: 'easy' | 'medium' | 'hard' | 'deadly' | 'auto' }) => void;
  // Dispel Magic é AÇÃO normal (não reaction) — usa cast normal via combatAction.
  // Future: socket dedicado pra dispelMagic targetId. Por ora, DM pode aplicar manual.

  // Meta
  chat: (payload: { text: string }) => void;
  // ψ.2 — Typing indicator (debounced client-side; server broadcasta).
  chatTyping: (payload: { isTyping: boolean }) => void;
}

// ════════════════════════════════════════════════════════════════════════════
// Lobby — pre-game room. Jogadores se reúnem antes de criar campanha.
// Cada player tem status (joined/selecting/wizard/ready). Quando todos ready,
// host clica "Começar Crônica" → cria Campaign + redirect.
// ════════════════════════════════════════════════════════════════════════════

export type LobbyPlayerStatus =
  | 'joined'           // só entrou, ainda não escolheu PJ
  | 'selecting'        // escolhendo PJ existente
  | 'wizard'           // criando PJ novo (com wizardStep)
  | 'ready';           // PJ selecionado/criado e travado

export interface LobbyPlayer {
  socketId: string;
  ownerName: string;
  status: LobbyPlayerStatus;
  characterId?: string;     // quando ready, qual PJ vai usar
  characterName?: string;   // display
  wizardStep?: string;      // se em wizard: 'race' / 'class' / 'abilities' / etc
  isHost: boolean;
  joinedAt: number;
}

export interface LobbyState {
  id: string;               // 6 chars alfanuméricos pra digitar fácil
  hostSocketId: string;
  players: LobbyPlayer[];
  createdAt: number;
  campaignId?: string;      // quando host inicia, vira o ID da campaign
  // 1C — Personality escolhida pelo host antes do start. Vai pro CampaignState.dmPersonality.
  dmPersonality?: import('../dnd/dm-personality').DmPersonality;
}

export interface ServerToClientEvents {
  campaignState: (state: CampaignState) => void;
  // Lobby
  lobbyState: (state: LobbyState | null) => void;
  lobbyRedirect: (payload: { campaignId: string }) => void;
  partyUpdate: (characters: CharacterSheet[]) => void;
  combatState: (state: CombatState | null) => void;
  // 1B — Combat-local flags (rage, action-surge, etc) por characterId. Server emit
  // junto com combatState, vai pro client renderizar badges de rage no party panel.
  combatFlags: (flags: Record<string, string[]>) => void;
  dmNarration: (payload: {
    text: string;
    speaker?: string;
    mood?: 'sombrio' | 'sarcastico' | 'trickster' | 'neutral' | 'error';
    /** POLISH γ.4 — quando mood='error', metadata sobre o que falhou pro client
     *  renderizar error recovery card rico (timeline providers + retry button). */
    errorMeta?: {
      providersAttempted: string[];   // ex: ['cerebras', 'gemini', 'groq']
      lastProvider: string;            // ex: 'groq'
      errorKind: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'empty' | 'unknown';
      errorMsg: string;                // mensagem curta sanitizada
      canRetry: boolean;               // se faz sentido tentar de novo
    };
  }) => void;
  diceRollResult: (payload: { source: string; roll: DiceRoll; purpose: string }) => void;
  characterUpdate: (character: CharacterSheet) => void;
  combatEvent: (event: CombatEvent) => void;
  dmThinking: (payload: { playerId: string; playerName: string; action: string }) => void;
  dmDone: () => void;
  error: (msg: string) => void;
  // F16: XP ganho ao final do combate. Emitido pra TODOS players do combate.
  xpAwarded: (payload: { characterId: string; characterName: string; xpAwarded: number; newXp: number }) => void;
  // F16: subiu de nível. Emitido após xpAwarded quando houve level-up.
  // Cliente abre overlay LEVEL UP no PJ correto.
  levelUp: (payload: {
    characterId: string;
    characterName: string;
    oldLevel: number;
    newLevel: number;
    hpGained: number;
    proficiencyBonusGained: boolean;
    slotsChanged: boolean;
    level4ChoiceApplied: boolean;
    notes: string[];
  }) => void;
  // F17: achievement unlocked. Cliente mostra toast.
  achievementUnlocked: (payload: { id: string; name: string; description: string; icon: string }) => void;
  // F20: daily streak bump (user logado). Cliente mostra toast/badge.
  streakUpdate: (payload: { currentStreak: number; longestStreak: number; brokeRecord: boolean }) => void;
  // ο.2 — Party chat message (broadcast separado da narração, renderizado no chat-sheet).
  partyMessage: (payload: {
    id: string;
    characterId: string;
    speaker: string;
    text: string;
    timestamp: number;
  }) => void;
  // ψ.2 — Backlog enviado em joinCampaign (resolve reconnect = histórico vazio).
  partyMessageBacklog: (payload: {
    messages: Array<{
      id: string;
      characterId: string;
      speaker: string;
      text: string;
      timestamp: number;
    }>;
  }) => void;
  // ψ.2 — Typing indicator (debounced server-side).
  partyTyping: (payload: {
    characterId: string;
    speaker: string;
    isTyping: boolean;
  }) => void;
}

export type ExplorationAction =
  | 'explore' | 'investigate' | 'sneak' | 'talk' | 'attack'
  | 'rest-short' | 'rest-long' | 'travel' | 'use-item' | 'cast-spell';

export type CombatActionKind =
  | 'attack' | 'cast-spell' | 'dodge' | 'dash' | 'disengage'
  | 'help' | 'hide' | 'ready' | 'search' | 'use-object'
  | 'use-item' | 'shove' | 'grapple' | 'two-weapon';

export interface CombatEvent {
  type: 'damage' | 'heal' | 'condition-applied' | 'condition-removed' | 'spell-cast' | 'death' | 'attack-miss' | 'attack-roll';
  sourceId?: string;
  targetId?: string;
  value?: number;
  conditionId?: ConditionId;
  text?: string;
  crit?: boolean;  // F21 — sinaliza ao cliente pra disparar combo SFX em crits consecutivos
  // γ.1 — Attack roll metadata: emitido ANTES de damage/attack-miss pra cliente
  // disparar overlay do dado. value = roll total (d20+bonus), crit/nat1 flags.
  nat1?: boolean;
  // γ.1 — Texto curto pra preview no overlay (ex: "d20+5 vs CA 13").
  preview?: string;
}

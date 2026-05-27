// JSgame · Campaign engine. Coordena estado de uma sessão de D&D.
// Estado in-memory + persistido via persistence.saveCampaign() em wave-end style.
//
// Coop-safe:
// - mutex (actionQueue): serializa takeAction/resolveSkillCheck/combat action — evita
//   2 chamadas LLM paralelas + state corrompido quando 2 players agem juntos.
// - startSession one-shot: flag isStarted impede dupla narração de abertura.
// - pendingCheck no state.pendingCheck (público) com playerId owner — broadcast.
//   resolveSkillCheck rejeita se playerId !== pendingCheck.playerId.

import type {
  CharacterSheet, CampaignState, GameMode, ExplorationAction,
  CombatActionKind, CombatEvent, MemoryFact,
} from '../shared/types.js';
import { DungeonMaster, FallbackDM, type DMInterface, type DMResponse } from './dm/dm.js';
import { validateToolCall, type ValidatedTool } from './dm/tools.js';
import { generateFallbackChips } from './dm/suggest-fallback.js';
import { rollD20, type DiceRoll } from '../dnd/dice.js';
import { abilityModifier, proficiencyBonus } from '../dnd/attributes.js';
import { getSkill, type SkillId } from '../dnd/skills.js';
import {
  startCombat, currentParticipant, advanceTurn, isCombatOver,
  resolvePlayerAttack, resolveEnemyTurn, resolvePlayerDodge, resolvePlayerDash,
  resolvePlayerDisengage, resolveGrapple, resolveShove, resolveHelp, resolvePlayerHide,
  applyConditionTo,
  consumeActionEconomy, actionEconomyKindFor,
} from './combat.js';
import {
  hasCombatFlag, setCombatFlag, clearCombatFlag,
} from './class-features-engine.js';
import { resolvePlayerCastSpell, type CastSpellResult } from './spells-engine.js';
import {
  useFeature, restoreOnShortRest, restoreOnLongRest, ensureFeatureUses,
} from './class-features-engine.js';
import type { FeatureKey } from '../dnd/class-features.js';
import { applyValidatedToolToCampaign } from './dm-tool-applier.js';
import { consumeBuffs, clearAllBuffs, tickBuffsEndOfTurn } from './buff-engine.js';
import type { SpellId } from '../dnd/spells.js';
import { getClass } from '../dnd/classes.js';
import { getRace } from '../dnd/races.js';
import { getBackground } from '../dnd/backgrounds.js';
import { restoreAllSlots } from '../dnd/spell-slots.js';
import { rollDice } from '../dnd/dice.js';
import { handleUseItem, handleEquipItem, handleUnequipItem } from './campaign-handlers/item-handler.js';
import { autoFillPreparedSpells } from '../dnd/prepared-casters.js';
import { handleShortRest, handleLongRest, handleRollDeathSave } from './campaign-handlers/rest-handler.js';
import { detectImpliedSkillCheck } from './skill-check-detector.js';
import { getColdOpen, pickFallbackLocation } from './cold-opens.js';
import { uuid } from './util.js';
import type { MemoryStore } from './memory.js';
import { awardXpToParty, type AwardXpResult } from '../dnd/leveling.js';
import type { AchievementEvent } from './achievements.js';

// F17: evento atribuído a um PJ específico (player culpado). Server consome
// e mapeia pra userId pra creditar achievements. campaign não conhece socket.
export type ScopedAchievementEvent = { playerId?: string | null; event: AchievementEvent };

const MAX_RECENT_EVENTS = 30;
const MAX_RECENT_NARRATIONS = 10;
// Quantos facts injetar no prompt do Mestre por narração — equilibra tokens vs recall
const MEMORY_TOPK = 5;
// Auto-resumo dispara quando narrationLog atinge este threshold. Após resumir,
// trim pra últimas 3 entradas — preserva continuidade próxima sem inflar tokens.
const AUTO_SUMMARIZE_AT = 10;
const KEEP_AFTER_SUMMARIZE = 3;
// Opt-out: setar MEMORY_AUTOSUMMARIZE=false desliga. Default ON — gasto controlado
// (1 LLM call extra a cada 10 narrações ≈ 10% overhead, comprime ~80% dos tokens).
const AUTO_SUMMARIZE_ENABLED = process.env.MEMORY_AUTOSUMMARIZE !== 'false';

export class Campaign {
  state: CampaignState;
  party: CharacterSheet[] = [];
  private narrationLog: string[] = [];
  private dm: DMInterface;
  private memory: MemoryStore | undefined;

  // Coop guards
  private isStarted = false;
  private isStarting = false;
  private actionQueue: Promise<unknown> = Promise.resolve();
  // Anti-duplicate: garante que só roda 1 auto-resumo por vez (não dispara enquanto
  // anterior ainda chega da Groq). Sem isso, 2 narrações rápidas disparariam 2 sumários.
  private summarizing = false;

  constructor(dm: DMInterface, opts?: { id?: string; name?: string; memory?: MemoryStore }) {
    this.dm = dm;
    this.memory = opts?.memory;
    const now = Date.now();
    this.state = {
      id: opts?.id ?? uuid(),
      name: opts?.name ?? 'Crônica Sem Nome',
      mode: 'exploration',
      partyCharacterIds: [],
      // Cenas com peso — default vazio. cold-open seta location real,
      // ou pickFallbackLocation() escolhe variada em coop/sessão 2+.
      // NUNCA "taverna" hardcoded (LLM seguia o cliché).
      currentLocation: '',
      currentSceneDescription: '',
      worldFlags: {},
      npcsMet: [],
      recentEvents: [],
      sessionNumber: 1,
      // F27 — saving throw pendente (paralelo a pendingCheck)
      pendingSave: null,
      startedAt: now,
      lastPlayedAt: now,
      pendingCheck: null,
      combat: null,
      quests: [],
    };
  }

  // Quando carregamos campanha persistida, restaura isStarted (se já tem narração)
  // pra evitar disparar startSession outra vez no rejoin.
  markStartedIfHasHistory(): void {
    if (this.narrationLog.length > 0 || this.state.recentEvents.length > 0) {
      this.isStarted = true;
    }
  }

  addCharacter(c: CharacterSheet): void {
    if (!this.party.find((p) => p.id === c.id)) {
      // F23 — Garante estrutura classFeatureUses inicializada (PJs antigos não têm)
      ensureFeatureUses(c);
      // η.5 — Auto-fill spellsPrepared pra prepared casters sem nada preparado
      // (PJs antigos + recém-criados). Gentle default: preenche até o limit.
      autoFillPreparedSpells(c);
      this.party.push(c);
      this.state.partyCharacterIds = this.party.map((p) => p.id);
    }
  }

  removeCharacter(id: string): void {
    this.party = this.party.filter((p) => p.id !== id);
    this.state.partyCharacterIds = this.party.map((p) => p.id);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Mutex: enfileira async ops. Próxima só roda quando a anterior termina.
  // Erros não quebram o queue.
  // ════════════════════════════════════════════════════════════════════════

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.actionQueue.then(fn, fn);
    // Suprime warning de unhandled rejection na queue (caller já lida)
    this.actionQueue = next.catch(() => undefined);
    return next;
  }

  // ════════════════════════════════════════════════════════════════════════
  // RAG: retrieve facts relevantes ao contexto + chama dm.narrate.
  // Centraliza a injeção de memória pra todos os 4-5 call sites do narrate().
  // ════════════════════════════════════════════════════════════════════════

  private async retrieveMemory(focusText: string, focusPlayerId?: string): Promise<MemoryFact[]> {
    if (!this.memory) return [];
    try {
      // Concatena foco (ação/local) com últimos eventos pra ampliar keywords.
      // Limit nas últimas 3 entradas pra não diluir foco com história antiga.
      const lastEvents = this.state.recentEvents.slice(-3).join(' ');
      const query = [focusText, this.state.currentLocation, lastEvents].filter(Boolean).join(' ');
      // PJ-aware: prioriza nome do PJ ativo. Se não houver, usa toda a party.
      const focusNames = focusPlayerId
        ? [this.party.find((p) => p.id === focusPlayerId)?.characterName].filter(Boolean) as string[]
        : this.party.map((p) => p.characterName);
      // F3 — Contextual memory: força slots NPC/promise/location. Garante callbacks
      // naturais (DM cita NPC conhecido + lembra de promessa + descreve local revisto).
      return await this.memory.contextualSearch(this.state.id, query, {
        limit: MEMORY_TOPK,
        focusNames,
        forceNpcSlot: true,
        forcePromiseSlot: true,
        forceLocationSlot: true,
      });
    } catch (err) {
      console.warn('[campaign] memory.search falhou:', err);
      return [];
    }
  }

  // F4 — Constrói ActiveCharacterProfile pra injetar no system prompt do DM.
  // Pega primeira entrada de cada lista (PJs têm 1-2 traits/ideals/bonds/flaws).
  private buildActiveProfile(playerId: string): import('./dm/prompts.js').ActiveCharacterProfile | undefined {
    const pj = this.party.find((p) => p.id === playerId);
    if (!pj) return undefined;
    const race = getRace(pj.raceId);
    const klass = getClass(pj.classId);
    const bg = getBackground(pj.backgroundId);
    const profile: import('./dm/prompts.js').ActiveCharacterProfile = {
      name: pj.characterName,
      race: race.name,
      class: klass.name,
      background: bg.name,
    };
    // η.2 — Usa até 2 traits combinados (PHB tem 2 por PJ)
    if (pj.personalityTraits && pj.personalityTraits.length > 0) {
      profile.trait = pj.personalityTraits.slice(0, 2).join(' · ');
    }
    if (pj.ideals?.[0]) profile.ideal = pj.ideals[0];
    if (pj.bonds?.[0]) profile.bond = pj.bonds[0];
    if (pj.flaws?.[0]) profile.flaw = pj.flaws[0];
    return profile;
  }

  // β.1 — Fetch top-N NPCs do roster persistente pra injetar no prompt.
  // Fire-and-forget seguro: erro = retorna [] (DM cai no fallback npcsMet).
  private async retrieveNpcRoster(limit = 5): Promise<import('../shared/types.js').NpcMemory[]> {
    try {
      const { topRecentNpcs } = await import('./npc-roster.js');
      return await topRecentNpcs(this.state.id, limit);
    } catch (err) {
      console.warn('[campaign] retrieveNpcRoster falhou:', err);
      return [];
    }
  }

  // Helper que extrai foco de uma chamada narrate() pra retrieval. Usa ação do
  // player se houver; senão usa skillCheck; senão usa local atual.
  // Retorna { text, playerId? } pra retrieveMemory aplicar PJ-aware boost.
  private buildMemoryFocus(opts: {
    playerAction?: { playerId?: string; action: string; details?: string };
    skillCheckResolution?: { playerId?: string; skill: string; playerName: string };
  }): { text: string; playerId?: string } {
    if (opts.playerAction) {
      return {
        text: `${opts.playerAction.action}${opts.playerAction.details ? ' ' + opts.playerAction.details : ''}`,
        playerId: opts.playerAction.playerId,
      };
    }
    if (opts.skillCheckResolution) {
      return {
        text: `${opts.skillCheckResolution.playerName} ${opts.skillCheckResolution.skill}`,
        playerId: opts.skillCheckResolution.playerId,
      };
    }
    return { text: this.state.currentLocation ?? '' };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Action loop — player toma ação, DM narra, tools aplicam
  // ════════════════════════════════════════════════════════════════════════

  async startSession(): Promise<DMResponse | null> {
    return this.enqueue(async () => {
      if (this.isStarted || this.isStarting) return null;
      this.isStarting = true;
      try {
        // F1 — Primeiro Minuto Magia: se sessão 1 + party=1 PJ + sem recentEvents,
        // usa cold open background-aware SERVER-SIDE (sem LLM call). Sempre seta
        // pendingCheck pra player rolar dado imediatamente. Reduz time-to-first-roll
        // de minutos pra <60s.
        if (this.state.sessionNumber === 1
            && this.party.length === 1
            && this.state.recentEvents.length === 0
            && this.narrationLog.length === 0) {
          const pj = this.party[0]!;
          const cold = getColdOpen(pj.backgroundId, pj.characterName);
          this.state.currentSceneDescription = cold.narration;
          // Cenas com peso — seta currentLocation real do cold open pra que
          // narrações subsequentes do LLM NÃO arrastem de volta pra "taverna".
          this.state.currentLocation = cold.locationLabel;
          this.state.pendingCheck = {
            skill: cold.pendingCheck.skill,
            dc: cold.pendingCheck.dc,
            reason: cold.pendingCheck.reason,
            playerId: pj.id,
          };
          this.pushRecentEvent(`Cold open: ${cold.pendingCheck.reason}`);
          this.narrationLog.push(`${cold.speaker}: ${cold.narration}`);
          this.isStarted = true;
          return {
            narration: cold.narration,
            speaker: cold.speaker,
            toolCalls: [],
            raw: '',
          };
        }

        // Coop ou sessão 2+ sem cold open: seta location variada
        // pra LLM não improvisar "taverna" default. Server escolhe random.
        if (!this.state.currentLocation || this.state.currentLocation.trim().length === 0) {
          this.state.currentLocation = pickFallbackLocation();
        }

        // A3 — Auto-recap pra sessão N > 1. QW-4: paraleliza recap + narração
        // principal (eram sequenciais → 8-12s na sessão 2+). São operações
        // INDEPENDENTES (recap usa só facts, narrate usa só state) — Promise.all
        // corta a latência pela metade.
        const focus = this.buildMemoryFocus({});

        const recapTask: Promise<string> = (async () => {
          if (this.state.sessionNumber <= 1 || !this.memory) return '';
          try {
            const topFacts = await this.memory.topImportant(this.state.id, {
              limit: 6,
              kinds: ['npc', 'location', 'event', 'promise'],
              minImportance: 1.3,
            });
            if (topFacts.length === 0) return '';
            const recap = await this.dm.generateRecap(topFacts, this.state.dmPersonality);
            if (recap) {
              this.pushRecentEvent(`Sessão ${this.state.sessionNumber} aberta com recap de ${topFacts.length} fatos.`);
              return recap + '\n\n';
            }
            return '';
          } catch (err) {
            console.warn('[campaign] auto-recap falhou:', err);
            return '';
          }
        })();

        const narrateTask: Promise<DMResponse> = (async () => {
          const [memoryFacts, npcRoster] = await Promise.all([
            this.retrieveMemory(focus.text, focus.playerId),
            this.retrieveNpcRoster(),
          ]);
          return this.dm.narrate({
            campaign: this.state,
            party: this.party,
            recentNarrations: this.narrationLog,
            memoryFacts,
            npcRoster,
          });
        })();

        const [recapPrefix, response] = await Promise.all([recapTask, narrateTask]);
        if (recapPrefix) {
          response.narration = recapPrefix + response.narration;
        }
        this.applyDMResponse(response);
        this.isStarted = true;
        return response;
      } finally {
        this.isStarting = false;
      }
    });
  }

  async takeAction(playerId: string, action: ExplorationAction | string, details?: string): Promise<DMResponse> {
    return this.enqueue(async () => {
      // γ.2 — Pré-check: se action implica skill check (regex em details) e o DM
      // AINDA não setou pendingCheck, server injeta automaticamente. DM respeita.
      // Skip se: já tem pendingCheck ativo, combate ativo, ou action não-aplicável.
      const combatActive = this.state.combat?.active === true;
      if (!combatActive && !this.state.pendingCheck) {
        const implied = detectImpliedSkillCheck(String(action), details);
        if (implied) {
          const skillDef = getSkill(implied.skill);
          this.state.pendingCheck = {
            skill: implied.skill,
            dc: implied.dc,
            reason: implied.reason,
            playerId,
          };
          this.pushRecentEvent(`${playerNameOrId(this.party, playerId)} → ${action}${details ? `: ${details}` : ''}`);
          // Resposta sintética — DM não foi chamada. Cliente verá pendingCheck no state
          // e abre o overlay. Tem som de pulso narrativo curto.
          const dummy: DMResponse = {
            narration: `Pra ${implied.reason.toLowerCase()}: ${skillDef.name} DC ${implied.dc}. Rola o d20.`,
            speaker: 'Mestre',
            toolCalls: [],
            raw: '',
          };
          return dummy;
        }
      }

      const focus = this.buildMemoryFocus({ playerAction: { playerId, action: String(action), details } });
      const [memoryFacts, npcRoster] = await Promise.all([
        this.retrieveMemory(focus.text, focus.playerId),
        this.retrieveNpcRoster(),
      ]);
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        playerAction: { playerId, action: String(action), details },
        recentNarrations: this.narrationLog,
        memoryFacts,
        npcRoster,
        // F4 — Injeta profile do PJ ativo (trait/ideal/bond/flaw)
        activeCharacterProfile: this.buildActiveProfile(playerId),
      });
      this.applyDMResponse(response);
      // Mestre Experiente — Post-DM auto-inject de skill check.
      // Se o DM narrou MAS esqueceu de chamar request_skill_check, server detecta
      // pela ação+details e força pendingCheck. Player NUNCA fica sem rolar quando
      // a ação implica incerteza+consequência. Combat-aware (skip).
      const dmAlreadyAskedRoll = this.state.pendingCheck !== null && this.state.pendingCheck !== undefined;
      const stillInCombat = this.state.combat?.active === true;
      if (!dmAlreadyAskedRoll && !stillInCombat) {
        const implied = detectImpliedSkillCheck(String(action), details);
        if (implied) {
          const skillDef = getSkill(implied.skill);
          this.state.pendingCheck = {
            skill: implied.skill,
            dc: implied.dc,
            reason: implied.reason,
            playerId,
          };
          // Adiciona dica na narração pra player ver o "porquê" do roll
          // sem destruir o que o DM já escreveu.
          response.narration = `${response.narration.trim()}\n\n_${skillDef.name} DC ${implied.dc} — ${implied.reason.toLowerCase()}._`;
        }
      }
      this.pushRecentEvent(`${playerNameOrId(this.party, playerId)} → ${action}${details ? `: ${details}` : ''}`);
      return response;
    });
  }

  // Resolve skill check pendente. Verifica owner: só playerId === pendingCheck.playerId.
  // α.3 — useInspiration opcional: gasta 1 inspiração pra forçar advantage no roll.
  async resolveSkillCheck(playerId: string, opts: { useInspiration?: boolean } = {}): Promise<{ roll: DiceRoll; success: boolean; nat20: boolean; nat1: boolean; usedInspiration: boolean; dmResponse: DMResponse } | null> {
    return this.enqueue(async () => {
      const check = this.state.pendingCheck;
      if (!check) return null;
      if (check.playerId !== playerId) return null;

      const player = this.party.find((p) => p.id === playerId);
      if (!player) return null;

      // Limpa antes de rolar (1 tentativa só)
      this.state.pendingCheck = null;

      const skill = getSkill(check.skill);
      const abilityScore = player.abilityScores[skill.ability];
      const modifier = abilityModifier(abilityScore);
      const proficient = player.proficientSkills.includes(check.skill);
      const pb = proficiencyBonus(player.level);
      const totalMod = modifier + (proficient ? pb : 0);

      // α.3 — Inspiração: gasta 1 pra advantage. Server valida que tem ≥1.
      let usedInspiration = false;
      const hasInspiration = (player.inspirations ?? 0) > 0;
      const wantsInspiration = opts.useInspiration === true && hasInspiration;
      if (wantsInspiration) {
        player.inspirations = Math.max(0, (player.inspirations ?? 0) - 1);
        usedInspiration = true;
      }

      // A2 — Buff engine: Guidance dá +1d4 em skill check (consumido após uso)
      const buffs = consumeBuffs(player, 'skill-check');
      // η.4 — DM-declared apply_advantage pendente
      const { consumePendingAdvantage, skillCheckAdvantageMode, combineAdvantage } = await import('../dnd/condition-advantage-rules.js');
      const dmAdv = consumePendingAdvantage(this.state, player.id, 'skill');
      const conditionAdv = skillCheckAdvantageMode(player.conditions);
      let advMode = combineAdvantage(dmAdv ?? 'normal', conditionAdv);
      if (buffs.advantage) advMode = combineAdvantage(advMode, 'advantage');
      if (buffs.disadvantage) advMode = combineAdvantage(advMode, 'disadvantage');
      if (usedInspiration) advMode = combineAdvantage(advMode, 'advantage');
      const roll = rollD20({
        modifier: totalMod + buffs.flatBonus + buffs.diceBonus,
        advantage: advMode === 'advantage',
        disadvantage: advMode === 'disadvantage',
      });
      const success = roll.total >= check.dc;
      // F17: credita skill_check event
      this.pushAchievementEvent(player.id, {
        kind: 'skill_check',
        success,
        nat20: !!roll.nat20,
        nat1: !!roll.nat1,
      });

      const focus = this.buildMemoryFocus({
        skillCheckResolution: { playerId, skill: skill.name, playerName: player.characterName },
      });
      const [memoryFacts, npcRoster] = await Promise.all([
        this.retrieveMemory(focus.text, focus.playerId),
        this.retrieveNpcRoster(),
      ]);
      const dmResponse = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        recentNarrations: this.narrationLog,
        memoryFacts,
        npcRoster,
        skillCheckResolution: {
          playerName: player.characterName,
          skill: skill.name,
          roll: roll.rolls[0] ?? 0,
          modifier: totalMod,
          total: roll.total,
          dc: check.dc,
          success,
          nat20: !!roll.nat20,
          nat1: !!roll.nat1,
        },
        // F4 — Profile do PJ ativo (quem rolou)
        activeCharacterProfile: this.buildActiveProfile(playerId),
      });
      this.applyDMResponse(dmResponse);
      const inspNote = usedInspiration ? ' [com inspiração]' : '';
      this.pushRecentEvent(`${player.characterName} rolou ${skill.name} (${roll.rolls[0]} + ${totalMod} = ${roll.total} vs DC ${check.dc})${inspNote}: ${success ? 'sucesso' : 'falhou'}`);

      return { roll, success, nat20: !!roll.nat20, nat1: !!roll.nat1, usedInspiration, dmResponse };
    });
  }

  hasPendingSkillCheck(): boolean {
    return this.state.pendingCheck !== null;
  }

  getPendingSkillCheck(): CampaignState['pendingCheck'] {
    return this.state.pendingCheck;
  }

  // F27 — Resolve saving throw pendente. Mesma estrutura de resolveSkillCheck mas
  // pra ability save (FOR/DES/CON/INT/SAB/CAR). Proficiência se PJ tem em proficientSavingThrows.
  async resolveSavingThrow(playerId: string): Promise<{ roll: DiceRoll; success: boolean; nat20: boolean; nat1: boolean; dmResponse?: DMResponse } | null> {
    return this.enqueue(async () => {
      const save = this.state.pendingSave;
      if (!save) return null;
      if (save.playerId !== playerId) return null;

      const player = this.party.find((p) => p.id === playerId);
      if (!player) return null;

      // Limpa antes de rolar
      this.state.pendingSave = null;

      const abilityScore = player.abilityScores[save.ability];
      const modifier = abilityModifier(abilityScore);
      const proficient = player.proficientSavingThrows.includes(save.ability);
      const pb = proficiencyBonus(player.level);
      const totalMod = modifier + (proficient ? pb : 0);

      // A2 — Buff engine: Bless aplica +1d4 em saves
      const buffs = consumeBuffs(player, 'save');
      // η.4 — DM-declared apply_advantage + auto-fail check
      const { consumePendingAdvantage, isAutoFailSave, combineAdvantage } = await import('../dnd/condition-advantage-rules.js');
      // Auto-fail STR/DEX se condição incapacitante (paralisado/atordoado/inconsciente/petrificado)
      if (isAutoFailSave(player.conditions, save.ability)) {
        const failRoll = rollD20({ modifier: totalMod });
        // Força total < DC (auto-fail PHB)
        const synthetic = { ...failRoll, total: -999 };
        this.pushRecentEvent(`${player.characterName} falhou auto save ${save.ability.toUpperCase()} (condição incapacitante)`);
        return { roll: synthetic, success: false, nat20: false, nat1: false };
      }
      const dmAdv = consumePendingAdvantage(this.state, player.id, 'save');
      let advMode = dmAdv ?? 'normal';
      if (buffs.advantage) advMode = combineAdvantage(advMode, 'advantage');
      if (buffs.disadvantage) advMode = combineAdvantage(advMode, 'disadvantage');
      const roll = rollD20({
        modifier: totalMod + buffs.flatBonus + buffs.diceBonus,
        advantage: advMode === 'advantage',
        disadvantage: advMode === 'disadvantage',
      });
      const success = roll.total >= save.dc;
      // F17: credita event genérico de skill_check (saves contam pra mesma metric)
      this.pushAchievementEvent(player.id, {
        kind: 'skill_check',
        success,
        nat20: !!roll.nat20,
        nat1: !!roll.nat1,
      });

      this.pushRecentEvent(`${player.characterName} rolou save ${save.ability.toUpperCase()} (${roll.rolls[0]} + ${totalMod} = ${roll.total} vs DC ${save.dc}): ${success ? 'sucesso' : 'falhou'}`);

      return { roll, success, nat20: !!roll.nat20, nat1: !!roll.nat1 };
    });
  }

  hasPendingSave(): boolean {
    return this.state.pendingSave !== null;
  }

  getPendingSave(): CampaignState['pendingSave'] {
    return this.state.pendingSave;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Combat — ações de player + enemy turns automáticos.
  // ════════════════════════════════════════════════════════════════════════

  async playerCombatAction(
    playerId: string,
    action: CombatActionKind,
    targetId?: string,
  ): Promise<{
    ok: boolean;
    events: CombatEvent[];
    log: string;
    outcome?: 'victory' | 'defeat';
    dmFinalNarration?: DMResponse;
  } | null> {
    return this.enqueue(async () => {
      const combat = this.state.combat;
      if (!combat || !combat.active) return null;
      const current = currentParticipant(combat);
      if (!current || current.kind !== 'player' || current.id !== playerId) {
        return { ok: false, events: [], log: 'não é seu turno' };
      }

      const player = this.party.find((p) => p.id === playerId);
      if (!player) return null;

      // β.4 V2 — Checagem + consume da action economy ANTES do switch.
      // Free actions (default case) não consomem nada. Two-weapon → bonus action.
      // Demais (attack/dodge/dash/etc) → action principal.
      // Se já gastou esse slot no turno, aborta com reason explicativo.
      const economyKind = actionEconomyKindFor(action);
      if (economyKind !== 'free') {
        const econ = consumeActionEconomy(combat, playerId, economyKind);
        if (!econ.ok) {
          return { ok: false, events: [], log: econ.reason ?? 'economia de ações bloqueada' };
        }
      }

      const events: CombatEvent[] = [];
      let log = '';

      switch (action) {
        case 'attack': {
          if (!targetId) return { ok: false, events: [], log: 'precisa de alvo' };
          const result = resolvePlayerAttack(player, targetId, combat);
          if (!result) return { ok: false, events: [], log: 'alvo inválido' };
          events.push(...result.events);
          log = result.log;
          // F17: credita attack event ao atacante
          const target = combat.enemies.find((e) => e.id === targetId);
          this.pushAchievementEvent(player.id, {
            kind: 'attack_resolved',
            hit: result.hit,
            crit: result.crit,
            nat20: !!result.attackRoll.nat20,
            nat1: !!result.attackRoll.nat1,
            killed: result.enemyKilled,
            targetIsBoss: target?.isBoss ?? false,
            targetName: target?.name ?? '',
          });
          break;
        }
        case 'dodge': {
          const r = resolvePlayerDodge(player, combat);
          log = r.log;
          break;
        }
        case 'dash': {
          const r = resolvePlayerDash(player, combat);
          log = r.log;
          break;
        }
        case 'disengage': {
          const r = resolvePlayerDisengage(player, combat);
          setCombatFlag(combat, player.id, 'disengaged-this-turn');
          log = r.log;
          break;
        }
        case 'grapple': {
          if (!targetId) return { ok: false, events: [], log: 'precisa de alvo' };
          const r = resolveGrapple(player, targetId, combat);
          if (!r.ok) return { ok: false, events: [], log: r.log };
          events.push(...r.events);
          log = r.log;
          break;
        }
        case 'shove': {
          if (!targetId) return { ok: false, events: [], log: 'precisa de alvo' };
          const r = resolveShove(player, targetId, combat, 'knock-down');
          if (!r.ok) return { ok: false, events: [], log: r.log };
          events.push(...r.events);
          log = r.log;
          break;
        }
        case 'help': {
          const r = resolveHelp(player, this.party, targetId, combat);
          events.push(...r.events);
          log = r.log;
          if (targetId) setCombatFlag(combat, targetId, 'helped-next-attack');
          break;
        }
        case 'hide': {
          // Sprint 5 — Esconder. Stealth check vs maior passive Perception dos inimigos.
          const r = resolvePlayerHide(player, combat);
          log = r.log;
          break;
        }
        case 'two-weapon': {
          // F24 — bonus action: 2º ataque com weapon off-hand. Sem mod no dmg.
          if (!targetId) return { ok: false, events: [], log: 'precisa de alvo' };
          if (hasCombatFlag(combat, player.id, 'bonus-action-used')) {
            return { ok: false, events: [], log: 'bonus action já gasto neste turno' };
          }
          setCombatFlag(combat, player.id, 'bonus-action-used');
          const result = resolvePlayerAttack(player, targetId, combat, { damageDice: '1d6' });
          if (!result) return { ok: false, events: [], log: 'alvo inválido' };
          events.push(...result.events);
          log = `(off-hand) ${result.log}`;
          break;
        }
        default: {
          log = `${player.characterName} usa ${action}.`;
          combat.log.push(log);
          break;
        }
      }

      // Checa fim do combate antes de avançar turno
      const overCheck = isCombatOver(combat, this.party);
      if (overCheck.over) {
        const outcome = overCheck.victory ? 'victory' : 'defeat';
        const dmFinal = await this.endCombatNarrate(outcome);
        return { ok: true, events, log, outcome, dmFinalNarration: dmFinal };
      }

      // Avança turno e executa enemies até cair em player vivo
      const enemyTurnEvents = await this.runEnemyTurnsUntilPlayer();
      events.push(...enemyTurnEvents);

      // Checa novamente após enemy turns
      const overCheck2 = isCombatOver(combat, this.party);
      if (overCheck2.over) {
        const outcome = overCheck2.victory ? 'victory' : 'defeat';
        const dmFinal = await this.endCombatNarrate(outcome);
        return { ok: true, events, log, outcome, dmFinalNarration: dmFinal };
      }

      return { ok: true, events, log };
    });
  }

  // Avança turn e roda enemies sequencialmente até a vez voltar pra um player vivo
  // (ou combate acabar). Retorna events acumulados.
  private async runEnemyTurnsUntilPlayer(): Promise<CombatEvent[]> {
    const combat = this.state.combat;
    if (!combat) return [];
    const events: CombatEvent[] = [];

    // Max iterações = nº participantes × 2 pra evitar loop infinito
    const max = combat.initiativeOrder.length * 2;
    for (let i = 0; i < max; i++) {
      const adv = advanceTurn(combat, this.party);
      if (adv.combatOver) break;
      if (!adv.participant) break;
      if (adv.participant.kind === 'player') break;

      // Enemy turn
      const result = resolveEnemyTurn(adv.participant.id, this.party, combat);
      if (result) events.push(...result.events);

      // Checa fim depois de cada enemy
      const oc = isCombatOver(combat, this.party);
      if (oc.over) break;
    }

    return events;
  }

  // F16: resultado do último combate vencido — distribuído entre PJs vivos.
  // Lido por server/index.ts e emitido como evento `xpAward` por player.
  // Reset a cada novo endCombatNarrate('victory') chamado.
  lastCombatXpAwards: AwardXpResult[] = [];

  // F17: fila de achievement events. Server drena via drainAchievementEvents()
  // depois de cada socket handler.
  private pendingAchievementEvents: ScopedAchievementEvent[] = [];

  pushAchievementEvent(playerId: string | null | undefined, event: AchievementEvent): void {
    this.pendingAchievementEvents.push({ playerId: playerId ?? null, event });
  }

  drainAchievementEvents(): ScopedAchievementEvent[] {
    const out = this.pendingAchievementEvents;
    this.pendingAchievementEvents = [];
    return out;
  }

  // F17: usado por server quando combate começa pra detectar "first combat".
  // Track de quantos combates a campanha viu.
  combatStartCount = 0;

  // F20: highlights pendentes pra persistir. Server drena depois do handler.
  pendingHighlights: Array<{
    characterId: string | null;
    characterName: string | null;
    summary: string;
    kind: 'moment' | 'kill' | 'speech' | 'choice' | 'twist';
  }> = [];

  drainHighlights(): typeof this.pendingHighlights {
    const out = this.pendingHighlights;
    this.pendingHighlights = [];
    return out;
  }

  private async endCombatNarrate(outcome: 'victory' | 'defeat'): Promise<DMResponse | undefined> {
    const combat = this.state.combat;
    if (!combat) return undefined;

    combat.active = false;
    this.state.mode = 'exploration';
    this.pushRecentEvent(outcome === 'victory' ? 'Combate vencido' : 'Party caiu em combate');

    // F16: vitória → distribui XP entre party viva, dispara level-ups.
    this.lastCombatXpAwards = [];
    if (outcome === 'victory') {
      // F17: detecta "untouched" — ninguém da party caiu (currentHp > 0 ainda)
      const allAlive = this.party.every((p) => p.currentHp > 0);
      for (const pj of this.party) {
        this.pushAchievementEvent(pj.id, { kind: 'combat_won', allAlive });
      }

      const totalXp = combat.enemies.reduce((sum, e) => sum + (e.xpAward ?? 10), 0);
      if (totalXp > 0) {
        this.lastCombatXpAwards = awardXpToParty(this.party, totalXp);
        for (const r of this.lastCombatXpAwards) {
          if (r.levelUps.length > 0) {
            const last = r.levelUps[r.levelUps.length - 1]!;
            this.pushRecentEvent(`${r.characterName} subiu pra nível ${last.newLevel} (+${r.xpAwarded} XP)`);
            this.indexFact({
              kind: 'event',
              text: `${r.characterName} subiu pra nível ${last.newLevel} após combate em ${this.state.currentLocation}.`,
              tags: `levelup progressao ${r.characterName.toLowerCase()}`,
              importance: 1.4,
            });
            // F17: credita level_up por nível subido
            for (const lu of r.levelUps) {
              this.pushAchievementEvent(r.characterId, { kind: 'level_up', oldLevel: lu.oldLevel, newLevel: lu.newLevel });
            }
          } else {
            this.pushRecentEvent(`${r.characterName} ganhou ${r.xpAwarded} XP`);
          }
        }
      }
    }

    try {
      const focus = this.buildMemoryFocus({
        playerAction: {
          playerId: this.party[0]?.id,
          action: outcome === 'victory' ? 'combate-vencido' : 'combate-perdido',
        },
      });
      const [memoryFacts, npcRoster] = await Promise.all([
        this.retrieveMemory(focus.text, focus.playerId),
        this.retrieveNpcRoster(),
      ]);
      const response = await this.dm.narrate({
        campaign: this.state,
        party: this.party,
        recentNarrations: this.narrationLog,
        memoryFacts,
        npcRoster,
        playerAction: {
          playerId: this.party[0]?.id ?? 'system',
          action: outcome === 'victory' ? 'combate-vencido' : 'combate-perdido',
          details: outcome === 'victory'
            ? 'Inimigos derrotados. Narre desfecho curto.'
            : 'Party caiu (HP 0). Narre desfecho sombrio — não morte definitiva ainda, só inconsciência.',
        },
      });
      this.applyDMResponse(response);
      return response;
    } catch (err) {
      console.warn('[campaign] DM final combat narration failed:', err);
      return undefined;
    } finally {
      // Limpa combat após narração
      this.state.combat = null;
    }
  }

  // Chamado quando current turn é enemy E ninguém tomou action ainda (depois start_combat).
  // Útil pra primeiro turno se enemy ganhou initiative.
  async kickoffCombatIfEnemyFirst(): Promise<CombatEvent[]> {
    return this.enqueue(async () => {
      const combat = this.state.combat;
      if (!combat || !combat.active) return [];
      const current = currentParticipant(combat);
      if (!current || current.kind === 'player') return [];

      const events: CombatEvent[] = [];
      // Resolve este enemy + roda até player
      const result = resolveEnemyTurn(current.id, this.party, combat);
      if (result) events.push(...result.events);
      const more = await this.runEnemyTurnsUntilPlayer();
      events.push(...more);
      return events;
    });
  }

  getCombatState() {
    return this.state.combat;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Rest — short (gasta hit dice, cura) + long (full restore)
  // ════════════════════════════════════════════════════════════════════════

  // A5 — Rest handlers delegam pra campaign-handlers/rest-handler.ts.
  async shortRest(playerId: string, hitDiceToSpend: number): Promise<{ ok: boolean; healed: number; diceSpent: number; reason?: string }> {
    return this.enqueue(() => handleShortRest(this, playerId, hitDiceToSpend));
  }

  async longRest(playerId: string): Promise<{ ok: boolean; healed: number; reason?: string }> {
    return this.enqueue(() => handleLongRest(this, playerId));
  }

  // F23 — Class feature: aplica efeito (rage, surge, second-wind, etc).
  async useClassFeature(playerId: string, featureKey: FeatureKey, opts: { targetId?: string } = {}): Promise<{ ok: boolean; reason?: string; events: CombatEvent[]; log: string }> {
    return this.enqueue(async () => {
      const player = this.party.find((p) => p.id === playerId);
      if (!player) return { ok: false, reason: 'jogador não encontrado', events: [], log: '' };
      // Garante estrutura inicializada (PJ pode ter sido criado antes do F23)
      ensureFeatureUses(player);
      const result = useFeature(player, featureKey, this.state.combat, this.party, opts);
      if (result.ok) {
        this.pushRecentEvent(result.log);
      }
      return result;
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Death saves — quando HP=0 em combate, no turn do PJ rola d20.
  // ≥10=sucesso; <10=falha. Nat20=recupera 1HP. Nat1=2 falhas.
  // 3 sucessos = estabiliza. 3 falhas = morre (deathCount++).
  // ════════════════════════════════════════════════════════════════════════

  // A5 — Death save handler delegado.
  async rollDeathSave(playerId: string): Promise<{
    ok: boolean;
    rollTotal?: number;
    success?: boolean;
    nat20?: boolean;
    nat1?: boolean;
    stabilized?: boolean;
    died?: boolean;
    successes?: number;
    failures?: number;
    reason?: string;
  }> {
    return this.enqueue(() => handleRollDeathSave(this, playerId));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Inventory — use/equip/unequip items
  // ════════════════════════════════════════════════════════════════════════

  // A5 — Item handlers delegam pra src/server/campaign-handlers/item-handler.ts.
  async useItem(playerId: string, itemId: string): Promise<{ ok: boolean; message: string; effectApplied?: string }> {
    return this.enqueue(() => handleUseItem(this, playerId, itemId));
  }

  async equipItem(playerId: string, itemId: string, slot: 'weapon' | 'armor' | 'shield'): Promise<{ ok: boolean; message: string }> {
    return this.enqueue(() => handleEquipItem(this, playerId, itemId, slot));
  }

  async unequipItem(playerId: string, slot: 'weapon' | 'armor' | 'shield', itemId?: string): Promise<{ ok: boolean; message: string }> {
    return this.enqueue(() => handleUnequipItem(this, playerId, slot, itemId));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cast spell — funciona em exploration OU combat.
  // Em combat só se for vez do caster.
  // ════════════════════════════════════════════════════════════════════════

  async playerCastSpell(
    casterId: string,
    spellId: SpellId,
    targetIds: string[],
    slotLevel: 0 | 1 | 2 | 3 | 4 | 5,
  ): Promise<CastSpellResult & { outcome?: 'victory' | 'defeat' }> {
    return this.enqueue(async () => {
      const caster = this.party.find((p) => p.id === casterId);
      if (!caster) {
        return { ok: false, reason: 'caster não está na party', events: [], narration: '', spellName: '' };
      }

      // Em combate, só na vez do caster
      if (this.state.combat?.active) {
        const cur = currentParticipant(this.state.combat);
        if (!cur || cur.kind !== 'player' || cur.id !== casterId) {
          return { ok: false, reason: 'não é seu turno', events: [], narration: '', spellName: '' };
        }
        // β.4 V2 — Cast Spell em combate consome Ação (simplificação MVP; spells
        // com castingTime=bonus serão tratadas em refinamento futuro de spell metadata).
        const econ = consumeActionEconomy(this.state.combat, casterId, 'action');
        if (!econ.ok) {
          return { ok: false, reason: econ.reason ?? 'sem ação', events: [], narration: '', spellName: '' };
        }
      }

      const result = resolvePlayerCastSpell({
        caster,
        spellId,
        targetIds,
        slotLevel,
        party: this.party,
        combat: this.state.combat,
      });

      if (!result.ok) return result;

      this.pushRecentEvent(result.narration);
      // F17: credita spell_cast event
      this.pushAchievementEvent(caster.id, { kind: 'spell_cast', spellId: String(spellId) });

      // Em combate: checa fim e avança turno
      let outcome: 'victory' | 'defeat' | undefined;
      if (this.state.combat?.active) {
        const oc = isCombatOver(this.state.combat, this.party);
        if (oc.over) {
          outcome = oc.victory ? 'victory' : 'defeat';
          await this.endCombatNarrate(outcome);
        } else {
          // Avança turn e roda enemies
          const enemyEvents = await this.runEnemyTurnsUntilPlayer();
          result.events.push(...enemyEvents);

          const oc2 = isCombatOver(this.state.combat, this.party);
          if (oc2.over) {
            outcome = oc2.victory ? 'victory' : 'defeat';
            await this.endCombatNarrate(outcome);
          }
        }
      }

      return { ...result, outcome };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Aplicação de tool calls do DM
  // ════════════════════════════════════════════════════════════════════════

  private applyDMResponse(response: DMResponse): void {
    const speaker = response.speaker ?? 'Mestre';
    const entry = `${speaker}: ${response.narration}`;
    this.narrationLog.push(entry);
    if (this.narrationLog.length > MAX_RECENT_NARRATIONS) {
      this.narrationLog = this.narrationLog.slice(-MAX_RECENT_NARRATIONS);
    }

    // Quote literal de NPC vale ouro pra manter tom — indexa antes dos tool calls
    // (que podem também salvar fact "npc apareceu", mas separados são complementares).
    // Mestre, Sistema e fallbacks degradados (ex: "Mestre (degradado)") ignorados.
    if (
      speaker !== 'Mestre' &&
      !speaker.startsWith('Mestre ') &&
      speaker !== 'Sistema' &&
      response.narration.trim().length > 0
    ) {
      this.indexFact({
        kind: 'npc',
        text: `${speaker} disse: "${response.narration.trim()}"`,
        tags: `npc fala dialogo ${speaker.toLowerCase()}`,
        importance: 1.5,
      });
    }

    // α.1 — Reseta suggestedActions ANTES de processar tools: chips são da CENA
    // ATUAL. Se o DM mandar suggest_actions nesta response, sobrescreve com novo
    // set. Se esqueceu, fallback abaixo garante chips contextuais.
    this.state.suggestedActions = [];

    for (const tc of response.toolCalls) {
      const valid = validateToolCall(tc);
      if (!valid) {
        console.warn('[campaign] tool inválido rejeitado:', tc.name);
        continue;
      }
      this.applyValidatedTool(valid);
    }

    // Fallback: se o DM não chamou suggest_actions, derivamos chips contextuais
    // de state (combat enemies, exploration smart com NPCs/landmarks da última
    // narração). Player NUNCA fica sem opções E os chips são da cena específica.
    if (this.state.suggestedActions.length === 0) {
      const lastNarration = response.narration && response.narration.trim().length > 0
        ? response.narration
        : this.narrationLog[this.narrationLog.length - 1];
      this.state.suggestedActions = generateFallbackChips(this.state, lastNarration);
    }

    this.state.lastPlayedAt = Date.now();

    // Auto-resumo (fire-and-forget). Roda após aplicar tudo, sem bloquear o queue.
    this.maybeAutoSummarize();
  }

  // Indexer fire-and-forget — salva fact relevante a partir de tool call. Não
  // bloqueia o caller (DB write é I/O e mutex Campaign já garante ordem das ações).
  // Erros são logados mas nunca propagados pra não quebrar narração.
  // F35: público pra dm-tool-applier (extraído de applyValidatedTool).
  indexFact(input: {
    kind: import('../shared/types.js').MemoryFactKind;
    text: string;
    tags?: string;
    importance?: number;
  }): void {
    if (!this.memory) return;
    void this.memory.saveFact({
      campaignId: this.state.id,
      sessionN: this.state.sessionNumber,
      ...input,
    }).catch((err) => {
      console.warn('[campaign] memory.saveFact falhou:', err);
    });
  }

  // Auto-resumo fire-and-forget. Dispara quando narrationLog atinge threshold.
  // Comprime via DM provider (1 call Groq), salva como fact `summary` no banco,
  // trim narrationLog pra últimas 3 — futuras narrações usam o resumo via RAG.
  private maybeAutoSummarize(): void {
    if (!AUTO_SUMMARIZE_ENABLED) return;
    if (!this.memory) return;
    if (this.summarizing) return;
    if (this.narrationLog.length < AUTO_SUMMARIZE_AT) return;
    // Skip se DM não tem summarize (FallbackDM retorna null mesmo, mas evita gasto)
    if (!('summarize' in this.dm)) return;

    this.summarizing = true;
    // Snapshot do log atual ANTES do trim — passa pro LLM
    const toCompress = this.narrationLog.slice(0, this.narrationLog.length - KEEP_AFTER_SUMMARIZE);
    if (toCompress.length === 0) {
      this.summarizing = false;
      return;
    }
    const compressText = toCompress.join('\n');

    // Trim imediato (otimista) — se LLM falhar, perdemos a janela mas próximo
    // ciclo refaz com narrações novas; melhor que segurar tokens à toa.
    this.narrationLog = this.narrationLog.slice(-KEEP_AFTER_SUMMARIZE);

    void (async () => {
      try {
        const summary = await this.dm.summarize(compressText);
        if (summary) {
          await this.memory!.saveFact({
            campaignId: this.state.id,
            kind: 'summary',
            text: summary,
            tags: `resumo sumario sessao${this.state.sessionNumber}`,
            importance: 1.6, // alta — compactação significativa, vale priorizar
            sessionN: this.state.sessionNumber,
          });
        }
      } catch (err) {
        console.warn('[campaign] auto-summarize falhou:', err);
      } finally {
        this.summarizing = false;
      }
    })();
  }

  // F35 — extraído pra src/server/dm-tool-applier.ts.
  // Mantemos delegate aqui pra preservar acesso via this.applyValidatedTool em outros métodos.
  private applyValidatedTool(tool: ValidatedTool): void {
    applyValidatedToolToCampaign(this, tool);
  }


  // F35: público pra dm-tool-applier.
  pushRecentEvent(text: string): void {
    this.state.recentEvents.push(text);
    if (this.state.recentEvents.length > MAX_RECENT_EVENTS) {
      this.state.recentEvents = this.state.recentEvents.slice(-MAX_RECENT_EVENTS);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Snapshot / restore
  // ════════════════════════════════════════════════════════════════════════

  setMode(mode: GameMode): void {
    this.state.mode = mode;
  }

  getNarrationLog(): string[] {
    return [...this.narrationLog];
  }
}

function playerNameOrId(party: CharacterSheet[], id: string): string {
  return party.find((p) => p.id === id)?.characterName ?? id;
}

// Re-export FallbackDM pra server/index.ts decidir
export { DungeonMaster, FallbackDM };
export type { DMInterface };

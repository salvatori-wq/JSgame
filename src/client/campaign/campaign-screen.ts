// JSgame · Tela de campanha. Renderiza exploration OU combat baseado em state.mode.
// Coop-aware:
// - Party panel (todos PJs HP/CA/conditions)
// - Skill-check banner SÓ pro player do pendingCheck.playerId
// - "X está pensando…" sincronizado via dmThinking/dmDone
// - Campaign ID no header pra share

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CampaignState, CharacterSheet, DiceRoll, ExplorationAction, CombatEvent,
} from '../../shared/types';
import { SKILLS } from '../../dnd/skills';
import { abilityModifier, proficiencyBonus } from '../../dnd/attributes';
import { el, setLastSession, clearLastSession } from '../util';
import { getCharacter } from '../api';
import { showPendingSkillCheck, showSkillCheckResult, closeSkillCheck, type PendingCheck } from './skill-check-overlay';
import { renderCombatScreen } from '../combat/combat-screen';
import { openCastSpellModal, closeCastSpellModal, shouldShowCastButton } from '../spells/cast-spell-modal';
import { openInventoryModal, closeInventoryModal } from '../inventory/inventory-modal';
import { openMemoryModal } from './memory-modal';
import { openQuestLog, closeQuestLog } from './quest-log-modal';
import { playHit, playMiss, playDamage, playSpellCast, playNpcSpeaks, isSfxEnabled, setSfxEnabled, notifyCrit, setAmbient, isAmbientEnabled, setAmbientEnabled } from '../audio';
import { notify, isNotifsEnabled, setNotifsEnabled, notifsSupported } from '../notifications';
import { enqueueLevelUp } from '../level-up-overlay';
import { xpProgressInLevel, xpToNextLevel, XP_FOR_LEVEL } from '../../dnd/leveling';
import { showAchievementToast } from '../achievements-toast';
import { portraitFor } from '../../dnd/portrait';
import { findCombatTarget, spawnFloating, flashHpBar } from '../combat/floating-number';
import { isVoiceTtsEnabled, isVoiceTtsSupported, setVoiceTtsEnabled } from '../voice-tts';
import { getPersonality, type DmPersonality } from '../../dnd/dm-personality';
import { maybeShowCounterspellPrompt, closeCounterspellPrompt } from '../combat/counterspell-prompt';
import { toastError, toastWarn } from '../toast';
import { openCombatTutorial, shouldShowCombatTutorial } from '../combat/combat-tutorial';
import { openExplorationTutorial, shouldShowExplorationTutorial, shouldTriggerExplorationTutorial } from './exploration-tutorial';
import { NarrationLog, isDegradedNarration, shouldAutoRetrySilent, maybeTtsSpeak } from './narration-log';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

interface CampaignScreenOpts {
  characterId: string;
  campaignId?: string;
  socket: SocketT;
  ownerName: string;
  onExit: () => void;
}

const ACTIONS: Array<{ id: ExplorationAction; label: string; icon: string }> = [
  { id: 'explore',       label: 'Explorar',         icon: '🔍' },
  { id: 'investigate',   label: 'Investigar',       icon: '🔎' },
  { id: 'talk',          label: 'Falar',            icon: '🗣' },
  { id: 'sneak',         label: 'Furtar-se',        icon: '🥷' },
  { id: 'attack',        label: 'Atacar',           icon: '⚔' },
];

export class CampaignScreen {
  private container: HTMLElement;
  private opts: CampaignScreenOpts;
  private character: CharacterSheet | null = null;
  private party: CharacterSheet[] = [];
  private currentState: CampaignState | null = null;
  private skillCheckOverlay: PendingCheck | null = null;
  // Chat refactor 2026-05-26: NarrationLog encapsula histórico + scroll + thinking
  // inline + error cards. Persistente entre renders — nunca destruída.
  private narrationLog: NarrationLog | null = null;
  // Slots do shell — recriados em cada update* parcial. NarrationLog mora dentro
  // do .ch-narration-host e nunca é recriado, preservando scroll/animations.
  private shellEl: HTMLElement | null = null;
  private slots: {
    header: HTMLElement;
    party: HTMLElement;
    deathBanner: HTMLElement;
    narrationHost: HTMLElement;
    pendingCheck: HTMLElement;
    mainContent: HTMLElement;
    chatBar: HTMLElement;
  } | null = null;
  // Auto-retry tracking: última ação enviada + se já retrou nesse ciclo.
  private lastAction: { action: string; details?: string } | null = null;
  private lastActionAt = 0;
  private autoRetriedThisCycle = false;
  // Quando faz retry silent OU click "Tentar de novo", o server vai emitir
  // OUTRO echo "▶ Player: action" — supressNextPlayerEcho consome o próximo
  // echo do player pra evitar dupla mensagem visual no log.
  private suppressNextPlayerEcho = 0;
  // Flag pra disable das action buttons. Synced com narrationLog.setThinking().
  private isDmThinking = false;
  private combatLog: string[] = [];
  // 1B — combat-local flags (rage, action-surge) por characterId, broadcast pelo server.
  private combatFlags: Record<string, string[]> = {};
  // BUG-002 fix: idempotency lock pra trigger do tutorial — evita double-fire
  // em coop (2 events chegam quase-simultâneo no mesmo client).
  private explorationTutorialFired = false;
  private socketBound = false;
  private socketCleanups: Array<() => void> = [];

  constructor(container: HTMLElement, opts: CampaignScreenOpts) {
    this.container = container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.character = await getCharacter(this.opts.characterId);
    this.party = [this.character];
    this.render();
    this.bindSocket();
    this.opts.socket.emit('joinCampaign', {
      ownerName: this.opts.ownerName,
      characterId: this.opts.characterId,
      campaignId: this.opts.campaignId,
    });
  }

  destroy(): void {
    for (const off of this.socketCleanups) off();
    this.socketCleanups = [];
    closeSkillCheck();
    closeCastSpellModal();
    closeInventoryModal();
    closeQuestLog();
    if (this.narrationLog) {
      this.narrationLog.destroy();
      this.narrationLog = null;
    }
    this.shellEl = null;
    this.slots = null;
    // F21: para música ambiente ao sair
    setAmbient('silence');
  }

  private bindSocket(): void {
    if (this.socketBound) return;
    this.socketBound = true;
    const s = this.opts.socket;

    const onNarration = (payload: { text: string; speaker?: string; mood?: string }): void => {
      const speaker = payload.speaker ?? 'Mestre';

      // Suprime echo do player quando retry silent foi disparado:
      // server emite echo a cada takeAction, mas se já mostramos o echo da
      // ação original, o do retry seria duplicação visual confusa.
      if (this.suppressNextPlayerEcho > 0 && speaker.startsWith('▶ ')) {
        this.suppressNextPlayerEcho--;
        return;
      }

      // Chat refactor 2026-05-26: auto-retry silencioso ANTES de mostrar narração
      // degradada. Se server cedeu mas a gente sabe o que reenviar, tenta 1x.
      const isDegraded = isDegradedNarration(speaker);
      const lastAction = this.getLastActionForRetry();
      const canRetrySilent = shouldAutoRetrySilent({
        speaker,
        lastAction,
        alreadyRetried: this.autoRetriedThisCycle,
        nowMs: Date.now(),
      });

      if (canRetrySilent && lastAction) {
        this.autoRetriedThisCycle = true;
        // Server vai emitir echo do player novamente — suprime pra não duplicar
        this.suppressNextPlayerEcho++;
        console.warn('[campaign] degraded narration — auto-retry silent em 1.2s');
        // Pequeno delay pra não bater no rate limit do mesmo erro
        setTimeout(() => {
          this.opts.socket.emit('takeAction', {
            action: lastAction.action as ExplorationAction,
            details: lastAction.details,
          });
        }, 1200);
        return; // não renderiza o erro ainda — dá a chance do retry
      }

      // SFX: NPC falando (qualquer speaker que não seja Mestre/degradado/Sistema) → chime
      if (speaker !== 'Mestre' && !speaker.startsWith('Mestre ') && speaker !== 'Sistema') {
        playNpcSpeaks();
      }
      // C3 — Voice TTS: só lê narrações do Mestre (não chat do player nem echo de ação).
      // Pula degradadas — quebra imersão ler texto cínico de erro.
      maybeTtsSpeak(payload.text, speaker);
      // Push notif se aba sem foco
      notify({
        title: `${speaker} — ${this.currentState?.name ?? 'Crônica'}`,
        body: payload.text.slice(0, 140),
        tag: 'narration',
      });

      // Append no log persistente OU error card se degradado
      this.ensureNarrationLog();
      if (isDegraded) {
        const retryHandler = lastAction ? () => {
          this.autoRetriedThisCycle = true;
          // Suprime echo do player que server vai re-emitir
          this.suppressNextPlayerEcho++;
          this.opts.socket.emit('takeAction', {
            action: lastAction.action as ExplorationAction,
            details: lastAction.details,
          });
        } : undefined;
        this.narrationLog!.appendError({
          message: payload.text,
          ...(retryHandler ? { onRetry: retryHandler } : {}),
        });
      } else {
        this.narrationLog!.appendNarration({ speaker, text: payload.text });
        // Reset retry flag — narração válida chegou
        this.autoRetriedThisCycle = false;
      }

      // BUG-002 fix: tutorial trigger.
      this.maybeFireExplorationTutorial();
    };
    s.on('dmNarration', onNarration);
    this.socketCleanups.push(() => s.off('dmNarration', onNarration));

    const onState = (state: CampaignState): void => {
      // Detecta "agora é teu turno em combate" e notifica
      const wasMyTurn = !!this.currentState?.combat?.active
        && this.currentState.combat.initiativeOrder[this.currentState.combat.currentTurnIndex]?.id === this.opts.characterId;
      const isMyTurnNow = !!state.combat?.active
        && state.combat.initiativeOrder[state.combat.currentTurnIndex]?.id === this.opts.characterId;
      if (!wasMyTurn && isMyTurnNow) {
        notify({
          title: 'É tua vez!',
          body: `Combate em ${state.currentLocation} — joga teu turno.`,
          tag: 'turn',
        });
      }
      // B2 — Tutorial first-combat: dispara só uma vez por user (localStorage flag)
      // ao detectar transição exploration → combat ativo
      const wasCombat = !!this.currentState?.combat?.active;
      const isCombat = !!state.combat?.active;
      if (!wasCombat && isCombat && shouldShowCombatTutorial()) {
        // Delay pequeno pra UI montar antes do overlay
        setTimeout(() => openCombatTutorial(), 500);
      }
      this.currentState = state;
      // BUG-002 fix: trigger usa função pura (testada) + tenta em TODO update de
      // state — antes só disparava se `!this.currentState` (primeira vez), o que
      // falhava em rejoin onde state arrives ANTES da narration.
      this.maybeFireExplorationTutorial();
      // Persiste sessão ativa pra auto-rejoin no reload
      setLastSession({ characterId: this.opts.characterId, campaignId: state.id });
      // Se pendingCheck mudou e eu sou owner, abre overlay
      this.maybeShowPendingCheck();
      // 2A — Counterspell prompt se DM declarou enemy_casts_spell.
      if (state.pendingEnemySpell && this.character) {
        maybeShowCounterspellPrompt({
          pending: state.pendingEnemySpell,
          me: this.character,
          socket: this.opts.socket,
        });
      } else {
        closeCounterspellPrompt();
      }
      // F21: ambient mood baseado em state.mode
      setAmbient(state.combat?.active ? 'combat' : 'exploration');
      this.render();
    };
    s.on('campaignState', onState);
    this.socketCleanups.push(() => s.off('campaignState', onState));

    const onParty = (party: CharacterSheet[]): void => {
      this.party = party;
      const me = party.find((p) => p.id === this.opts.characterId);
      if (me) this.character = me;
      this.render();
    };
    s.on('partyUpdate', onParty);
    this.socketCleanups.push(() => s.off('partyUpdate', onParty));

    const onCombat = (_combat: unknown): void => {
      // combat embarcado em currentState.combat — só re-renderiza
      this.render();
    };
    s.on('combatState', onCombat);
    this.socketCleanups.push(() => s.off('combatState', onCombat));

    const onCombatFlags = (flags: Record<string, string[]>): void => {
      this.combatFlags = flags;
      this.render();
    };
    s.on('combatFlags', onCombatFlags);
    this.socketCleanups.push(() => s.off('combatFlags', onCombatFlags));

    const onCombatEvent = (ev: CombatEvent): void => {
      if (ev.text) {
        this.combatLog.push(ev.text);
        // Sprint 4: capacity 20→50 — player gosta de scrollar log longo pra ver combate todo.
        if (this.combatLog.length > 50) this.combatLog = this.combatLog.slice(-50);
      }
      // SFX baseado no tipo do evento
      const myId = this.character?.id;
      switch (ev.type) {
        case 'damage':
          // F21: se foi crit, notifyCrit detecta combo (2+ seguidos = som épico)
          if (ev.crit) {
            notifyCrit();
          } else if (ev.targetId && ev.targetId === myId) {
            // PJ teu tomou dano (hit normal) → bass thud
            playDamage();
          } else {
            playHit();
          }
          break;
        case 'attack-miss':
          playMiss();
          break;
        case 'spell-cast':
          playSpellCast();
          break;
        case 'condition-applied':
          playNpcSpeaks(); // chime suave de alerta — reusa SFX
          break;
        case 'death':
          playDamage();
          break;
      }
      // F34 — Floating numbers + HP flash. Antes do render pra agarrar
      // o elemento alvo ainda renderizado com o HP "atual" pré-flash.
      if (ev.targetId) {
        const targetEl = findCombatTarget(ev.targetId);
        if (targetEl) {
          if (ev.type === 'damage' && typeof ev.value === 'number') {
            spawnFloating(targetEl, { value: ev.value, kind: ev.crit ? 'crit' : 'damage' });
            flashHpBar(targetEl);
          } else if (ev.type === 'heal' && typeof ev.value === 'number') {
            spawnFloating(targetEl, { value: ev.value, kind: 'heal' });
          } else if (ev.type === 'attack-miss') {
            spawnFloating(targetEl, { value: 0, kind: 'miss' });
          }
        }
      }
      this.render();
    };
    s.on('combatEvent', onCombatEvent);
    this.socketCleanups.push(() => s.off('combatEvent', onCombatEvent));

    const onDice = (payload: { source: string; roll: DiceRoll; purpose: string }): void => {
      if (payload.purpose === 'skill-check' && this.skillCheckOverlay) {
        showSkillCheckResult(payload.roll, this.skillCheckOverlay, () => {
          this.skillCheckOverlay = null;
          this.render();
        });
      }
    };
    s.on('diceRollResult', onDice);
    this.socketCleanups.push(() => s.off('diceRollResult', onDice));

    const onThinking = (payload: { playerId: string; playerName: string; action: string }): void => {
      // Thinking indicator vai INLINE no narration log (entry temporária com shimmer).
      this.isDmThinking = true;
      this.ensureNarrationLog();
      this.narrationLog!.setThinking({
        playerName: payload.playerName,
        action: payload.action,
        startedAt: Date.now(),
      });
      // Atualiza só action bar pra disable visual ("ocupado")
      this.updateMainContent();
    };
    s.on('dmThinking', onThinking);
    this.socketCleanups.push(() => s.off('dmThinking', onThinking));

    const clearThinking = (): void => {
      this.isDmThinking = false;
      if (this.narrationLog) this.narrationLog.setThinking(null);
    };

    const onDone = (): void => {
      clearThinking();
      this.updateMainContent();
    };
    s.on('dmDone', onDone);
    this.socketCleanups.push(() => s.off('dmDone', onDone));

    const onError = (msg: string): void => {
      console.warn('[campaign] server error:', msg);
      // FIX coop-4: filtra mensagens de race condition / spectator que não são
      // bugs reais — só mostra erros reais (failure de tool call, save fail).
      const benign = /no active campaign|campaign not found|outro player|sem combate ativo/i;
      if (!benign.test(msg)) {
        // B6 — Toast inferior em vez de só push narração (mais visível)
        toastError(msg);
      }
      clearThinking();
    };
    s.on('error', onError);
    this.socketCleanups.push(() => s.off('error', onError));

    // F16 — XP awarded (toast pequeno) + level up (overlay grande)
    const onXp = (payload: { characterId: string; characterName: string; xpAwarded: number; newXp: number }): void => {
      // Mostra toast pra TODOS players (não só o owner) pra share da glória
      const isMe = payload.characterId === this.opts.characterId;
      this.flashToast(`${isMe ? 'Você' : payload.characterName} ganhou +${payload.xpAwarded} XP`);
    };
    s.on('xpAwarded', onXp);
    this.socketCleanups.push(() => s.off('xpAwarded', onXp));

    const onLevelUp = (payload: {
      characterId: string; characterName: string; oldLevel: number; newLevel: number;
      hpGained: number; proficiencyBonusGained: boolean; slotsChanged: boolean;
      level4ChoiceApplied: boolean; notes: string[];
    }): void => {
      // Overlay aparece pra TODOS — celebra a party junto. Só sound e visual,
      // qualquer player pode fechar o próprio.
      enqueueLevelUp(payload);
      notify({
        title: `🌟 LEVEL UP — ${payload.characterName}`,
        body: `Nv ${payload.oldLevel} → Nv ${payload.newLevel}`,
        tag: 'levelup',
      });
    };
    s.on('levelUp', onLevelUp);
    this.socketCleanups.push(() => s.off('levelUp', onLevelUp));

    // F17 — Achievement unlocked toast
    const onAch = (payload: { id: string; name: string; description: string; icon: string }): void => {
      showAchievementToast(payload);
      notify({
        title: `🏆 ${payload.name}`,
        body: payload.description,
        tag: `ach-${payload.id}`,
      });
    };
    s.on('achievementUnlocked', onAch);
    this.socketCleanups.push(() => s.off('achievementUnlocked', onAch));

    // F20 — Daily streak update (só dispara em joinCampaign 1x/sessão)
    const onStreak = (payload: { currentStreak: number; longestStreak: number; brokeRecord: boolean }): void => {
      const msg = payload.brokeRecord
        ? `🔥 ${payload.currentStreak} dias! NOVO recorde pessoal!`
        : `🔥 ${payload.currentStreak} dias seguidos`;
      this.flashToast(msg);
    };
    s.on('streakUpdate', onStreak);
    this.socketCleanups.push(() => s.off('streakUpdate', onStreak));
  }

  // BUG-002 fix: tenta disparar tutorial em qualquer momento (state ou narration).
  // Função pura `shouldTriggerExplorationTutorial` faz o decision-making; método aqui
  // só compõe o input e dispara o setTimeout idempotente.
  private maybeFireExplorationTutorial(): void {
    const state = this.currentState;
    if (!state) return;
    const trigger = shouldTriggerExplorationTutorial({
      sessionNumber: state.sessionNumber,
      narrationsArrived: (this.narrationLog?.getEntries().length ?? 0) > 0,
      alreadyFiredThisSession: this.explorationTutorialFired,
      tutorialNotDoneYet: shouldShowExplorationTutorial(),
    });
    if (trigger) {
      // Marca ANTES do setTimeout — protege contra race em coop (2 events
      // chegando quase-simultâneo no mesmo cliente).
      this.explorationTutorialFired = true;
      setTimeout(() => openExplorationTutorial(), 1200);
    }
  }

  private maybeShowPendingCheck(): void {
    const pending = this.currentState?.pendingCheck;
    if (!pending || !this.character) {
      // Não há check ativo OU já passou — fecha overlay se aberto
      if (!pending && this.skillCheckOverlay) {
        closeSkillCheck();
        this.skillCheckOverlay = null;
      }
      return;
    }
    if (pending.playerId !== this.opts.characterId) return; // não é meu check
    if (this.skillCheckOverlay) return; // já mostrando

    const skill = SKILLS[pending.skill];
    if (!skill) return;
    const abilityScore = this.character.abilityScores[skill.ability];
    const mod = abilityModifier(abilityScore);
    const pb = proficiencyBonus(this.character.level);
    const proficient = this.character.proficientSkills.includes(pending.skill);
    const bonus = mod + (proficient ? pb : 0);
    this.skillCheckOverlay = {
      skill: pending.skill,
      dc: pending.dc,
      reason: pending.reason,
      bonus,
    };
    showPendingSkillCheck(this.skillCheckOverlay, () => {
      this.opts.socket.emit('requestSkillCheck', { skill: pending.skill });
    });
  }

  // Chat refactor: render incremental.
  // Primeiro chamado constrói o SHELL com slots vazios + NarrationLog persistente.
  // Chamadas subsequentes atualizam APENAS os slots dos painéis dinâmicos —
  // o NarrationLog mora dentro de .ch-narration-host e NUNCA é destruído.
  // Isso preserva scroll, foco em inputs e animações em curso.
  private render(): void {
    if (!this.shellEl || !this.slots) this.buildShell();
    this.updateHeader();
    this.updatePartyPanel();
    this.updateDeathBanner();
    this.updatePendingCheck();
    this.updateMainContent();
    this.updateChatBar();
  }

  // Constrói o shell estável uma única vez. Slots ficam vazios — update*() preenchem.
  private buildShell(): void {
    this.container.innerHTML = '';
    const root = el('main', { class: 'camp-screen' });
    const header = el('div', { class: 'ch-slot ch-slot-header' });
    const party = el('div', { class: 'ch-slot ch-slot-party' });
    const deathBanner = el('div', { class: 'ch-slot ch-slot-death-banner' });
    const narrationHost = el('div', { class: 'ch-narration-host' });
    const pendingCheck = el('div', { class: 'ch-slot ch-slot-pending-check' });
    const mainContent = el('div', { class: 'ch-slot ch-slot-main-content' });
    const chatBar = el('div', { class: 'ch-slot ch-slot-chat-bar' });

    root.appendChild(header);
    root.appendChild(party);
    root.appendChild(deathBanner);
    root.appendChild(narrationHost);
    root.appendChild(pendingCheck);
    root.appendChild(mainContent);
    root.appendChild(chatBar);

    // Inicializa o NarrationLog persistente — sobrevive entre renders.
    this.narrationLog = new NarrationLog();
    narrationHost.appendChild(this.narrationLog.element);

    this.container.appendChild(root);
    this.shellEl = root;
    this.slots = { header, party, deathBanner, narrationHost, pendingCheck, mainContent, chatBar };
  }

  private ensureNarrationLog(): void {
    if (!this.narrationLog || !this.shellEl) this.render();
  }

  // Wrappers que mantêm slot estável e só trocam conteúdo.
  private replaceSlot(slot: HTMLElement, content: HTMLElement | null): void {
    slot.replaceChildren();
    if (content) slot.appendChild(content);
  }

  private updateHeader(): void {
    if (!this.slots) return;
    this.replaceSlot(this.slots.header, this.renderHeader());
  }

  private updatePartyPanel(): void {
    if (!this.slots) return;
    if (this.party.length === 0) {
      this.replaceSlot(this.slots.party, null);
      return;
    }
    this.replaceSlot(this.slots.party, this.renderPartyPanel());
  }

  private updateDeathBanner(): void {
    if (!this.slots) return;
    this.replaceSlot(this.slots.deathBanner, this.renderDeathSaveBanner());
  }

  private updatePendingCheck(): void {
    if (!this.slots) return;
    const pending = this.currentState?.pendingCheck;
    const pendingSave = this.currentState?.pendingSave;
    const wrap = el('div');

    if (pending && pending.playerId !== this.opts.characterId) {
      const ownerName = this.party.find((p) => p.id === pending.playerId)?.characterName ?? 'Aliado';
      const sk = SKILLS[pending.skill];
      wrap.appendChild(el('div', { class: 'camp-check-banner is-spectating' }, [
        el('span', { text: `🎲 ${ownerName} está rolando ${sk?.name ?? pending.skill} (DC ${pending.dc}) — ${pending.reason}` }),
      ]));
    }

    if (pendingSave) {
      const isMe = pendingSave.playerId === this.opts.characterId;
      if (isMe) {
        wrap.appendChild(el('div', { class: 'camp-check-banner' }, [
          el('span', { text: `🛡 Save ${pendingSave.ability.toUpperCase()} (DC ${pendingSave.dc}) — ${pendingSave.reason}` }),
          el('button', {
            class: 'cdb-roll-btn',
            text: '🎲 Rolar Save',
            attrs: { type: 'button' },
            on: { click: () => this.opts.socket.emit('resolveSavingThrow') },
          }),
        ]));
      } else {
        const ownerName = this.party.find((p) => p.id === pendingSave.playerId)?.characterName ?? 'Aliado';
        wrap.appendChild(el('div', { class: 'camp-check-banner is-spectating' }, [
          el('span', { text: `🛡 ${ownerName} está rolando save ${pendingSave.ability.toUpperCase()} (DC ${pendingSave.dc}) — ${pendingSave.reason}` }),
        ]));
      }
    }

    this.replaceSlot(this.slots.pendingCheck, wrap.children.length > 0 ? wrap : null);
  }

  // Combat OR actions bar
  private updateMainContent(): void {
    if (!this.slots) return;
    const isCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
    if (isCombat && this.currentState?.combat && this.character) {
      const combatWrap = el('div');
      renderCombatScreen(combatWrap, {
        combat: this.currentState.combat,
        party: this.party,
        myCharacterId: this.opts.characterId,
        socket: this.opts.socket,
        combatLog: this.combatLog,
      });
      this.replaceSlot(this.slots.mainContent, combatWrap);
    } else {
      this.replaceSlot(this.slots.mainContent, this.renderActionsBar());
    }
  }

  private updateChatBar(): void {
    if (!this.slots) return;
    if (this.party.length > 1) {
      this.replaceSlot(this.slots.chatBar, this.renderChatBar());
    } else {
      this.replaceSlot(this.slots.chatBar, null);
    }
  }

  // Auto-retry helper: lastAction com timestamp pra decisão de janela 30s.
  private getLastActionForRetry(): { action: string; details?: string; timestamp: number } | null {
    if (!this.lastAction || this.lastActionAt === 0) return null;
    return { ...this.lastAction, timestamp: this.lastActionAt };
  }

  // FIX coop-3: Chat livre player → party (broadcast pra room toda).
  // Usa Enter pra enviar. Limpa input após envio. Limite 280 chars.
  private renderChatBar(): HTMLElement {
    const input = el('input', {
      class: 'camp-chat-input',
      attrs: {
        type: 'text',
        placeholder: '💬 Falar pra party (Enter pra enviar)',
        maxlength: '280',
      },
    }) as HTMLInputElement;
    const send = (): void => {
      const text = input.value.trim();
      if (!text) return;
      this.opts.socket.emit('chat', { text });
      input.value = '';
    };
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
    });
    return el('div', { class: 'camp-chat-bar' }, [
      input,
      el('button', {
        class: 'camp-chat-send',
        text: 'Enviar',
        attrs: { type: 'button' },
        on: { click: send },
      }),
    ]);
  }

  private dmPersonalityLabel(id: DmPersonality): string {
    const p = getPersonality(id);
    return `${p.icon} ${p.label}`;
  }

  // 3B — Dropdown de dificuldade. Mudança emite updateCampaignSettings.
  private renderDifficultyDropdown(): HTMLElement {
    const current = this.currentState?.combatDifficulty ?? 'auto';
    const select = document.createElement('select');
    select.className = 'camp-difficulty-select';
    select.title = 'Dificuldade preferida de combate (DM respeita)';
    const opts: Array<['easy' | 'medium' | 'hard' | 'deadly' | 'auto', string]> = [
      ['auto', '⚔ Auto'],
      ['easy', '🟢 Fácil'],
      ['medium', '🟡 Médio'],
      ['hard', '🟠 Difícil'],
      ['deadly', '🔴 Mortal'],
    ];
    for (const [val, label] of opts) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      const v = select.value as 'easy' | 'medium' | 'hard' | 'deadly' | 'auto';
      this.opts.socket.emit('updateCampaignSettings', { combatDifficulty: v });
    });
    return select;
  }

  private renderHeader(): HTMLElement {
    const campId = this.currentState?.id;
    return el('header', { class: 'camp-header' }, [
      el('button', {
        class: 'wiz-back-btn',
        text: '← Sair',
        on: {
          click: () => {
            const inCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
            if (inCombat) {
              const ok = confirm('Sair em combate? Teu PJ vira NPC vulnerável e o party continua sem você.');
              if (!ok) return;
            }
            clearLastSession();
            this.opts.onExit();
          },
        },
      }),
      el('div', { class: 'camp-title' }, [
        el('h2', { text: this.currentState?.name ?? 'Carregando…' }),
        el('div', { class: 'camp-loc', text: this.currentState?.currentLocation ?? '...' }),
        // 1C — indicador discreto de personality do DM ativa
        this.currentState?.dmPersonality
          ? el('div', { class: 'camp-personality-tag', attrs: { title: 'Estilo do Mestre' }, text: this.dmPersonalityLabel(this.currentState.dmPersonality) })
          : null,
      ].filter(Boolean) as HTMLElement[]),
      el('button', {
        class: 'camp-sfx-btn',
        text: isSfxEnabled() ? '🔊' : '🔇',
        attrs: { title: 'Liga/desliga sons' },
        on: {
          click: (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            setSfxEnabled(!isSfxEnabled());
            btn.textContent = isSfxEnabled() ? '🔊' : '🔇';
          },
        },
      }),
      el('button', {
        class: 'camp-sfx-btn',
        text: isAmbientEnabled() ? '🎵' : '🎶',
        attrs: { title: 'Liga/desliga música ambiente procedural (F21)' },
        on: {
          click: (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const next = !isAmbientEnabled();
            setAmbientEnabled(next);
            btn.textContent = next ? '🎵' : '🎶';
            btn.style.opacity = next ? '1' : '0.5';
            if (next) {
              setAmbient(this.currentState?.combat?.active ? 'combat' : 'exploration');
            }
          },
          mouseover: (e) => {
            // Refresh visual estado
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.opacity = isAmbientEnabled() ? '1' : '0.5';
          },
        },
      }),
      notifsSupported() ? el('button', {
        class: 'camp-notif-btn',
        text: isNotifsEnabled() ? '🔔' : '🔕',
        attrs: { title: 'Liga/desliga notificações quando aba sem foco' },
        on: {
          click: async (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const next = !isNotifsEnabled();
            const ok = await setNotifsEnabled(next);
            btn.textContent = ok ? '🔔' : '🔕';
          },
        },
      }) : null,
      // C3 — Voice TTS toggle (só aparece se browser suporta)
      isVoiceTtsSupported() ? el('button', {
        class: 'camp-sfx-btn',
        text: isVoiceTtsEnabled() ? '🗣' : '🤐',
        attrs: { title: 'Liga/desliga voz lendo narrações do Mestre' },
        on: {
          click: (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const next = !isVoiceTtsEnabled();
            setVoiceTtsEnabled(next);
            btn.textContent = next ? '🗣' : '🤐';
          },
        },
      }) : null,
      campId ? el('button', {
        class: 'camp-mem-btn',
        text: '🧠',
        attrs: { title: 'Memória do Mestre (RAG)' },
        on: {
          click: () => openMemoryModal({ campaignId: campId, onClose: () => { /* nothing */ } }),
        },
      }) : null,
      // 3B — Dropdown de dificuldade de combate (DM respeita)
      this.renderDifficultyDropdown(),
      // F18 — quest log
      el('button', {
        class: 'camp-mem-btn',
        text: '📜',
        attrs: { title: 'Quest Log (missões ativas)' },
        on: {
          click: () => openQuestLog({
            quests: this.currentState?.quests ?? [],
            onClose: () => { /* nothing */ },
          }),
        },
      }),
      campId ? el('button', {
        class: 'camp-share-btn',
        text: '🔗 Compartilhar',
        attrs: { title: 'Copiar ID da crônica pra share com aliado' },
        on: {
          click: async () => {
            try {
              await navigator.clipboard.writeText(campId);
              this.flashToast('ID copiado! Cole no Home → Joinar.');
            } catch {
              prompt('Copie o ID:', campId);
            }
          },
        },
      }) : null,
    ].filter(Boolean) as HTMLElement[]);
  }

  private renderPartyPanel(): HTMLElement {
    const panel = el('section', { class: 'camp-party' });
    panel.appendChild(el('div', { class: 'cp-title', text: '🛡 Party' }));
    const list = el('div', { class: 'cp-list' });
    for (const p of this.party) {
      const isMe = p.id === this.opts.characterId;
      const isDown = p.currentHp <= 0;
      const hpPct = p.maxHp > 0 ? Math.round((p.currentHp / p.maxHp) * 100) : 0;
      // Slots resumidos
      const slotsInfo: string[] = [];
      for (let lvl = 1; lvl <= 5; lvl++) {
        const s = p.spellSlots[lvl as 1 | 2 | 3 | 4 | 5];
        if (s && s.max > 0) slotsInfo.push(`L${lvl}: ${s.max - s.used}/${s.max}`);
      }
      // F16: XP progress 0..1 dentro do nível atual
      const xpPct = Math.round(xpProgressInLevel(p.xp, p.level) * 100);
      const xpToNext = xpToNextLevel(p.xp, p.level);
      const xpAtMax = p.level >= 20;
      const xpFloor = XP_FOR_LEVEL[p.level] ?? 0;
      const xpInLevel = p.xp - xpFloor;

      const portrait = portraitFor({ raceId: p.raceId, classId: p.classId });
      list.appendChild(el('div', {
        class: `cp-pj ${isMe ? 'is-me' : ''} ${isDown ? 'is-down' : ''}`,
        attrs: { 'data-combat-target': p.id },
      }, [
        el('div', { class: 'cp-pj-portrait', style: { background: portrait.aura }, attrs: { title: `${p.raceId} ${p.classId}` } }, [
          el('span', { class: 'cp-pj-portrait-race', text: portrait.race }),
          el('span', { class: 'cp-pj-portrait-class', text: portrait.class }),
        ]),
        el('div', { class: 'cp-pj-name', text: `${p.characterName}${isMe ? ' (você)' : ''}` }),
        el('div', { class: 'cp-pj-meta', text: `Nv ${p.level} · CA ${p.armorClass} · HD ${p.hitDiceRemaining}/${p.level}` }),
        el('div', { class: 'cp-pj-hp-bar' }, [
          el('div', {
            class: `cp-pj-hp-fill ${hpPct < 33 ? 'is-low' : hpPct < 66 ? 'is-mid' : ''}`,
            style: { width: `${hpPct}%` },
          }),
        ]),
        el('div', { class: 'cp-pj-hp-txt', text: `HP ${p.currentHp}/${p.maxHp}` }),
        // F16 — XP bar
        el('div', { class: 'cp-pj-xp-bar', attrs: { title: xpAtMax ? 'Nível máximo' : `${xpInLevel} XP no nv ${p.level} · faltam ${xpToNext} pro nv ${p.level + 1}` } }, [
          el('div', { class: 'cp-pj-xp-fill', style: { width: `${xpPct}%` } }),
        ]),
        el('div', { class: 'cp-pj-xp-txt', text: xpAtMax ? '★ MAX (nv 20)' : `XP ${p.xp.toLocaleString('pt-BR')}${xpToNext > 0 ? ` · faltam ${xpToNext.toLocaleString('pt-BR')}` : ''}` }),
        slotsInfo.length > 0
          ? el('div', { class: 'cp-pj-slots', text: `🔮 ${slotsInfo.join(' · ')}` })
          : null,
        isDown
          ? el('div', { class: 'cp-pj-death' }, [
              el('span', { class: 'cp-pj-death-label', text: '💀 Death saves' }),
              el('span', { class: 'cp-pj-death-marks' }, [
                el('span', { class: 'cp-pj-death-s', text: `✓${p.deathSaveSuccesses}/3` }),
                el('span', { class: 'cp-pj-death-f', text: `✗${p.deathSaveFailures}/3` }),
              ]),
            ])
          : null,
        p.conditions.length > 0
          ? el('div', { class: 'cp-pj-cond', text: p.conditions.join(' · ') })
          : null,
        p.exhaustion > 0
          ? el('div', { class: 'cp-pj-exhaustion', text: `💀 Exaustão ${p.exhaustion}/6` })
          : null,
        // 1B — Concentration badge (F25): exibe magia ativa em concentração.
        p.concentratingOn
          ? el('div', { class: 'cp-pj-conc', text: `🧠 Conc: ${p.concentratingOn}` })
          : null,
        // 1B — Active buffs badge (A2): Bardic, Bless, Guidance, Shield, Faerie Fire.
        p.activeBuffs && p.activeBuffs.length > 0
          ? el('div', { class: 'cp-pj-buffs', text: `✨ ${p.activeBuffs.map((b) => b.source).join(' · ')}` })
          : null,
        // 1B — Rage badge (F23): flag combat-local serializada via combatFlags event.
        (this.combatFlags[p.id] && this.combatFlags[p.id]!.includes('rage'))
          ? el('div', { class: 'cp-pj-rage', text: '🔥 FÚRIA' })
          : null,
      ].filter(Boolean) as HTMLElement[]));
    }
    panel.appendChild(list);
    return panel;
  }

  private renderDeathSaveBanner(): HTMLElement | null {
    if (!this.character) return null;
    if (this.character.currentHp > 0) return null;
    if (this.character.deathSaveSuccesses >= 3 || this.character.deathSaveFailures >= 3) return null;
    return el('div', { class: 'camp-death-banner' }, [
      el('div', { class: 'cdb-title', text: '💀 Você está caído. Sua vida pende.' }),
      el('div', { class: 'cdb-marks' }, [
        el('span', { class: 'cdb-mark cdb-s', text: `Sucessos: ${this.character.deathSaveSuccesses}/3` }),
        el('span', { class: 'cdb-mark cdb-f', text: `Falhas: ${this.character.deathSaveFailures}/3` }),
      ]),
      el('button', {
        class: 'cdb-roll-btn',
        text: '🎲 Rolar Death Save',
        attrs: { type: 'button' },
        on: { click: () => this.opts.socket.emit('rollDeathSave') },
      }),
    ]);
  }

  private renderActionsBar(): HTMLElement {
    const actionsEl = el('section', { class: 'camp-actions' });
    actionsEl.appendChild(el('h3', { class: 'camp-h3', text: 'O que você faz?' }));
    const disabled = this.isDmThinking;
    const grid = el('div', { class: 'camp-actions-grid' });
    for (const a of ACTIONS) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn',
        attrs: { type: 'button', disabled },
        on: { click: () => this.takeAction(a.id) },
      }, [
        el('span', { class: 'caa-icon', text: a.icon }),
        el('span', { class: 'caa-label', text: a.label }),
      ]));
    }
    // Botão Lançar Magia — só pra casters
    if (shouldShowCastButton(this.character)) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-spell',
        attrs: { type: 'button', disabled },
        on: { click: () => this.openSpellModal() },
      }, [
        el('span', { class: 'caa-icon', text: '🔮' }),
        el('span', { class: 'caa-label', text: 'Magia' }),
      ]));
    }
    // Botão Inventário (sempre disponível)
    if (this.character) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-inv',
        attrs: { type: 'button', disabled, title: 'Inventário, equipamentos, usar itens' },
        on: { click: () => this.openInventory() },
      }, [
        el('span', { class: 'caa-icon', text: '🎒' }),
        el('span', { class: 'caa-label', text: 'Inventário' }),
      ]));
    }
    // Rest buttons (só fora de combate)
    const canRest = this.currentState?.mode !== 'combat';
    if (canRest && this.character) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-rest',
        attrs: { type: 'button', disabled, title: 'Descanso Curto — gasta 1+ hit dice pra curar HP' },
        on: { click: () => this.openShortRestModal() },
      }, [
        el('span', { class: 'caa-icon', text: '🛌' }),
        el('span', { class: 'caa-label', text: 'Curto' }),
      ]));
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-rest',
        attrs: { type: 'button', disabled, title: 'Descanso Longo — HP cheio, slots resetam' },
        on: { click: () => this.confirmLongRest() },
      }, [
        el('span', { class: 'caa-icon', text: '🏕' }),
        el('span', { class: 'caa-label', text: 'Longo' }),
      ]));
    }
    actionsEl.appendChild(grid);

    const customInput = el('input', {
      class: 'camp-custom-input',
      attrs: { type: 'text', placeholder: 'Ou digite uma ação livre (ex: "abro o baú devagar")', maxlength: '200' },
    }) as HTMLInputElement;
    const customBtn = el('button', {
      class: 'wiz-cta',
      text: 'Enviar →',
      attrs: { type: 'button', disabled },
      on: {
        click: () => {
          const v = customInput.value.trim();
          if (v) { this.takeAction('explore', v); customInput.value = ''; }
        },
      },
    });
    customInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const v = customInput.value.trim();
        if (v) { this.takeAction('explore', v); customInput.value = ''; }
      }
    });
    actionsEl.appendChild(el('div', { class: 'camp-custom-row' }, [customInput, customBtn]));
    return actionsEl;
  }

  private takeAction(action: ExplorationAction, details?: string): void {
    // Registra lastAction pra possível retry (auto-silent OU botão error card).
    this.lastAction = details !== undefined ? { action, details } : { action };
    this.lastActionAt = Date.now();
    this.autoRetriedThisCycle = false; // novo ciclo
    this.opts.socket.emit('takeAction', { action, details });
  }

  private openSpellModal(): void {
    if (!this.character) return;
    openCastSpellModal({
      caster: this.character,
      party: this.party,
      combat: this.currentState?.combat ?? null,
      socket: this.opts.socket,
      onClose: () => { /* re-render acontece via campaignState event */ },
    });
  }

  private openInventory(): void {
    if (!this.character) return;
    openInventoryModal({
      character: this.character,
      socket: this.opts.socket,
      onClose: () => { /* re-render via partyUpdate */ },
    });
  }

  private openShortRestModal(): void {
    if (!this.character) return;
    const maxDice = this.character.hitDiceRemaining;
    if (maxDice === 0) {
      this.flashToast('Sem hit dice. Precisa de descanso longo.');
      return;
    }
    const input = prompt(`Quantos hit dice gastar? (1-${maxDice})`, '1');
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n < 1) return;
    this.opts.socket.emit('shortRest', { hitDiceToSpend: Math.min(n, maxDice) });
  }

  private confirmLongRest(): void {
    if (confirm('Descanso longo (8h): HP cheio + spell slots resetam. Avança o tempo. Confirmar?')) {
      this.opts.socket.emit('longRest');
    }
  }

  private flashToast(text: string): void {
    const t = el('div', { class: 'camp-toast', text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
}

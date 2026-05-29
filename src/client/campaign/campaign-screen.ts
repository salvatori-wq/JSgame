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
import { getCharacter, trackClientMetric } from '../api';
import { confirmDialog, inputDialog, pickerDialog } from '../ui-modal';
import { showPendingSkillCheck, showSkillCheckResult, closeSkillCheck, type PendingCheck } from './skill-check-overlay';
import { showDiceRollOverlay } from '../dice/dice-roll-overlay';
import { prewarmPhysicalDice } from '../dice/dice-box-engine';
import { renderCombatScreen } from '../combat/combat-screen';
import { openCastSpellModal, closeCastSpellModal, shouldShowCastButton } from '../spells/cast-spell-modal';
import { openInventoryModal, closeInventoryModal } from '../inventory/inventory-modal';
import { openMemoryModal } from './memory-modal';
import { openQuestLog, closeQuestLog } from './quest-log-modal';
import { openAchievementsModal, closeAchievementsModal } from './achievements-modal';
import { openNpcRosterModal, closeNpcRosterModal } from './npc-roster-modal';
import { openShopModal, closeShopModal } from '../shop/shop-modal';
import { playHit, playMiss, playDamage, playSpellCast, playNpcSpeaks, isSfxEnabled, setSfxEnabled, notifyCrit, setAmbient, isAmbientEnabled, setAmbientEnabled, playEnemyKill, playDeathSaveHeartbeat } from '../audio';
import { notify, isNotifsEnabled, setNotifsEnabled, notifsSupported } from '../notifications';
import { openOverflowMenu, type OverflowMenuItem } from './header-overflow-menu';
import type { AmbientMood } from '../audio';
import { enqueueLevelUp } from '../level-up-overlay';
import { xpProgressInLevel, xpToNextLevel, XP_FOR_LEVEL } from '../../dnd/leveling';
import { showAchievementToast } from '../achievements-toast';
import { portraitFor } from '../../dnd/portrait';
import { iconEl, classIconName } from '../icons/game-icons';
import { effectiveArmorClass } from '../../dnd/active-buffs';
import { findCombatTarget, spawnFloating, flashHpBar } from '../combat/floating-number';
import { isVoiceTtsEnabled, isVoiceTtsSupported, setVoiceTtsEnabled } from '../voice-tts';
import { getPersonality, type DmPersonality } from '../../dnd/dm-personality';
import { maybeShowCounterspellPrompt, closeCounterspellPrompt } from '../combat/counterspell-prompt';
import { toastError, toastWarn } from '../toast';
import { humanizeServerError } from '../humanize-error';
import { openCombatTutorial, shouldShowCombatTutorial } from '../combat/combat-tutorial';
import { openExplorationTutorial, shouldShowExplorationTutorial, shouldTriggerExplorationTutorial } from './exploration-tutorial';
import { openDuolingoTutorial, shouldShowDuolingoTutorial, closeDuolingoTutorial, isRollOverlayOpen } from './duolingo-tutorial';
import { NarrationLog, isDegradedNarration, shouldAutoRetrySilent, maybeTtsSpeak, classIcon } from './narration-log';
import { playConfetti, showItemReveal } from '../reward-juice';

/**
 * Y.B3 — Classifica CombatEvent pro kind do combat-echo no narration-log.
 * Reusa heurística de β.6 (classifyLogLine) mas baseada no ev.type estruturado.
 */
function classifyCombatEventKind(ev: CombatEvent): 'crit' | 'miss' | 'kill' | 'skill' | 'player' | 'enemy' | 'neutral' | 'death' {
  if (ev.type === 'death') return 'death';
  if (ev.type === 'damage' && ev.crit) return 'crit';
  if (ev.type === 'attack-miss') return 'miss';
  if (ev.text) {
    const l = ev.text.toLowerCase();
    if (l.includes('teste de') || l.includes('save') || l.includes('rolou ')) return 'skill';
  }
  return 'neutral';
}
import { shouldShowVoiceMic, startStt, sttErrorMessage, type SttSession } from '../voice-stt';
import { renderStatusRibbon } from './status-ribbon';
import { renderActionDockTopics, resetActionDockState } from './action-dock-topics';
import { renderSavingThrowFormula } from './saving-throw-overlay';
import { openShortRestPicker } from './short-rest-overlay';
import { playLongRestRitual } from './long-rest-ritual';
import { createChatPill, type ChatPillHandle } from './chat-pill';
import { openChatSheet, closeChatSheet, isChatSheetOpen, appendChatMessage, setRemoteTyping, type PartyMessage } from './chat-sheet';
import { type BottomTabBarHandle, type BottomTabId } from './bottom-tab-bar';
import { popAll as popAllSheets } from '../sheet-stack-manager';
import { transitionToCombat, transitionCombatVictory, transitionCombatDefeat, transitionSceneChange, transitionLongRest, transitionRevive, clearTransitions } from '../mode-transitions';
import { openUxSettingsModal } from '../ux-settings-modal';
import { openGlossaryModal } from '../glossary-modal';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

interface CampaignScreenOpts {
  characterId: string;
  campaignId?: string;
  socket: SocketT;
  ownerName: string;
  onExit: () => void;
}

const ACTIONS: Array<{ id: ExplorationAction; label: string; icon: string; promptText: string; placeholder: string }> = [
  { id: 'explore',     label: 'Explorar',   icon: '🔍', promptText: 'Explorar o quê?',       placeholder: 'a taverna, o beco, o baú...' },
  { id: 'investigate', label: 'Investigar', icon: '🔎', promptText: 'Investigar o quê?',     placeholder: 'a marca na parede, o cadáver...' },
  { id: 'talk',        label: 'Falar',      icon: '🗣', promptText: 'Falar com quem? (e o quê?)', placeholder: 'taverneiro: pergunto sobre o mendigo' },
  { id: 'sneak',       label: 'Furtar-se',  icon: '🥷', promptText: 'Furtar-se de quem/onde?', placeholder: 'passar pelo guarda, esconder atrás do barril' },
  { id: 'attack',      label: 'Atacar',     icon: '⚔', promptText: 'Atacar o quê/quem?',     placeholder: 'o orc da esquerda, o vidro' },
];

export class CampaignScreen {
  private container: HTMLElement;
  private opts: CampaignScreenOpts;
  private character: CharacterSheet | null = null;
  private party: CharacterSheet[] = [];
  private currentState: CampaignState | null = null;
  private skillCheckOverlay: PendingCheck | null = null;
  // Rank 1 fix — true enquanto o dado do skill-check está animando/mostrando o
  // resultado. Protege contra o broadcastState (pendingCheck=null) que chega
  // logo após o diceRollResult e fechava o overlay em ~64ms (dado "some sem
  // nexo"). Resetado pelo onClose do próprio overlay (4-5s).
  private skillCheckResolving = false;
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
    bottomTabs: HTMLElement;
  } | null = null;
  // Auto-retry tracking: última ação enviada + se já retrou nesse ciclo.
  private lastAction: { action: string; details?: string } | null = null;
  private lastActionAt = 0;
  private autoRetriedThisCycle = false;
  // Watchdog do Mestre: se o DM não responder (LLM mudo/sem chave em prod), o
  // thinking spinner ficava girando pra sempre = "nada ocorre" (feedback do
  // João no celular). Após uma ação, se nenhum dmDone/error chega em N s,
  // limpamos o spinner + mostramos erro visível + reabilitamos as ações.
  private responseWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DM_RESPONSE_TIMEOUT_MS = 30000;
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
  private viewportCleanups: Array<() => void> = [];
  // ο.2 — Chat Perfeito state
  private chatPill: ChatPillHandle | null = null;
  private partyMessages: PartyMessage[] = [];
  /** Y.A2 — Sprint Y: tracker pra disparar heartbeat só na transição ENTRA (não a cada re-render). */
  private wasInDeathSave = false;
  private unreadChatCount = 0;
  // π.1 — Bottom Tab Bar (mobile portrait-narrow). Persistente entre renders.
  private bottomTabBar: BottomTabBarHandle | null = null;
  private currentOpenTab: BottomTabId | null = null;
  // ψ.5 — Combat turn duration tracking (start ts quando vira meu turno)
  private myTurnStartedAt = 0;
  // M1.1 + N3.2 — Dock attention pulse. Antes era one-shot (1ª vez por sessão).
  // Agora dispara em momentos chave: (a) primeira renderização, (b) quando
  // skill-check/save é fechado (overlay sai, dock fica disponível de novo),
  // (c) quando DM terminou (dmDone) e player precisa decidir próxima ação.
  // Throttled — não pode disparar 2x em <3s pra não virar epileptic flicker.
  private lastDockAttentionAt = 0;
  private readonly DOCK_ATTENTION_THROTTLE_MS = 3000;

  constructor(container: HTMLElement, opts: CampaignScreenOpts) {
    this.container = container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.character = await getCharacter(this.opts.characterId);
    this.party = [this.character];
    this.render();
    // D2 — pré-aquece o dado físico em idle (carrega ~600KB fora do 1º roll,
    // pra ele não aparecer tarde). No-op se físico off / reduced-motion / SSR.
    prewarmPhysicalDice();
    this.bindSocket();
    // ο.1 — Re-render header em resize/orientationchange pra alternar entre
    // ribbon (portrait-narrow) e header full (desktop) conforme viewport muda.
    const onResize = (): void => { this.updateHeader(); };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    this.viewportCleanups.push(() => window.removeEventListener('resize', onResize));
    this.viewportCleanups.push(() => window.removeEventListener('orientationchange', onResize));
    this.opts.socket.emit('joinCampaign', {
      ownerName: this.opts.ownerName,
      characterId: this.opts.characterId,
      campaignId: this.opts.campaignId,
    });
  }

  destroy(): void {
    this.clearResponseWatchdog();
    for (const off of this.socketCleanups) off();
    this.socketCleanups = [];
    for (const off of this.viewportCleanups) off();
    this.viewportCleanups = [];
    // ο.2 — Limpa chat pill + sheets
    if (this.chatPill) {
      this.chatPill.destroy();
      this.chatPill = null;
    }
    // π.1 — Limpa Bottom Tab Bar
    if (this.bottomTabBar) {
      this.bottomTabBar.destroy();
      this.bottomTabBar = null;
    }
    this.currentOpenTab = null;
    // κ.1 — Fecha tutorial Duolingo se aberto
    closeDuolingoTutorial();
    // ψ.5 — Reset state externo do action dock (customDetails + currentTopic)
    resetActionDockState();
    closeChatSheet();
    popAllSheets();
    this.partyMessages = [];
    this.unreadChatCount = 0;
    clearTransitions();
    closeSkillCheck();
    closeCastSpellModal();
    closeInventoryModal();
    closeQuestLog();
    closeAchievementsModal();
    closeNpcRosterModal();
    closeShopModal();
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

    const onNarration = (payload: {
      text: string;
      speaker?: string;
      mood?: string;
      // POLISH γ.4 — errorMeta opcional quando DM degradou
      errorMeta?: {
        providersAttempted: string[];
        lastProvider: string;
        errorKind: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'empty' | 'unknown';
        errorMsg: string;
        canRetry: boolean;
      };
    }): void => {
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
        // POLISH γ.4 — Se server enviou errorMeta estruturada, usa card rico
        // com timeline de providers + tipo de erro + retry. Senão, fallback genérico.
        if (payload.errorMeta) {
          this.narrationLog!.appendDegradedNarration({
            speaker,
            text: payload.text,
            errorMeta: payload.errorMeta,
            ...(retryHandler ? { onRetry: retryHandler } : {}),
          });
          // ψ.5 — Telemetria distribution kinds de erro
          trackClientMetric('error_kind_seen', { kind: payload.errorMeta.errorKind });
        } else {
          this.narrationLog!.appendError({
            message: payload.text,
            ...(retryHandler ? { onRetry: retryHandler } : {}),
          });
          trackClientMetric('error_kind_seen', { kind: 'unknown' });
        }
      } else {
        // W2.1 — Passa currentLocation pra drop-cap inteligente reset por cena.
        const loc = this.currentState?.currentLocation;
        this.narrationLog!.appendNarration({
          speaker,
          text: payload.text,
          ...(typeof loc === 'string' ? { currentLocation: loc } : {}),
        });
        // ψ.5 — Narration word count + auto_retry_success
        const words = payload.text.split(/\s+/).filter((w) => w.length > 0).length;
        trackClientMetric('narration_word_count', { words, kind: 'normal' });
        if (this.autoRetriedThisCycle) {
          // Retry silent funcionou — narração válida chegou após retry
          trackClientMetric('auto_retry_success', { attempt_n: 1, success: true });
        }
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
        // ψ.5 — Start timer pra combat_turn_duration
        this.myTurnStartedAt = Date.now();
      }
      if (wasMyTurn && !isMyTurnNow && this.myTurnStartedAt > 0) {
        // ψ.5 — End timer + track
        const duration_ms = Date.now() - this.myTurnStartedAt;
        if (duration_ms > 0 && duration_ms < 600_000) { // sanity 0-10min
          trackClientMetric('combat_turn_duration', { duration_ms });
        }
        this.myTurnStartedAt = 0;
      }

      // POLISH γ.3 — Scene transition: location mudou → pulsa header pra
      // sinalizar mudança de cena. Anim curta, respeita reduced-motion via CSS.
      const oldLoc = this.currentState?.currentLocation ?? '';
      const newLoc = state.currentLocation ?? '';
      if (oldLoc !== newLoc && newLoc) {
        const locEl = document.querySelector('.camp-loc');
        if (locEl instanceof HTMLElement) {
          locEl.classList.remove('is-scene-changed');
          void locEl.offsetWidth; // force reflow pra reiniciar anim
          locEl.classList.add('is-scene-changed');
          setTimeout(() => locEl.classList.remove('is-scene-changed'), 1200);
        }
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
      // β.3 — Vendor/Shop: abre modal automaticamente quando DM declara open_shop
      if (state.openShop && this.character) {
        openShopModal({
          shop: state.openShop,
          character: this.character,
          socket: this.opts.socket,
          onClose: () => { /* state cleanup via socket closeShop event */ },
        });
      } else {
        closeShopModal();
      }
      // Trilha medieval — mood inteligente. Detecta transição combat→exploration
      // com boss morto pra disparar fanfare 'victory' (one-shot, volta a calm em 4.5s).
      const wasInCombat = !!this.currentState?.combat?.active;
      const isInCombat = !!state.combat?.active;
      const wasFightingBoss = !!this.currentState?.combat?.enemies?.some((e) => e.isBoss);
      // ο.7 — Mode transitions cinematográficas
      if (!wasInCombat && isInCombat) {
        transitionToCombat();
        // Y.B1 — Sprint Y: sincronizar vinheta + ring "passou pra você" do
        // initiative-ribbon. body.is-combat-just-started faz com que o ring
        // expansivo do meu node atrase 400ms (CSS animation-delay) — vinheta
        // 700ms peak por volta de 200ms, ring começa em 400ms = fade direto
        // pro ring expansivo sem gap. Consultor Mobile #1.
        document.body.classList.add('is-combat-just-started');
        window.setTimeout(() => {
          document.body.classList.remove('is-combat-just-started');
        }, 1200);
      } else if (wasInCombat && !isInCombat) {
        // Detecta vitória (todos enemies derrotados) vs derrota (PJ caiu/fugiu)
        const lastCombat = this.currentState?.combat;
        const allEnemiesDead = lastCombat?.enemies.every((e) => e.currentHp <= 0) ?? false;
        if (allEnemiesDead) {
          transitionCombatVictory();
        } else {
          transitionCombatDefeat();
        }
      }
      // Scene change detection (location mudou e não foi combat trigger)
      if (this.currentState && state.currentLocation && this.currentState.currentLocation !== state.currentLocation && !isInCombat) {
        transitionSceneChange();
      }
      // Long rest detection (mode rest)
      if (this.currentState?.mode !== 'rest' && state.mode === 'rest') {
        transitionLongRest();
      }
      // Revive detection (PJ tinha HP 0 e agora tem >0)
      const prevMe = this.currentState ? this.party.find((p) => p.id === this.opts.characterId) : null;
      const currMe = this.party.find((p) => p.id === this.opts.characterId);
      if (prevMe && currMe && prevMe.currentHp <= 0 && currMe.currentHp > 0) {
        transitionRevive();
      }

      if (wasInCombat && !isInCombat && wasFightingBoss) {
        setAmbient('victory');
      } else {
        setAmbient(this.pickAmbientMood(state, this.character));
      }
      this.render();
    };
    s.on('campaignState', onState);
    this.socketCleanups.push(() => s.off('campaignState', onState));

    // ο.2 + W2.3 — Party chat message: absorvido em narration-log como entry
    // inline (.is-party-message). Antes só ia pro chat-sheet modal (disruptivo);
    // agora player vê AMBAS narrações + chat no mesmo fluxo. Em solo (party=1)
    // chat-pill nem aparece, mas mensagens em outros canais (futuros) podem
    // aparecer aqui sem refactor.
    const onPartyMessage = (msg: PartyMessage): void => {
      this.partyMessages.push(msg);
      // W2.3 — Absorve no log SEMPRE (mesmo se chat-sheet aberto). Source of
      // truth visual é o log. chat-sheet vira fallback opcional.
      const charForIcon = this.party.find((p) => p.id === msg.characterId);
      this.narrationLog?.appendPartyMessage({
        speaker: msg.speaker,
        text: msg.text,
        classIcon: classIcon(charForIcon?.classId),
      });
      if (isChatSheetOpen()) {
        appendChatMessage(msg);
      } else if (this.character && msg.characterId !== this.character.id) {
        // Não conta próprias msgs como unread
        this.unreadChatCount += 1;
        this.chatPill?.setUnreadCount(this.unreadChatCount);
        // π.1 — Em portrait-narrow, badge mora no tab bar (chat absorvido).
        this.bottomTabBar?.setUnreadCount(this.unreadChatCount);
      }
    };
    s.on('partyMessage', onPartyMessage);
    this.socketCleanups.push(() => s.off('partyMessage', onPartyMessage));

    // ψ.2 + W2.3 — Backlog em joinCampaign. Insere todas msgs como entries no
    // log (player reconectou e perdeu histórico — vê o que conversaram).
    const onBacklog = (payload: { messages: PartyMessage[] }): void => {
      this.partyMessages = [...payload.messages];
      for (const msg of payload.messages) {
        const charForIcon = this.party.find((p) => p.id === msg.characterId);
        this.narrationLog?.appendPartyMessage({
          speaker: msg.speaker,
          text: msg.text,
          classIcon: classIcon(charForIcon?.classId),
        });
      }
    };
    s.on('partyMessageBacklog', onBacklog);
    this.socketCleanups.push(() => s.off('partyMessageBacklog', onBacklog));

    // ψ.2 — Typing indicator de aliados
    const onTyping = (payload: { characterId: string; speaker: string; isTyping: boolean }): void => {
      if (this.character && payload.characterId === this.character.id) return; // skip próprio
      setRemoteTyping(payload);
    };
    s.on('partyTyping', onTyping);
    this.socketCleanups.push(() => s.off('partyTyping', onTyping));

    const onParty = (party: CharacterSheet[]): void => {
      // Y.B2 — Sprint Y: Detecta NOVO item no inventory (loot drop) e
      // dispara showItemReveal antes de this.character ser atualizado.
      // Comparação por id evita falso-positivo em equip/unequip (mesmo item,
      // só muda flag equipped).
      const me = party.find((p) => p.id === this.opts.characterId);
      const oldIds = new Set((this.character?.inventory ?? []).map((it) => it.id));
      const newItems = me ? me.inventory.filter((it) => !oldIds.has(it.id)) : [];
      this.party = party;
      if (me) this.character = me;
      this.render();
      // Y.B2 — Reveal o ÚLTIMO item novo (geralmente loot puro tem 1 item;
      // múltiplos numa tacada só = level-up de quest reward, mostra o mais
      // raro ou o primeiro). Skip se mesmo player já tinha (rejoin/restore).
      // Auto-dismiss 4.5s ou tap.
      if (newItems.length > 0 && this.currentState !== null) {
        const featured = newItems.find((it) => it.rarity && it.rarity !== 'comum') ?? newItems[0];
        if (featured) {
          try {
            showItemReveal({ item: featured });
          } catch { /* silent — modal queue conflict */ }
        }
      }
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
        // Y.B3 — Sprint Y: absorver no narration-log como is-combat-echo.
        // Mantém cb-log-line legacy como fallback (tab "Log" do combat-screen).
        // Player vê combat events INLINE com narração de Mestre — 1 feed só.
        const kind = classifyCombatEventKind(ev);
        try { this.narrationLog?.appendCombatEcho({ text: ev.text, kind }); } catch { /* silent */ }
      }
      // SFX baseado no tipo do evento
      const myId = this.character?.id;

      // γ.1 — Attack roll: abre overlay do dado SE foi o player que atacou
      // (não mostra pro ataque de inimigo — só dano final aparece pro player).
      if (ev.type === 'attack-roll' && ev.sourceId === myId && typeof ev.value === 'number') {
        const special = ev.crit ? 'crit' : ev.nat1 ? 'fumble' : null;
        showDiceRollOverlay({
          kind: 'd20',
          label: 'ATAQUE',
          preview: ev.preview,
          // D5 — o dado cai na face d20 crua (ev.nat); o total (ev.value) fica
          // no verdict. Fallback pro total se nat ausente (server antigo no deploy).
          final: ev.nat ?? ev.value,
          special,
          verdictText: ev.crit ? 'CRÍTICO!' : ev.nat1 ? 'FALHA CRÍTICA' : `Resultado ${ev.value}`,
          // W1.3 — sem showAfterMs manual: deixa default (2500ms / 4000ms crit/fumble)
          // pro silêncio dramático D&D. Era 1200ms — tempo de Tinder.
        });
        // Não return — outros eventos (damage, miss) chegam logo após e atualizam UI.
        return;
      }

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
          // W3-DnD — Damage TAKEN visceral. Body class .is-took-damage 600ms
          // ativa screen-shake leve + flash vermelho borda. Consultor D&D:
          // "momento de tensão máxima do D&D. Precisa peso visceral, não
          // só -X HP no display". Crit dispara variant mais intensa (HARDHIT).
          if (ev.targetId && ev.targetId === myId && typeof document !== 'undefined') {
            const bodyCls = ev.crit ? 'is-took-damage-crit' : 'is-took-damage';
            document.body.classList.remove(bodyCls);
            void document.body.offsetWidth;
            document.body.classList.add(bodyCls);
            window.setTimeout(() => document.body.classList.remove(bodyCls), 700);
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
          // F2 — kill satisfying se for inimigo morrendo; player KO mantém playDamage
          if (ev.targetId && ev.targetId !== myId) {
            playEnemyKill();
          } else {
            playDamage();
          }
          break;
      }
      // F34 + F2 — Floating numbers + HP flash + hit shake + dying anim.
      if (ev.targetId) {
        const targetEl = findCombatTarget(ev.targetId);
        if (targetEl) {
          if (ev.type === 'damage' && typeof ev.value === 'number') {
            spawnFloating(targetEl, { value: ev.value, kind: ev.crit ? 'crit' : 'damage' });
            flashHpBar(targetEl);
            // F2 — hit shake (300ms). Re-disparável via reflow.
            targetEl.classList.remove('is-hit');
            void targetEl.offsetWidth;
            targetEl.classList.add('is-hit');
            window.setTimeout(() => targetEl.classList.remove('is-hit'), 350);
          } else if (ev.type === 'heal' && typeof ev.value === 'number') {
            spawnFloating(targetEl, { value: ev.value, kind: 'heal' });
          } else if (ev.type === 'attack-miss') {
            spawnFloating(targetEl, { value: 0, kind: 'miss' });
          } else if (ev.type === 'death') {
            // F2 — dying animation (800ms). Render normal vai aplicar is-dead depois.
            targetEl.classList.add('is-dying');
            if (ev.crit) targetEl.classList.add('is-crit-kill');
          }
        }
      }
      this.render();
    };
    s.on('combatEvent', onCombatEvent);
    this.socketCleanups.push(() => s.off('combatEvent', onCombatEvent));

    const onDice = (payload: { source: string; roll: DiceRoll; purpose: string }): void => {
      if (payload.purpose === 'skill-check' && this.skillCheckOverlay) {
        this.skillCheckResolving = true;
        showSkillCheckResult(payload.roll, this.skillCheckOverlay, () => {
          this.skillCheckResolving = false;
          this.skillCheckOverlay = null;
          this.render();
        });
        return;
      }
      // ψ-fix: Saving throw + Death save mostram dado animado (drama D&D real).
      // Antes apareciam só como texto na narração — player rolava e não via NADA.
      if (payload.purpose === 'saving-throw' && payload.source === this.opts.characterId) {
        const pendingSave = this.currentState?.pendingSave;
        const dc = pendingSave?.dc ?? 0;
        const success = payload.roll.total >= dc;
        const special: 'crit' | 'fumble' | 'success' | 'fail' =
          payload.roll.nat20 ? 'crit'
          : payload.roll.nat1 ? 'fumble'
          : success ? 'success' : 'fail';
        showDiceRollOverlay({
          kind: 'd20',
          label: 'SAVE',
          preview: pendingSave ? `${pendingSave.ability.toUpperCase()} vs DC ${pendingSave.dc}` : 'Save',
          final: payload.roll.rolls[0] ?? payload.roll.total,
          special,
          verdictText: payload.roll.nat20 ? 'NAT 20 — Crítico!' : payload.roll.nat1 ? 'NAT 1 — Falha Crítica' : success ? 'Sucesso' : 'Falhou',
          // W1.3 — default 2500ms (4000ms em nat20/nat1) substitui 1800ms manual.
        });
        return;
      }
      if (payload.purpose === 'death-save' && payload.source === this.opts.characterId) {
        const success = payload.roll.total >= 10;
        const special: 'crit' | 'fumble' | 'success' | 'fail' =
          payload.roll.nat20 ? 'crit'
          : payload.roll.nat1 ? 'fumble'
          : success ? 'success' : 'fail';
        showDiceRollOverlay({
          kind: 'd20',
          label: 'DEATH SAVE',
          preview: 'd20 vs DC 10',
          final: payload.roll.rolls[0] ?? payload.roll.total,
          special,
          verdictText: payload.roll.nat20 ? 'NAT 20 — Volta da Morte!' : payload.roll.nat1 ? 'NAT 1 — 2 falhas' : success ? '✓ Sucesso' : '✗ Falha',
          // W1.3 — momento mais dramático do D&D usa default 2500ms (4000ms crit/fumble).
        });
        return;
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
      this.clearResponseWatchdog(); // Mestre respondeu (ou erro) — cancela o watchdog
    };

    const onDone = (): void => {
      clearThinking();
      this.updateMainContent();
      // N3.2 — DM terminou de narrar → dock fica disponível de novo. Pulse
      // chama atenção (throttled internamente — não vira flicker).
      this.fireDockAttention();
    };
    s.on('dmDone', onDone);
    this.socketCleanups.push(() => s.off('dmDone', onDone));

    const onError = (msg: string): void => {
      console.warn('[campaign] server error:', msg);
      // FIX coop-4: filtra mensagens de race condition / spectator que não são
      // bugs reais — só mostra erros reais (failure de tool call, save fail).
      const benign = /no active campaign|campaign not found|outro player|sem combate ativo/i;
      if (!benign.test(msg)) {
        // Sub-sprint C (Henrique) — traduz erros técnicos em mensagens
        // family-friendly antes de exibir no toast.
        toastError(humanizeServerError(msg));
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
      // Y.B2 — Sprint Y: Reward juice confetti dourado em level-up. Consultor
      // Mobile #2: "Marvel Snap moment-of-glory. playLevelUp arpeggio existe
      // mas falta confetti dourado". Dispara só pro PJ DO PLAYER (não tela
      // dos aliados se for coop) — overlay levelUp já mostra pra todos.
      if (this.character && payload.characterId === this.character.id) {
        try { playConfetti({ origin: 'top', count: 70, durationMs: 2400 }); } catch { /* silent */ }
      }
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
  //
  // κ.1 — Antes do exploration-tutorial (cards passivos), dispara Duolingo
  // tutorial guiado (spotlight nos componentes) SE primeira sessão e nunca viu.
  // Os dois NÃO conflitam: Duolingo aparece imediatamente; exploration só se
  // Duolingo skipado/done.
  private maybeFireExplorationTutorial(): void {
    const state = this.currentState;
    if (!state) return;
    const narrationsArrived = (this.narrationLog?.getEntries().length ?? 0) > 0;

    // κ.1 — Duolingo guiado tem prioridade na 1ª sessão
    if (
      state.sessionNumber === 1
      && narrationsArrived
      && !this.explorationTutorialFired
      && shouldShowDuolingoTutorial()
    ) {
      this.explorationTutorialFired = true;
      setTimeout(() => {
        // Não cobrir o dado: o cold-open abre um skill-check overlay (z-9000) e o
        // Duolingo é z-10000 — disparar junto tapa o dado + botão "Rolar". Se um
        // overlay de rolagem estiver aberto, re-arma (fired=false) e adia: o
        // próximo dmNarration/state update (após o check resolver e o player
        // agir) re-tenta com a tela livre.
        if (isRollOverlayOpen()) {
          this.explorationTutorialFired = false;
          return;
        }
        openDuolingoTutorial();
      }, 1200);
      return;
    }

    const trigger = shouldTriggerExplorationTutorial({
      sessionNumber: state.sessionNumber,
      narrationsArrived,
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
      // Não há check ativo OU já passou — fecha overlay se aberto.
      // Rank 1 fix: NÃO fecha se o dado está animando/mostrando resultado
      // (skillCheckResolving). O broadcastState que limpa pendingCheck chega
      // logo após o diceRollResult; sem esta guarda ele arrancava o overlay
      // ~64ms depois do dado começar a girar. O onClose do overlay (4-5s) fecha.
      if (!pending && this.skillCheckOverlay && !this.skillCheckResolving) {
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
      inspirations: this.character.inspirations ?? 0,
    };
    showPendingSkillCheck(
      this.skillCheckOverlay,
      (opts) => {
        this.opts.socket.emit('requestSkillCheck', {
          skill: pending.skill,
          useInspiration: opts.useInspiration,
        });
      },
      // M1.2 — Pular: limpa pendingCheck no server + fecha overlay imediatamente.
      // skillCheckOverlay local também limpa pra não reabrir no próximo state.
      () => {
        this.skillCheckOverlay = null;
        this.opts.socket.emit('skipPendingCheck');
      },
    );
  }

  /** Trilha medieval — escolhe mood baseado em estado completo do jogo.
   *  Ordem de prioridade: shop → combat-boss → combat → danger → rest → exploration. */
  private pickAmbientMood(state: CampaignState, character: CharacterSheet | null): AmbientMood {
    // Shop aberto > tudo
    if (state.openShop) return 'shop';

    // Combat ativo: detecta boss
    if (state.combat?.active) {
      const hasBoss = state.combat.enemies?.some((e) => e.isBoss && e.currentHp > 0);
      return hasBoss ? 'combat-boss' : 'combat-skirmish';
    }

    // Fora de combate: HP crítico do PJ → danger
    if (character && character.maxHp > 0) {
      const hpPct = character.currentHp / character.maxHp;
      if (character.currentHp > 0 && hpPct < 0.25) return 'danger-low-hp';
    }

    // Mode rest do servidor
    if (state.mode === 'rest') return 'rest';

    // Default exploração — calm sempre (tension fica pra trigger explícito futuro)
    return 'exploration-calm';
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
    this.updateBottomTabBar();
    this.updateSuggestedChips();
  }

  // α.1 — Re-sincroniza chips de sugestão com state.suggestedActions.
  // Chips ficam no NarrationLog (depois da última narração).
  // Atualizado: combat também tem chips (tactical, derivados ou do DM).
  private updateSuggestedChips(): void {
    if (!this.narrationLog) return;
    const suggestions = this.currentState?.suggestedActions ?? [];
    if (suggestions.length === 0 || this.isDmThinking) {
      this.narrationLog.setSuggestedChips([]);
      return;
    }
    const isCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
    const chips = suggestions.map((s) => ({
      label: s.label,
      ...(s.hint ? { hint: s.hint } : {}),
      ...(isCombat ? { variant: 'combat' as const } : {}),
      onClick: () => {
        // 'custom' não é ExplorationAction — mapeia pra 'explore' (DM lê details)
        const action: ExplorationAction = (s.action === 'custom' ? 'explore' : s.action) as ExplorationAction;
        this.takeAction(action, s.details);
      },
    }));
    this.narrationLog.setSuggestedChips(chips);
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
    // π.1 — Slot pra Bottom Tab Bar (visível só em portrait-narrow via CSS).
    const bottomTabs = el('div', { class: 'ch-slot ch-slot-bottom-tabs' });

    root.appendChild(header);
    root.appendChild(party);
    root.appendChild(deathBanner);
    root.appendChild(narrationHost);
    root.appendChild(pendingCheck);
    root.appendChild(mainContent);
    root.appendChild(chatBar);
    root.appendChild(bottomTabs);

    // Inicializa o NarrationLog persistente — sobrevive entre renders.
    this.narrationLog = new NarrationLog();
    narrationHost.appendChild(this.narrationLog.element);

    this.container.appendChild(root);
    this.shellEl = root;
    this.slots = { header, party, deathBanner, narrationHost, pendingCheck, mainContent, chatBar, bottomTabs };
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
    // ο.1 — Em portrait-narrow (mobile), substitui header completo por status ribbon
    // mode-aware (1 linha densa, tap pra expandir). Desktop mantém header full.
    const isNarrow = document.body.classList.contains('is-portrait-narrow');
    if (isNarrow) {
      this.replaceSlot(this.slots.header, renderStatusRibbon({
        state: this.currentState,
        character: this.character,
        onExpand: (anchor) => this.openHeaderOverflow(anchor),
        onExit: async () => {
          const inCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
          if (inCombat) {
            // ψ.4 — Modal customizado em vez de confirm() blocking
            const ok = await confirmDialog({
              title: 'Sair em combate?',
              text: 'Teu PJ vira NPC vulnerável e o party continua sem você. A morte ainda é real.',
              confirmText: 'Abandonar',
              cancelText: 'Continuar lutando',
              danger: true,
            });
            if (!ok) return;
          }
          clearLastSession();
          this.opts.onExit();
        },
      }));
    } else {
      this.replaceSlot(this.slots.header, this.renderHeader());
    }
  }

  private updatePartyPanel(): void {
    if (!this.slots) return;
    if (this.party.length === 0) {
      this.replaceSlot(this.slots.party, null);
      return;
    }
    // M1.1 — Solo (1 PJ) compacta o slot pra liberar 6vh ao narration.
    this.slots.party.classList.toggle('is-solo', this.party.length === 1);
    // ③ Redesign mobile: solo + portrait-narrow → faixa fina de 1 linha.
    // is-thin-host zera o padding/cap do slot pra a faixa ser full-bleed e curta.
    const thinHost = this.party.length === 1
      && typeof document !== 'undefined'
      && document.body.classList.contains('is-portrait-narrow');
    this.slots.party.classList.toggle('is-thin-host', thinHost);
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
      if (isMe && this.character) {
        // η.6 — Fórmula didática em vez de banner seco
        wrap.appendChild(renderSavingThrowFormula({
          character: this.character,
          ability: pendingSave.ability,
          dc: pendingSave.dc,
          reason: pendingSave.reason,
          onRoll: () => this.opts.socket.emit('resolveSavingThrow'),
        }));
      } else if (isMe) {
        // Fallback se character ainda null
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
    // FIX mobile dock: marca .camp-screen com class is-in-combat pra dock destacar borda vermelha
    this.shellEl?.classList.toggle('is-in-combat', !!isCombat);
    // ④ Redesign — em combate o scene pin some e a centragem desliga (narração
    // vira recap fino de 18vh). NarrationLog reavalia visibilidade do pin.
    this.narrationLog?.setCombatMode(!!isCombat);
    // FIX morte invisível: marca body com is-player-down quando PJ HP <= 0
    document.body.classList.toggle('is-player-down', !!this.character && this.character.currentHp <= 0);
    // FIX morte definitiva: 3 falhas no death save → tombstone overlay
    document.body.classList.toggle(
      'is-player-dead',
      !!this.character && this.character.currentHp <= 0 && (this.character.deathSaveFailures ?? 0) >= 3,
    );
    // Y.A2 — Sprint Y: Death save drama. Body class .is-death-save-pending
    // ativa vinheta vermelha sutil nas bordas. Heartbeat audio dispara 1×
    // ao ENTRAR no estado (não em cada re-render). lastDeathSavePending
    // tracker module-level previne repetição.
    const inDeathSave = !!this.character
      && this.character.currentHp <= 0
      && (this.character.deathSaveSuccesses ?? 0) < 3
      && (this.character.deathSaveFailures ?? 0) < 3;
    document.body.classList.toggle('is-death-save-pending', inDeathSave);
    if (inDeathSave && !this.wasInDeathSave) {
      // Acabou de entrar em death save state — drama audio
      try { playDeathSaveHeartbeat(); } catch { /* silent */ }
    }
    this.wasInDeathSave = inDeathSave;
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
      // Redesign WhatsApp: em portrait-narrow a EXPLORAÇÃO não usa mais o dock.
      // As ações vivem na barra inferior (.camp-action-bar, updateBottomTabBar)
      // e a narração toma a tela inteira. main-content fica vazio (:empty →
      // some). Desktop mantém o grid flat antigo no main-content.
      const isNarrow = document.body.classList.contains('is-portrait-narrow');
      if (isNarrow) {
        this.replaceSlot(this.slots.mainContent, null);
      } else {
        this.replaceSlot(this.slots.mainContent, this.renderActionsBar());
      }
    }
    // M1.1 + N3.2 — Dispara pulse no dock se já passou throttle desde último
    // disparo. Chamado em primeira renderização + via fireDockAttention() em
    // eventos chave (dmDone, skill check fechado). Limita ruído visual.
    if (this.lastDockAttentionAt === 0) {
      this.fireDockAttention();
    }
  }

  /** N3.2 — Dispara pulse no dock se mobile + não throttled. Idempotente. */
  private fireDockAttention(): void {
    if (!this.slots || !document.body.classList.contains('is-portrait-narrow')) return;
    if (!this.slots.mainContent.firstChild) return;
    const now = Date.now();
    if (now - this.lastDockAttentionAt < this.DOCK_ATTENTION_THROTTLE_MS) return;
    this.lastDockAttentionAt = now;
    const slot = this.slots.mainContent;
    slot.classList.remove('is-dock-attention');
    void slot.offsetWidth; // force reflow pra reiniciar anim
    slot.classList.add('is-dock-attention');
    window.setTimeout(() => slot.classList.remove('is-dock-attention'), 2000);
  }

  private renderActionDockTopics(): HTMLElement {
    return renderActionDockTopics({
      isCombat: false,
      canRest: this.currentState?.mode !== 'combat',
      isCaster: shouldShowCastButton(this.character),
      isDmThinking: this.isDmThinking,
      onAction: (action, details) => this.takeAction(action, details ?? ''),
      onCustomAction: (details) => this.takeAction('explore', details),
      onCastSpell: () => this.openSpellModal(),
      onInventory: () => this.openInventory(),
      onShortRest: () => { void this.openShortRestModal(); },
      onLongRest: () => { void this.confirmLongRest(); },
      // Sub-sprint D2 — player abre picker de perícia e pede dado.
      // Servidor emite skillCheckPending (overlay do dado abre normal).
      onRollDice: () => { void this.openSkillPickerAndRoll(); },
    });
  }

  /** Sub-sprint D2 — abre picker de perícia + emit requestSkillCheck. */
  private async openSkillPickerAndRoll(): Promise<void> {
    if (this.isDmThinking) {
      toastWarn('Aguarde o Mestre terminar antes de pedir outro teste.');
      return;
    }
    const { openSkillPicker } = await import('./skill-picker');
    const skill = await openSkillPicker();
    if (!skill) return;
    // DC fica undefined — server decide DC com base no contexto (default 12 média)
    this.opts.socket.emit('requestSkillCheck', { skill });
  }

  private updateChatBar(): void {
    if (!this.slots) return;
    if (this.party.length > 1) {
      // ο.2 — Coop ativo: chat-bar inline some, pill flutuante toma lugar.
      this.replaceSlot(this.slots.chatBar, null);
      // Redesign WhatsApp — a nav bar que hospedava o Chat em coop foi removida
      // (o rodapé virou barra de ações). O chat volta pro pill flutuante em
      // mobile E desktop (o "Mais" também não traz chat — pill é mais rápido).
      this.ensureChatPill();
    } else {
      this.replaceSlot(this.slots.chatBar, null);
      if (this.chatPill) {
        this.chatPill.destroy();
        this.chatPill = null;
      }
      closeChatSheet();
    }
  }

  /** π.1 — Cria/atualiza Bottom Tab Bar conforme viewport + coop state. */
  private updateBottomTabBar(): void {
    if (!this.slots) return;
    // Redesign WhatsApp — o rodapé deixa de ser nav (Missões/Glórias/NPCs/
    // Convite) e vira a BARRA DE AÇÕES do jogo. Exploração: Explorar/Social/
    // Tentar/Livre/Mais (e o dock de 35vh some → narração domina). Combate:
    // só [⋯ Mais] (o dock ①② tem as ações táticas). Desktop: sem barra.
    if (this.bottomTabBar) { this.bottomTabBar.destroy(); this.bottomTabBar = null; }
    const isNarrow = document.body.classList.contains('is-portrait-narrow');
    if (!isNarrow) {
      this.replaceSlot(this.slots.bottomTabs, null);
      return;
    }
    const isCombat = this.currentState?.mode === 'combat' && !!this.currentState.combat?.active;
    this.replaceSlot(this.slots.bottomTabs, this.renderActionBar(isCombat));
  }

  /** Redesign WhatsApp — barra de ações no rodapé (substitui o dock + a nav
   * antiga). Exploração: 4 ações diretas + Mais. Combate: só Mais (dock ①②
   * tem o tático). O "Mais" (único agora) abre a folha de ferramentas/nav. */
  private renderActionBar(isCombat: boolean): HTMLElement {
    const bar = el('div', { class: `camp-action-bar ${isCombat ? 'is-combat' : ''}` });
    const disabled = this.isDmThinking;
    const mkBtn = (glyph: string, label: string, onClick: () => void, opts: { more?: boolean; alwaysEnabled?: boolean } = {}): HTMLElement =>
      el('button', {
        class: `cab-btn ${opts.more ? 'is-more' : ''}`,
        attrs: { type: 'button', title: label, ...(opts.alwaysEnabled ? {} : disabled ? { disabled: true } : {}) },
        on: { click: onClick },
      }, [
        el('span', { class: 'cab-glyph', text: glyph }),
        el('span', { class: 'cab-label', text: label }),
      ]);

    if (!isCombat) {
      bar.appendChild(mkBtn('🔍', 'Explorar', () => this.takeAction('explore', '')));
      bar.appendChild(mkBtn('🗣', 'Social', () => this.takeAction('talk', '')));
      bar.appendChild(mkBtn('🎲', 'Tentar', () => { void this.openSkillPickerAndRoll(); }));
      bar.appendChild(mkBtn('✎', 'Livre', () => { void this.openFreeAction(); }));
    }
    // Mais sempre disponível (mesmo pensando — é navegação/ferramentas).
    bar.appendChild(mkBtn('⋯', 'Mais', () => { void this.openToolsSheet(); }, { more: true, alwaysEnabled: true }));
    return bar;
  }

  /** ✎ Livre — modal de ação em texto. Envia como takeAction('explore', texto). */
  private async openFreeAction(): Promise<void> {
    if (this.isDmThinking) { toastWarn('Aguarde o Mestre terminar antes de agir.'); return; }
    const result = await inputDialog({
      title: '✎ Ação livre',
      text: 'Descreva o que seu personagem faz. O Mestre interpreta e responde.',
      placeholder: 'ex: abro o baú devagar, olhando se tem armadilha',
      maxLength: 500,
      multiline: true,
      confirmText: 'Enviar',
      cancelText: 'Cancelar',
      validator: (v) => (v.trim().length === 0 ? 'Descreva o que você faz.' : null),
    });
    if (result && result.trim().length > 0) this.takeAction('explore', result.trim());
  }

  /** ⋯ Mais — folha unificada (ferramentas + navegação). Substitui o popover
   * antigo (que abria fora da tela quando ancorado no rodapé) + a nav bar. */
  private async openToolsSheet(): Promise<void> {
    const campId = this.currentState?.id;
    const isCaster = shouldShowCastButton(this.character);
    const canRest = this.currentState?.mode !== 'combat';
    type Tool =
      | 'investigate' | 'sneak' | 'travel' | 'inventory' | 'magic' | 'use-item'
      | 'short-rest' | 'long-rest' | 'quests' | 'npcs' | 'achievements'
      | 'share' | 'glossary' | 'settings';
    const opts: Array<{ value: Tool; label: string; description?: string }> = [];
    if (canRest) {
      opts.push({ value: 'investigate', label: '🔎 Investigar', description: 'analisar uma pista' });
      opts.push({ value: 'sneak', label: '🥷 Furtar-se', description: 'esconder / passar' });
      opts.push({ value: 'travel', label: '🚶 Viajar', description: 'ir pra outro lugar' });
    }
    opts.push({ value: 'inventory', label: '🎒 Inventário' });
    if (isCaster) opts.push({ value: 'magic', label: '🔮 Magia' });
    opts.push({ value: 'use-item', label: '🧪 Usar Item' });
    if (canRest) {
      opts.push({ value: 'short-rest', label: '🛌 Descanso Curto', description: 'gasta hit dice' });
      opts.push({ value: 'long-rest', label: '🏕 Descanso Longo', description: '8h, restaura tudo' });
    }
    opts.push({ value: 'quests', label: '🗺 Missões' });
    opts.push({ value: 'npcs', label: '👥 NPCs' });
    opts.push({ value: 'achievements', label: '🏆 Glórias' });
    if (campId) opts.push({ value: 'share', label: '🤝 Convite', description: 'copiar ID da crônica' });
    opts.push({ value: 'glossary', label: '📖 Glossário' });
    opts.push({ value: 'settings', label: '⚙ Ajustes' });

    const choice = await pickerDialog<Tool>({
      title: '⋯ Mais',
      text: 'Ferramentas e navegação',
      options: opts,
    });
    if (!choice) return;
    switch (choice) {
      case 'investigate': this.takeAction('investigate', ''); break;
      case 'sneak': this.takeAction('sneak', ''); break;
      case 'travel': this.takeAction('travel', ''); break;
      case 'use-item': this.takeAction('use-item', ''); break;
      case 'inventory': this.openInventory(); break;
      case 'magic': this.openSpellModal(); break;
      case 'short-rest': void this.openShortRestModal(); break;
      case 'long-rest': void this.confirmLongRest(); break;
      case 'quests': openQuestLog({ quests: this.currentState?.quests ?? [], onClose: () => { /* noop */ } }); break;
      case 'npcs': if (campId) openNpcRosterModal({ campaignId: campId, onClose: () => { /* noop */ } }); break;
      case 'achievements': openAchievementsModal({ onClose: () => { /* noop */ } }); break;
      case 'share': if (campId) void this.shareCampaignId(campId); break;
      case 'glossary': openGlossaryModal(); break;
      case 'settings': openUxSettingsModal(); break;
    }
  }

  /** π.1 — Click handler — abre modal/sheet correspondente e marca tab ativa. */
  private onBottomTabClick(tab: BottomTabId, anchor: HTMLElement): void {
    const campId = this.currentState?.id;
    // π — Telemetria distribution por slot (fire-and-forget).
    trackClientMetric('bottom_tab_tap', { tab });
    // Toggle: tap em tab já ativa fecha o modal
    if (this.currentOpenTab === tab) {
      this.closeCurrentTabModal(tab);
      return;
    }
    switch (tab) {
      case 'quests':
        this.markTabActive('quests');
        openQuestLog({
          quests: this.currentState?.quests ?? [],
          onClose: () => this.markTabActive(null),
        });
        break;
      case 'achievements':
        this.markTabActive('achievements');
        openAchievementsModal({ onClose: () => this.markTabActive(null) });
        break;
      case 'npcs':
        if (!campId) return;
        this.markTabActive('npcs');
        openNpcRosterModal({ campaignId: campId, onClose: () => this.markTabActive(null) });
        break;
      case 'chat':
        this.markTabActive('chat');
        this.openPartyChat();
        // Sync: closeChatSheet em outros lugares também precisa limpar — caller marca via close
        break;
      case 'share':
        if (!campId) return;
        void this.shareCampaignId(campId);
        break;
      case 'more':
        this.markTabActive('more');
        this.openHeaderOverflow(anchor);
        // overflow menu fecha via document click — limpa active state em delay
        setTimeout(() => {
          if (this.currentOpenTab === 'more') this.markTabActive(null);
        }, 100);
        break;
    }
  }

  private markTabActive(tab: BottomTabId | null): void {
    this.currentOpenTab = tab;
    this.bottomTabBar?.setActiveTab(tab);
  }

  private closeCurrentTabModal(tab: BottomTabId): void {
    switch (tab) {
      case 'quests': closeQuestLog(); break;
      case 'achievements': closeAchievementsModal(); break;
      case 'npcs': closeNpcRosterModal(); break;
      case 'chat': closeChatSheet(); break;
      case 'more':
        // overflow menu fecha sozinho via doc click — apenas limpa estado
        break;
    }
    this.markTabActive(null);
  }

  private async shareCampaignId(campId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(campId);
      this.flashToast('ID copiado! Cole no Home → Tenho o ID de uma crônica.');
    } catch {
      prompt('Copie o ID:', campId);
    }
  }

  private ensureChatPill(): void {
    if (this.chatPill) return;
    this.chatPill = createChatPill({
      unreadCount: this.unreadChatCount,
      onClick: () => this.openPartyChat(),
    });
    document.body.appendChild(this.chatPill.element);
  }

  private openPartyChat(): void {
    if (!this.character) return;
    if (isChatSheetOpen()) {
      closeChatSheet();
      // π.1 — limpa active state quando chat fecha por toggle
      if (this.currentOpenTab === 'chat') this.markTabActive(null);
      return;
    }
    // Zera unread ao abrir
    this.unreadChatCount = 0;
    this.chatPill?.setUnreadCount(0);
    this.bottomTabBar?.setUnreadCount(0);
    openChatSheet({
      party: this.party,
      messages: this.partyMessages,
      myCharacterId: this.character.id,
      onSend: (text) => this.opts.socket.emit('chat', { text }),
      // ψ.2 — Typing indicator emit (debounced no chat-sheet)
      onTyping: (isTyping) => this.opts.socket.emit('chatTyping', { isTyping }),
      onClose: () => {
        if (this.currentOpenTab === 'chat') this.markTabActive(null);
      },
    });
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

  // γ.5 — renderDifficultyDropdown deletado; difficulty agora vive no overflow menu.

  private renderHeader(): HTMLElement {
    const campId = this.currentState?.id;
    return el('header', { class: 'camp-header' }, [
      el('button', {
        class: 'wiz-back-btn',
        text: '← Sair',
        on: {
          click: async () => {
            const inCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
            if (inCombat) {
              // ψ.4 — Modal customizado (era confirm() nativo)
              const ok = await confirmDialog({
                title: 'Sair em combate?',
                text: 'Teu PJ vira NPC vulnerável e o party continua sem você. A morte ainda é real.',
                confirmText: 'Abandonar',
                cancelText: 'Continuar lutando',
                danger: true,
              });
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
      // MP2 — Chips secundários agrupados pra layout 2-row em mobile.
      // Desktop: display:contents (transparente). Mobile: row 2 scroll-x.
      el('div', { class: 'camp-header-chips' }, [
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
        // β.2 — achievements modal
        el('button', {
          class: 'camp-mem-btn',
          text: '🏆',
          attrs: { title: 'Conquistas' },
          on: {
            click: () => openAchievementsModal({ onClose: () => { /* nothing */ } }),
          },
        }),
        // β.1 — NPC roster modal
        campId ? el('button', {
          class: 'camp-mem-btn',
          text: '👥',
          attrs: { title: 'NPCs conhecidos' },
          on: {
            click: () => openNpcRosterModal({ campaignId: campId, onClose: () => { /* nothing */ } }),
          },
        }) : null,
        campId ? el('button', {
          class: 'camp-share-btn',
          text: '🔗',
          attrs: { title: 'Copiar ID da crônica pra share com aliado' },
          on: {
            click: async () => {
              try {
                await navigator.clipboard.writeText(campId);
                this.flashToast('ID copiado! Cole no Home → Tenho o ID de uma crônica.');
              } catch {
                prompt('Copie o ID:', campId);
              }
            },
          },
        }) : null,
      ].filter(Boolean) as HTMLElement[]),
      // γ.5 — Overflow menu (⋯) com configurações secundárias
      el('button', {
        class: 'camp-mem-btn camp-overflow-btn',
        text: '⋯',
        attrs: { title: 'Mais opções (sons, notificações, dificuldade)', 'aria-label': 'Mais opções', 'aria-haspopup': 'menu' },
        on: {
          click: (e) => this.openHeaderOverflow(e.currentTarget as HTMLElement),
        },
      }),
    ].filter(Boolean) as HTMLElement[]);
  }

  /** γ.5 — Abre overflow menu com configurações secundárias. */
  private openHeaderOverflow(anchor: HTMLElement): void {
    const campId = this.currentState?.id;
    const items: OverflowMenuItem[] = [
      {
        icon: isSfxEnabled() ? '🔊' : '🔇',
        label: `Sons ${isSfxEnabled() ? 'ON' : 'OFF'}`,
        title: 'Liga/desliga efeitos sonoros',
        active: isSfxEnabled(),
        onClick: () => {
          setSfxEnabled(!isSfxEnabled());
          this.render();
        },
      },
      {
        icon: isAmbientEnabled() ? '🎵' : '🎶',
        label: `Música ${isAmbientEnabled() ? 'ON' : 'OFF'}`,
        title: 'Liga/desliga música ambiente procedural',
        active: isAmbientEnabled(),
        onClick: () => {
          const next = !isAmbientEnabled();
          setAmbientEnabled(next);
          if (next && this.currentState) {
            setAmbient(this.pickAmbientMood(this.currentState, this.character));
          }
          this.render();
        },
      },
    ];

    if (notifsSupported()) {
      items.push({
        icon: isNotifsEnabled() ? '🔔' : '🔕',
        label: `Notif ${isNotifsEnabled() ? 'ON' : 'OFF'}`,
        title: 'Notificações quando aba sem foco',
        active: isNotifsEnabled(),
        onClick: async () => {
          await setNotifsEnabled(!isNotifsEnabled());
          this.render();
        },
      });
    }

    if (isVoiceTtsSupported()) {
      items.push({
        icon: isVoiceTtsEnabled() ? '🗣' : '🤐',
        label: `Voz ${isVoiceTtsEnabled() ? 'ON' : 'OFF'}`,
        title: 'Voz lendo narrações do Mestre',
        active: isVoiceTtsEnabled(),
        onClick: () => {
          setVoiceTtsEnabled(!isVoiceTtsEnabled());
          this.render();
        },
      });
    }

    if (campId) {
      items.push({
        icon: '🧠',
        label: 'Memória',
        title: 'Memória do Mestre (RAG)',
        onClick: () => openMemoryModal({ campaignId: campId, onClose: () => { /* nothing */ } }),
      });
    }

    // 3B — Dificuldade — abre dropdown nativo via prompt simples
    items.push({
      icon: '⚔',
      label: 'Dificuldade',
      title: 'Mudar dificuldade de combate',
      onClick: () => { void this.promptDifficultyChange(); },
    });

    // ο.8 — UX Settings (density / font / contrast / anim)
    items.push({
      icon: '🎨',
      label: 'Tela',
      title: 'Densidade, fonte, contraste, animações',
      onClick: () => openUxSettingsModal(),
    });

    // κ.2 — Glossário D&D pt-BR
    items.push({
      icon: '📖',
      label: 'Glossário',
      title: 'O que é DC? AC? Slot? Advantage? Aprende os termos.',
      onClick: () => openGlossaryModal(),
    });

    openOverflowMenu(anchor, items);
  }

  private async promptDifficultyChange(): Promise<void> {
    const current = this.currentState?.combatDifficulty ?? 'auto';
    // ψ.4 — Picker modal customizado (era prompt() nativo blocking)
    const result = await pickerDialog<'auto' | 'easy' | 'medium' | 'hard' | 'deadly'>({
      title: 'Dificuldade de Combate',
      text: 'Como o Mestre vai balancear os encontros desta crônica?',
      initialValue: current,
      options: [
        { value: 'auto', icon: '⚔', label: 'Auto', description: 'Mestre decide pela cena' },
        { value: 'easy', icon: '🟢', label: 'Fácil', description: 'Vitórias claras, dano controlado' },
        { value: 'medium', icon: '🟡', label: 'Médio', description: 'Padrão D&D 5e — risco real' },
        { value: 'hard', icon: '🟠', label: 'Difícil', description: 'Tem que pensar tática' },
        { value: 'deadly', icon: '🔴', label: 'Mortal', description: 'Morte é provável — heroico ou hardcore' },
      ],
    });
    if (!result) return;
    this.opts.socket.emit('updateCampaignSettings', { combatDifficulty: result });
  }

  private renderPartyPanel(): HTMLElement {
    // ③ Redesign mobile: solo + portrait-narrow → faixa fina de 1 linha
    // (portrait + nome + HP + CA), sem XP/slots in-game. Libera ~90px: na
    // exploração a narração (flex:1) absorve, no combate o dock (flex:1, sem
    // cap) preenche. Coop e desktop mantêm o card completo.
    const isNarrow = typeof document !== 'undefined' && document.body.classList.contains('is-portrait-narrow');
    if (isNarrow && this.party.length === 1 && this.party[0]) {
      return this.renderPartyStrip(this.party[0]);
    }
    const panel = el('section', { class: 'camp-party' });
    panel.appendChild(el('div', { class: 'cp-title', text: '🛡 Party' }));
    // O2.2 — Em coop (2+ PJs), .cp-list ganha is-coop pra ativar layout
    // horizontal scroll-snap em mobile (cada PJ vira card compact 200px).
    const list = el('div', { class: `cp-list${this.party.length > 1 ? ' is-coop' : ''}` });
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
          iconEl(classIconName(p.classId), portrait.class, { className: 'cp-pj-portrait-class' }),
        ]),
        el('div', { class: 'cp-pj-name', text: `${p.characterName}${isMe ? ' (você)' : ''}` }),
        el('div', { class: 'cp-pj-meta', text: `Nv ${p.level} · CA ${effectiveArmorClass(p)}${effectiveArmorClass(p) !== p.armorClass ? '✦' : ''} · HD ${p.hitDiceRemaining}/${p.level}` }),
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
        // α.3 — Inspiração badge (PHB pág 125): 1-3 estrelas douradas
        (p.inspirations && p.inspirations > 0)
          ? el('div', {
              class: 'cp-pj-inspiration',
              attrs: { title: `${p.inspirations} inspiração(ões) — gasta antes de rolar pra advantage` },
              text: '🌟'.repeat(Math.min(3, p.inspirations)),
            })
          : null,
      ].filter(Boolean) as HTMLElement[]));
    }
    panel.appendChild(list);
    return panel;
  }

  /** ③ Faixa fina solo (portrait): 1 linha portrait+nome+HP+CA, sem XP/slots.
   * Badges críticos (conditions/conc/fúria/exaustão/inspiração) caem numa
   * 2ª mini-linha só quando existem. Death saves seguem no banner dedicado. */
  private renderPartyStrip(p: CharacterSheet): HTMLElement {
    const isMe = p.id === this.opts.characterId;
    const isDown = p.currentHp <= 0;
    const hpPct = p.maxHp > 0 ? Math.round((p.currentHp / p.maxHp) * 100) : 0;
    const ac = effectiveArmorClass(p);
    const portrait = portraitFor({ raceId: p.raceId, classId: p.classId });

    const badges: string[] = [];
    if (p.conditions.length > 0) badges.push(p.conditions.join(' · '));
    if (p.concentratingOn) badges.push(`🧠 ${p.concentratingOn}`);
    if (this.combatFlags[p.id] && this.combatFlags[p.id]!.includes('rage')) badges.push('🔥 Fúria');
    if (p.exhaustion > 0) badges.push(`💀 Exaustão ${p.exhaustion}/6`);
    if (p.inspirations && p.inspirations > 0) badges.push('🌟'.repeat(Math.min(3, p.inspirations)));

    const strip = el('div', {
      class: `cp-strip ${isMe ? 'is-me' : ''} ${isDown ? 'is-down' : ''}`,
      attrs: { 'data-combat-target': p.id },
    }, [
      el('div', { class: 'cp-pj-portrait cp-strip-av', style: { background: portrait.aura }, attrs: { title: `${p.raceId} ${p.classId}` } }, [
        el('span', { class: 'cp-pj-portrait-race', text: portrait.race }),
        iconEl(classIconName(p.classId), portrait.class, { className: 'cp-pj-portrait-class' }),
      ]),
      el('span', { class: 'cp-strip-name', text: `${p.characterName}${isMe ? ' (você)' : ''}` }),
      el('div', { class: 'cp-pj-hp-bar cp-strip-bar' }, [
        el('div', {
          class: `cp-pj-hp-fill ${hpPct < 33 ? 'is-low' : hpPct < 66 ? 'is-mid' : ''}`,
          style: { width: `${hpPct}%` },
        }),
      ]),
      el('span', { class: 'cp-strip-hp', text: `${p.currentHp}/${p.maxHp}` }),
      el('span', { class: 'cp-strip-ca', attrs: { title: 'Classe de Armadura' }, text: `🛡 ${ac}${ac !== p.armorClass ? '✦' : ''}` }),
    ]);

    const section = el('section', { class: 'camp-party is-thin-strip' }, [strip]);
    if (badges.length > 0) {
      section.appendChild(el('div', { class: 'cp-strip-badges' },
        badges.map((b) => el('span', { class: 'cp-strip-badge', text: b }))));
    }
    return section;
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
        on: { click: () => { void this.promptAndTakeAction(a); } },
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
        on: { click: () => { void this.openShortRestModal(); } },
      }, [
        el('span', { class: 'caa-icon', text: '🛌' }),
        el('span', { class: 'caa-label', text: 'Curto' }),
      ]));
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-rest',
        attrs: { type: 'button', disabled, title: 'Descanso Longo — HP cheio, slots resetam' },
        on: { click: () => { void this.confirmLongRest(); } },
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

    // α.4 — Voice input (push-to-talk) — só aparece se browser suporta STT.
    const row = el('div', { class: 'camp-custom-row' }, [customInput, customBtn]);
    if (shouldShowVoiceMic()) {
      row.insertBefore(this.renderVoiceMicBtn(customInput, disabled), customBtn);
    }
    actionsEl.appendChild(row);
    return actionsEl;
  }

  // α.4 — Botão mic: click-to-toggle. Idle → recording → processing → idle.
  // Texto reconhecido vai pro input pra player editar antes de mandar.
  private voiceSession: SttSession | null = null;
  private renderVoiceMicBtn(input: HTMLInputElement, disabled: boolean): HTMLButtonElement {
    const btn = el('button', {
      class: 'camp-mic-btn',
      attrs: { type: 'button', disabled, title: 'Falar (push-to-talk)' },
      text: '🎙',
    }) as HTMLButtonElement;
    const setState = (state: 'idle' | 'recording' | 'processing'): void => {
      btn.classList.remove('is-recording', 'is-processing');
      if (state === 'recording') {
        btn.classList.add('is-recording');
        btn.textContent = '🔴';
        btn.title = 'Toque pra parar';
      } else if (state === 'processing') {
        btn.classList.add('is-processing');
        btn.textContent = '⏳';
      } else {
        btn.textContent = '🎙';
        btn.title = 'Falar (push-to-talk)';
      }
    };

    btn.addEventListener('click', () => {
      if (this.voiceSession) {
        this.voiceSession.stop();
        this.voiceSession = null;
        return;
      }
      this.voiceSession = startStt({
        onStatus: (s) => setState(s),
        onInterim: (text) => {
          input.value = text;
          input.classList.add('is-listening');
        },
        onFinal: (text) => {
          input.value = text;
          input.classList.remove('is-listening');
          input.focus();
          this.voiceSession = null;
        },
        onError: (code, msg) => {
          input.classList.remove('is-listening');
          this.voiceSession = null;
          // 'aborted' = user clicou stop — não mostra erro
          if (code === 'aborted') return;
          toastWarn(sttErrorMessage(code) + (msg ? ` (${msg})` : ''));
        },
      });
    });
    return btn;
  }

  // 2026-05-26 fix UX: clique em botão genérico (Explorar/Investigar/Falar/etc)
  // sem detalhes manda action sozinha pro DM, que tem que improvisar o quê o
  // player tá fazendo — gera narrações desconexas. Agora pedimos contexto antes
  // de enviar. Player escreve "a taverna" → DM responde coerente. Cancel = nada.
  private async promptAndTakeAction(a: typeof ACTIONS[number]): Promise<void> {
    // ψ.4 — Input modal customizado (era window.prompt() blocking)
    const details = await inputDialog({
      title: `${a.icon} ${a.label}`,
      text: a.promptText,
      placeholder: a.placeholder,
      maxLength: 280,
      multiline: true,
      confirmText: 'Enviar pro Mestre',
    });
    if (details === null) return;
    const trimmed = details.trim();
    if (trimmed.length === 0) return;
    this.takeAction(a.id, trimmed);
  }

  private takeAction(action: ExplorationAction, details?: string): void {
    // Registra lastAction pra possível retry (auto-silent OU botão error card).
    this.lastAction = details !== undefined ? { action, details } : { action };
    this.lastActionAt = Date.now();
    this.autoRetriedThisCycle = false; // novo ciclo
    this.opts.socket.emit('takeAction', { action, details });
    this.startResponseWatchdog();
  }

  /** Watchdog do Mestre — arma o timer ao enviar uma ação. clearThinking()
   * (dmDone/error) cancela. Se estourar, o Mestre ficou mudo → erro visível. */
  private startResponseWatchdog(): void {
    this.clearResponseWatchdog();
    this.responseWatchdogTimer = setTimeout(() => {
      this.responseWatchdogTimer = null;
      this.isDmThinking = false;
      if (this.narrationLog) this.narrationLog.setThinking(null);
      this.updateMainContent(); // reabilita a barra de ações
      toastError('🌙 O Mestre não respondeu. Toque numa ação pra tentar de novo.');
    }, this.DM_RESPONSE_TIMEOUT_MS);
  }

  private clearResponseWatchdog(): void {
    if (this.responseWatchdogTimer) {
      clearTimeout(this.responseWatchdogTimer);
      this.responseWatchdogTimer = null;
    }
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

  private async openShortRestModal(): Promise<void> {
    if (!this.character) return;
    const maxDice = this.character.hitDiceRemaining;
    if (maxDice === 0) {
      this.flashToast('Sem hit dice. Precisa de descanso longo.');
      return;
    }
    // T2.5 — Picker visual D&D (era inputDialog numérico genérico).
    // Mostra hit dice como chips clicáveis + preview HP estimado (1dN+ConMod).
    openShortRestPicker({
      character: this.character,
      maxDice,
      onConfirm: (n) => {
        this.opts.socket.emit('shortRest', { hitDiceToSpend: Math.min(n, maxDice) });
      },
    });
  }

  private async confirmLongRest(): Promise<void> {
    // ψ.4 — Modal customizado (era confirm() nativo)
    const ok = await confirmDialog({
      title: 'Descanso Longo (8h)',
      text: 'HP cheio + spell slots resetam + condições leves curam. O tempo avança — pode mudar o estado do mundo.',
      confirmText: '🏕 Descansar 8h',
      cancelText: 'Mais tarde',
    });
    if (ok) {
      // T3.3 — Ritual visual cinematográfico antes de emitir longRest.
      // 🌙 noite → ⭐ descanso → ☀ amanhecer (~2s). reduced-motion pula direto.
      playLongRestRitual(() => {
        this.opts.socket.emit('longRest');
      });
    }
  }

  private flashToast(text: string): void {
    const t = el('div', { class: 'camp-toast', text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
}

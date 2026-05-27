// JSgame · ο.2 — Chat Sheet (bottom-sheet expansível, coop only).
// Lista mensagens da party com avatar emoji raça+classe + nome + timestamp relativo.
// Input + send. Usa sheet-stack-manager pra empilhar (1ª layer normalmente).

import type { CharacterSheet } from '../../shared/types';
import { el, escapeHtml } from '../util';
import { push as pushSheet, pop as popSheet, isSheetOpen } from '../sheet-stack-manager';

export interface PartyMessage {
  id: string;
  characterId: string;
  speaker: string;          // nome do PJ
  text: string;
  timestamp: number;
  /** Map emoji → array de characterIds que reagiram. V2 — V1 sempre vazio. */
  reactions?: Record<string, string[]>;
}

export interface ChatSheetContext {
  party: CharacterSheet[];
  messages: PartyMessage[];
  myCharacterId: string;
  onSend: (text: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  /** π.1 — caller é notificado quando sheet fecha (sync active tab). */
  onClose?: () => void;
  /** ψ.2 — Emite typing indicator (debounced). Server broadcasta pra aliados. */
  onTyping?: (isTyping: boolean) => void;
}

// ψ.2 — Estado de typing (aliados digitando AGORA)
const typingState = new Map<string, { speaker: string; expiresAt: number }>();
let typingIndicatorEl: HTMLDivElement | null = null;
let typingRefreshTimer: number | null = null;
let timestampRefreshTimer: number | null = null;

const SHEET_ID = 'party-chat';

let currentSheetEl: HTMLElement | null = null;
let currentMessagesContainer: HTMLElement | null = null;
let currentInput: HTMLInputElement | null = null;
let currentTitleEl: HTMLElement | null = null;
let currentCtx: ChatSheetContext | null = null;

export function openChatSheet(ctx: ChatSheetContext): void {
  if (isSheetOpen(SHEET_ID)) return;
  currentCtx = ctx;

  const root = el('div', {
    class: 'chat-sheet',
    attrs: { role: 'dialog', 'aria-label': 'Chat da Party' },
  });

  // Handlebar (visual indicator pra drag)
  root.appendChild(el('div', { class: 'cs-handlebar', attrs: { 'aria-hidden': 'true' } }));

  // Header — ψ.2 título em PT-BR
  const title = el('div', { class: 'cs-title', text: `🤝 Party · ${ctx.party.length} aliado${ctx.party.length === 1 ? '' : 's'}` });
  currentTitleEl = title;
  const header = el('header', { class: 'cs-header' }, [
    title,
    el('button', {
      class: 'cs-close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Fechar chat' },
      on: { click: () => closeChatSheet() },
    }),
  ]);
  root.appendChild(header);

  // Messages list
  const messagesEl = el('div', { class: 'cs-messages', attrs: { role: 'log', 'aria-live': 'polite' } });
  currentMessagesContainer = messagesEl;
  renderMessages(messagesEl, ctx.messages, ctx);
  root.appendChild(messagesEl);

  // ψ.2 — Typing indicator (renderiza acima do input quando aliado digita)
  typingIndicatorEl = el('div', {
    class: 'cs-typing',
    attrs: { 'aria-live': 'polite', hidden: 'true' },
  }) as HTMLDivElement;
  root.appendChild(typingIndicatorEl);

  // ψ.2 — Input multi-line (textarea auto-resize 1-3 linhas)
  const input = el('textarea', {
    class: 'cs-input',
    attrs: {
      placeholder: 'Sussurre algo aos aliados...',
      maxlength: '280',
      rows: '1',
      'aria-label': 'Mensagem',
    },
  }) as unknown as HTMLTextAreaElement;
  currentInput = input as unknown as HTMLInputElement;

  // ψ.2 — Contador char (badge aparece quando >70% do limit)
  const counter = el('span', {
    class: 'cs-char-counter',
    attrs: { hidden: 'true', 'aria-hidden': 'true' },
    text: '0/280',
  });

  const send = (): void => {
    const text = input.value.trim();
    if (!text) return;
    ctx.onSend(text);
    input.value = '';
    autoResize();
    updateCounter();
    // Para indicação de typing imediatamente após enviar
    ctx.onTyping?.(false);
  };

  // Auto-resize do textarea (1-3 linhas)
  const autoResize = (): void => {
    input.style.height = 'auto';
    const lineHeight = 20;
    const maxLines = 3;
    const newHeight = Math.min(input.scrollHeight, lineHeight * maxLines + 16);
    input.style.height = `${newHeight}px`;
  };

  const updateCounter = (): void => {
    const len = input.value.length;
    if (len > 280 * 0.7) {
      counter.removeAttribute('hidden');
      counter.textContent = `${len}/280`;
      counter.classList.toggle('is-near-limit', len > 280 * 0.9);
    } else {
      counter.setAttribute('hidden', 'true');
    }
  };

  // ψ.2 — Typing indicator debounce (emite após 200ms estável, stop após 1.5s sem mudança)
  let typingDebounce: number | null = null;
  let typingStopTimer: number | null = null;
  let isCurrentlyTyping = false;

  const triggerTyping = (): void => {
    if (typingDebounce !== null) clearTimeout(typingDebounce);
    if (typingStopTimer !== null) clearTimeout(typingStopTimer);

    if (!isCurrentlyTyping) {
      typingDebounce = window.setTimeout(() => {
        isCurrentlyTyping = true;
        ctx.onTyping?.(true);
      }, 200);
    }

    typingStopTimer = window.setTimeout(() => {
      if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        ctx.onTyping?.(false);
      }
    }, 1500);
  };

  input.addEventListener('keydown', (e) => {
    // Enter envia (Shift+Enter quebra linha)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener('input', () => {
    autoResize();
    updateCounter();
    if (input.value.trim().length > 0) triggerTyping();
  });

  const sendBtn = el('button', {
    class: 'cs-send',
    text: '↑',
    attrs: { type: 'button', 'aria-label': 'Enviar' },
    on: { click: send },
  });

  root.appendChild(el('footer', { class: 'cs-footer' }, [input, counter, sendBtn]));

  currentSheetEl = root;
  const externalOnClose = ctx.onClose;
  pushSheet({
    id: SHEET_ID,
    element: root,
    onClose: () => {
      // Limpa timers
      if (typingDebounce !== null) clearTimeout(typingDebounce);
      if (typingStopTimer !== null) clearTimeout(typingStopTimer);
      if (typingRefreshTimer !== null) {
        clearInterval(typingRefreshTimer);
        typingRefreshTimer = null;
      }
      if (timestampRefreshTimer !== null) {
        clearInterval(timestampRefreshTimer);
        timestampRefreshTimer = null;
      }
      // Notifica stop typing antes de sair
      if (isCurrentlyTyping) ctx.onTyping?.(false);
      currentSheetEl = null;
      currentMessagesContainer = null;
      currentInput = null;
      currentTitleEl = null;
      currentCtx = null;
      typingIndicatorEl = null;
      typingState.clear();
      if (externalOnClose) {
        try { externalOnClose(); } catch (err) { console.warn('[chat-sheet] onClose external failed:', err); }
      }
    },
  });

  // ψ.2 — Refresh typing indicator a cada 500ms (limpa entradas expiradas)
  typingRefreshTimer = window.setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, st] of typingState.entries()) {
      if (st.expiresAt < now) {
        typingState.delete(id);
        changed = true;
      }
    }
    if (changed) renderTypingIndicator();
  }, 500);

  // ψ.2 — Refresh timestamps relativos a cada 60s
  timestampRefreshTimer = window.setInterval(() => {
    if (!currentMessagesContainer || !currentCtx) return;
    refreshTimestamps(currentMessagesContainer);
  }, 60_000);

  // focus input after animation
  setTimeout(() => { input.focus(); }, 220);

  // scroll to bottom inicial
  setTimeout(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 240);
}

/** ψ.2 — Recebe typing remoto. Caller é o socket bind do campaign-screen. */
export function setRemoteTyping(input: { characterId: string; speaker: string; isTyping: boolean }): void {
  if (input.isTyping) {
    typingState.set(input.characterId, {
      speaker: input.speaker,
      // Auto-expira em 3s se nenhum stop chegar (rede instável)
      expiresAt: Date.now() + 3000,
    });
  } else {
    typingState.delete(input.characterId);
  }
  renderTypingIndicator();
}

function renderTypingIndicator(): void {
  if (!typingIndicatorEl) return;
  const speakers = Array.from(typingState.values()).map((s) => s.speaker);
  if (speakers.length === 0) {
    typingIndicatorEl.setAttribute('hidden', 'true');
    typingIndicatorEl.textContent = '';
    return;
  }
  typingIndicatorEl.removeAttribute('hidden');
  const names = speakers.length === 1
    ? `${speakers[0]} está digitando`
    : speakers.length === 2
      ? `${speakers[0]} e ${speakers[1]} estão digitando`
      : `${speakers.length} aliados estão digitando`;
  typingIndicatorEl.innerHTML = `${escapeHtml(names)}<span class="cs-typing-dots"><span></span><span></span><span></span></span>`;
}

function refreshTimestamps(container: HTMLElement): void {
  const timeEls = container.querySelectorAll('[data-msg-timestamp]');
  for (const el of Array.from(timeEls)) {
    const ts = parseInt(el.getAttribute('data-msg-timestamp') ?? '0', 10);
    if (ts > 0) el.textContent = relativeTime(ts);
  }
}

export function closeChatSheet(): void {
  if (isSheetOpen(SHEET_ID)) popSheet();
}

export function isChatSheetOpen(): boolean {
  return isSheetOpen(SHEET_ID);
}

/** Adiciona uma mensagem ao chat (usado por bind socket externo). */
export function appendChatMessage(msg: PartyMessage): void {
  if (!currentMessagesContainer || !currentCtx) return;
  currentCtx.messages.push(msg);
  appendOneMessage(currentMessagesContainer, msg, currentCtx);
  // Auto-scroll se user perto do bottom
  const c = currentMessagesContainer;
  const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 60;
  if (nearBottom) {
    c.scrollTop = c.scrollHeight;
  }
}

function renderMessages(container: HTMLElement, messages: PartyMessage[], ctx: ChatSheetContext): void {
  container.innerHTML = '';
  if (messages.length === 0) {
    // ψ.2 — Empty state cinematográfico D&D (tom Sombrio+Sarcástico+Trickster)
    container.appendChild(el('div', { class: 'cs-empty' }, [
      el('div', { class: 'cs-empty-glyph', text: '🌒' }),
      el('div', { class: 'cs-empty-title', text: 'A taverna está em silêncio…' }),
      el('div', { class: 'cs-empty-sub', text: 'Sussurre uma estratégia, debochar do orc, um plano de fuga. Os aliados escutam.' }),
    ]));
    return;
  }
  for (const msg of messages) {
    appendOneMessage(container, msg, ctx, false);
  }
}

function appendOneMessage(
  container: HTMLElement,
  msg: PartyMessage,
  ctx: ChatSheetContext,
  animate: boolean = true,
): void {
  // Remove empty state se existir
  const empty = container.querySelector('.cs-empty');
  if (empty) empty.remove();

  const isMe = msg.characterId === ctx.myCharacterId;
  const character = ctx.party.find((p) => p.id === msg.characterId);
  const avatar = avatarFor(character);
  const timeStr = relativeTime(msg.timestamp);

  const row = el('div', {
    class: `cs-msg ${isMe ? 'is-me' : ''} ${animate ? 'is-entering' : ''}`,
    attrs: { 'data-msg-id': msg.id },
  }, [
    el('span', { class: 'cs-msg-avatar', text: avatar, attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'cs-msg-bubble' }, [
      el('div', { class: 'cs-msg-head' }, [
        el('span', { class: 'cs-msg-speaker', text: msg.speaker }),
        el('span', {
          class: 'cs-msg-time',
          text: timeStr,
          attrs: { 'data-msg-timestamp': String(msg.timestamp) },
        }),
      ]),
      el('div', { class: 'cs-msg-text', text: msg.text }),
    ]),
  ]);
  container.appendChild(row);

  // ψ.2 — Animação de entrada: remove is-entering no próximo frame pra
  // disparar o transition CSS slide-up + fade.
  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.classList.remove('is-entering');
      });
    });
  }
}

function avatarFor(character: CharacterSheet | undefined): string {
  if (!character) return '👤';
  const race = character.raceId;
  const klass = character.classId;
  // Emoji race+class mapping
  if (race.startsWith('elfo') || race === 'alto-elfo') {
    if (klass === 'mago' || klass === 'feiticeiro') return '🧝‍♀️';
    return '🏹';
  }
  if (race === 'tiefling') return '😈';
  if (race === 'draconato') return '🐉';
  if (race === 'meio-orc') return '👹';
  if (race.startsWith('halfling')) return '🧒';
  if (race.startsWith('gnomo')) return '🧙‍♂️';
  if (race === 'anao-colina' || race === 'anao-montanha') return '🪓';
  // Default by class
  if (klass === 'guerreiro' || klass === 'barbaro') return '⚔️';
  if (klass === 'mago' || klass === 'feiticeiro' || klass === 'bruxo') return '🧙';
  if (klass === 'clerigo' || klass === 'paladino') return '⛪';
  if (klass === 'ladino') return '🗡';
  if (klass === 'bardo') return '🎵';
  if (klass === 'druida') return '🌿';
  if (klass === 'monge') return '🥋';
  if (klass === 'patrulheiro') return '🏹';
  return '🧑';
}

function relativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

// Helpers pra tests
export function _avatarForTest(character: CharacterSheet | undefined): string {
  return avatarFor(character);
}
export function _relativeTimeForTest(ts: number): string {
  return relativeTime(ts);
}

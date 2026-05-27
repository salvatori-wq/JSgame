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
}

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

  // Header
  const title = el('div', { class: 'cs-title', text: `Party Chat · ${ctx.party.length} online` });
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

  // Input row
  const input = el('input', {
    class: 'cs-input',
    attrs: {
      type: 'text',
      placeholder: 'Mensagem... (Enter envia)',
      maxlength: '280',
      'aria-label': 'Mensagem',
    },
  }) as HTMLInputElement;
  currentInput = input;

  const send = (): void => {
    const text = input.value.trim();
    if (!text) return;
    ctx.onSend(text);
    input.value = '';
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  });

  const sendBtn = el('button', {
    class: 'cs-send',
    text: '↑',
    attrs: { type: 'button', 'aria-label': 'Enviar' },
    on: { click: send },
  });

  root.appendChild(el('footer', { class: 'cs-footer' }, [input, sendBtn]));

  currentSheetEl = root;
  pushSheet({
    id: SHEET_ID,
    element: root,
    onClose: () => {
      currentSheetEl = null;
      currentMessagesContainer = null;
      currentInput = null;
      currentTitleEl = null;
      currentCtx = null;
    },
  });

  // focus input after animation
  setTimeout(() => { input.focus(); }, 220);

  // scroll to bottom inicial
  setTimeout(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 240);
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
    container.appendChild(el('div', {
      class: 'cs-empty',
      text: '🌒 Nenhuma mensagem ainda. Seja o primeiro a falar.',
    }));
    return;
  }
  for (const msg of messages) {
    appendOneMessage(container, msg, ctx);
  }
}

function appendOneMessage(container: HTMLElement, msg: PartyMessage, ctx: ChatSheetContext): void {
  // Remove empty state se existir
  const empty = container.querySelector('.cs-empty');
  if (empty) empty.remove();

  const isMe = msg.characterId === ctx.myCharacterId;
  const character = ctx.party.find((p) => p.id === msg.characterId);
  const avatar = avatarFor(character);
  const timeStr = relativeTime(msg.timestamp);

  const row = el('div', {
    class: `cs-msg ${isMe ? 'is-me' : ''}`,
    attrs: { 'data-msg-id': msg.id },
  }, [
    el('span', { class: 'cs-msg-avatar', text: avatar, attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'cs-msg-bubble' }, [
      el('div', { class: 'cs-msg-head' }, [
        el('span', { class: 'cs-msg-speaker', text: msg.speaker }),
        el('span', { class: 'cs-msg-time', text: timeStr }),
      ]),
      el('div', { class: 'cs-msg-text', text: msg.text }),
    ]),
  ]);
  container.appendChild(row);
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

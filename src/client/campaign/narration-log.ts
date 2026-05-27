// JSgame · Chat refactor — NarrationLog standalone.
//
// Encapsula o "coração" do jogo: o log de narrações da campanha.
// Antes era re-renderizado destrutivamente a cada update em campaign-screen.ts,
// perdendo scroll, animando tudo de novo e descartando histórico (slice(-10)).
//
// Agora:
//  - DOM append-only (entries acumulam sem nunca limpar)
//  - Scroll inteligente: segue se user no fim, mostra "↓ N novas" se rolou pra cima
//  - Histórico completo da sessão preservado
//  - Thinking indicator inline (entry temporária no fim do log)
//  - Error card com botão retry actionable
//  - Streaming typewriter visual nas narrações novas (respeita prefers-reduced-motion)

import { el, escapeHtml, renderNarrationText } from '../util';
import { isVoiceTtsEnabled, speak as ttsSpeak } from '../voice-tts';

export interface NarrationEntry {
  id: string;
  speaker: string;
  text: string;
  kind: 'narration' | 'error' | 'system';
  timestamp: number;
}

export interface ThinkingState {
  playerName: string;
  action: string;
  startedAt: number;
}

export interface NarrationLogOpts {
  // Se true, narrations novas animam typewriter (~40 chars/s). Default true.
  enableTypewriter?: boolean;
  // Threshold em px pra considerar "está no fim". Default 80.
  bottomThresholdPx?: number;
}

const DEFAULT_TYPEWRITER_CHARS_PER_SEC = 80;

function genId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

// α.1 — Suggested action chip schema (espelha SuggestedAction do shared/types).
// Duplicado aqui pra não criar dep do client → shared no domínio do log puro.
export interface SuggestedChip {
  label: string;
  hint?: string;
  /** 'combat' aplica visual avermelhado (tactical). Default exploration (dourado). */
  variant?: 'combat';
  // Callback dispara takeAction com action/details. NarrationLog não conhece socket.
  onClick: () => void;
}

export class NarrationLog {
  private rootEl: HTMLElement;
  private entriesEl: HTMLElement;
  private badgeEl: HTMLButtonElement;
  private entries: NarrationEntry[] = [];
  private thinkingEl: HTMLElement | null = null;
  private thinkingState: ThinkingState | null = null;
  private thinkingTimer: ReturnType<typeof setInterval> | null = null;
  private lastErrorEntryEl: HTMLElement | null = null;
  // α.1 — Container persistente dos chips de sugestão (sempre ÚLTIMO no log).
  private chipsEl: HTMLElement | null = null;
  private newSinceScrolled = 0;
  private isPinnedToBottom = true;
  private opts: Required<NarrationLogOpts>;
  // Mantém referência das animações ativas pra cancelar se entry remove.
  private activeTypewriters = new Map<string, ReturnType<typeof setInterval>>();
  private destroyed = false;

  constructor(opts: NarrationLogOpts = {}) {
    this.opts = {
      enableTypewriter: opts.enableTypewriter ?? !prefersReducedMotion(),
      bottomThresholdPx: opts.bottomThresholdPx ?? 80,
    };

    this.rootEl = el('section', { class: 'camp-narration' });
    this.entriesEl = el('div', { class: 'cn-entries' });
    this.badgeEl = el('button', {
      class: 'cn-new-badge is-hidden',
      attrs: { type: 'button' },
      text: '↓ novas mensagens',
      on: {
        click: () => {
          this.scrollToBottom('smooth');
          this.isPinnedToBottom = true;
          this.newSinceScrolled = 0;
          this.updateBadge();
        },
      },
    }) as HTMLButtonElement;

    this.rootEl.appendChild(this.entriesEl);
    this.rootEl.appendChild(this.badgeEl);

    // Empty state inicial
    this.renderEmptyState();

    // Scroll detection — passive pra perf
    this.rootEl.addEventListener('scroll', () => this.handleScroll(), { passive: true });
  }

  get element(): HTMLElement {
    return this.rootEl;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Adiciona nova narração ao log. Auto-scroll suave se user estava no fim,
   * caso contrário incrementa badge "↓ N novas".
   *
   * Typewriter visual aplicado APENAS na entry mais recente (e só se for
   * narração de Mestre — não em ecos de chat). Respeita prefers-reduced-motion.
   */
  appendNarration(payload: { speaker: string; text: string }): void {
    if (this.destroyed) return;
    this.removeEmptyState();
    this.removeThinkingEl(); // narração chegou — remove "Mestre escrevendo..."
    this.removeChipsEl();    // α.1 — chips da cena passada não fazem sentido com narração nova

    const entry: NarrationEntry = {
      id: genId(),
      speaker: payload.speaker,
      text: payload.text,
      kind: 'narration',
      timestamp: Date.now(),
    };
    this.entries.push(entry);

    const entryEl = this.buildEntryEl(entry, 'is-narration');
    this.entriesEl.appendChild(entryEl);

    // Typewriter visual nas narrações de Mestre (não em chat/echo).
    const isMasterNarration = entry.speaker === 'Mestre' || entry.speaker.startsWith('Mestre ');
    if (isMasterNarration && this.opts.enableTypewriter) {
      this.startTypewriter(entry, entryEl);
    }

    this.afterAppend(entryEl);
  }

  /**
   * Adiciona card de erro com botão "Tentar de novo".
   * Substitui qualquer error card anterior (não acumula).
   * Se onRetry for fornecido, mostra botão actionable.
   */
  appendError(payload: {
    message: string;
    onRetry?: () => void;
  }): void {
    if (this.destroyed) return;
    this.removeEmptyState();
    this.removeThinkingEl();
    this.removeChipsEl(); // α.1 — erro invalida chips da cena anterior

    // Remove o error card anterior se houver
    if (this.lastErrorEntryEl) {
      this.lastErrorEntryEl.remove();
      this.lastErrorEntryEl = null;
    }

    const entry: NarrationEntry = {
      id: genId(),
      speaker: 'Mestre',
      text: payload.message,
      kind: 'error',
      timestamp: Date.now(),
    };
    this.entries.push(entry);

    const entryEl = el('div', { class: 'camp-narr-entry is-error', attrs: { 'data-id': entry.id } });
    const textWrap = el('div', { class: 'cn-error-body' });
    textWrap.innerHTML = `
      <div class="cnn-speaker">⚠ Mestre tropeçou</div>
      <div class="cnn-text">${escapeHtml(payload.message)}</div>
    `;
    entryEl.appendChild(textWrap);

    if (payload.onRetry) {
      const handler = payload.onRetry;
      entryEl.appendChild(el('button', {
        class: 'cn-retry-btn',
        text: '🔁 Tentar de novo',
        attrs: { type: 'button' },
        on: {
          click: () => {
            entryEl.classList.add('is-retrying');
            handler();
          },
        },
      }));
    }

    this.entriesEl.appendChild(entryEl);
    this.lastErrorEntryEl = entryEl;
    this.afterAppend(entryEl);
  }

  /**
   * Mostra/atualiza o "Mestre escrevendo..." inline no fim do log.
   * Passe null pra esconder.
   */
  setThinking(state: ThinkingState | null): void {
    if (this.destroyed) return;
    if (!state) {
      this.removeThinkingEl();
      return;
    }

    // Se já tem thinking, só atualiza texto
    if (this.thinkingEl) {
      this.thinkingState = state;
      const txt = this.thinkingEl.querySelector('.cn-thinking-text');
      if (txt) txt.textContent = `Mestre escrevendo… (${state.playerName} → ${state.action})`;
      return;
    }

    this.removeEmptyState();
    this.removeChipsEl(); // α.1 — pensando = chips sumindo enquanto DM gera nova cena
    this.thinkingState = state;
    const thinkingEl = el('div', { class: 'camp-narr-entry is-thinking' }, [
      el('div', { class: 'cn-thinking-row' }, [
        el('span', { class: 'cn-thinking-dots' }, [
          el('span', { class: 'cn-dot' }),
          el('span', { class: 'cn-dot' }),
          el('span', { class: 'cn-dot' }),
        ]),
        el('span', { class: 'cn-thinking-text', text: `Mestre escrevendo… (${state.playerName} → ${state.action})` }),
        el('span', { class: 'cn-thinking-elapsed', text: '0s' }),
      ]),
    ]);
    this.thinkingEl = thinkingEl;
    this.entriesEl.appendChild(thinkingEl);

    // Tick contador. Usa state.startedAt pra ser preciso mesmo se aba ficou em background.
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
    this.thinkingTimer = setInterval(() => {
      if (!this.thinkingEl || !this.thinkingState) return;
      const elapsed = Math.floor((Date.now() - this.thinkingState.startedAt) / 1000);
      const elapsedEl = this.thinkingEl.querySelector('.cn-thinking-elapsed');
      if (elapsedEl) elapsedEl.textContent = `${elapsed}s`;
    }, 1000);

    this.afterAppend(thinkingEl);
  }

  /**
   * α.1 — Atualiza chips de sugestão renderizados após a última narração.
   * Passa [] pra esconder. Substitui set anterior (não acumula).
   * Chips sempre vivem no FIM do log (após thinking se houver).
   */
  setSuggestedChips(chips: SuggestedChip[]): void {
    if (this.destroyed) return;
    // Remove o container antigo se houver
    if (this.chipsEl) {
      this.chipsEl.remove();
      this.chipsEl = null;
    }
    if (chips.length === 0) return;

    const wrap = el('div', { class: 'cn-suggested-chips', attrs: { role: 'group', 'aria-label': 'Ações sugeridas' } });
    for (const chip of chips) {
      const btn = el('button', {
        class: `cn-chip${chip.variant === 'combat' ? ' is-combat' : ''}`,
        attrs: { type: 'button' },
        on: { click: () => chip.onClick() },
      }, [
        el('span', { class: 'cn-chip-label', text: chip.label }),
        chip.hint ? el('span', { class: 'cn-chip-hint', text: chip.hint }) : null,
      ].filter(Boolean) as HTMLElement[]);
      wrap.appendChild(btn);
    }
    this.entriesEl.appendChild(wrap);
    this.chipsEl = wrap;
    this.afterAppend(wrap);
  }

  /**
   * Hard scroll pro fim. Usado em rejoin/F5 pra abrir já no recente.
   *
   * Implementação: setar `.scrollTop = .scrollHeight` direto (síncrono, robusto).
   * Animação smooth vem do CSS `scroll-behavior: smooth` no .camp-narration —
   * NÃO usar `scrollTo({behavior:'smooth'})` aqui porque múltiplas chamadas
   * em rajada (narrações chegando rápido) interrompem umas às outras e o
   * smooth scroll fica preso com valor velho de scrollHeight.
   */
  scrollToBottom(_behavior: ScrollBehavior = 'auto'): void {
    if (this.destroyed) return;
    this.rootEl.scrollTop = this.rootEl.scrollHeight;
  }

  /**
   * Retorna entries pra serialization (rejoin restore, debug, etc).
   */
  getEntries(): readonly NarrationEntry[] {
    return this.entries;
  }

  /**
   * Restaura entries de uma sessão anterior. Não anima typewriter
   * (assume que user já viu antes).
   */
  restoreEntries(entries: Array<{ speaker: string; text: string }>): void {
    if (this.destroyed) return;
    this.removeEmptyState();
    for (const e of entries) {
      const entry: NarrationEntry = {
        id: genId(),
        speaker: e.speaker,
        text: e.text,
        kind: 'narration',
        timestamp: Date.now(),
      };
      this.entries.push(entry);
      this.entriesEl.appendChild(this.buildEntryEl(entry, 'is-narration is-restored'));
    }
    // Scroll instant pro fim após restore — user espera ver o recente
    this.scrollToBottom('auto');
  }

  destroy(): void {
    this.destroyed = true;
    for (const timer of this.activeTypewriters.values()) clearInterval(timer);
    this.activeTypewriters.clear();
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
    this.thinkingTimer = null;
    // Não removemos o DOM aqui — caller decide quando remover do parent.
  }

  // ════════════════════════════════════════════════════════════════════════
  // Internals
  // ════════════════════════════════════════════════════════════════════════

  private buildEntryEl(entry: NarrationEntry, extraClass: string): HTMLElement {
    const entryEl = el('div', {
      class: `camp-narr-entry ${extraClass}`,
      attrs: { 'data-id': entry.id, 'data-kind': entry.kind },
    });
    // QW-2: renderNarrationText escapa HTML ANTES de aplicar markdown leve.
    entryEl.innerHTML = `
      <div class="cnn-speaker">${escapeHtml(entry.speaker)}</div>
      <div class="cnn-text">${renderNarrationText(entry.text)}</div>
    `;
    return entryEl;
  }

  // Typewriter visual char-by-char. Substitui innerHTML do .cnn-text gradualmente.
  // Speed em chars/sec — convertido pra ms-por-tick com 2-4 chars por tick.
  private startTypewriter(entry: NarrationEntry, entryEl: HTMLElement): void {
    const textEl = entryEl.querySelector('.cnn-text') as HTMLElement | null;
    if (!textEl) return;

    const fullHtml = renderNarrationText(entry.text);
    const fullText = entry.text;
    // Escolhe N chars por tick: 2 pra texto médio, 3 pra longo.
    const charsPerTick = fullText.length > 200 ? 3 : 2;
    const tickMs = Math.max(20, Math.floor(1000 / (DEFAULT_TYPEWRITER_CHARS_PER_SEC / charsPerTick)));
    let i = 0;
    textEl.textContent = '';
    textEl.classList.add('is-streaming');

    const finish = (): void => {
      textEl.innerHTML = fullHtml;
      textEl.classList.remove('is-streaming');
      const t = this.activeTypewriters.get(entry.id);
      if (t) {
        clearInterval(t);
        this.activeTypewriters.delete(entry.id);
      }
      // Mantém scroll seguindo até o fim da animação
      if (this.isPinnedToBottom) this.scrollToBottom('auto');
    };

    // Click no entry → skip animation (instant reveal)
    entryEl.addEventListener('click', finish, { once: true });

    const timer = setInterval(() => {
      i = Math.min(fullText.length, i + charsPerTick);
      // Preserva quebras de linha como <br> + escape
      textEl.textContent = fullText.slice(0, i);
      // Mantém scroll seguindo enquanto digita
      if (this.isPinnedToBottom) {
        this.rootEl.scrollTop = this.rootEl.scrollHeight;
      }
      if (i >= fullText.length) finish();
    }, tickMs);
    this.activeTypewriters.set(entry.id, timer);
  }

  private renderEmptyState(): void {
    if (this.entries.length > 0) return;
    if (this.entriesEl.querySelector('.camp-narr-empty')) return;
    this.entriesEl.appendChild(el('div', {
      class: 'camp-narr-empty',
      text: 'Aguardando o Mestre acordar…',
    }));
  }

  private removeEmptyState(): void {
    const empty = this.entriesEl.querySelector('.camp-narr-empty');
    if (empty) empty.remove();
  }

  private removeChipsEl(): void {
    if (this.chipsEl) {
      this.chipsEl.remove();
      this.chipsEl = null;
    }
  }

  private removeThinkingEl(): void {
    if (this.thinkingEl) {
      this.thinkingEl.remove();
      this.thinkingEl = null;
    }
    this.thinkingState = null;
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  }

  // Detecta se user está perto do fim (threshold). Atualiza isPinnedToBottom + badge.
  private handleScroll(): void {
    const distanceFromBottom = this.rootEl.scrollHeight - this.rootEl.scrollTop - this.rootEl.clientHeight;
    const wasPinned = this.isPinnedToBottom;
    this.isPinnedToBottom = distanceFromBottom <= this.opts.bottomThresholdPx;
    if (this.isPinnedToBottom) {
      // user voltou pro fim — limpa contador
      if (!wasPinned) {
        this.newSinceScrolled = 0;
        this.updateBadge();
      }
    }
  }

  private afterAppend(_entryEl: HTMLElement): void {
    if (this.isPinnedToBottom) {
      // Scroll suave (CSS faz a animação) segue a nova entry.
      // Faz duas vezes: imediato (DOM já atualizado) + após rAF (caso layout
      // pendente). Idempotente — setar mesmo scrollTop é no-op visual.
      this.scrollToBottom();
      requestAnimationFrame(() => this.scrollToBottom());
    } else {
      // user scrollou pra cima — incrementa contador e mostra badge
      this.newSinceScrolled++;
      this.updateBadge();
    }
  }

  private updateBadge(): void {
    if (this.newSinceScrolled > 0) {
      this.badgeEl.textContent = `↓ ${this.newSinceScrolled} nova${this.newSinceScrolled > 1 ? 's' : ''}`;
      this.badgeEl.classList.remove('is-hidden');
    } else {
      this.badgeEl.classList.add('is-hidden');
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (testable sem JSDOM)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Heurística pra detectar se uma narração veio do fallback degradado do server.
 * Usada pelo client pra decidir auto-retry silencioso.
 */
export function isDegradedNarration(speaker: string): boolean {
  return speaker === 'Mestre (degradado)' || speaker === 'Mestre (offline)';
}

/**
 * Calcula se vale retry silencioso baseado em:
 *  - speaker indica degradação (server cedeu)
 *  - existe lastAction (sabemos o que reenviar)
 *  - não retrou ainda nesse ciclo
 *  - lastAction recente (< 30s — não retry se user mudou de cena há muito)
 */
export function shouldAutoRetrySilent(input: {
  speaker: string;
  lastAction: { action: string; details?: string; timestamp: number } | null;
  alreadyRetried: boolean;
  nowMs: number;
}): boolean {
  if (!isDegradedNarration(input.speaker)) return false;
  if (input.alreadyRetried) return false;
  if (!input.lastAction) return false;
  if (input.nowMs - input.lastAction.timestamp > 30_000) return false;
  return true;
}

/**
 * Tira a TTS speak da degraded narration — TTS lê coisa cínica e quebra imersão.
 */
export function shouldTtsSpeak(speaker: string): boolean {
  if (isDegradedNarration(speaker)) return false;
  const isMaster = speaker === 'Mestre' || speaker.startsWith('Mestre ');
  return isMaster && isVoiceTtsEnabled();
}

// Wrapper exportado pra TTS — caller passa o text + speaker.
export function maybeTtsSpeak(text: string, speaker: string): void {
  if (shouldTtsSpeak(speaker)) ttsSpeak(text, { rate: 1.05 });
}

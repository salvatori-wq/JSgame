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
import { pickRandomTip, getThinkingPhase } from './thinking-tips';
import { detectChipIcon } from './chip-icon-detector';

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

    // Scroll detection — listener no rootEl (desktop scroll container)
    this.rootEl.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    // BUG-Ω.4 — em mobile portrait-narrow o scroll real está no `.ch-narration-host`
    // PAI (overflow-y: auto), não no `.camp-narration`. Listener no ancestor é
    // attached lazily (precisa estar no DOM). bindAncestorScroll() é chamado em
    // afterAppend (já garantido estar attached) — idempotente.
  }

  // BUG-Ω.4 — Detecta o real scroll container. Em desktop, `.camp-narration`
  // tem overflow-y: auto + max-height: 55vh → ele mesmo scrolla. Em mobile
  // portrait-narrow, `.camp-narration` tem max-height: none + cresce, daí
  // o scroll real é no `.ch-narration-host` ancestor.
  private getScrollContainer(): HTMLElement {
    // Self é scrollable?
    if (this.isElementScrollable(this.rootEl)) return this.rootEl;
    // Sobe pelos ancestrais até achar um scrollable.
    let parent = this.rootEl.parentElement;
    while (parent && parent !== document.body) {
      if (this.isElementScrollable(parent)) return parent;
      parent = parent.parentElement;
    }
    // Fallback: rootEl mesmo (pelo menos não throw).
    return this.rootEl;
  }

  private isElementScrollable(el: HTMLElement): boolean {
    const style = getComputedStyle(el);
    if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') return false;
    // Tem conteúdo overflowing? scrollHeight > clientHeight indica scrollable.
    // Mas também precisa ser true se clientHeight ainda não foi medido (layout pending).
    // Em mobile durante boot, clientHeight pode ser 0 → ainda assim consideramos scrollable.
    return true;
  }

  private ancestorScrollBound = false;
  private bindAncestorScrollOnce(): void {
    if (this.ancestorScrollBound) return;
    const container = this.getScrollContainer();
    if (container === this.rootEl) {
      // Self é o scroll, listener já bound no construtor.
      this.ancestorScrollBound = true;
      return;
    }
    container.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    this.ancestorScrollBound = true;
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

    // Sub-sprint C (Henrique) — primeira narração da sessão recebe classe
    // .is-first-narration pra animação fade-in mais dramática (cold-open
    // = "moment of truth" da primeira impressão).
    const isFirstNarration = this.entries.filter((e) => e.kind === 'narration').length === 0;

    const entry: NarrationEntry = {
      id: genId(),
      speaker: payload.speaker,
      text: payload.text,
      kind: 'narration',
      timestamp: Date.now(),
    };
    this.entries.push(entry);

    // N3.3 — Drop-cap responsivo: narrações curtas (<100 chars) → drop-cap
    // menor pra não dominar visualmente o conteúdo. Narrações médias/longas
    // → drop-cap padrão. Aplicado via data-attr lido pelo CSS.
    let dropCapSize: 'sm' | 'md' = 'md';
    if (isFirstNarration && payload.text.length < 100) dropCapSize = 'sm';
    const extraClass = `is-narration${isFirstNarration ? ' is-first-narration' : ''}`;
    const entryEl = this.buildEntryEl(entry, extraClass);
    if (isFirstNarration) entryEl.dataset.dropCap = dropCapSize;
    this.entriesEl.appendChild(entryEl);

    // Typewriter visual nas narrações de Mestre (não em chat/echo).
    const isMasterNarration = entry.speaker === 'Mestre' || entry.speaker.startsWith('Mestre ');
    if (isMasterNarration && this.opts.enableTypewriter) {
      this.startTypewriter(entry, entryEl);
    }

    this.afterAppend(entryEl);
  }

  /**
   * POLISH γ.4 — Adiciona narração degradada (DM tentou mas falhou) com error
   * recovery card rico embutido: timeline providers tentados + retry button.
   * Substitui appendError quando vier de erro de DM com metadata estruturada.
   */
  appendDegradedNarration(payload: {
    speaker: string;
    text: string;
    errorMeta: {
      providersAttempted: string[];
      lastProvider: string;
      errorKind: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'empty' | 'unknown';
      errorMsg: string;
      canRetry: boolean;
    };
    onRetry?: () => void;
  }): void {
    if (this.destroyed) return;
    this.removeEmptyState();
    this.removeThinkingEl();
    this.removeChipsEl();

    // Remove error card anterior se houver
    if (this.lastErrorEntryEl) {
      this.lastErrorEntryEl.remove();
      this.lastErrorEntryEl = null;
    }

    const entry: NarrationEntry = {
      id: genId(),
      speaker: payload.speaker,
      text: payload.text,
      kind: 'error',
      timestamp: Date.now(),
    };
    this.entries.push(entry);

    const errorKindLabel: Record<string, string> = {
      timeout: '⏱ Tempo esgotado',
      rate_limit: '🚦 Limite de uso',
      auth: '🔑 Falha de autenticação',
      parse: '📝 Resposta malformada',
      empty: '🪶 Resposta vazia',
      unknown: '❓ Erro desconhecido',
    };

    const entryEl = el('div', { class: 'camp-narr-entry is-error is-degraded', attrs: { 'data-id': entry.id } });

    // Speaker + narração degradada
    const body = el('div', { class: 'cn-error-body' }, [
      el('div', { class: 'cnn-speaker', text: '⚠ ' + payload.speaker }),
      el('div', { class: 'cnn-text', text: payload.text }),
    ]);
    entryEl.appendChild(body);

    // Provider chip resumido sempre visível
    const summary = el('div', { class: 'cn-error-summary' }, [
      el('span', { class: 'cn-error-kind', text: errorKindLabel[payload.errorMeta.errorKind] ?? 'Erro' }),
      el('span', { class: 'cn-error-provider', text: `· ${payload.errorMeta.lastProvider}` }),
    ]);
    entryEl.appendChild(summary);

    // Toggle de detalhes
    const detailsContent = el('div', { class: 'cn-error-details', attrs: { hidden: 'true' } }, [
      el('div', { class: 'cn-err-row' }, [
        el('span', { class: 'cn-err-label', text: 'Providers tentados:' }),
        el('span', { class: 'cn-err-val', text: payload.errorMeta.providersAttempted.join(' → ') || '—' }),
      ]),
      el('div', { class: 'cn-err-row' }, [
        el('span', { class: 'cn-err-label', text: 'Erro técnico:' }),
        el('code', { class: 'cn-err-msg', text: payload.errorMeta.errorMsg }),
      ]),
    ]);
    const toggleBtn = el('button', {
      class: 'cn-error-details-toggle',
      attrs: { type: 'button', 'aria-expanded': 'false' },
      text: '▸ Ver detalhes técnicos',
      on: {
        click: () => {
          const hidden = detailsContent.hasAttribute('hidden');
          if (hidden) {
            detailsContent.removeAttribute('hidden');
            toggleBtn.textContent = '▾ Ocultar detalhes';
            toggleBtn.setAttribute('aria-expanded', 'true');
          } else {
            detailsContent.setAttribute('hidden', 'true');
            toggleBtn.textContent = '▸ Ver detalhes técnicos';
            toggleBtn.setAttribute('aria-expanded', 'false');
          }
        },
      },
    });
    entryEl.appendChild(toggleBtn);
    entryEl.appendChild(detailsContent);

    // BUG-Ω.4 — Dica actionable quando errorKind=rate_limit. Quota esgotada =
    // único fix real é mais providers. Sem isso, jogo trava cada vez que LLM
    // free tier do dia acaba.
    if (payload.errorMeta.errorKind === 'rate_limit') {
      entryEl.appendChild(el('div', { class: 'cn-error-tip' }, [
        el('span', { class: 'cn-tip-icon', text: '💡' }),
        el('span', { class: 'cn-tip-text', text: 'Quota free esgotou. Setup gratuito Cerebras (Llama 3.3, 1M tok/dia) em 2min: cloud.cerebras.ai → API Key → Render env var CEREBRAS_API_KEY' }),
      ]));
    }

    // Retry button (só se canRetry e callback fornecido)
    if (payload.errorMeta.canRetry && payload.onRetry) {
      const handler = payload.onRetry;
      entryEl.appendChild(el('button', {
        class: 'cn-retry-btn',
        text: '🔁 Tentar novamente',
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
   * Adiciona card de erro com botão "Tentar de novo".
   * ψ.5 — Acumula até 3 últimos erros (dim os antigos via class .is-stale).
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

    // ψ.5 — Marca erros anteriores como stale (dim 0.5) em vez de remover.
    // Player ganha contexto debug se DM falhar várias vezes em sequência.
    const previousErrors = this.element.querySelectorAll('.camp-narr-entry.is-error:not(.is-stale)');
    previousErrors.forEach((el) => el.classList.add('is-stale'));
    // Mantém só os últimos 3 (FIFO).
    const allErrors = this.element.querySelectorAll('.camp-narr-entry.is-error');
    if (allErrors.length >= 3) {
      // Remove o mais antigo
      allErrors[0]?.remove();
    }
    this.lastErrorEntryEl = null;

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
      if (txt) txt.textContent = getThinkingPhase(0, state.playerName, state.action);
      return;
    }

    this.removeEmptyState();
    this.removeChipsEl(); // α.1 — pensando = chips sumindo enquanto DM gera nova cena
    this.thinkingState = state;
    // POLISH α.6 — dica rotativa abaixo do texto principal
    const initialTip = pickRandomTip();
    const thinkingEl = el('div', { class: 'camp-narr-entry is-thinking' }, [
      el('div', { class: 'cn-thinking-row' }, [
        el('span', { class: 'cn-thinking-dots' }, [
          el('span', { class: 'cn-dot' }),
          el('span', { class: 'cn-dot' }),
          el('span', { class: 'cn-dot' }),
        ]),
        el('span', { class: 'cn-thinking-text', text: getThinkingPhase(0, state.playerName, state.action) }),
        el('span', { class: 'cn-thinking-elapsed', text: '0s' }),
      ]),
      el('div', { class: 'cn-thinking-tip', text: `💡 ${initialTip}` }),
    ]);
    this.thinkingEl = thinkingEl;
    this.entriesEl.appendChild(thinkingEl);

    // Tick contador. Usa state.startedAt pra ser preciso mesmo se aba ficou em background.
    // POLISH α.6 — também atualiza texto principal (escala fases) e troca dica a cada 5s.
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
    let lastTipChangeAt = Date.now();
    this.thinkingTimer = setInterval(() => {
      if (!this.thinkingEl || !this.thinkingState) return;
      const elapsed = Math.floor((Date.now() - this.thinkingState.startedAt) / 1000);
      const elapsedEl = this.thinkingEl.querySelector('.cn-thinking-elapsed');
      if (elapsedEl) elapsedEl.textContent = `${elapsed}s`;
      // Atualiza texto principal (3 fases: <8s normal / <18s demorando / <30s trocando / 30+ lenta)
      const txt = this.thinkingEl.querySelector('.cn-thinking-text');
      if (txt) txt.textContent = getThinkingPhase(elapsed, this.thinkingState.playerName, this.thinkingState.action);
      // Troca dica a cada 5s pra player não cansar
      if (Date.now() - lastTipChangeAt >= 5000) {
        lastTipChangeAt = Date.now();
        const tipEl = this.thinkingEl.querySelector('.cn-thinking-tip');
        if (tipEl) tipEl.textContent = `💡 ${pickRandomTip()}`;
      }
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
      // Sub-sprint D1 — chips com hint = ação com skill check (rolará dado).
      // Marca .is-skill pra ganhar destaque visual (border dourado + 🎲 prefix).
      const isSkill = !!chip.hint;
      // M2.1 — Chips não-skill ganham emoji prefix detectado pelo verbo inicial
      // (🗣 falar, 🚶 seguir, ⚔ atacar, etc). Skill chips mantêm 🎲 — não acumula.
      const actionIcon = isSkill ? null : detectChipIcon(chip.label);
      const tooltipBase = chip.hint
        ? `🎲 Rola ${chip.hint} (d20 + bônus)`
        : chip.label;
      const btn = el('button', {
        class: `cn-chip${chip.variant === 'combat' ? ' is-combat' : ''}${isSkill ? ' is-skill' : ''}${actionIcon ? ' has-action-icon' : ''}`,
        attrs: { type: 'button', title: tooltipBase, 'aria-label': tooltipBase },
        on: { click: () => chip.onClick() },
      }, [
        isSkill ? el('span', { class: 'cn-chip-dice', text: '🎲', attrs: { 'aria-hidden': 'true' } }) : null,
        actionIcon ? el('span', { class: 'cn-chip-action-icon', text: actionIcon, attrs: { 'aria-hidden': 'true' } }) : null,
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
    // BUG-Ω.4 — Scrolla o real container (self em desktop, ancestor em mobile).
    const container = this.getScrollContainer();
    container.scrollTop = container.scrollHeight;
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
    // M2.3 — Echo de roll ("🎲 Borin: percepcao DC 12 → SUCESSO") + save echo
    // ("🛡 Borin: save DEX...") vem do server como speaker iniciando com 🎲 ou 🛡.
    // Detecta + aplica .is-roll-echo pra estilo cinza/menor que diferencia
    // do corpo narrado pelo Mestre (visual claro: "isso é mecânica, não cena").
    const isRollEcho = entry.kind === 'narration'
      && (entry.speaker.startsWith('🎲 ') || entry.speaker.startsWith('🛡 ') || entry.speaker.startsWith('🚶 '));
    const echoClass = isRollEcho ? ' is-roll-echo' : '';
    const entryEl = el('div', {
      class: `camp-narr-entry ${extraClass}${echoClass}`,
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
      // Mantém scroll seguindo enquanto digita (real container — ancestor em mobile)
      if (this.isPinnedToBottom) {
        const c = this.getScrollContainer();
        c.scrollTop = c.scrollHeight;
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
    // BUG-Ω.4 — Usa o real scroll container (pode ser ancestor em mobile).
    const c = this.getScrollContainer();
    const distanceFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
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
    // BUG-Ω.4 — Garante listener no ancestor scrollable (mobile). Idempotente.
    this.bindAncestorScrollOnce();
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

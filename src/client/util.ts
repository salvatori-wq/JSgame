// JSgame · Helpers DOM utilitários. Sem framework — vanilla TypeScript.

// Cria element com tag + classes + atributos + filhos.
// Uso: el('div', { class: 'foo bar', text: 'Hello' }, [child1, child2])
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    class?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string | number | boolean>;
    on?: { [event: string]: EventListener };
    style?: Partial<CSSStyleDeclaration>;
  } = {},
  children: (HTMLElement | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (typeof v === 'boolean') {
        if (v) node.setAttribute(k, ''); else node.removeAttribute(k);
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  if (opts.on) {
    for (const [evt, handler] of Object.entries(opts.on)) {
      node.addEventListener(evt, handler);
    }
  }
  if (opts.style) {
    Object.assign(node.style, opts.style);
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// QW-2 — Narration markdown renderer. XSS-safe: escapa HTML PRIMEIRO, depois
// aplica formatação leve via regex. Suporta **bold**, *italic* e `code`.
// Newlines viram <br>. Não é parser markdown completo — só visual upgrade.
export function renderNarrationText(s: string): string {
  // 1) Escapa todo HTML primeiro — entrada arbitrária do LLM/player é untrusted
  let out = escapeHtml(s);
  // 2) Bold (precisa ser ANTES de italic — `**` é greedy match)
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // 3) Italic com asterisco (precisa não capturar `*` adjacente de bold já processado)
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // 4) Italic com underscore (alternativa comum em outputs LLM)
  out = out.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  // 5) Inline code (backticks já escapados? não — backtick não está em escapeHtml,
  //    mas também não é tag HTML, então OK)
  out = out.replace(/`([^`\n]+?)`/g, '<code>$1</code>');
  // 6) Quebras de linha → <br>
  out = out.replace(/\n/g, '<br>');
  return out;
}

export function uuid(): string {
  // Não-cryptographic — bom o suficiente pra character IDs locais.
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

// Lê/escreve owner name no localStorage (identidade simples no MVP).
const OWNER_KEY = 'jsgame:owner';
export function getOwnerName(): string {
  try { return localStorage.getItem(OWNER_KEY) ?? ''; } catch { return ''; }
}
export function setOwnerName(name: string): void {
  try { localStorage.setItem(OWNER_KEY, name.trim()); } catch { /* ignore */ }
}

// Sessão ativa (pra auto-rejoin no reload).
const LAST_SESSION_KEY = 'jsgame:lastSession';
export interface LastSession {
  characterId: string;
  campaignId: string;
}
export function getLastSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSession>;
    if (!parsed.characterId || !parsed.campaignId) return null;
    return { characterId: parsed.characterId, campaignId: parsed.campaignId };
  } catch { return null; }
}
export function setLastSession(s: LastSession): void {
  try { localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function clearLastSession(): void {
  try { localStorage.removeItem(LAST_SESSION_KEY); } catch { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════════════
// Touch gestures — swipe down detection pra fechar modals em mobile.
// Usa touchstart/touchmove/touchend nativo, sem dependência externa.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Liga swipe-down em um elemento. Quando user arrasta dedo pra baixo > threshold,
 * chama onSwipeDown. Útil pra modals dispensarem-se via gesto.
 * Retorna função pra desligar (importante em modal close pra evitar leak).
 *
 * Threshold default: 80px de drag vertical com tolerância horizontal de 40px
 * (evita disparar em scroll horizontal acidental).
 */
export function onSwipeDown(
  el: HTMLElement,
  onSwipeDown: () => void,
  opts: { threshold?: number; horizTolerance?: number } = {},
): () => void {
  const threshold = opts.threshold ?? 80;
  const horizTolerance = opts.horizTolerance ?? 40;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  // ψ.2-fix — Bug "modal não scrolla": se touch começou dentro de área
  // scrollável, deixa o browser scrollar nativo (não captura swipe-down).
  const isInsideScrollableWithRoom = (target: EventTarget | null): boolean => {
    let node: Node | null = target as Node | null;
    while (node && node !== el && node instanceof HTMLElement) {
      const cs = getComputedStyle(node);
      const canScrollY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      if (canScrollY && node.scrollHeight > node.clientHeight) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  };

  const onStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    if (isInsideScrollableWithRoom(e.target)) {
      tracking = false;
      return;
    }
    startX = e.touches[0]!.clientX;
    startY = e.touches[0]!.clientY;
    tracking = true;
  };
  const onEnd = (e: TouchEvent): void => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (dy > threshold && Math.abs(dx) < horizTolerance) {
      onSwipeDown();
    }
  };
  const onCancel = (): void => { tracking = false; };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', onCancel, { passive: true });

  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onCancel);
  };
}

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

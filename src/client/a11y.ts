// JSgame · POLISH ε — Acessibilidade & Resiliência.
//
// Helpers globais aplicados no boot pra cobrir:
// - ε.1 ESC fecha modais bottom-sheet + close button (sem refactor por modal)
// - ε.2 ARIA labels automáticos em botões icon-only via title (MutationObserver)
// - ε.5 Error boundary global window.onerror + unhandledrejection → toast

import { toastError } from './toast';

/**
 * Heurística: botão é "icon-only" se conteúdo de texto tem ≤2 caracteres visíveis
 * (típico de emoji, ✕, ⋯, etc) e tem title mas não aria-label.
 * Aplicar title como aria-label resolve 80% dos casos sem refactor.
 */
function enhanceButtonsAria(root: ParentNode): void {
  const buttons = root.querySelectorAll('button, [role="button"]');
  for (const btn of buttons) {
    if (btn.hasAttribute('aria-label')) continue;
    const text = (btn.textContent ?? '').trim();
    // Considera icon-only se ≤3 chars (emoji + opt space) ou só whitespace
    if (text.length > 3) continue;
    const title = btn.getAttribute('title') ?? btn.getAttribute('data-tooltip');
    if (title && title.length > 0) {
      btn.setAttribute('aria-label', title);
    } else if (text.length > 0) {
      // Fallback: usa o texto (ex: "✕") com prefixo descritivo
      const fallback = text === '✕' || text === '×' || text === '✖'
        ? 'Fechar'
        : text === '⋯' ? 'Mais opções'
        : text === '🗑' ? 'Excluir'
        : text === '🎒' ? 'Inventário'
        : text === '📜' ? 'Quests'
        : text === '🏆' ? 'Conquistas'
        : null;
      if (fallback) btn.setAttribute('aria-label', fallback);
    }
  }
}

/**
 * Marca elementos comuns com role/aria apropriado.
 * Modais bottom-sheet ganham role=dialog + aria-modal=true.
 * Loading indicators ganham role=status. Toasts de erro ganham role=alert.
 */
function enhanceLandmarksAria(root: ParentNode): void {
  // Bottom-sheet modais (.m-modal pattern)
  const modals = root.querySelectorAll('.inv-modal-overlay, .mc-modal-overlay, .mem-modal-overlay, .cs-modal-overlay, .wcm-overlay');
  for (const m of modals) {
    if (!m.hasAttribute('role')) m.setAttribute('role', 'dialog');
    if (!m.hasAttribute('aria-modal')) m.setAttribute('aria-modal', 'true');
  }
  // Loading / thinking indicators
  const loaders = root.querySelectorAll('.dm-thinking, .skeleton, [class*="loading"]');
  for (const l of loaders) {
    if (!l.hasAttribute('role')) l.setAttribute('role', 'status');
    if (!l.hasAttribute('aria-live')) l.setAttribute('aria-live', 'polite');
  }
  // Toasts de erro
  const errors = root.querySelectorAll('.toast-error, [class*="error-banner"]');
  for (const e of errors) {
    if (!e.hasAttribute('role')) e.setAttribute('role', 'alert');
  }
}

/**
 * Inicia MutationObserver que aplica enhance* sempre que novos elementos
 * aparecem no DOM. Cobre 100% das telas sem refactor por componente.
 */
export function initA11yEnhancements(): void {
  const root = document.body;

  // Aplica imediatamente em conteúdo já presente
  enhanceButtonsAria(root);
  enhanceLandmarksAria(root);

  // Observer pra novos elementos (router troca de view, modal abre, etc)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          enhanceButtonsAria(el);
          enhanceLandmarksAria(el);
        }
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

/**
 * Handler global de ESC pra fechar modais bottom-sheet abertos.
 * Procura por overlays comuns e dispara click no botão de fechar.
 * Cobre 8+ modais sem mexer em código de cada um.
 */
export function initEscapeKeyHandler(): void {
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    // Priority order — mais específico primeiro
    const closeSelectors = [
      '.inv-modal-close',
      '.mc-modal-close',
      '.mem-modal-close',
      '.cs-modal-close',
      '.wcm-close',
      '.tour-skip-btn',
      '[data-modal-close]',
    ];
    for (const sel of closeSelectors) {
      const btn = document.querySelector(sel);
      if (btn instanceof HTMLElement && isVisible(btn)) {
        ev.preventDefault();
        btn.click();
        return;
      }
    }
  });
}

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && el.tagName !== 'BODY') return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}

/**
 * Error boundary global — captura uncaught errors e unhandled promise
 * rejections, mostra toast user-friendly em vez de tela branca.
 * Telemetria silenciosa pra debug futuro (POLISH-0 pattern).
 */
export function initGlobalErrorBoundary(): void {
  // Counter pra evitar flood — máximo 3 toasts por sessão
  let errorCount = 0;
  const MAX_ERRORS = 3;

  function reportError(source: string, message: string, stack?: string): void {
    errorCount += 1;
    if (errorCount <= MAX_ERRORS) {
      toastError(`⚠ Algo se quebrou (${source}). Continue jogando — se piorar, recarregue.`);
    }
    // Fire-and-forget telemetria — usa rota client metric whitelist? Não,
    // ainda não temos client_error. Por enquanto só console + futuro telem.
    console.error(`[a11y/boundary] ${source}:`, message, stack);
  }

  window.addEventListener('error', (ev) => {
    reportError('runtime', ev.message, ev.error?.stack);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportError('promise', msg, stack);
  });
}

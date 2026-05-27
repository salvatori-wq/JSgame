// MP1 — Swipe-down genérico p/ modais mobile bottom-sheet.
// Detecta drag vertical com velocity check + adiciona handlebar visual opcional.
// Reusa lógica básica de `util.ts:onSwipeDown` mas adiciona velocity (px/ms)
// e helper de handlebar — padrão único pra Sessão 3 aplicar em 7 modais.

export interface SwipeDownOptions {
  /** Distância mínima vertical pra disparar (default 80px) */
  threshold?: number;
  /** Tolerância horizontal — evita disparar em scroll-x (default 50px) */
  horizTolerance?: number;
  /** Velocidade mínima px/ms (default 0.3 — gesture intencional) */
  minVelocity?: number;
  /** Adiciona <div class="m-handlebar"></div> automaticamente no topo do el (default false) */
  addHandlebar?: boolean;
}

/**
 * Liga swipe-down em um elemento (tipicamente o modal root ou seu header).
 * Quando user faz drag vertical maior que `threshold` E com velocidade suficiente,
 * chama `onClose`. Retorna função de teardown — chamar no modal close pra evitar leak.
 *
 * Diferenças vs `util.ts:onSwipeDown`:
 *  - Velocity check (gesture intencional, não scroll lento)
 *  - Handlebar visual opcional (insere DOM)
 *  - touchcancel limpa estado mesmo se tracking ativo
 */
export function attachSwipeDown(
  el: HTMLElement,
  onClose: () => void,
  opts: SwipeDownOptions = {},
): () => void {
  const threshold = opts.threshold ?? 80;
  const horizTolerance = opts.horizTolerance ?? 50;
  const minVelocity = opts.minVelocity ?? 0.3;

  let handlebarEl: HTMLDivElement | null = null;
  if (opts.addHandlebar) {
    handlebarEl = document.createElement('div');
    handlebarEl.className = 'm-handlebar';
    handlebarEl.setAttribute('aria-hidden', 'true');
    el.insertBefore(handlebarEl, el.firstChild);
  }

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let tracking = false;

  // ψ.2-fix — Verifica se o touch começou DENTRO de uma área SCROLLÁVEL.
  // Aceita mesmo se scrollHeight === clientHeight (empty state) — caso contrário
  // o swipe-down fecharia o sheet quando user toca em .cs-empty sem mensagens.
  // Defesa por proximidade do conteúdo: qualquer overflow-y:auto/scroll = "dentro
  // de zona de scroll, deixa nativo cuidar mesmo que ainda não scrolle".
  const isInsideScrollableWithRoom = (target: EventTarget | null): boolean => {
    let node: Node | null = target as Node | null;
    while (node && node !== el && node instanceof HTMLElement) {
      const cs = getComputedStyle(node);
      const canScrollY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      // ψ.2-fix-v2: aceita SEM exigir scrollHeight > clientHeight.
      // Antes: bug "swipe fecha chat em empty state" pq sem msgs scrollHeight===clientHeight
      if (canScrollY) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  };

  const onStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    // ψ.2-fix — Se touch começou dentro de área scrollável com conteúdo, NÃO rastreia
    // swipe-down. Deixa o scroll nativo do browser cuidar.
    if (isInsideScrollableWithRoom(e.target)) {
      tracking = false;
      return;
    }
    startX = e.touches[0]!.clientX;
    startY = e.touches[0]!.clientY;
    startT = performance.now();
    tracking = true;
  };
  const onEnd = (e: TouchEvent): void => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = performance.now() - startT;
    if (dt <= 0) return;
    const velocity = dy / dt;
    if (dy > threshold && Math.abs(dx) < horizTolerance && velocity >= minVelocity) {
      onClose();
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
    if (handlebarEl?.parentElement === el) {
      el.removeChild(handlebarEl);
    }
  };
}

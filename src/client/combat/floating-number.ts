// JSgame · F34 — Floating damage/heal numbers.
// Spawn pop-up animado em cima de um elemento alvo. Anima up + fade out.
// Usado em combat para feedback visual imediato de dano/cura.

export type FloatingKind = 'damage' | 'heal' | 'miss' | 'crit';

export interface FloatingOpts {
  value: number | string;
  kind: FloatingKind;
}

// Acha o elemento DOM relacionado ao targetId no combat.
// Retorna null se não achou (alvo fora da tela / não renderizado).
export function findCombatTarget(targetId: string): HTMLElement | null {
  return document.querySelector(`[data-combat-target="${CSS.escape(targetId)}"]`) as HTMLElement | null;
}

export function spawnFloating(over: HTMLElement, opts: FloatingOpts): void {
  const rect = over.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = `fn-pop fn-${opts.kind}`;
  const label = opts.kind === 'damage' ? `-${opts.value}`
    : opts.kind === 'heal' ? `+${opts.value}`
    : opts.kind === 'crit' ? `CRIT ${opts.value}`
    : 'MISS';
  node.textContent = label;
  // Posição: centralizado horizontalmente, um pouco acima do alvo.
  const left = rect.left + rect.width / 2;
  const top = rect.top + rect.height * 0.25;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  document.body.appendChild(node);

  // Auto-remove após animação (1.2s — ajustar se CSS mudar)
  window.setTimeout(() => node.remove(), 1300);
}

// Flash transitório no HP-bar de um alvo (damage taken).
export function flashHpBar(targetEl: HTMLElement): void {
  const bar = targetEl.querySelector('.cb-enemy-hp-bar, .cp-pj-hp-bar');
  if (!bar) return;
  bar.classList.remove('is-flashing');
  // Force reflow para reiniciar a animação
  void (bar as HTMLElement).offsetWidth;
  bar.classList.add('is-flashing');
  window.setTimeout(() => bar.classList.remove('is-flashing'), 700);
}

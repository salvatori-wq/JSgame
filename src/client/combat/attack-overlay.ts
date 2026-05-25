// JSgame · Attack overlay — d20 animado pra resolução de ataque em combate.
// Estética alinhada ao skill-check-overlay: spin 1s → resultado hit/miss → dmg.

import type { CombatEvent } from '@shared/types';
import { el } from '../util';

let currentEl: HTMLDivElement | null = null;

export interface AttackResolution {
  attackerName: string;
  targetName: string;
  attackRollTotal: number;
  attackDie: number;          // o d20 cru
  targetAc: number;
  hit: boolean;
  crit: boolean;
  fumble: boolean;
  damage?: number;
}

export function showAttackOverlay(res: AttackResolution, onClose: () => void): void {
  closeAttack();

  const overlay = el('div', { class: 'atk-overlay' });
  overlay.appendChild(el('div', { class: 'atk-backdrop' }));

  const stage = el('div', { class: 'atk-stage' });
  stage.innerHTML = `
    <div class="atk-label">${escapeHtml(res.attackerName)} → ${escapeHtml(res.targetName)}</div>
    <div class="atk-row">
      <div class="atk-die atk-die-rolling"><span class="atk-face">?</span></div>
      <div class="atk-chip atk-chip-ac">CA ${res.targetAc}</div>
    </div>
    <div class="atk-verdict atk-verdict-idle">…</div>
  `;
  overlay.appendChild(stage);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  // Spin 900ms
  const die = stage.querySelector('.atk-die') as HTMLDivElement;
  const face = stage.querySelector('.atk-face') as HTMLSpanElement;
  const verdict = stage.querySelector('.atk-verdict') as HTMLDivElement;

  const start = Date.now();
  const spin = window.setInterval(() => {
    if (Date.now() - start >= 850) {
      window.clearInterval(spin);
      die.classList.remove('atk-die-rolling');
      face.textContent = String(res.attackDie);

      if (res.crit) die.classList.add('atk-die-crit');
      else if (res.fumble) die.classList.add('atk-die-fumble');
      else if (res.hit) die.classList.add('atk-die-hit');
      else die.classList.add('atk-die-miss');

      const txt = res.crit
        ? `CRÍTICO! ${res.attackRollTotal} vs CA ${res.targetAc} — ${res.damage} dmg`
        : res.fumble
          ? `NAT 1 — falha catastrófica`
          : res.hit
            ? `ACERTO ${res.attackRollTotal} ≥ CA ${res.targetAc} — ${res.damage} dmg`
            : `ERROU ${res.attackRollTotal} < CA ${res.targetAc}`;
      verdict.textContent = txt;
      verdict.className = `atk-verdict ${res.crit ? 'atk-verdict-crit' : res.hit ? 'atk-verdict-hit' : res.fumble ? 'atk-verdict-fumble' : 'atk-verdict-miss'}`;

      window.setTimeout(() => { closeAttack(); onClose(); }, 1800);
    } else {
      face.textContent = String(1 + Math.floor(Math.random() * 20));
    }
  }, 55);
}

export function closeAttack(): void {
  currentEl?.remove();
  currentEl = null;
}

// Helper pra construir AttackResolution a partir de um CombatEvent (damage ou attack-miss).
// Usado quando server emite combatEvent sequencial e cliente quer animar.
export function resolutionFromEvent(
  ev: CombatEvent,
  attackerName: string,
  targetName: string,
  targetAc: number,
): AttackResolution | null {
  if (ev.type === 'damage') {
    return {
      attackerName, targetName, targetAc,
      attackRollTotal: targetAc, // só pra UI — server já valida
      attackDie: 0,
      hit: true,
      crit: ev.text?.includes('CRITA') ?? false,
      fumble: false,
      damage: ev.value,
    };
  }
  if (ev.type === 'attack-miss') {
    return {
      attackerName, targetName, targetAc,
      attackRollTotal: 0,
      attackDie: 0,
      hit: false,
      crit: false,
      fumble: false,
    };
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// JSgame · Skill check overlay — d20 animado, mostra modifier + DC + verdict.
// Acionado quando server emite pendingSkillCheck via campaignState.
// Player clica "Rolar d20" → emit requestSkillCheck → aguarda diceRollResult.

import type { DiceRoll, SkillId } from '@shared/types';
import { SKILLS } from '@dnd/skills';
import { ABILITY_SHORT } from '@dnd/attributes';
import { el, escapeHtml } from '../util';

export interface PendingCheck {
  skill: SkillId;
  dc: number;
  reason: string;
  bonus: number;          // pre-calculado pelo cliente (PJ ability mod + prof?)
}

let currentEl: HTMLDivElement | null = null;

export function showPendingSkillCheck(
  check: PendingCheck,
  onRoll: () => void,
): void {
  closeSkillCheck();
  const skill = SKILLS[check.skill];

  const overlay = el('div', { class: 'sc-overlay' });
  overlay.appendChild(el('div', { class: 'sc-backdrop' }));

  const stage = el('div', { class: 'sc-stage' });
  stage.innerHTML = `
    <div class="sc-label">${escapeHtml(skill.name)}</div>
    <div class="sc-sub">${escapeHtml(check.reason)}</div>
    <div class="sc-row">
      <div class="sc-chip sc-chip-attr">${ABILITY_SHORT[skill.ability]} ${check.bonus >= 0 ? '+' : ''}${check.bonus}</div>
      <div class="sc-die sc-die-idle"><span class="sc-face">?</span></div>
      <div class="sc-chip sc-chip-dc">DC ${check.dc}</div>
    </div>
    <div class="sc-verdict sc-verdict-idle">Clique pra rolar o d20</div>
  `;

  const rollBtn = el('button', {
    class: 'sc-roll-btn',
    text: '🎲 Rolar d20',
    attrs: { type: 'button' },
    on: { click: () => onRoll() },
  });
  stage.appendChild(rollBtn);

  overlay.appendChild(stage);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;
}

// Após receber diceRollResult do server, anima o resultado.
export function showSkillCheckResult(
  roll: DiceRoll,
  check: PendingCheck,
  onClose: () => void,
): void {
  if (!currentEl) {
    // Caso o overlay tenha sido fechado, recria
    showPendingSkillCheck(check, () => { /* noop */ });
    if (!currentEl) return;
  }

  const stage = (currentEl as HTMLElement).querySelector('.sc-stage');
  if (!stage) return;

  const die = stage.querySelector('.sc-die') as HTMLDivElement | null;
  const face = stage.querySelector('.sc-face') as HTMLSpanElement | null;
  const verdict = stage.querySelector('.sc-verdict') as HTMLDivElement | null;
  const rollBtn = stage.querySelector('.sc-roll-btn') as HTMLButtonElement | null;

  if (!die || !face || !verdict) return;

  // Esconde botão
  rollBtn?.remove();

  // Animação spin (1.1s)
  die.classList.remove('sc-die-idle');
  die.classList.add('sc-die-rolling');
  verdict.textContent = '…';

  const spinStart = Date.now();
  const spinTick = window.setInterval(() => {
    const elapsed = Date.now() - spinStart;
    if (elapsed >= 1000) {
      window.clearInterval(spinTick);
      die.classList.remove('sc-die-rolling');
      face.textContent = String(roll.rolls[0] ?? 0);

      const success = roll.total >= check.dc;
      if (roll.nat20) die.classList.add('sc-die-nat20');
      else if (roll.nat1) die.classList.add('sc-die-nat1');
      else if (success) die.classList.add('sc-die-success');
      else die.classList.add('sc-die-fail');

      if (verdict) {
        const verdictText = roll.nat20
          ? `NAT 20 — ${roll.total} vs DC ${check.dc} · CRÍTICO`
          : roll.nat1
            ? `NAT 1 — ${roll.total} vs DC ${check.dc} · FALHA CRÍTICA`
            : success
              ? `${roll.rolls[0]} ${formatMod(check.bonus)} = ${roll.total} ≥ DC ${check.dc} · SUCESSO`
              : `${roll.rolls[0]} ${formatMod(check.bonus)} = ${roll.total} < DC ${check.dc} · FALHOU`;
        verdict.textContent = verdictText;
        verdict.className = `sc-verdict ${success ? 'sc-verdict-success' : 'sc-verdict-fail'} ${roll.nat20 ? 'sc-verdict-nat20' : ''} ${roll.nat1 ? 'sc-verdict-nat1' : ''}`;
      }

      // Auto-close após 2.5s
      window.setTimeout(() => {
        closeSkillCheck();
        onClose();
      }, 2500);
    } else {
      face.textContent = String(1 + Math.floor(Math.random() * 20));
    }
  }, 55);
}

export function closeSkillCheck(): void {
  currentEl?.remove();
  currentEl = null;
}

function formatMod(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
}

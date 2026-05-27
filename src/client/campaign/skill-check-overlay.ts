// JSgame · Skill check overlay — d20 animado, mostra modifier + DC + verdict.
// Acionado quando server emite pendingSkillCheck via campaignState.
// Player clica "Rolar d20" → emit requestSkillCheck → aguarda diceRollResult.
//
// γ.1 — Usa <DieComponent> reusável de dice-3d.ts com som em 3 camadas
// (rolling + land + crit/fumble) + haptic feedback. Mantém fluxo de
// botão "Rolar"/"Inspiração" como já existia.

import type { DiceRoll, SkillId } from '../../shared/types';
import { SKILLS } from '../../dnd/skills';
import { ABILITY_SHORT } from '../../dnd/attributes';
import { el, escapeHtml } from '../util';
import { playDiceRolling, playDiceLand, playDiceCritTing, playDiceFumble } from '../audio';
import { renderDie, rollAndReveal, prefersReducedMotion } from '../dice/dice-3d';
import { hapticTap, hapticCrit, hapticFumble, hapticSuccess } from '../haptic';

export interface PendingCheck {
  skill: SkillId;
  dc: number;
  reason: string;
  bonus: number;          // pre-calculado pelo cliente (PJ ability mod + prof?)
  inspirations?: number;  // α.3 — quantas inspirações o PJ tem disponível (display + botão)
}

let currentEl: HTMLDivElement | null = null;

export function showPendingSkillCheck(
  check: PendingCheck,
  onRoll: (opts: { useInspiration: boolean }) => void,
): void {
  closeSkillCheck();
  const skill = SKILLS[check.skill];

  const overlay = el('div', { class: 'sc-overlay' });
  overlay.appendChild(el('div', { class: 'sc-backdrop' }));

  const stage = el('div', { class: 'sc-stage' });

  // Header textos
  const labelLine = el('div', { class: 'sc-label', text: skill.name });
  const subLine = el('div', { class: 'sc-sub', text: check.reason });
  stage.appendChild(labelLine);
  stage.appendChild(subLine);

  // Row: chip-bônus | dado 3D | chip-DC
  const row = el('div', { class: 'sc-row' });
  row.appendChild(el('span', {
    class: 'sc-chip sc-chip-attr',
    text: `${ABILITY_SHORT[skill.ability]} ${check.bonus >= 0 ? '+' : ''}${check.bonus}`,
  }));
  const die = renderDie({ kind: 'd20', value: '?' });
  die.classList.add('sc-die-slot');
  row.appendChild(die);
  row.appendChild(el('span', { class: 'sc-chip sc-chip-dc', text: `DC ${check.dc}` }));
  stage.appendChild(row);

  const verdict = el('div', { class: 'sc-verdict sc-verdict-idle', text: 'Clique pra rolar o d20' });
  stage.appendChild(verdict);

  let rolled = false;
  const rollAndDisable = (useInspiration: boolean): void => {
    if (rolled) return;
    rolled = true;
    rollBtn.setAttribute('disabled', '');
    rollBtn.textContent = 'Rolando…';
    rollBtn.classList.add('is-rolling');
    if (inspBtn) inspBtn.setAttribute('disabled', '');
    onRoll({ useInspiration });
  };

  const rollBtn = el('button', {
    class: 'sc-roll-btn',
    text: '🎲 Rolar d20',
    attrs: { type: 'button' },
    on: { click: () => rollAndDisable(false) },
  }) as HTMLButtonElement;
  stage.appendChild(rollBtn);

  // α.3 — Inspiração: botão extra "🌟 Usar Inspiração + Rolar" se PJ tem ≥1
  let inspBtn: HTMLButtonElement | null = null;
  const insp = check.inspirations ?? 0;
  if (insp > 0) {
    inspBtn = el('button', {
      class: 'sc-roll-btn sc-roll-inspiration',
      text: `🌟 Usar Inspiração (${insp}) — Rolar com Advantage`,
      attrs: { type: 'button', title: 'Gasta 1 inspiração pra rolar 2d20 e pegar o maior' },
      on: { click: () => rollAndDisable(true) },
    }) as HTMLButtonElement;
    stage.appendChild(inspBtn);
  }

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
    showPendingSkillCheck(check, () => { /* noop */ });
    if (!currentEl) return;
  }

  const stage = (currentEl as HTMLElement).querySelector('.sc-stage');
  if (!stage) return;

  const die = stage.querySelector('.die-3d') as HTMLDivElement | null;
  const verdict = stage.querySelector('.sc-verdict') as HTMLDivElement | null;
  const rollBtn = stage.querySelector('.sc-roll-btn') as HTMLButtonElement | null;

  if (!die || !verdict) return;

  // Esconde botões (rolagem em andamento)
  rollBtn?.remove();
  stage.querySelectorAll('.sc-roll-btn').forEach((b) => b.remove());

  // Camada 1 (som): rolling loop + haptic tap
  playDiceRolling();
  hapticTap();
  verdict.textContent = '…';
  verdict.className = 'sc-verdict sc-verdict-rolling';

  const success = roll.total >= check.dc;
  const special = roll.nat20 ? 'crit' : roll.nat1 ? 'fumble' : success ? 'success' : 'fail';
  const finalValue = roll.rolls[0] ?? 0;

  rollAndReveal(die, {
    final: finalValue,
    special,
    durationMs: prefersReducedMotion() ? 200 : 1000,
    onDone: () => {
      // Camada 2 (som): land thud
      playDiceLand();

      // Camada 3 (som+haptic): crit ting / fumble dread / success tap
      if (roll.nat20) { playDiceCritTing(); hapticCrit(); }
      else if (roll.nat1) { playDiceFumble(); hapticFumble(); }
      else if (success) { hapticSuccess(); }

      // Verdict text
      const verdictText = roll.nat20
        ? `NAT 20 — ${roll.total} vs DC ${check.dc} · CRÍTICO`
        : roll.nat1
          ? `NAT 1 — ${roll.total} vs DC ${check.dc} · FALHA CRÍTICA`
          : success
            ? `${finalValue} ${formatMod(check.bonus)} = ${roll.total} ≥ DC ${check.dc} · SUCESSO`
            : `${finalValue} ${formatMod(check.bonus)} = ${roll.total} < DC ${check.dc} · FALHOU`;
      verdict.textContent = verdictText;
      verdict.className = `sc-verdict ${success ? 'sc-verdict-success' : 'sc-verdict-fail'} ${roll.nat20 ? 'sc-verdict-nat20' : ''} ${roll.nat1 ? 'sc-verdict-nat1' : ''}`;

      // ARIA live region — anuncia pro screen reader
      const live = el('div', {
        class: 'visually-hidden',
        attrs: { role: 'alert', 'aria-live': 'polite' },
        text: verdictText,
      });
      stage.appendChild(live);

      // Auto-close após 2.5s
      window.setTimeout(() => {
        closeSkillCheck();
        onClose();
      }, 2500);
    },
  });

  // Silencia parâmetro não usado (legado)
  void escapeHtml;
}

export function closeSkillCheck(): void {
  currentEl?.remove();
  currentEl = null;
}

function formatMod(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
}

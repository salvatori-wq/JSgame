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
import { showToast } from '../toast';
import { trackClientMetric } from '../api';

export interface PendingCheck {
  skill: SkillId;
  dc: number;
  reason: string;
  bonus: number;          // pre-calculado pelo cliente (PJ ability mod + prof?)
  inspirations?: number;  // α.3 — quantas inspirações o PJ tem disponível (display + botão)
}

let currentEl: HTMLDivElement | null = null;
/** W1.4 — Watchdog 10s (era Ω.1 5s). Consultor Mobile: "latência LLM real é
 * 3-12s, player vê 'Rolando…' e desiste antes da animação completar. 5s mata
 * o flow". 10s cobre p95 sem prender UI indefinidamente. Toast também muda
 * pra não-disruptivo durante latência normal: "🎲 O Mestre está pensando…". */
let watchdogTimer: number | null = null;
const WATCHDOG_MS = 10000;

export function showPendingSkillCheck(
  check: PendingCheck,
  onRoll: (opts: { useInspiration: boolean }) => void,
  onSkip?: () => void,
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

  // POLISH α.4 — Tutorial inline na PRIMEIRA vez que o player vê o overlay.
  // localStorage flag persiste entre sessões. Explica brevemente d20 + DC +
  // Inspiração pra não deixar o player perdido. Some na 2ª vez em diante.
  if (!hasSeenSkillCheckTutorial()) {
    markSkillCheckTutorialSeen();
    const tutorial = el('div', { class: 'sc-tutorial' }, [
      el('div', { class: 'sc-tutorial-title', text: '🎲 Primeiro teste de perícia!' }),
      el('div', { class: 'sc-tutorial-body' }, [
        el('span', { text: 'Você rola um ' }),
        el('b', { text: 'd20' }),
        el('span', { text: ` + seu bônus. Soma ≥ ` }),
        el('b', { text: 'DC' }),
        el('span', { text: ` = sucesso. Nat 20 = crítico, Nat 1 = falha crítica.` }),
      ]),
    ]);
    stage.appendChild(tutorial);
  }

  // Row: chip-bônus | dado 3D | chip-DC
  const row = el('div', { class: 'sc-row' });
  row.appendChild(el('span', {
    class: 'sc-chip sc-chip-attr',
    text: `${ABILITY_SHORT[skill.ability]} ${check.bonus >= 0 ? '+' : ''}${check.bonus}`,
    attrs: { title: `Bônus de ${skill.name} — atributo ${ABILITY_SHORT[skill.ability]} ${check.bonus >= 0 ? '+' : ''}${check.bonus}` },
  }));
  const die = renderDie({ kind: 'd20', value: '?' });
  die.classList.add('sc-die-slot');
  row.appendChild(die);
  // N1.1 + N2.3 — Chip DC ganha tooltip educacional. Player vê em hover/long-press:
  // "DC X = [muito fácil / fácil / média / difícil / muito difícil]" (PHB DMG p.238).
  row.appendChild(el('span', {
    class: 'sc-chip sc-chip-dc',
    text: `DC ${check.dc}`,
    attrs: { title: dcDifficultyLabel(check.dc) },
  }));
  stage.appendChild(row);

  // N1.1 — Verdict idle agora EDUCACIONAL: mostra fórmula d20 + bônus vs DC
  // em vez de "Clique pra rolar o d20". Newbie aprende a mecânica enquanto
  // joga. Tom didático mas curto pra não distrair.
  const bonusStr = check.bonus >= 0 ? `+ ${check.bonus}` : `− ${Math.abs(check.bonus)}`;
  const verdict = el('div', {
    class: 'sc-verdict sc-verdict-idle',
    text: `d20 ${bonusStr} vs DC ${check.dc} — toque pra rolar`,
  });
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
    // Ω.1 — Watchdog: se showSkillCheckResult não chamar em 5s, libera UI.
    if (watchdogTimer !== null) window.clearTimeout(watchdogTimer);
    watchdogTimer = window.setTimeout(() => {
      handleWatchdogTimeout(rollBtn, inspBtn);
    }, WATCHDOG_MS);
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

  // M1.2 + N1.3 — Botão sutil de skip — player ignora a oportunidade e segue
  // jogando. Texto agora clarifica que skip NÃO cancela a cena, só segue sem
  // rolar (Henrique família: "vai pular pra outro teste? cancela?").
  if (onSkip) {
    stage.appendChild(el('button', {
      class: 'sc-skip-btn',
      text: 'Pular — segue sem rolar',
      attrs: { type: 'button', title: 'Não rola o dado. O Mestre continua a cena assumindo que você não percebeu/conseguiu.' },
      on: {
        click: () => {
          if (rolled) return;
          rolled = true;
          onSkip();
          closeSkillCheck();
        },
      },
    }));
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
  // Ω.1 — Watchdog desarmado: server respondeu a tempo.
  if (watchdogTimer !== null) {
    window.clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
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
    // ψ.1-fix — Aumentado 1000→1500ms pra player ver o dado caindo+girando
    durationMs: prefersReducedMotion() ? 200 : 1500,
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
  if (watchdogTimer !== null) {
    window.clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  currentEl?.remove();
  currentEl = null;
}

/** Ω.1 — Watchdog handler: server timeout (5s sem diceRollResult). */
function handleWatchdogTimeout(rollBtn: HTMLButtonElement, inspBtn: HTMLButtonElement | null): void {
  watchdogTimer = null;
  // Restaura botão pra player tentar de novo
  rollBtn.removeAttribute('disabled');
  rollBtn.textContent = '🎲 Tentar novamente';
  rollBtn.classList.remove('is-rolling');
  if (inspBtn) inspBtn.removeAttribute('disabled');
  // W1.4 — mensagem não-disruptiva pra cobrir latência LLM normal.
  // "O Mestre está pensando" sugere imersão, não erro.
  try {
    showToast({ kind: 'info', message: '🎲 O Mestre está pensando… tente rolar de novo se travou.', durationMs: 5000 });
  } catch { /* silent */ }
  try {
    trackClientMetric('dice_roll_timeout', { kind: 'skill-check' });
  } catch { /* silent */ }
}

function formatMod(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
}

// N1.1 + N2.3 — Tabela DC referência PHB DMG p.238. Usado em tooltip pro
// player iniciante aprender o que significa cada DC sem abrir glossário.
// Exposto pra tests (puro).
export function dcDifficultyLabel(dc: number): string {
  if (dc <= 5) return `DC ${dc} — Muito fácil (qualquer um passa)`;
  if (dc <= 10) return `DC ${dc} — Fácil (treinado quase sempre passa)`;
  if (dc <= 14) return `DC ${dc} — Média (50/50 pra mediano)`;
  if (dc <= 19) return `DC ${dc} — Difícil (precisa rolar bem ou bônus alto)`;
  if (dc <= 24) return `DC ${dc} — Muito difícil (heroico)`;
  return `DC ${dc} — Quase impossível (lendário)`;
}

// POLISH α.4 — Tutorial seen flag em localStorage. Persiste entre sessões pro
// player não ver o mesmo hint toda vez. Helper exportado pra tests.
const TUTORIAL_KEY = 'jsgame:skillCheckTutorialSeen';

export function hasSeenSkillCheckTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;  // SSR ou localStorage bloqueado — sempre mostra
  }
}

export function markSkillCheckTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch { /* silent */ }
}

/** Reseta o flag — útil pra testar / re-onboarding manual. */
export function resetSkillCheckTutorial(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch { /* silent */ }
}

// JSgame · T2.5 — Modal visual de Descanso Curto.
// Substitui inputDialog numérico genérico. Player vê:
//  - Hit dice disponíveis em chips numerados
//  - Preview de HP estimado por dice (1d_N + Con mod, fórmula PHB)
//  - Slider/+- pra escolher quantos gastar
//  - Botão "🛌 Descansar (N dice)" com preview total
//
// Promise<number|null> — null = cancel, número = quantos hit dice gastar.

import { el } from '../util';
import { abilityModifier } from '../../dnd/attributes';
import type { CharacterSheet } from '../../shared/types';
import { getClass } from '../../dnd/classes';
import { push as pushSheet, pop as popSheet, isSheetOpen } from '../sheet-stack-manager';

const SHEET_ID = 'short-rest';

export interface ShortRestPickerCtx {
  character: CharacterSheet;
  maxDice: number;
  onConfirm: (diceCount: number) => void;
}

/**
 * Calcula o HP médio recuperado ao gastar N hit dice.
 * Fórmula PHB: cada hit die rola (1dN + ConMod). Mínimo 1 por dice (regra opcional, mantemos).
 * Mean(1dN) = (N+1)/2.
 */
export function estimateShortRestHp(hitDieFaces: number, conMod: number, dice: number): number {
  if (dice <= 0) return 0;
  const meanPerDie = (hitDieFaces + 1) / 2 + conMod;
  const safePerDie = Math.max(1, meanPerDie);
  return Math.round(safePerDie * dice);
}

export function openShortRestPicker(ctx: ShortRestPickerCtx): void {
  if (isSheetOpen(SHEET_ID)) return;

  const conMod = abilityModifier(ctx.character.abilityScores.con);
  const klass = getClass(ctx.character.classId);
  const dieFaces = klass.hitDie;
  const maxHpMissing = ctx.character.maxHp - ctx.character.currentHp;

  let selected = 1;

  const root = el('div', {
    class: 'srm-sheet',
    attrs: { role: 'dialog', 'aria-label': 'Descanso Curto' },
  });

  // Handlebar (mobile swipe-down affordance)
  root.appendChild(el('div', { class: 'cs-handlebar', attrs: { 'aria-hidden': 'true' } }));

  // Header
  root.appendChild(el('header', { class: 'srm-header' }, [
    el('div', { class: 'srm-title-row' }, [
      el('span', { class: 'srm-icon', text: '🛌' }),
      el('h2', { class: 'srm-title', text: 'Descanso Curto' }),
    ]),
    el('button', {
      class: 'srm-close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Fechar' },
      on: { click: () => closeModal() },
    }),
  ]));

  // Body
  const body = el('div', { class: 'srm-body' });

  // Info atual
  body.appendChild(el('div', { class: 'srm-info' }, [
    el('span', { class: 'srm-info-stat' }, [
      el('b', { text: `${ctx.character.currentHp}/${ctx.character.maxHp}` }),
      el('span', { text: ' HP' }),
    ]),
    el('span', { class: 'srm-info-dot', text: '·' }),
    el('span', { class: 'srm-info-stat' }, [
      el('b', { text: `${ctx.maxDice}` }),
      el('span', { text: ' hit dice' }),
    ]),
    el('span', { class: 'srm-info-dot', text: '·' }),
    el('span', { class: 'srm-info-stat' }, [
      el('span', { text: `d${dieFaces}+${conMod >= 0 ? '+' : ''}${conMod}` }),
    ]),
  ]));

  // Chips de dice (1, 2, 3, …, max)
  const chipsRow = el('div', { class: 'srm-chips', attrs: { role: 'radiogroup', 'aria-label': 'Quantos hit dice gastar' } });
  const previewLabel = el('div', { class: 'srm-preview' });

  const updatePreview = (): void => {
    const est = estimateShortRestHp(dieFaces, conMod, selected);
    const clamped = Math.min(est, maxHpMissing);
    previewLabel.innerHTML = '';
    previewLabel.appendChild(el('span', { class: 'srm-preview-icon', text: '❤' }));
    previewLabel.appendChild(el('span', { text: 'Estimado: ' }));
    previewLabel.appendChild(el('b', { class: 'srm-preview-val', text: `~${clamped} HP` }));
    if (est > maxHpMissing) {
      previewLabel.appendChild(el('span', { class: 'srm-preview-cap', text: ` (cap ${maxHpMissing})` }));
    }
  };

  for (let i = 1; i <= ctx.maxDice; i++) {
    const chip = el('button', {
      class: `srm-chip ${i === selected ? 'is-selected' : ''}`,
      text: String(i),
      attrs: { type: 'button', role: 'radio', 'aria-checked': String(i === selected) },
      on: {
        click: () => {
          selected = i;
          chipsRow.querySelectorAll('.srm-chip').forEach((c) => {
            c.classList.remove('is-selected');
            c.setAttribute('aria-checked', 'false');
          });
          chip.classList.add('is-selected');
          chip.setAttribute('aria-checked', 'true');
          updatePreview();
          confirmBtn.textContent = `🛌 Descansar (${selected} ${selected === 1 ? 'dice' : 'dice'})`;
        },
      },
    });
    chipsRow.appendChild(chip);
  }
  body.appendChild(chipsRow);
  body.appendChild(previewLabel);
  updatePreview();

  // Hint
  body.appendChild(el('p', { class: 'srm-hint', text: 'Hit dice gastam-se de verdade. Descanso longo (8h) recupera metade dos dice + cura tudo.' }));

  root.appendChild(body);

  // Footer
  const confirmBtn = el('button', {
    class: 'srm-confirm',
    text: `🛌 Descansar (${selected} dice)`,
    attrs: { type: 'button' },
    on: {
      click: () => {
        ctx.onConfirm(selected);
        closeModal();
      },
    },
  });
  const cancelBtn = el('button', {
    class: 'srm-cancel',
    text: 'Cancelar',
    attrs: { type: 'button' },
    on: { click: () => closeModal() },
  });
  root.appendChild(el('footer', { class: 'srm-footer' }, [cancelBtn, confirmBtn]));

  pushSheet({ id: SHEET_ID, element: root, onClose: () => { /* nothing */ } });
}

function closeModal(): void {
  if (isSheetOpen(SHEET_ID)) popSheet();
}

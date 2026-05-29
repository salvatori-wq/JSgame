// JSgame · Step 5: pré-seleção da escolha de nv 4 (ASI ou Feat).
// PHB: ao atingir nv 4 player ganha 1 feat OU +2 em atributos. Aqui o player
// planeja a escolha durante a criação — fica latente até o PJ subir.
// Step é OPCIONAL: pode pular (plannedLevel4Choice fica null/undefined).

import { ABILITY_KEYS, ABILITY_LABELS, ABILITY_SHORT } from '../../dnd/attributes';
import { ALL_FEATS, type FeatDef } from '../../dnd/feats';
import { el, escapeHtml } from '../util';
import type { WizardState } from './wizard';
import type { AbilityKey, PlannedLevel4Choice } from '../../shared/types';

// Modo da UI — separado do state da sheet pra suportar "começou a configurar mas não terminou".
type Mode = 'none' | 'asi' | 'feat';

export function renderFeatStep(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void; next: () => void; back: () => void },
): HTMLElement {
  const container = el('div', { class: 'wiz-step wiz-step-feat' });
  container.appendChild(el('h2', { class: 'wiz-h2', text: 'Escolha de Nível 4 (opcional)' }));
  container.appendChild(el('p', { class: 'wiz-intro', text: 'Ao chegar no nível 4 você escolhe: +2 em atributos OU um talento (uma habilidade especial). Pode planejar agora ou pular — dá pra decidir depois quando subir.' }));

  // Modo inicial vem do state atual
  const initialMode: Mode = !state.plannedLevel4Choice
    ? 'none'
    : state.plannedLevel4Choice.kind === 'asi' ? 'asi' : 'feat';
  let mode: Mode = initialMode;

  const body = el('div', { class: 'feat-body' });
  const footer = el('footer', { class: 'wiz-footer wiz-footer-sticky' });

  const renderAll = (): void => {
    body.innerHTML = '';
    body.appendChild(renderModeToggle(mode, (m) => {
      mode = m;
      // Limpa state ao mudar de modo
      if (m === 'none') callbacks.update({ plannedLevel4Choice: null });
      renderAll();
    }));

    if (mode === 'asi') {
      body.appendChild(renderAsiPicker(state, callbacks, renderAll));
    } else if (mode === 'feat') {
      body.appendChild(renderFeatPicker(state, callbacks, renderAll));
    } else {
      body.appendChild(el('p', { class: 'feat-skip-note', text: 'Sem pré-seleção — você decide no level-up.' }));
    }

    footer.innerHTML = '';
    footer.appendChild(el('button', { class: 'wiz-back', text: '← Voltar', on: { click: () => callbacks.back() } }));

    const hint = getHint(mode, state.plannedLevel4Choice);
    footer.appendChild(el('div', { class: `wiz-hint ${hint.ready ? 'is-ready' : ''}`, text: hint.text }));

    // Continuar sempre habilitado (step é opcional)
    footer.appendChild(el('button', {
      class: 'wiz-cta',
      text: 'Continuar →',
      attrs: { type: 'button' },
      on: { click: () => callbacks.next() },
    }));
  };

  renderAll();
  container.appendChild(body);
  container.appendChild(footer);
  return container;
}

function getHint(mode: Mode, choice: PlannedLevel4Choice | null | undefined): { text: string; ready: boolean } {
  if (mode === 'none') return { text: '✓ Pode pular — decisão fica pro level-up', ready: true };
  if (mode === 'asi') {
    if (!choice || choice.kind !== 'asi') return { text: 'Escolha 2 atributos pra +2 / +1 ↑', ready: false };
    return { text: `✓ ASI: +2 ${ABILITY_SHORT[choice.plusTwo]} · +1 ${ABILITY_SHORT[choice.plusOne]}`, ready: true };
  }
  // feat
  if (!choice || choice.kind !== 'feat') return { text: 'Escolha um talento ↑', ready: false };
  return { text: `✓ Feat: ${escapeHtml(ALL_FEATS.find((f) => f.id === choice.featId)?.name ?? '?')}`, ready: true };
}

function renderModeToggle(mode: Mode, onChange: (m: Mode) => void): HTMLElement {
  const wrap = el('div', { class: 'feat-mode-toggle' });
  const modes: { id: Mode; label: string; sub: string }[] = [
    { id: 'none', label: 'Pular', sub: 'decido depois' },
    { id: 'asi', label: '+2 Atributos', sub: 'reforça os atributos' },
    { id: 'feat', label: 'Talento', sub: 'ganha uma habilidade especial' },
  ];
  for (const m of modes) {
    wrap.appendChild(el('button', {
      class: `feat-mode-btn ${mode === m.id ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      on: { click: () => onChange(m.id) },
    }, [
      el('div', { class: 'fmb-label', text: m.label }),
      el('div', { class: 'fmb-sub', text: m.sub }),
    ]));
  }
  return wrap;
}

function renderAsiPicker(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
  rerender: () => void,
): HTMLElement {
  const wrap = el('div', { class: 'feat-asi-picker' });
  wrap.appendChild(el('p', { class: 'feat-intro-sub', text: 'Escolha um atributo pra +2 e outro pra +1. Atributo final não pode passar de 20 (validado ao aplicar no level-up).' }));

  const current = state.plannedLevel4Choice?.kind === 'asi' ? state.plannedLevel4Choice : null;

  const setChoice = (plusTwo: AbilityKey, plusOne: AbilityKey) => {
    callbacks.update({ plannedLevel4Choice: { kind: 'asi', plusTwo, plusOne } });
    rerender();
  };

  // Linha 1: +2
  wrap.appendChild(el('div', { class: 'feat-asi-row' }, [
    el('div', { class: 'feat-asi-label', text: '+2 em:' }),
    el('div', { class: 'feat-asi-buttons' },
      ABILITY_KEYS.map((k) =>
        el('button', {
          class: `feat-ab-btn ${current?.plusTwo === k ? 'is-active' : ''}`,
          attrs: { type: 'button' },
          text: ABILITY_LABELS[k],
          on: {
            click: () => {
              const plusOne = current?.plusOne && current.plusOne !== k ? current.plusOne : ABILITY_KEYS.find((a) => a !== k)!;
              setChoice(k, plusOne);
            },
          },
        }),
      ),
    ),
  ]));

  // Linha 2: +1 (só habilitado se +2 já escolhido)
  if (current?.plusTwo) {
    wrap.appendChild(el('div', { class: 'feat-asi-row' }, [
      el('div', { class: 'feat-asi-label', text: '+1 em:' }),
      el('div', { class: 'feat-asi-buttons' },
        ABILITY_KEYS.filter((k) => k !== current.plusTwo).map((k) =>
          el('button', {
            class: `feat-ab-btn ${current.plusOne === k ? 'is-active' : ''}`,
            attrs: { type: 'button' },
            text: ABILITY_LABELS[k],
            on: { click: () => setChoice(current.plusTwo, k) },
          }),
        ),
      ),
    ]));
  }

  return wrap;
}

function renderFeatPicker(
  state: WizardState,
  callbacks: { update: (patch: Partial<WizardState>) => void },
  rerender: () => void,
): HTMLElement {
  const wrap = el('div', { class: 'feat-feat-picker' });
  const current = state.plannedLevel4Choice?.kind === 'feat' ? state.plannedLevel4Choice : null;

  const grid = el('div', { class: 'wiz-grid wiz-grid-feat' });
  for (const feat of ALL_FEATS) {
    grid.appendChild(renderFeatCard(feat, current?.featId === feat.id, () => {
      callbacks.update({ plannedLevel4Choice: { kind: 'feat', featId: feat.id } });
      rerender();
    }));
  }
  wrap.appendChild(grid);
  return wrap;
}

function renderFeatCard(feat: FeatDef, isSelected: boolean, onSelect: () => void): HTMLElement {
  const card = el('article', {
    class: `wiz-card wiz-card-feat ${isSelected ? 'is-selected' : ''}`,
    attrs: { role: 'button', tabindex: 0 },
    on: { click: () => onSelect() },
  });

  const benefits = feat.benefit.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  const prereq = feat.prerequisite?.ability
    ? `<div class="wc-prereq">Pré-req: ${ABILITY_SHORT[feat.prerequisite.ability.key]} ≥ ${feat.prerequisite.ability.min}</div>`
    : feat.prerequisite?.proficiency
      ? `<div class="wc-prereq">Pré-req: ${escapeHtml(feat.prerequisite.proficiency)}</div>`
      : '';
  const abInc = feat.abilityIncrease
    ? `<div class="wc-ab-inc">+1: ${Object.entries(feat.abilityIncrease).map(([k, v]) => `${ABILITY_SHORT[k as AbilityKey]} ${v! > 0 ? '+' : ''}${v}`).join(', ')}</div>`
    : '';

  card.innerHTML = `
    <div class="wc-name">${escapeHtml(feat.name)}</div>
    <div class="wc-desc">${escapeHtml(feat.description)}</div>
    <ul class="wc-benefits">${benefits}</ul>
    ${abInc}
    ${prereq}
  `;
  return card;
}

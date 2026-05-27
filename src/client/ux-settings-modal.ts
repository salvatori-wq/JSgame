// JSgame · ο.8 — UX Settings Modal.
// Modal de configurações de tela acessado via overflow menu.
// Density / Font / Contrast / Hit targets / Anim / Typewriter.

import { el } from './util';
import { getUxPrefs, setUxPrefs, type UxPrefs, type Density, type FontScale, type AnimSpeed, type TypewriterSpeed } from './ux-prefs';
import { push as pushSheet, pop as popSheet, isSheetOpen } from './sheet-stack-manager';

const SHEET_ID = 'ux-settings';

export function openUxSettingsModal(): void {
  if (isSheetOpen(SHEET_ID)) return;

  let prefs = getUxPrefs();

  const root = el('div', {
    class: 'ux-settings-sheet',
    attrs: { role: 'dialog', 'aria-label': 'Configurações de Tela' },
  });

  root.appendChild(el('div', { class: 'cs-handlebar', attrs: { 'aria-hidden': 'true' } }));

  root.appendChild(el('header', { class: 'cs-header' }, [
    el('div', { class: 'cs-title', text: '🎨 Tela & Preferências' }),
    el('button', {
      class: 'cs-close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Fechar' },
      on: { click: () => closeUxSettings() },
    }),
  ]));

  const body = el('div', { class: 'uxs-body' });

  // ───────── Densidade
  body.appendChild(renderSegment(
    'Densidade',
    [
      { value: 'compact', label: 'Compacto' },
      { value: 'standard', label: 'Padrão' },
      { value: 'comfortable', label: 'Confortável' },
    ],
    prefs.density,
    (v) => {
      prefs = setUxPrefs({ density: v as Density });
    },
  ));

  // ───────── Font scale
  body.appendChild(renderSegment(
    'Tamanho de fonte',
    [
      { value: '0.9', label: '0.9×' },
      { value: '1', label: '1×' },
      { value: '1.15', label: '1.15×' },
      { value: '1.3', label: '1.3×' },
    ],
    String(prefs.fontScale),
    (v) => {
      prefs = setUxPrefs({ fontScale: parseFloat(v) as FontScale });
    },
  ));

  // ───────── Anim speed
  body.appendChild(renderSegment(
    'Velocidade animações',
    [
      { value: 'slow', label: 'Lenta' },
      { value: 'normal', label: 'Normal' },
      { value: 'fast', label: 'Rápida' },
      { value: 'instant', label: 'Instantâneo' },
    ],
    prefs.animSpeed,
    (v) => {
      prefs = setUxPrefs({ animSpeed: v as AnimSpeed });
    },
  ));

  // ───────── Typewriter speed
  body.appendChild(renderSegment(
    'Velocidade narração (typewriter)',
    [
      { value: 'instant', label: 'Instantâneo' },
      { value: 'slow', label: 'Lenta' },
      { value: 'normal', label: 'Normal' },
      { value: 'fast', label: 'Rápida' },
    ],
    prefs.typewriterSpeed,
    (v) => {
      prefs = setUxPrefs({ typewriterSpeed: v as TypewriterSpeed });
    },
  ));

  // ───────── Toggles
  body.appendChild(renderToggle(
    'Contraste reforçado',
    'Intensifica dourado e vermelho, escurece fundos',
    prefs.contrastBoost,
    (v) => {
      prefs = setUxPrefs({ contrastBoost: v });
    },
  ));

  body.appendChild(renderToggle(
    'Botões maiores (acessibilidade)',
    'Aumenta tap targets de 44 → 56px',
    prefs.hitTargetBoost,
    (v) => {
      prefs = setUxPrefs({ hitTargetBoost: v });
    },
  ));

  root.appendChild(body);

  pushSheet({
    id: SHEET_ID,
    element: root,
    onClose: () => { /* nothing */ },
  });
}

export function closeUxSettings(): void {
  if (isSheetOpen(SHEET_ID)) popSheet();
}

function renderSegment(
  label: string,
  options: Array<{ value: string; label: string }>,
  current: string,
  onChange: (v: string) => void,
): HTMLElement {
  const wrap = el('div', { class: 'uxs-group' });
  wrap.appendChild(el('div', { class: 'uxs-label', text: label }));
  const seg = el('div', { class: 'uxs-segment', attrs: { role: 'radiogroup' } });
  for (const opt of options) {
    const btn = el('button', {
      class: `uxs-seg-btn ${opt.value === current ? 'is-active' : ''}`,
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': String(opt.value === current),
      },
      text: opt.label,
      on: {
        click: () => {
          current = opt.value;
          // Re-paint segment
          seg.querySelectorAll('.uxs-seg-btn').forEach((b) => {
            b.classList.toggle('is-active', b.textContent === opt.label);
            b.setAttribute('aria-checked', String(b.textContent === opt.label));
          });
          onChange(opt.value);
        },
      },
    });
    seg.appendChild(btn);
  }
  wrap.appendChild(seg);
  return wrap;
}

function renderToggle(
  label: string,
  hint: string,
  current: boolean,
  onChange: (v: boolean) => void,
): HTMLElement {
  const wrap = el('div', { class: 'uxs-toggle' });
  const labelEl = el('div', { class: 'uxs-toggle-text' }, [
    el('div', { class: 'uxs-toggle-label', text: label }),
    el('div', { class: 'uxs-toggle-hint', text: hint }),
  ]);
  const toggle = el('button', {
    class: `uxs-toggle-btn ${current ? 'is-on' : ''}`,
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(current) },
    on: {
      click: () => {
        current = !current;
        toggle.classList.toggle('is-on', current);
        toggle.setAttribute('aria-checked', String(current));
        onChange(current);
      },
    },
  }, [
    el('span', { class: 'uxs-toggle-knob' }),
  ]);
  wrap.appendChild(labelEl);
  wrap.appendChild(toggle);
  return wrap;
}

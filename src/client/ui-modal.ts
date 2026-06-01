// JSgame · ψ.4 — UI Modal helpers (confirmDialog / inputDialog).
// Substitui native window.prompt() / window.confirm() em 14+ lugares por
// modais custom temáticos (dourado/sangue), mobile-safe, ESC + backdrop
// fecham. Reusa sheet-stack-manager pra empilhar sobre outros modals.

import { el } from './util';
import { push as pushSheet, pop as popSheet, isSheetOpen } from './sheet-stack-manager';

const CONFIRM_ID = 'ui-confirm-modal';
const INPUT_ID = 'ui-input-modal';
const PICKER_ID = 'ui-picker-modal';

export interface ConfirmDialogOpts {
  title: string;
  /** Texto descritivo (opcional). Aceita string com \n pra parágrafos. */
  text?: string;
  /** Texto do botão confirmar. Default "Confirmar". */
  confirmText?: string;
  /** Texto do botão cancelar. Default "Cancelar". */
  cancelText?: string;
  /** Se true, botão confirmar fica vermelho (delete/sair/etc). Default false. */
  danger?: boolean;
}

/**
 * Modal de confirmação assíncrono. Retorna true se user clicou confirmar,
 * false se cancelou ou apertou ESC.
 *
 * @example
 * if (await confirmDialog({ title: 'Sair em combate?', danger: true })) {
 *   exitCombat();
 * }
 */
export function confirmDialog(opts: ConfirmDialogOpts): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (isSheetOpen(CONFIRM_ID)) {
      resolve(false);
      return;
    }

    let resolved = false;
    const finish = (result: boolean): void => {
      if (resolved) return;
      resolved = true;
      popSheet();
      resolve(result);
    };

    const root = el('div', {
      class: 'ui-modal ui-modal-confirm',
      attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-modal-title' },
    });

    // Handlebar
    root.appendChild(el('div', { class: 'ui-modal-handle', attrs: { 'aria-hidden': 'true' } }));

    // Title
    root.appendChild(el('h2', {
      class: 'ui-modal-title',
      attrs: { id: 'ui-modal-title' },
      text: opts.title,
    }));

    // Text body (parágrafos por \n)
    if (opts.text) {
      const body = el('div', { class: 'ui-modal-body' });
      const paragraphs = opts.text.split('\n').filter((s) => s.trim().length > 0);
      for (const p of paragraphs) {
        body.appendChild(el('p', { class: 'ui-modal-p', text: p }));
      }
      root.appendChild(body);
    }

    // Actions
    const actions = el('div', { class: 'ui-modal-actions' });
    actions.appendChild(el('button', {
      class: 'ui-modal-btn ui-modal-cancel',
      attrs: { type: 'button' },
      text: opts.cancelText ?? 'Cancelar',
      on: { click: () => finish(false) },
    }));
    actions.appendChild(el('button', {
      class: `ui-modal-btn ui-modal-confirm-btn ${opts.danger ? 'is-danger' : ''}`,
      attrs: { type: 'button' },
      text: opts.confirmText ?? 'Confirmar',
      on: { click: () => finish(true) },
    }));
    root.appendChild(actions);

    pushSheet({
      id: CONFIRM_ID,
      element: root,
      onClose: () => {
        // Se sheet-stack-manager fechar (ESC/backdrop), resolve false
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      },
    });

    // Focus confirmar button após anim
    setTimeout(() => {
      const btn = root.querySelector('.ui-modal-confirm-btn') as HTMLButtonElement | null;
      btn?.focus();
    }, 240);
  });
}

export interface InputDialogOpts {
  title: string;
  text?: string;
  placeholder?: string;
  initialValue?: string;
  /** Max chars. Default 280. */
  maxLength?: number;
  /** Validator (retorna null = OK, string = erro a mostrar). */
  validator?: (value: string) => string | null;
  /** Se true, usa <textarea> (multi-line). Default false (single-line input). */
  multiline?: boolean;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Modal de input assíncrono. Retorna o texto digitado (trimmed) ou null se
 * cancelou. Validator inline mostra erro abaixo do input.
 */
export function inputDialog(opts: InputDialogOpts): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (isSheetOpen(INPUT_ID)) {
      resolve(null);
      return;
    }
    let resolved = false;
    const finish = (result: string | null): void => {
      if (resolved) return;
      resolved = true;
      popSheet();
      resolve(result);
    };

    const root = el('div', {
      class: 'ui-modal ui-modal-input',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-modal-input-title' },
    });
    root.appendChild(el('div', { class: 'ui-modal-handle', attrs: { 'aria-hidden': 'true' } }));
    root.appendChild(el('h2', {
      class: 'ui-modal-title',
      attrs: { id: 'ui-modal-input-title' },
      text: opts.title,
    }));
    if (opts.text) {
      root.appendChild(el('p', { class: 'ui-modal-p', text: opts.text }));
    }

    const inputTag = opts.multiline ? 'textarea' : 'input';
    const inputEl = el(inputTag as 'input', {
      class: 'ui-modal-input-field',
      attrs: {
        ...(opts.multiline ? { rows: '4' } : { type: 'text' }),
        placeholder: opts.placeholder ?? '',
        maxlength: String(opts.maxLength ?? 280),
        'aria-label': opts.title,
      },
    }) as HTMLInputElement | HTMLTextAreaElement;
    inputEl.value = opts.initialValue ?? '';

    const errorEl = el('div', {
      class: 'ui-modal-error',
      attrs: { hidden: 'true', role: 'alert' },
    });

    root.appendChild(inputEl);
    root.appendChild(errorEl);

    const submit = (): void => {
      const value = inputEl.value.trim();
      if (opts.validator) {
        const error = opts.validator(value);
        if (error) {
          errorEl.removeAttribute('hidden');
          errorEl.textContent = error;
          return;
        }
      }
      finish(value);
    };

    inputEl.addEventListener('keydown', ((e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' && (!opts.multiline || ke.ctrlKey || ke.metaKey)) {
        ke.preventDefault();
        submit();
      }
    }) as EventListener);

    const actions = el('div', { class: 'ui-modal-actions' });
    actions.appendChild(el('button', {
      class: 'ui-modal-btn ui-modal-cancel',
      attrs: { type: 'button' },
      text: opts.cancelText ?? 'Cancelar',
      on: { click: () => finish(null) },
    }));
    actions.appendChild(el('button', {
      class: 'ui-modal-btn ui-modal-confirm-btn',
      attrs: { type: 'button' },
      text: opts.confirmText ?? 'Confirmar',
      on: { click: submit },
    }));
    root.appendChild(actions);

    pushSheet({
      id: INPUT_ID,
      element: root,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      },
    });

    setTimeout(() => { inputEl.focus(); }, 240);
  });
}

export interface PickerDialogOpts<T extends string = string> {
  title: string;
  text?: string;
  options: Array<{
    value: T;
    label: string;
    description?: string;
    icon?: string;
    /** Cabeçalho de seção: o 1º item de cada `section` insere um divisor acima. */
    section?: string;
  }>;
  initialValue?: T;
  cancelText?: string;
}

/**
 * Modal de escolha entre opções. Retorna value selecionada ou null.
 * Útil pra dificuldade, dificuldade combate, escolha de personagem, etc.
 */
export function pickerDialog<T extends string = string>(opts: PickerDialogOpts<T>): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    if (isSheetOpen(PICKER_ID)) {
      resolve(null);
      return;
    }
    let resolved = false;
    const finish = (result: T | null): void => {
      if (resolved) return;
      resolved = true;
      popSheet();
      resolve(result);
    };

    const root = el('div', {
      class: 'ui-modal ui-modal-picker',
      attrs: { role: 'dialog', 'aria-modal': 'true' },
    });
    root.appendChild(el('div', { class: 'ui-modal-handle', attrs: { 'aria-hidden': 'true' } }));
    root.appendChild(el('h2', { class: 'ui-modal-title', text: opts.title }));
    if (opts.text) {
      root.appendChild(el('p', { class: 'ui-modal-p', text: opts.text }));
    }

    const list = el('div', { class: 'ui-modal-picker-list', attrs: { role: 'radiogroup' } });
    let lastSection: string | undefined;
    for (const opt of opts.options) {
      if (opt.section && opt.section !== lastSection) {
        lastSection = opt.section;
        list.appendChild(el('div', { class: 'ui-modal-picker-section', text: opt.section }));
      }
      const isSelected = opt.value === opts.initialValue;
      const btn = el('button', {
        class: `ui-modal-picker-opt ${isSelected ? 'is-selected' : ''}`,
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(isSelected),
        },
        on: { click: () => finish(opt.value) },
      });
      if (opt.icon) btn.appendChild(el('span', { class: 'ui-modal-picker-icon', text: opt.icon }));
      const textWrap = el('div', { class: 'ui-modal-picker-text' });
      textWrap.appendChild(el('div', { class: 'ui-modal-picker-label', text: opt.label }));
      if (opt.description) {
        textWrap.appendChild(el('div', { class: 'ui-modal-picker-desc', text: opt.description }));
      }
      btn.appendChild(textWrap);
      list.appendChild(btn);
    }
    root.appendChild(list);

    const actions = el('div', { class: 'ui-modal-actions ui-modal-actions-single' });
    actions.appendChild(el('button', {
      class: 'ui-modal-btn ui-modal-cancel',
      attrs: { type: 'button' },
      text: opts.cancelText ?? 'Cancelar',
      on: { click: () => finish(null) },
    }));
    root.appendChild(actions);

    pushSheet({
      id: PICKER_ID,
      element: root,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      },
    });
  });
}

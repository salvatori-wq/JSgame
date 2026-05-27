// ψ.4 — Tests pros UI modal helpers (confirmDialog / inputDialog / pickerDialog).
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { confirmDialog, inputDialog, pickerDialog } from '../ui-modal';
import { resetSheetStackForTest } from '../sheet-stack-manager';

describe('confirmDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetSheetStackForTest();
  });

  it('renderiza title + actions corretas', async () => {
    const promise = confirmDialog({
      title: 'Test title',
      text: 'Test body',
      confirmText: 'OK',
      cancelText: 'No',
    });
    // Promessa fica pendente, modal aparece
    await new Promise((r) => setTimeout(r, 0));
    const modal = document.querySelector('.ui-modal-confirm');
    expect(modal).not.toBeNull();
    expect(modal?.querySelector('.ui-modal-title')?.textContent).toBe('Test title');
    expect(modal?.querySelector('.ui-modal-confirm-btn')?.textContent).toBe('OK');
    expect(modal?.querySelector('.ui-modal-cancel')?.textContent).toBe('No');
    // Cancela pra resolve a promise
    (modal?.querySelector('.ui-modal-cancel') as HTMLButtonElement).click();
    const result = await promise;
    expect(result).toBe(false);
  });

  it('confirmDialog resolve true ao clicar confirmar', async () => {
    const promise = confirmDialog({ title: 'X' });
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.querySelector('.ui-modal-confirm-btn') as HTMLButtonElement;
    btn.click();
    expect(await promise).toBe(true);
  });

  it('danger=true adiciona classe is-danger', async () => {
    const promise = confirmDialog({ title: 'X', danger: true });
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.querySelector('.ui-modal-confirm-btn');
    expect(btn?.classList.contains('is-danger')).toBe(true);
    (btn as HTMLButtonElement).click();
    await promise;
  });
});

describe('inputDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetSheetStackForTest();
  });

  it('renderiza input + submit retorna valor', async () => {
    const promise = inputDialog({
      title: 'Diga algo',
      placeholder: 'algo',
    });
    await new Promise((r) => setTimeout(r, 0));
    const input = document.querySelector('.ui-modal-input-field') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'hello';
    (document.querySelector('.ui-modal-confirm-btn') as HTMLButtonElement).click();
    expect(await promise).toBe('hello');
  });

  it('validator inválido mostra erro e bloqueia submit', async () => {
    const promise = inputDialog({
      title: 'X',
      validator: (v) => v.length < 3 ? 'Curto demais' : null,
    });
    await new Promise((r) => setTimeout(r, 0));
    const input = document.querySelector('.ui-modal-input-field') as HTMLInputElement;
    input.value = 'a';
    (document.querySelector('.ui-modal-confirm-btn') as HTMLButtonElement).click();
    // Submit não fechou — error visible
    const err = document.querySelector('.ui-modal-error');
    expect(err?.textContent).toBe('Curto demais');
    expect(err?.hasAttribute('hidden')).toBe(false);
    // Modal ainda aberto
    expect(document.querySelector('.ui-modal-input')).not.toBeNull();
    // Corrige + envia
    input.value = 'abc';
    (document.querySelector('.ui-modal-confirm-btn') as HTMLButtonElement).click();
    expect(await promise).toBe('abc');
  });

  it('cancelar retorna null', async () => {
    const promise = inputDialog({ title: 'X' });
    await new Promise((r) => setTimeout(r, 0));
    (document.querySelector('.ui-modal-cancel') as HTMLButtonElement).click();
    expect(await promise).toBe(null);
  });

  it('multiline=true usa <textarea>', async () => {
    const promise = inputDialog({ title: 'X', multiline: true });
    await new Promise((r) => setTimeout(r, 0));
    const textarea = document.querySelector('.ui-modal-input-field') as HTMLElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    (document.querySelector('.ui-modal-cancel') as HTMLButtonElement).click();
    await promise;
  });
});

describe('pickerDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetSheetStackForTest();
  });

  it('renderiza opções e click retorna value', async () => {
    const promise = pickerDialog<'a' | 'b'>({
      title: 'Choose',
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
      ],
    });
    await new Promise((r) => setTimeout(r, 0));
    const opts = document.querySelectorAll('.ui-modal-picker-opt');
    expect(opts.length).toBe(2);
    (opts[1] as HTMLButtonElement).click();
    expect(await promise).toBe('b');
  });

  it('initialValue marca opção como selected', async () => {
    const promise = pickerDialog({
      title: 'X',
      initialValue: 'b',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    await new Promise((r) => setTimeout(r, 0));
    const opts = Array.from(document.querySelectorAll('.ui-modal-picker-opt'));
    expect(opts[1]?.classList.contains('is-selected')).toBe(true);
    expect(opts[0]?.classList.contains('is-selected')).toBe(false);
    (document.querySelector('.ui-modal-cancel') as HTMLButtonElement).click();
    await promise;
  });

  it('cancelar retorna null', async () => {
    const promise = pickerDialog({
      title: 'X',
      options: [{ value: 'a', label: 'A' }],
    });
    await new Promise((r) => setTimeout(r, 0));
    (document.querySelector('.ui-modal-cancel') as HTMLButtonElement).click();
    expect(await promise).toBe(null);
  });
});

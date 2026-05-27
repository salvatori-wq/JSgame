// @vitest-environment happy-dom
// ο.6 — Tests do Toast System Unificado.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  showToast, toastError, toastInfo, toastAchievement, toastWithActions, peek,
  getActiveToastCount, resetToastsForTest,
} from '../toast';

describe('Toast System ο.6', () => {
  beforeEach(() => {
    resetToastsForTest();
    document.body.innerHTML = '';
  });

  it('legacy showToast renderiza no DOM', () => {
    showToast({ message: 'oi', kind: 'info' });
    expect(getActiveToastCount()).toBe(1);
    const t = document.querySelector('.toast.toast-info');
    expect(t).toBeTruthy();
    expect(t?.textContent).toContain('oi');
  });

  it('toastError aplica classe error', () => {
    toastError('xinga');
    const t = document.querySelector('.toast-error');
    expect(t).toBeTruthy();
  });

  it('toastAchievement aplica kind achievement com shimmer', () => {
    toastAchievement('🏆 Primeira Vitória!');
    const t = document.querySelector('.toast-achievement');
    expect(t).toBeTruthy();
    expect(t?.textContent).toContain('Primeira Vitória');
  });

  it('multi-actions renderiza N botões', () => {
    let cured = 0;
    let saved = 0;
    toastWithActions('Borin caiu', [
      { label: '💉 Curar', onClick: () => { cured++; } },
      { label: '🎲 Death Save', onClick: () => { saved++; } },
    ]);
    const btns = document.querySelectorAll('.toast-actions .toast-action-btn');
    expect(btns.length).toBe(2);
    (btns[0] as HTMLButtonElement).click();
    expect(cured).toBe(1);
  });

  it('action button click fecha o toast', () => {
    toastWithActions('msg', [{ label: 'Ok', onClick: () => {} }]);
    const btn = document.querySelector('.toast-actions .toast-action-btn') as HTMLButtonElement;
    btn.click();
    // is-closing flag aplica imediatamente, remove DOM em 280ms
    const t = document.querySelector('.toast');
    expect(t?.classList.contains('is-closing')).toBe(true);
  });

  it('queue limita a max 3 visíveis', () => {
    toastInfo('msg 1');
    toastInfo('msg 2');
    toastInfo('msg 3');
    toastInfo('msg 4'); // deve remover msg 1
    expect(getActiveToastCount()).toBe(3);
    const toasts = document.querySelectorAll('.toast');
    expect(toasts[0]?.textContent).toContain('msg 2');
    expect(toasts[2]?.textContent).toContain('msg 4');
  });

  it('dedupKey evita dupes', () => {
    showToast({ message: 'a', kind: 'info', dedupKey: 'reconnect' });
    showToast({ message: 'b', kind: 'info', dedupKey: 'reconnect' });
    expect(getActiveToastCount()).toBe(1);
  });

  it('peek usa duration de 3000ms (sem testar timing — só path coverage)', () => {
    peek('+50 XP');
    const t = document.querySelector('.toast');
    expect(t?.textContent).toContain('+50 XP');
  });

  it('onExpand dispara em tap no body (não no botão)', () => {
    let expanded = 0;
    showToast({
      message: 'tap me',
      kind: 'info',
      onExpand: () => { expanded++; },
    });
    const t = document.querySelector('.toast.is-expandable') as HTMLElement;
    expect(t).toBeTruthy();
    // tap no msg (não botão)
    const msg = t.querySelector('.toast-msg') as HTMLElement;
    msg.click();
    expect(expanded).toBe(1);
  });

  it('close button fecha mas não dispara onExpand', () => {
    let expanded = 0;
    showToast({
      message: 'tap',
      kind: 'info',
      onExpand: () => { expanded++; },
    });
    const close = document.querySelector('.toast-close-btn') as HTMLButtonElement;
    close.click();
    expect(expanded).toBe(0);
  });
});

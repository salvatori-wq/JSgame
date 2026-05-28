// @vitest-environment happy-dom
// Ω.2 — Tests do Identity Bar.

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { AuthUser } from '../../api';

beforeAll(() => {
  const memStore: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memStore[k] ?? null,
    setItem: (k: string, v: string) => { memStore[k] = String(v); },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  });
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('renderIdentityBar', () => {
  it('mostra "Entrar" button quando user é null (anônimo)', async () => {
    const { renderIdentityBar } = await import('../sections/identity-bar');
    const bar = renderIdentityBar({
      currentUser: null,
      onLoginClick: () => {},
      onAchievementsClick: () => {},
      onLogout: async () => {},
      onOwnerChange: () => {},
    });
    const btns = bar.querySelectorAll('.home-id-btn');
    const labels = Array.from(btns).map((b) => b.textContent);
    // Round 1 fix (Henrique) — "Entrar" virou "Login" pra não confundir com "entrar no jogo"
    expect(labels).toContain('Login');
    expect(labels).not.toContain('Sair');
  });

  it('mostra "Sair" + "🏆" quando user logado', async () => {
    const { renderIdentityBar } = await import('../sections/identity-bar');
    const user: AuthUser = { id: '1', email: 'test@x.com' } as AuthUser;
    const bar = renderIdentityBar({
      currentUser: user,
      onLoginClick: () => {},
      onAchievementsClick: () => {},
      onLogout: async () => {},
      onOwnerChange: () => {},
    });
    const btns = bar.querySelectorAll('.home-id-btn');
    const labels = Array.from(btns).map((b) => b.textContent);
    expect(labels).toContain('Sair');
    expect(labels).toContain('🏆');
  });

  it('owner-input chama onOwnerChange debounced 200ms', async () => {
    vi.useFakeTimers();
    const { renderIdentityBar } = await import('../sections/identity-bar');
    const onOwnerChange = vi.fn();
    const bar = renderIdentityBar({
      currentUser: null,
      onLoginClick: () => {},
      onAchievementsClick: () => {},
      onLogout: async () => {},
      onOwnerChange,
    });
    document.body.appendChild(bar);
    const input = bar.querySelector('.home-id-owner-input') as HTMLInputElement;
    input.value = 'João';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onOwnerChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(onOwnerChange).toHaveBeenCalledWith('João');
    vi.useRealTimers();
  });

  it('focusOwnerInput aplica class is-needs-name + remove após 1800ms', async () => {
    vi.useFakeTimers();
    const { renderIdentityBar, focusOwnerInput } = await import('../sections/identity-bar');
    const bar = renderIdentityBar({
      currentUser: null,
      onLoginClick: () => {},
      onAchievementsClick: () => {},
      onLogout: async () => {},
      onOwnerChange: () => {},
    });
    document.body.appendChild(bar);
    const input = bar.querySelector('.home-id-owner-input') as HTMLInputElement;
    focusOwnerInput(bar);
    expect(input.classList.contains('is-needs-name')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(input.classList.contains('is-needs-name')).toBe(false);
    vi.useRealTimers();
  });
});

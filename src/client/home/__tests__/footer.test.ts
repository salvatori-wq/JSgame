// @vitest-environment happy-dom
// S1.1 — Tests do HomeFooter. Garante que slot 1 anônimo agora diz "💾 Salvar"
// (alinhado com identity bar — antes era "🔑 Login", causava inconsistência).

import { describe, it, expect } from 'vitest';
import { renderHomeFooter } from '../sections/footer';
import type { AuthUser } from '../../api';

describe('renderHomeFooter', () => {
  it('slot 1 anônimo agora é "💾 Salvar" (S1.1 — era "🔑 Login")', () => {
    const footer = renderHomeFooter({
      currentUser: null,
      onProfileClick: () => {},
      onLoginClick: () => {},
    });
    const first = footer.querySelector('.home-footer-link');
    expect(first?.textContent).toContain('Salvar');
    expect(first?.textContent).toContain('💾');
    // Garante que NÃO usa mais "Login" / chave
    expect(first?.textContent).not.toContain('Login');
    expect(first?.textContent).not.toContain('🔑');
  });

  it('slot 1 logado mantém "👤 Perfil"', () => {
    const user: AuthUser = { id: '1', email: 't@x.com' } as AuthUser;
    const footer = renderHomeFooter({
      currentUser: user,
      onProfileClick: () => {},
      onLoginClick: () => {},
    });
    const first = footer.querySelector('.home-footer-link');
    expect(first?.textContent).toContain('Perfil');
    expect(first?.textContent).toContain('👤');
  });

  it('Salvar tem title consistente com identity bar', () => {
    const footer = renderHomeFooter({
      currentUser: null,
      onProfileClick: () => {},
      onLoginClick: () => {},
    });
    const first = footer.querySelector('.home-footer-link') as HTMLElement;
    const title = first.getAttribute('title') || '';
    expect(title.toLowerCase()).toContain('salvar');
    expect(title.toLowerCase()).toContain('opcional');
  });

  it('3 slots ainda: Salvar/Perfil + Glossário + Ajustes', () => {
    const footer = renderHomeFooter({
      currentUser: null,
      onProfileClick: () => {},
      onLoginClick: () => {},
    });
    const links = footer.querySelectorAll('.home-footer-link');
    expect(links.length).toBe(3);
    const labels = Array.from(links).map(l => l.textContent || '');
    expect(labels[1]).toContain('Glossário');
    expect(labels[2]).toContain('Ajustes');
  });
});

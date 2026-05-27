// JSgame · Ω.2 — Hero compacto da home tavern.
// Logo + tagline + status chips (servidor + IA) numa linha condensada.

import { el } from '../../util';
import type { ApiHealth } from '../../api';

export function renderHero(health: ApiHealth | { ok: false }): HTMLElement {
  const isHealthOk = 'ok' in health && health.ok;
  const fullHealth = isHealthOk ? (health as ApiHealth) : null;
  const hasProvider = !!(fullHealth?.hasGemini || fullHealth?.hasGroq || fullHealth?.hasAnthropic);
  const providerName = fullHealth?.dmProvider;

  return el('header', { class: 'home-hero' }, [
    el('div', { class: 'home-hero-brand' }, [
      el('h1', { class: 'home-hero-title', text: 'JSGAME' }),
      el('p', { class: 'home-hero-tagline', text: 'D&D 5e · Mestre IA · 30min · até 3 amigos' }),
    ]),
    el('div', { class: 'home-hero-status' }, [
      el('span', {
        class: `home-hero-chip ${isHealthOk ? 'is-ok' : 'is-fail'}`,
        attrs: { title: isHealthOk ? 'Servidor online' : 'Servidor offline — tente recarregar' },
        text: isHealthOk ? '● online' : '○ offline',
      }),
      el('span', {
        class: `home-hero-chip ${hasProvider ? 'is-ok' : 'is-warn'}`,
        attrs: { title: hasProvider ? `IA ativa: ${providerName}` : 'Nenhum provider de IA disponível' },
        text: hasProvider ? `🧠 ${providerName}` : '⚠ IA off',
      }),
    ]),
  ]);
}

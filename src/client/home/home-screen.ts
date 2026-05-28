// JSgame · Ω.2 — Home Tavern orquestrador.
// Substitui a função `renderHome` em main.ts (250+ linhas) por composição de seções:
// Hero (compacto) → Identity Bar (sticky) → CONTINUE CARD (CTA #1 quando há lastSession)
// → PLAY NOW (3 prefabs + wizard link) → COOP → Collapsibles (PJs / Crônicas / Cemitério)
// → Footer.
//
// Inspiração visual: Wash Me (bottom action cards) · Spotify (hero + carousels)
// · Duolingo (1 main CTA progresso) · D&D Beyond (hero char card).
//
// Decisões D1-D3:
// D1: forceMotion default ON (Ω.1 — outro escopo)
// D2: Continue Card é #1 quando há lastSession (sem lastSession → Play Now vira #1)
// D3: Wizard como link discreto abaixo dos prefabs (não card grande)

import { el } from '../util';
import { getHealth, trackClientMetric, type AuthUser } from '../api';
import { getOwnerName, getLastSession } from '../util';
import { renderHero } from './sections/hero';
import { renderIdentityBar } from './sections/identity-bar';
import { maybeRenderContinueCard } from './sections/continue-card';
import { renderPlayNow } from './sections/play-now';
import { renderCoop } from './sections/coop';
import { renderMyCharacters, type MyCharactersHandle } from './sections/my-characters';
import { renderMyChronicles, type MyChroniclesHandle } from './sections/my-chronicles';
import { renderGraveyard } from './sections/graveyard';
import { renderHomeFooter } from './sections/footer';

export interface HomeScreenOpts {
  container: HTMLElement;
  currentUser: AuthUser | null;
  /** Navega pra outra view. Tipos válidos espelham o router em main.ts. */
  navigate: (v:
    | { kind: 'home' }
    | { kind: 'login' }
    | { kind: 'wizard'; fromLobby?: boolean }
    | { kind: 'sheet'; id: string }
    | { kind: 'campaign'; characterId: string; campaignId?: string }
    | { kind: 'lobby'; lobbyId?: string }
    | { kind: 'profile' }
  ) => void;
  /** Callback chamado após logout (limpa user state + re-render). */
  onLogout: () => Promise<void>;
}

export async function mountHomeScreen(opts: HomeScreenOpts): Promise<void> {
  const owner = getOwnerName();
  trackClientMetric('home_loaded', {
    has_anon: !owner,
    has_user: !!opts.currentUser,
    returning: !!getLastSession(),
  });

  // Ω.3 — Removido `home-screen` class. Antes: 'home-screen home-tavern' pegava
  // overrides de home-core.css + responsive.css (`body.is-portrait-narrow .home-screen`
  // force `display: block; max-width: 100%` que quebrava layout flex novo).
  const root = el('main', { class: 'home-tavern' });

  // ── Health check (server + IA provider)
  const health = await getHealth().catch(() => ({ ok: false } as const));

  // ── Hero compacto
  root.appendChild(renderHero(health));

  // ── Identity bar (sticky)
  let charsHandle: MyCharactersHandle | null = null;
  const identityBar = renderIdentityBar({
    currentUser: opts.currentUser,
    onLoginClick: () => opts.navigate({ kind: 'login' }),
    onAchievementsClick: () => opts.navigate({ kind: 'profile' }),
    onLogout: opts.onLogout,
    onOwnerChange: () => {
      // Owner mudou → refresh lista PJs
      void charsHandle?.refresh();
    },
  });
  root.appendChild(identityBar);

  // ── Continue Card (CTA #1 quando há sessão ativa)
  const continueCard = await maybeRenderContinueCard({
    onContinue: ({ characterId, campaignId }) => {
      opts.navigate({ kind: 'campaign', characterId, campaignId });
    },
  });
  if (continueCard) root.appendChild(continueCard);

  // ── Play Now (3 prefabs + wizard link)
  root.appendChild(renderPlayNow({
    onChronicleStart: (characterId) => opts.navigate({ kind: 'campaign', characterId }),
    onWizardClick: () => opts.navigate({ kind: 'wizard' }),
  }));

  // ── Coop (lobby create/join + advanced join chronicle)
  let chroniclesHandle: MyChroniclesHandle | null = null;
  root.appendChild(renderCoop({
    identityBar,
    selectedCharGetter: () => charsHandle?.getSelectedId() ?? null,
    onCreateLobby: () => opts.navigate({ kind: 'lobby' }),
    onJoinLobby: (lobbyId) => opts.navigate({ kind: 'lobby', lobbyId }),
    onJoinExisting: (campaignId) => {
      const charId = charsHandle?.getSelectedId();
      if (!charId) return;
      opts.navigate({ kind: 'campaign', characterId: charId, campaignId });
    },
  }));

  // ── Collapsibles: Meus PJs (open default), Crônicas, Cemitério
  charsHandle = await renderMyCharacters({
    onPlayChronicle: (id) => opts.navigate({ kind: 'campaign', characterId: id }),
    onOpenSheet: (id) => opts.navigate({ kind: 'sheet', id }),
    onSelectionChange: () => { /* getter já usado por coop/chronicles */ },
    onAfterRefresh: () => { void chroniclesHandle?.refresh(); },
  });
  root.appendChild(charsHandle.element);

  chroniclesHandle = await renderMyChronicles({
    selectedCharGetter: () => charsHandle?.getSelectedId() ?? null,
    onJoin: (campaignId, characterId) => opts.navigate({ kind: 'campaign', characterId, campaignId }),
  });
  root.appendChild(chroniclesHandle.element);

  if (opts.currentUser) {
    root.appendChild(renderGraveyard());
  }

  // ── Footer minimal
  root.appendChild(renderHomeFooter({
    currentUser: opts.currentUser,
    onLoginClick: () => opts.navigate({ kind: 'login' }),
    onProfileClick: () => opts.navigate({ kind: 'profile' }),
  }));

  opts.container.appendChild(root);
}

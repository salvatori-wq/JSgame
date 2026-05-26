// JSgame · F17 — Tela de perfil do user. Lista achievements unlocked + locked.
// Hidden achievements ainda não unlocked mostram "?? ???" pra preservar surpresa.

import { el } from '../util';
import {
  getAchievementProgress, listHighlights, getStreak,
  listFriends, acceptFriendship, removeFriendship, inviteFriendByEmail,
  type AchievementStatusDTO, type HighlightDTO, type StreakDTO, type FriendDTO,
} from '../api';

interface ProfileScreenOpts {
  container: HTMLElement;
  onExit: () => void;
}

export class ProfileScreen {
  private container: HTMLElement;
  private opts: ProfileScreenOpts;

  constructor(opts: ProfileScreenOpts) {
    this.container = opts.container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.container.innerHTML = '';
    const root = el('main', { class: 'profile-screen' });

    root.appendChild(el('header', { class: 'wiz-header' }, [
      el('button', {
        class: 'wiz-back-btn',
        text: '← Voltar',
        on: { click: () => this.opts.onExit() },
      }),
      el('h2', { class: 'wiz-h2', text: '🏆 Conquistas' }),
    ]));

    const body = el('div', { class: 'profile-body' });
    root.appendChild(body);
    this.container.appendChild(root);

    try {
      // F20 — streak header (se houver)
      const streak = await getStreak().catch(() => null);
      if (streak && streak.currentStreak > 0) {
        body.appendChild(this.renderStreak(streak));
      }
      // F20 — highlights antes dos achievements (lugar de prestígio)
      const highlights = await listHighlights().catch(() => [] as HighlightDTO[]);
      if (highlights.length > 0) {
        body.appendChild(this.renderHighlights(highlights));
      }
      // A4 — Amigos (coop)
      const friends = await listFriends().catch(() => [] as FriendDTO[]);
      body.appendChild(this.renderFriends(friends));
      const data = await getAchievementProgress();
      this.renderProgress(body, data.progress, data.counters);
    } catch (err) {
      const msg = String(err);
      if (/401/.test(msg)) {
        body.appendChild(el('div', { class: 'profile-empty' }, [
          el('p', { text: '🔒 Conquistas precisam de conta.' }),
          el('p', { class: 'profile-empty-sub', text: 'Entre via magic link pra começar a desbloquear marcos persistentes entre PJs.' }),
        ]));
      } else {
        body.appendChild(el('div', { class: 'profile-empty', text: `Erro: ${msg}` }));
      }
    }
  }

  private renderStreak(streak: StreakDTO): HTMLElement {
    return el('div', { class: 'profile-streak' }, [
      el('div', { class: 'profile-streak-icon', text: '🔥' }),
      el('div', { class: 'profile-streak-body' }, [
        el('div', { class: 'profile-streak-current', text: `${streak.currentStreak} dias seguidos` }),
        el('div', { class: 'profile-streak-meta', text: `Recorde: ${streak.longestStreak} dias · Total ativo: ${streak.totalDays} dias` }),
      ]),
    ]);
  }

  // A4 — Lista amigos + form de convite por email.
  private renderFriends(friends: FriendDTO[]): HTMLElement {
    const sec = el('section', { class: 'profile-friends-section' });
    sec.appendChild(el('h3', { class: 'profile-section-h', text: `👥 Amigos (${friends.filter((f) => f.status === 'accepted').length})` }));

    // Form de convite por email
    const inviteForm = el('form', { class: 'profile-invite-form' });
    const input = document.createElement('input');
    input.type = 'email';
    input.placeholder = 'amigo@email.com';
    input.required = true;
    input.className = 'profile-invite-input';
    const btn = el('button', {
      class: 'profile-invite-btn',
      text: '📧 Convidar pra jogar',
      attrs: { type: 'submit' },
    });
    inviteForm.appendChild(input);
    inviteForm.appendChild(btn);
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!email) return;
      try {
        const r = await inviteFriendByEmail(email);
        if (r.mode === 'dev-log' && r.devLink) {
          alert(`Modo dev — link gerado:\n${r.devLink}`);
        } else {
          alert(`Convite enviado pra ${email}!`);
        }
        input.value = '';
        // Re-render lista
        this.start();
      } catch (err) {
        alert(`Erro: ${String(err)}`);
      }
    });
    sec.appendChild(inviteForm);

    // Lista
    if (friends.length === 0) {
      sec.appendChild(el('div', { class: 'profile-friends-empty', text: 'Nenhum amigo ainda. Convide alguém pra jogar coop.' }));
    } else {
      const list = el('div', { class: 'profile-friends-list' });
      // Pendentes recebidos primeiro (precisam ação)
      const pendingIn = friends.filter((f) => f.status === 'pending' && !f.iRequested);
      const pendingOut = friends.filter((f) => f.status === 'pending' && f.iRequested);
      const accepted = friends.filter((f) => f.status === 'accepted');
      for (const f of [...pendingIn, ...accepted, ...pendingOut]) {
        list.appendChild(this.renderFriendRow(f));
      }
      sec.appendChild(list);
    }
    return sec;
  }

  private renderFriendRow(f: FriendDTO): HTMLElement {
    const name = f.displayName || f.email.split('@')[0]!;
    const row = el('div', { class: `profile-friend-row is-${f.status}` });
    row.appendChild(el('div', { class: 'pf-name', text: name }));
    row.appendChild(el('div', { class: 'pf-email', text: f.email }));
    if (f.status === 'pending' && !f.iRequested) {
      row.appendChild(el('button', {
        class: 'pf-accept-btn',
        text: '✓ Aceitar',
        on: { click: async () => {
          await acceptFriendship(f.userId).catch((err) => alert(`Erro: ${String(err)}`));
          this.start();
        } },
      }));
    } else if (f.status === 'pending' && f.iRequested) {
      row.appendChild(el('div', { class: 'pf-pending-tag', text: 'aguardando' }));
    } else {
      row.appendChild(el('button', {
        class: 'pf-remove-btn',
        text: '×',
        attrs: { title: 'Remover amigo' },
        on: { click: async () => {
          if (!confirm(`Remover ${name}?`)) return;
          await removeFriendship(f.userId).catch((err) => alert(`Erro: ${String(err)}`));
          this.start();
        } },
      }));
    }
    return row;
  }

  private renderHighlights(highlights: HighlightDTO[]): HTMLElement {
    const sec = el('section');
    sec.appendChild(el('h3', { class: 'profile-section-h', text: `✨ Highlight Reel (${highlights.length})` }));
    const list = el('div', { class: 'profile-highlights' });
    const KIND_ICON: Record<string, string> = {
      moment: '✨', kill: '⚔', speech: '🗣', choice: '⚖', twist: '🌀',
    };
    for (const h of highlights.slice(0, 20)) {
      const when = new Date(h.createdAt).toLocaleDateString();
      list.appendChild(el('div', { class: `profile-highlight is-${h.kind}` }, [
        el('div', { class: 'ph-icon', text: KIND_ICON[h.kind] ?? '✨' }),
        el('div', { class: 'ph-body' }, [
          el('div', { class: 'ph-summary', text: h.summary }),
          el('div', { class: 'ph-meta', text: `${h.characterName ?? '—'} · ${when}` }),
          // 3A — Botão exportar HTML standalone da campanha
          el('a', {
            class: 'ph-export-btn',
            attrs: {
              href: `/api/highlights/${h.campaignId}/export`,
              target: '_blank',
              rel: 'noopener',
              title: 'Abrir reel HTML compartilhável (salvar/imprimir)',
            },
            text: '📜 Exportar',
          }),
        ]),
      ]));
    }
    sec.appendChild(list);
    return sec;
  }

  private renderProgress(parent: HTMLElement, progress: AchievementStatusDTO[], counters: Record<string, number>): void {
    const unlocked = progress.filter((p) => p.unlocked);
    const total = progress.length;
    const totalUnlocked = unlocked.length;
    const pct = total > 0 ? Math.round((totalUnlocked / total) * 100) : 0;

    parent.appendChild(el('div', { class: 'profile-summary' }, [
      el('div', { class: 'profile-summary-pct', text: `${totalUnlocked}/${total}` }),
      el('div', { class: 'profile-summary-bar' }, [
        el('div', { class: 'profile-summary-fill', style: { width: `${pct}%` } }),
      ]),
      el('div', { class: 'profile-summary-pct-txt', text: `${pct}% das conquistas desbloqueadas` }),
    ]));

    // Counters resumidos
    const counterEntries = [
      { key: 'kills', icon: '🗡', label: 'Inimigos derrotados' },
      { key: 'crits', icon: '⚡', label: 'Acertos críticos' },
      { key: 'spells_cast', icon: '🔮', label: 'Magias conjuradas' },
      { key: 'long_rests', icon: '🏕', label: 'Descansos longos' },
      { key: 'stabilizations', icon: '❤', label: 'Estabilizações em 0 HP' },
      { key: 'unique_locations', icon: '🗺', label: 'Locais visitados' },
      { key: 'unique_npcs', icon: '🗣', label: 'NPCs distintos' },
      { key: 'character_deaths', icon: '🪦', label: 'PJs mortos' },
    ];
    const countersBlock = el('div', { class: 'profile-counters' });
    let hasAnyCounter = false;
    for (const c of counterEntries) {
      const val = counters[c.key] ?? 0;
      if (val > 0) hasAnyCounter = true;
      countersBlock.appendChild(el('div', { class: 'profile-counter' }, [
        el('span', { class: 'pc-icon', text: c.icon }),
        el('span', { class: 'pc-label', text: c.label }),
        el('span', { class: 'pc-val', text: String(val) }),
      ]));
    }
    if (hasAnyCounter) {
      parent.appendChild(el('h3', { class: 'profile-section-h', text: '📊 Estatísticas' }));
      parent.appendChild(countersBlock);
    }

    // Tier sections
    const tiers: Array<{ key: 'bronze' | 'silver' | 'gold' | 'platinum'; label: string; color: string }> = [
      { key: 'bronze',   label: '🥉 Bronze',   color: '#b87333' },
      { key: 'silver',   label: '🥈 Silver',   color: '#c0c0c0' },
      { key: 'gold',     label: '🥇 Gold',     color: '#f0c050' },
      { key: 'platinum', label: '💎 Platinum', color: '#a8d8e8' },
    ];
    for (const tier of tiers) {
      const inTier = progress.filter((p) => p.achievement.tier === tier.key);
      if (inTier.length === 0) continue;
      const unlockedInTier = inTier.filter((p) => p.unlocked).length;
      parent.appendChild(el('h3', {
        class: 'profile-section-h profile-tier-h',
        text: `${tier.label}  ${unlockedInTier}/${inTier.length}`,
        style: { color: tier.color, borderBottomColor: tier.color },
      }));
      const grid = el('div', { class: 'profile-grid' });
      for (const p of inTier) {
        grid.appendChild(this.renderCard(p));
      }
      parent.appendChild(grid);
    }
  }

  private renderCard(p: AchievementStatusDTO): HTMLElement {
    const isHidden = !!p.achievement.hidden && !p.unlocked;
    const cardClass = `ach-card ach-tier-${p.achievement.tier} ${p.unlocked ? 'is-unlocked' : 'is-locked'}${isHidden ? ' is-hidden' : ''}`;
    return el('div', { class: cardClass }, [
      el('div', { class: 'ach-card-icon', text: isHidden ? '❓' : p.achievement.icon }),
      el('div', { class: 'ach-card-body' }, [
        el('div', { class: 'ach-card-name', text: isHidden ? '???' : p.achievement.name }),
        el('div', { class: 'ach-card-desc', text: isHidden ? 'Conquista oculta — desbloqueie pra ver.' : p.achievement.description }),
        p.unlocked && p.unlockedAt
          ? el('div', { class: 'ach-card-when', text: new Date(p.unlockedAt).toLocaleDateString() })
          : null,
      ].filter(Boolean) as HTMLElement[]),
    ]);
  }
}

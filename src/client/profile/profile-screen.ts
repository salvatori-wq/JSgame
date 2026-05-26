// JSgame · F17 — Tela de perfil do user. Lista achievements unlocked + locked.
// Hidden achievements ainda não unlocked mostram "?? ???" pra preservar surpresa.

import { el } from '../util';
import { getAchievementProgress, listHighlights, getStreak, type AchievementStatusDTO, type HighlightDTO, type StreakDTO } from '../api';

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

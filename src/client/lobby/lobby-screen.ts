// JSgame · Lobby screen — pre-game room.
// Lista players com status, permite escolher PJ existente ou criar novo no wizard.
// Quando todos ready, host clica "Começar Crônica" → vai pra campaign.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  LobbyState, LobbyPlayer, LobbyPlayerStatus,
} from '../../shared/types';
import { listCharacters } from '../api';
import type { CharacterSummary } from '../../server/persistence';
import { el, escapeHtml, getOwnerName } from '../util';
import { getRace } from '../../dnd/races';
import { getClass } from '../../dnd/classes';
import { ALL_PERSONALITIES, DEFAULT_PERSONALITY, getPersonality, type DmPersonality } from '../../dnd/dm-personality';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface LobbyScreenOpts {
  socket: SocketT;
  ownerName: string;
  // Quando o servidor manda redirect, vai pra campaign
  onCampaignStart: (campaignId: string, characterId: string) => void;
  // Quando entra modo "criar PJ", abre wizard
  onCreateCharacter: () => void;
  // Saída
  onExit: () => void;
}

const STATUS_LABEL: Record<LobbyPlayerStatus, string> = {
  joined: '👤 Entrou',
  selecting: '🔍 Escolhendo PJ',
  wizard: '⚙ No wizard',
  ready: '✓ Pronto',
};

export class LobbyScreen {
  private container: HTMLElement;
  private opts: LobbyScreenOpts;
  private state: LobbyState | null = null;
  private chars: CharacterSummary[] = [];
  private mode: 'main' | 'selecting' = 'main';
  private socketBound = false;
  private cleanups: Array<() => void> = [];

  constructor(container: HTMLElement, opts: LobbyScreenOpts) {
    this.container = container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    await this.refreshChars();
    this.bindSocket();
    this.render();
  }

  destroy(): void {
    for (const off of this.cleanups) off();
    this.cleanups = [];
  }

  setState(state: LobbyState | null): void {
    this.state = state;
    this.render();
  }

  // Refresh after wizard completes — chamado de fora
  async refreshChars(): Promise<void> {
    const owner = this.opts.ownerName || getOwnerName();
    if (!owner) { this.chars = []; return; }
    try {
      this.chars = await listCharacters(owner);
    } catch {
      this.chars = [];
    }
  }

  private bindSocket(): void {
    if (this.socketBound) return;
    this.socketBound = true;
    const s = this.opts.socket;

    const onState = (state: LobbyState | null): void => {
      this.state = state;
      // Se servidor mandou redirect, sair
      if (state?.campaignId) {
        // será tratado por onRedirect — não duplica
      }
      this.render();
    };
    s.on('lobbyState', onState);
    this.cleanups.push(() => s.off('lobbyState', onState));

    const onRedirect = (payload: { campaignId: string }): void => {
      // Pega meu PJ atual do lobby state e navega pra campanha
      const me = this.findMe();
      if (me?.characterId) {
        this.opts.onCampaignStart(payload.campaignId, me.characterId);
      } else {
        // fallback: vai sem PJ específico
        this.opts.onCampaignStart(payload.campaignId, '');
      }
    };
    s.on('lobbyRedirect', onRedirect);
    this.cleanups.push(() => s.off('lobbyRedirect', onRedirect));
  }

  private findMe(): LobbyPlayer | undefined {
    return this.state?.players.find((p) => p.socketId === this.opts.socket.id);
  }

  private render(): void {
    this.container.innerHTML = '';
    const root = el('main', { class: 'lobby-screen' });

    if (!this.state) {
      root.appendChild(el('div', { class: 'lobby-loading', text: 'Conectando ao lobby…' }));
      this.container.appendChild(root);
      return;
    }

    const me = this.findMe();
    const allReady = this.state.players.length > 0 && this.state.players.every((p) => p.status === 'ready');

    // ── Header
    root.appendChild(el('header', { class: 'lobby-header' }, [
      el('button', { class: 'wiz-back-btn', text: '← Sair', on: { click: () => this.handleExit() } }),
      el('div', { class: 'lobby-title' }, [
        el('h2', { text: '🏛 Lobby' }),
        el('div', { class: 'lobby-id' }, [
          el('span', { text: 'Código: ' }),
          el('strong', { text: this.state.id }),
          el('button', {
            class: 'lobby-share-btn',
            text: '🔗 Copiar',
            on: { click: () => this.copyId() },
          }),
        ]),
      ]),
    ]));

    // ── Players list
    const playersSection = el('section', { class: 'lobby-players' });
    playersSection.appendChild(el('h3', { class: 'lobby-section-title', text: `Aventureiros (${this.state.players.length})` }));
    const list = el('div', { class: 'lobby-players-list' });
    for (const p of this.state.players) {
      list.appendChild(this.renderPlayerRow(p, p.socketId === this.opts.socket.id));
    }
    playersSection.appendChild(list);
    root.appendChild(playersSection);

    // ── Minha área (escolher PJ, criar novo, pronto)
    if (me) {
      root.appendChild(this.renderMyControls(me));
    }

    // 1C — Host escolhe personality do DM antes de começar.
    if (me?.isHost) {
      root.appendChild(this.renderPersonalityPicker());
    } else if (this.state.dmPersonality) {
      root.appendChild(el('div', { class: 'lobby-personality-info' }, [
        el('span', { class: 'lp-pers-label', text: 'Estilo do Mestre:' }),
        el('span', { class: 'lp-pers-value', text: this.personalityLabel(this.state.dmPersonality) }),
      ]));
    }

    // ── Host start button (A1.2: lista quem ainda falta)
    if (me?.isHost) {
      const notReady = this.state?.players.filter((p) => p.status !== 'ready') ?? [];
      const readyCount = (this.state?.players.length ?? 0) - notReady.length;
      const totalCount = this.state?.players.length ?? 0;
      const waitingNames = notReady.map((p) => p.ownerName).join(', ');
      const btnText = allReady
        ? `▶ Começar Crônica (${totalCount}/${totalCount} prontos)`
        : `⏳ Aguardando ${notReady.length}: ${waitingNames} (${readyCount}/${totalCount})`;
      const startBtn = el('button', {
        class: 'lobby-start-btn',
        text: btnText,
        attrs: { disabled: !allReady, title: allReady ? 'Inicia a campanha pra todos' : 'Esperando todos clicarem em "Pronto"' },
        on: { click: () => this.opts.socket.emit('lobbyStartCampaign') },
      });
      root.appendChild(startBtn);
    } else {
      root.appendChild(el('div', { class: 'lobby-host-info', text: '⏳ Só o host pode iniciar a crônica' }));
    }

    this.container.appendChild(root);
  }

  private renderPlayerRow(p: LobbyPlayer, isMe: boolean): HTMLElement {
    const statusClass = `is-status-${p.status}`;
    const extraInfo: string[] = [];
    if (p.characterName) extraInfo.push(`PJ: ${p.characterName}`);
    if (p.status === 'wizard' && p.wizardStep) extraInfo.push(`step: ${p.wizardStep}`);
    return el('div', { class: `lobby-player-row ${statusClass} ${isMe ? 'is-me' : ''}` }, [
      el('span', { class: 'lp-host', text: p.isHost ? '👑' : '👤' }),
      el('span', { class: 'lp-name', text: p.ownerName + (isMe ? ' (você)' : '') }),
      el('span', { class: 'lp-status', text: STATUS_LABEL[p.status] }),
      extraInfo.length > 0
        ? el('span', { class: 'lp-info', text: extraInfo.join(' · ') })
        : null,
    ].filter(Boolean) as HTMLElement[]);
  }

  private personalityLabel(id: DmPersonality): string {
    const p = getPersonality(id);
    return `${p.icon} ${p.label}`;
  }

  // 1C — Host-only: dropdown estilos do DM. Disabled quando campanha já começou.
  private renderPersonalityPicker(): HTMLElement {
    const current: DmPersonality = (this.state?.dmPersonality ?? DEFAULT_PERSONALITY);
    const active = getPersonality(current);
    const wrap = el('section', { class: 'lobby-personality-picker' });
    wrap.appendChild(el('h3', { class: 'lobby-section-title', text: '🎭 Estilo do Mestre' }));
    const row = el('div', { class: 'lpp-row' });
    for (const p of ALL_PERSONALITIES) {
      const btn = el('button', {
        class: `lpp-opt ${p.id === current ? 'is-active' : ''}`,
        attrs: { type: 'button', title: p.description },
        on: { click: () => this.opts.socket.emit('lobbySetPersonality', { dmPersonality: p.id }) },
      }, [
        el('span', { class: 'lpp-icon', text: p.icon }),
        el('span', { class: 'lpp-label', text: p.label }),
      ]);
      row.appendChild(btn);
    }
    wrap.appendChild(row);
    wrap.appendChild(el('div', { class: 'lpp-desc', text: active.description }));
    return wrap;
  }

  private renderMyControls(me: LobbyPlayer): HTMLElement {
    const section = el('section', { class: 'lobby-controls' });

    if (me.status === 'ready') {
      section.appendChild(el('div', { class: 'lobby-ready-card' }, [
        el('div', { class: 'lobby-ready-title', text: `✓ Você está pronto com ${me.characterName ?? 'seu PJ'}` }),
        el('button', {
          class: 'lobby-unready-btn',
          text: 'Trocar PJ',
          on: { click: () => this.opts.socket.emit('lobbyUpdateStatus', { status: 'joined' }) },
        }),
      ]));
      return section;
    }

    // Não ready: escolha entre PJ existente ou criar novo
    section.appendChild(el('h3', { class: 'lobby-section-title', text: '🎭 Escolhe seu personagem' }));

    if (this.mode === 'selecting') {
      // Lista PJs existentes
      if (this.chars.length === 0) {
        section.appendChild(el('div', { class: 'lobby-empty', text: 'Você não tem PJs ainda. Crie um novo.' }));
      } else {
        const grid = el('div', { class: 'lobby-chars-grid' });
        for (const c of this.chars) {
          const race = getRace(c.raceId as Parameters<typeof getRace>[0]);
          const klass = getClass(c.classId as Parameters<typeof getClass>[0]);
          grid.appendChild(el('div', {
            class: 'lobby-char-card',
            on: { click: () => this.selectChar(c) },
          }, [
            el('div', { class: 'lcc-name', text: c.characterName }),
            el('div', { class: 'lcc-meta', text: `${race?.name ?? c.raceId} ${klass?.name ?? c.classId} · Nv ${c.level}` }),
          ]));
        }
        section.appendChild(grid);
      }
      section.appendChild(el('button', {
        class: 'lobby-back-mode-btn',
        text: '← Voltar',
        on: { click: () => { this.mode = 'main'; this.render(); } },
      }));
    } else {
      const grid = el('div', { class: 'lobby-mode-grid' });
      grid.appendChild(el('button', {
        class: 'lobby-mode-btn',
        on: { click: () => {
          this.mode = 'selecting';
          this.opts.socket.emit('lobbyUpdateStatus', { status: 'selecting' });
          this.render();
        } },
      }, [
        el('span', { class: 'lmb-icon', text: '🎭' }),
        el('span', { class: 'lmb-label', text: 'Usar PJ existente' }),
        el('span', { class: 'lmb-sub', text: `Você tem ${this.chars.length} PJ${this.chars.length !== 1 ? 's' : ''}` }),
      ]));
      grid.appendChild(el('button', {
        class: 'lobby-mode-btn',
        on: { click: () => this.opts.onCreateCharacter() },
      }, [
        el('span', { class: 'lmb-icon', text: '⚔' }),
        el('span', { class: 'lmb-label', text: 'Criar PJ novo' }),
        el('span', { class: 'lmb-sub', text: 'Wizard 5 steps (party te vê construir)' }),
      ]));
      section.appendChild(grid);
    }

    return section;
  }

  private selectChar(c: CharacterSummary): void {
    this.opts.socket.emit('lobbyUpdateStatus', {
      status: 'ready',
      characterId: c.id,
    });
    this.mode = 'main';
  }

  private async copyId(): Promise<void> {
    if (!this.state) return;
    try {
      await navigator.clipboard.writeText(this.state.id);
      this.flash('Código copiado!');
    } catch {
      prompt('Copie o código:', this.state.id);
    }
  }

  private flash(text: string): void {
    const t = el('div', { class: 'lobby-toast', text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  private handleExit(): void {
    this.opts.socket.emit('leaveLobby');
    this.opts.onExit();
  }
}

// JSgame · Tela de campanha (exploration mode).
// Caixa de narração + log + botões de ação + integração com socket.
// Gerencia também o skill-check overlay quando server pede.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CampaignState, CharacterSheet, DiceRoll, SkillId, ExplorationAction,
} from '@shared/types';
import { SKILLS } from '@dnd/skills';
import { abilityModifier, proficiencyBonus } from '@dnd/attributes';
import { el, escapeHtml } from '../util';
import { getCharacter } from '../api';
import { showPendingSkillCheck, showSkillCheckResult, closeSkillCheck, type PendingCheck } from './skill-check-overlay';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

interface CampaignScreenOpts {
  characterId: string;
  campaignId?: string;
  socket: SocketT;
  ownerName: string;
  onExit: () => void;
}

const ACTIONS: Array<{ id: ExplorationAction; label: string; icon: string }> = [
  { id: 'explore',       label: 'Explorar',         icon: '🔍' },
  { id: 'investigate',   label: 'Investigar',       icon: '🔎' },
  { id: 'talk',          label: 'Falar',            icon: '🗣' },
  { id: 'sneak',         label: 'Furtar-se',        icon: '🥷' },
  { id: 'attack',        label: 'Atacar',           icon: '⚔' },
  { id: 'rest-short',    label: 'Descanso Curto',   icon: '🛌' },
];

export class CampaignScreen {
  private container: HTMLElement;
  private opts: CampaignScreenOpts;
  private narrations: Array<{ speaker: string; text: string }> = [];
  private character: CharacterSheet | null = null;
  private currentState: CampaignState | null = null;
  private pendingCheck: PendingCheck | null = null;
  private isWaitingDM = false;
  private socketBound = false;
  private socketCleanups: Array<() => void> = [];

  constructor(container: HTMLElement, opts: CampaignScreenOpts) {
    this.container = container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.character = await getCharacter(this.opts.characterId);
    this.render();
    this.bindSocket();
    // Inicia/retoma campanha
    this.opts.socket.emit('joinCampaign', {
      ownerName: this.opts.ownerName,
      characterId: this.opts.characterId,
      campaignId: this.opts.campaignId,
    });
  }

  destroy(): void {
    for (const off of this.socketCleanups) off();
    this.socketCleanups = [];
    closeSkillCheck();
  }

  private bindSocket(): void {
    if (this.socketBound) return;
    this.socketBound = true;
    const s = this.opts.socket;

    const onNarration = (payload: { text: string; speaker?: string; mood?: string }): void => {
      this.narrations.push({ speaker: payload.speaker ?? 'Mestre', text: payload.text });
      this.isWaitingDM = false;
      this.render();
    };
    s.on('dmNarration', onNarration);
    this.socketCleanups.push(() => s.off('dmNarration', onNarration));

    const onState = (state: CampaignState): void => {
      this.currentState = state;
      this.render();
    };
    s.on('campaignState', onState);
    this.socketCleanups.push(() => s.off('campaignState', onState));

    const onParty = (party: CharacterSheet[]): void => {
      const me = party.find((p) => p.id === this.opts.characterId);
      if (me) this.character = me;
      this.render();
    };
    s.on('partyUpdate', onParty);
    this.socketCleanups.push(() => s.off('partyUpdate', onParty));

    const onDice = (payload: { source: string; roll: DiceRoll; purpose: string }): void => {
      if (payload.purpose === 'skill-check' && this.pendingCheck) {
        showSkillCheckResult(payload.roll, this.pendingCheck, () => {
          this.pendingCheck = null;
          this.render();
        });
      }
    };
    s.on('diceRollResult', onDice);
    this.socketCleanups.push(() => s.off('diceRollResult', onDice));

    const onError = (msg: string): void => {
      console.warn('[campaign] server error:', msg);
      this.narrations.push({ speaker: '⚠ Erro', text: msg });
      this.isWaitingDM = false;
      this.render();
    };
    s.on('error', onError);
    this.socketCleanups.push(() => s.off('error', onError));
  }

  // ── Pre-check de skill check: server pode embarcar no campaignState futuro,
  // por enquanto vamos pelo currentState.mode/condition. Sem campo dedicated,
  // mostramos o botão "Rolar d20" no header da scene quando o backend confirmar.
  // Simplificação: usaremos um botão "✨ Resolver perícia" quando narração mencionar.
  // Pra MVP, o DM call dispara requestSkillCheck quando há pending. Vamos manter
  // simples: o cliente sempre tem botão "Rolar d20 (se houver pendente)" visível.

  private render(): void {
    this.container.innerHTML = '';

    const root = el('main', { class: 'camp-screen' });

    // Header com volta e info
    root.appendChild(el('header', { class: 'camp-header' }, [
      el('button', { class: 'wiz-back-btn', text: '← Sair', on: { click: () => this.opts.onExit() } }),
      el('div', { class: 'camp-title' }, [
        el('h2', { text: this.currentState?.name ?? 'Carregando…' }),
        el('div', { class: 'camp-loc', text: this.currentState?.currentLocation ?? '...' }),
      ]),
      this.character ? el('div', { class: 'camp-hp' }, [
        el('span', { class: 'chp-name', text: this.character.characterName }),
        el('span', { class: 'chp-stats', text: `HP ${this.character.currentHp}/${this.character.maxHp} · CA ${this.character.armorClass}` }),
      ]) : null,
    ].filter(Boolean) as HTMLElement[]));

    // Narração log
    const narrEl = el('section', { class: 'camp-narration' });
    if (this.narrations.length === 0 && !this.isWaitingDM) {
      narrEl.appendChild(el('div', { class: 'camp-narr-empty', text: 'Aguardando o Mestre acordar…' }));
    }
    for (const n of this.narrations.slice(-10)) {
      const entry = el('div', { class: 'camp-narr-entry' });
      entry.innerHTML = `
        <div class="cnn-speaker">${escapeHtml(n.speaker)}</div>
        <div class="cnn-text">${escapeHtml(n.text)}</div>
      `;
      narrEl.appendChild(entry);
    }
    if (this.isWaitingDM) {
      narrEl.appendChild(el('div', { class: 'camp-narr-thinking', text: '💭 O Mestre pensa…' }));
    }
    root.appendChild(narrEl);

    // Pending skill check banner — server signaliza via state futuro; por agora
    // detectamos pelo último narration ter um pattern. Versão simples: botão
    // sempre disponível "Rolar perícia (se pendente)" — server rejeita se não houver.
    // Pra UX cleaner: detector básico pelas últimas narrations.
    if (this.shouldOfferSkillCheck()) {
      const banner = el('div', { class: 'camp-check-banner' }, [
        el('span', { text: '🎲 O Mestre pediu um teste de perícia' }),
        el('button', {
          class: 'wiz-cta',
          text: 'Rolar d20',
          attrs: { type: 'button' },
          on: { click: () => this.rollSkillCheck() },
        }),
      ]);
      root.appendChild(banner);
    }

    // Ações (botões)
    const actionsEl = el('section', { class: 'camp-actions' });
    actionsEl.appendChild(el('h3', { class: 'camp-h3', text: 'O que você faz?' }));
    const grid = el('div', { class: 'camp-actions-grid' });
    for (const a of ACTIONS) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn',
        attrs: { type: 'button', disabled: this.isWaitingDM },
        on: { click: () => this.takeAction(a.id) },
      }, [
        el('span', { class: 'caa-icon', text: a.icon }),
        el('span', { class: 'caa-label', text: a.label }),
      ]));
    }
    actionsEl.appendChild(grid);

    // Input livre
    const customInput = el('input', {
      class: 'camp-custom-input',
      attrs: {
        type: 'text',
        placeholder: 'Ou digite uma ação livre (ex: "abro o baú devagar")',
        maxlength: '200',
      },
    }) as HTMLInputElement;
    const customBtn = el('button', {
      class: 'wiz-cta',
      text: 'Enviar →',
      attrs: { type: 'button', disabled: this.isWaitingDM },
      on: {
        click: () => {
          const v = customInput.value.trim();
          if (v) {
            this.takeAction('explore', v);
            customInput.value = '';
          }
        },
      },
    });
    customInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const v = customInput.value.trim();
        if (v) {
          this.takeAction('explore', v);
          customInput.value = '';
        }
      }
    });
    actionsEl.appendChild(el('div', { class: 'camp-custom-row' }, [customInput, customBtn]));

    root.appendChild(actionsEl);

    this.container.appendChild(root);
  }

  private shouldOfferSkillCheck(): boolean {
    // Heurística simples: última narração menciona "rola", "teste de", "d20", "perícia"
    const last = this.narrations[this.narrations.length - 1]?.text.toLowerCase() ?? '';
    return /rola|teste de|d20|per[íi]cia|tenta/.test(last);
  }

  private async rollSkillCheck(): Promise<void> {
    // Server tem pending — pede pra rolar
    // Pre-calcula bonus pra mostrar no overlay (cliente assume Percepção SAB +prof default;
    // server vai rolar com bonus real. UI é só visual.)
    if (!this.character) return;
    // Fallback bonus: usa Percepção/Sabedoria (proxy comum)
    const sab = abilityModifier(this.character.abilityScores.sab);
    const pb = proficiencyBonus(this.character.level);
    const guessBonus = sab + (this.character.proficientSkills.includes('percepcao') ? pb : 0);
    this.pendingCheck = {
      skill: 'percepcao' as SkillId,
      dc: 15,
      reason: 'Teste pedido pelo Mestre',
      bonus: guessBonus,
    };
    showPendingSkillCheck(this.pendingCheck, () => {
      this.opts.socket.emit('requestSkillCheck', { skill: 'percepcao' as SkillId });
    });
  }

  private takeAction(action: ExplorationAction, details?: string): void {
    this.isWaitingDM = true;
    this.render();
    this.opts.socket.emit('takeAction', { action, details });
  }
}

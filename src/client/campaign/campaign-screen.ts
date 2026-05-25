// JSgame · Tela de campanha. Renderiza exploration OU combat baseado em state.mode.
// Coop-aware:
// - Party panel (todos PJs HP/CA/conditions)
// - Skill-check banner SÓ pro player do pendingCheck.playerId
// - "X está pensando…" sincronizado via dmThinking/dmDone
// - Campaign ID no header pra share

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CampaignState, CharacterSheet, DiceRoll, ExplorationAction, CombatEvent,
} from '../../shared/types';
import { SKILLS } from '../../dnd/skills';
import { abilityModifier, proficiencyBonus } from '../../dnd/attributes';
import { el, escapeHtml, setLastSession, clearLastSession } from '../util';
import { getCharacter } from '../api';
import { showPendingSkillCheck, showSkillCheckResult, closeSkillCheck, type PendingCheck } from './skill-check-overlay';
import { renderCombatScreen } from '../combat/combat-screen';
import { openCastSpellModal, closeCastSpellModal, shouldShowCastButton } from '../spells/cast-spell-modal';
import { openInventoryModal, closeInventoryModal } from '../inventory/inventory-modal';

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
];

export class CampaignScreen {
  private container: HTMLElement;
  private opts: CampaignScreenOpts;
  private narrations: Array<{ speaker: string; text: string }> = [];
  private character: CharacterSheet | null = null;
  private party: CharacterSheet[] = [];
  private currentState: CampaignState | null = null;
  private skillCheckOverlay: PendingCheck | null = null;
  private dmThinkingBy: { playerName: string; action: string } | null = null;
  private combatLog: string[] = [];
  private socketBound = false;
  private socketCleanups: Array<() => void> = [];

  constructor(container: HTMLElement, opts: CampaignScreenOpts) {
    this.container = container;
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.character = await getCharacter(this.opts.characterId);
    this.party = [this.character];
    this.render();
    this.bindSocket();
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
    closeCastSpellModal();
    closeInventoryModal();
  }

  private bindSocket(): void {
    if (this.socketBound) return;
    this.socketBound = true;
    const s = this.opts.socket;

    const onNarration = (payload: { text: string; speaker?: string; mood?: string }): void => {
      this.narrations.push({ speaker: payload.speaker ?? 'Mestre', text: payload.text });
      if (this.narrations.length > 50) this.narrations = this.narrations.slice(-50);
      this.render();
    };
    s.on('dmNarration', onNarration);
    this.socketCleanups.push(() => s.off('dmNarration', onNarration));

    const onState = (state: CampaignState): void => {
      this.currentState = state;
      // Persiste sessão ativa pra auto-rejoin no reload
      setLastSession({ characterId: this.opts.characterId, campaignId: state.id });
      // Se pendingCheck mudou e eu sou owner, abre overlay
      this.maybeShowPendingCheck();
      this.render();
    };
    s.on('campaignState', onState);
    this.socketCleanups.push(() => s.off('campaignState', onState));

    const onParty = (party: CharacterSheet[]): void => {
      this.party = party;
      const me = party.find((p) => p.id === this.opts.characterId);
      if (me) this.character = me;
      this.render();
    };
    s.on('partyUpdate', onParty);
    this.socketCleanups.push(() => s.off('partyUpdate', onParty));

    const onCombat = (_combat: unknown): void => {
      // combat embarcado em currentState.combat — só re-renderiza
      this.render();
    };
    s.on('combatState', onCombat);
    this.socketCleanups.push(() => s.off('combatState', onCombat));

    const onCombatEvent = (ev: CombatEvent): void => {
      if (ev.text) {
        this.combatLog.push(ev.text);
        if (this.combatLog.length > 20) this.combatLog = this.combatLog.slice(-20);
      }
      this.render();
    };
    s.on('combatEvent', onCombatEvent);
    this.socketCleanups.push(() => s.off('combatEvent', onCombatEvent));

    const onDice = (payload: { source: string; roll: DiceRoll; purpose: string }): void => {
      if (payload.purpose === 'skill-check' && this.skillCheckOverlay) {
        showSkillCheckResult(payload.roll, this.skillCheckOverlay, () => {
          this.skillCheckOverlay = null;
          this.render();
        });
      }
    };
    s.on('diceRollResult', onDice);
    this.socketCleanups.push(() => s.off('diceRollResult', onDice));

    const onThinking = (payload: { playerId: string; playerName: string; action: string }): void => {
      this.dmThinkingBy = { playerName: payload.playerName, action: payload.action };
      this.render();
    };
    s.on('dmThinking', onThinking);
    this.socketCleanups.push(() => s.off('dmThinking', onThinking));

    const onDone = (): void => {
      this.dmThinkingBy = null;
      this.render();
    };
    s.on('dmDone', onDone);
    this.socketCleanups.push(() => s.off('dmDone', onDone));

    const onError = (msg: string): void => {
      console.warn('[campaign] server error:', msg);
      this.narrations.push({ speaker: '⚠ Erro', text: msg });
      this.dmThinkingBy = null;
      this.render();
    };
    s.on('error', onError);
    this.socketCleanups.push(() => s.off('error', onError));
  }

  private maybeShowPendingCheck(): void {
    const pending = this.currentState?.pendingCheck;
    if (!pending || !this.character) {
      // Não há check ativo OU já passou — fecha overlay se aberto
      if (!pending && this.skillCheckOverlay) {
        closeSkillCheck();
        this.skillCheckOverlay = null;
      }
      return;
    }
    if (pending.playerId !== this.opts.characterId) return; // não é meu check
    if (this.skillCheckOverlay) return; // já mostrando

    const skill = SKILLS[pending.skill];
    if (!skill) return;
    const abilityScore = this.character.abilityScores[skill.ability];
    const mod = abilityModifier(abilityScore);
    const pb = proficiencyBonus(this.character.level);
    const proficient = this.character.proficientSkills.includes(pending.skill);
    const bonus = mod + (proficient ? pb : 0);
    this.skillCheckOverlay = {
      skill: pending.skill,
      dc: pending.dc,
      reason: pending.reason,
      bonus,
    };
    showPendingSkillCheck(this.skillCheckOverlay, () => {
      this.opts.socket.emit('requestSkillCheck', { skill: pending.skill });
    });
  }

  private render(): void {
    this.container.innerHTML = '';
    const isCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;

    const root = el('main', { class: 'camp-screen' });

    // ── Header
    root.appendChild(this.renderHeader());

    // ── Party panel (todos PJs)
    if (this.party.length > 0) {
      root.appendChild(this.renderPartyPanel());
    }

    // ── Death save banner (se meu PJ caiu)
    const deathBanner = this.renderDeathSaveBanner();
    if (deathBanner) root.appendChild(deathBanner);

    // ── Narração log
    root.appendChild(this.renderNarrationLog());

    // ── Pending check banner — só pra OUTROS players (o owner vê overlay)
    const pending = this.currentState?.pendingCheck;
    if (pending && pending.playerId !== this.opts.characterId) {
      const ownerName = this.party.find((p) => p.id === pending.playerId)?.characterName ?? 'Aliado';
      const sk = SKILLS[pending.skill];
      root.appendChild(el('div', { class: 'camp-check-banner is-spectating' }, [
        el('span', { text: `🎲 ${ownerName} está rolando ${sk?.name ?? pending.skill} (DC ${pending.dc}) — ${pending.reason}` }),
      ]));
    }

    // ── DM thinking indicator (qualquer jogador)
    if (this.dmThinkingBy) {
      root.appendChild(el('div', { class: 'camp-thinking' }, [
        el('span', { class: 'ct-spinner', text: '💭' }),
        el('span', { class: 'ct-txt', text: `${this.dmThinkingBy.playerName} → ${this.dmThinkingBy.action}…` }),
      ]));
    }

    // ── Combat OR exploration UI
    if (isCombat && this.currentState?.combat && this.character) {
      renderCombatScreen(root, {
        combat: this.currentState.combat,
        party: this.party,
        myCharacterId: this.opts.characterId,
        socket: this.opts.socket,
        combatLog: this.combatLog,
      });
    } else {
      root.appendChild(this.renderActionsBar());
    }

    this.container.appendChild(root);
  }

  private renderHeader(): HTMLElement {
    const campId = this.currentState?.id;
    return el('header', { class: 'camp-header' }, [
      el('button', {
        class: 'wiz-back-btn',
        text: '← Sair',
        on: {
          click: () => {
            const inCombat = this.currentState?.mode === 'combat' && this.currentState.combat?.active;
            if (inCombat) {
              const ok = confirm('Sair em combate? Teu PJ vira NPC vulnerável e o party continua sem você.');
              if (!ok) return;
            }
            clearLastSession();
            this.opts.onExit();
          },
        },
      }),
      el('div', { class: 'camp-title' }, [
        el('h2', { text: this.currentState?.name ?? 'Carregando…' }),
        el('div', { class: 'camp-loc', text: this.currentState?.currentLocation ?? '...' }),
      ]),
      campId ? el('button', {
        class: 'camp-share-btn',
        text: '🔗 Compartilhar',
        attrs: { title: 'Copiar ID da crônica pra share com aliado' },
        on: {
          click: async () => {
            try {
              await navigator.clipboard.writeText(campId);
              this.flashToast('ID copiado! Cole no Home → Joinar.');
            } catch {
              prompt('Copie o ID:', campId);
            }
          },
        },
      }) : null,
    ].filter(Boolean) as HTMLElement[]);
  }

  private renderPartyPanel(): HTMLElement {
    const panel = el('section', { class: 'camp-party' });
    panel.appendChild(el('div', { class: 'cp-title', text: '🛡 Party' }));
    const list = el('div', { class: 'cp-list' });
    for (const p of this.party) {
      const isMe = p.id === this.opts.characterId;
      const isDown = p.currentHp <= 0;
      const hpPct = p.maxHp > 0 ? Math.round((p.currentHp / p.maxHp) * 100) : 0;
      // Slots resumidos
      const slotsInfo: string[] = [];
      for (let lvl = 1; lvl <= 5; lvl++) {
        const s = p.spellSlots[lvl as 1 | 2 | 3 | 4 | 5];
        if (s && s.max > 0) slotsInfo.push(`L${lvl}: ${s.max - s.used}/${s.max}`);
      }
      list.appendChild(el('div', { class: `cp-pj ${isMe ? 'is-me' : ''} ${isDown ? 'is-down' : ''}` }, [
        el('div', { class: 'cp-pj-name', text: `${p.characterName}${isMe ? ' (você)' : ''}` }),
        el('div', { class: 'cp-pj-meta', text: `Nv ${p.level} · CA ${p.armorClass} · HD ${p.hitDiceRemaining}/${p.level}` }),
        el('div', { class: 'cp-pj-hp-bar' }, [
          el('div', {
            class: `cp-pj-hp-fill ${hpPct < 33 ? 'is-low' : hpPct < 66 ? 'is-mid' : ''}`,
            style: { width: `${hpPct}%` },
          }),
        ]),
        el('div', { class: 'cp-pj-hp-txt', text: `HP ${p.currentHp}/${p.maxHp}` }),
        slotsInfo.length > 0
          ? el('div', { class: 'cp-pj-slots', text: `🔮 ${slotsInfo.join(' · ')}` })
          : null,
        isDown
          ? el('div', { class: 'cp-pj-death' }, [
              el('span', { class: 'cp-pj-death-label', text: '💀 Death saves' }),
              el('span', { class: 'cp-pj-death-marks' }, [
                el('span', { class: 'cp-pj-death-s', text: `✓${p.deathSaveSuccesses}/3` }),
                el('span', { class: 'cp-pj-death-f', text: `✗${p.deathSaveFailures}/3` }),
              ]),
            ])
          : null,
        p.conditions.length > 0
          ? el('div', { class: 'cp-pj-cond', text: p.conditions.join(' · ') })
          : null,
        p.exhaustion > 0
          ? el('div', { class: 'cp-pj-exhaustion', text: `💀 Exaustão ${p.exhaustion}/6` })
          : null,
      ].filter(Boolean) as HTMLElement[]));
    }
    panel.appendChild(list);
    return panel;
  }

  private renderDeathSaveBanner(): HTMLElement | null {
    if (!this.character) return null;
    if (this.character.currentHp > 0) return null;
    if (this.character.deathSaveSuccesses >= 3 || this.character.deathSaveFailures >= 3) return null;
    return el('div', { class: 'camp-death-banner' }, [
      el('div', { class: 'cdb-title', text: '💀 Você está caído. Sua vida pende.' }),
      el('div', { class: 'cdb-marks' }, [
        el('span', { class: 'cdb-mark cdb-s', text: `Sucessos: ${this.character.deathSaveSuccesses}/3` }),
        el('span', { class: 'cdb-mark cdb-f', text: `Falhas: ${this.character.deathSaveFailures}/3` }),
      ]),
      el('button', {
        class: 'cdb-roll-btn',
        text: '🎲 Rolar Death Save',
        attrs: { type: 'button' },
        on: { click: () => this.opts.socket.emit('rollDeathSave') },
      }),
    ]);
  }

  private renderNarrationLog(): HTMLElement {
    const narrEl = el('section', { class: 'camp-narration' });
    if (this.narrations.length === 0 && !this.dmThinkingBy) {
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
    return narrEl;
  }

  private renderActionsBar(): HTMLElement {
    const actionsEl = el('section', { class: 'camp-actions' });
    actionsEl.appendChild(el('h3', { class: 'camp-h3', text: 'O que você faz?' }));
    const disabled = !!this.dmThinkingBy;
    const grid = el('div', { class: 'camp-actions-grid' });
    for (const a of ACTIONS) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn',
        attrs: { type: 'button', disabled },
        on: { click: () => this.takeAction(a.id) },
      }, [
        el('span', { class: 'caa-icon', text: a.icon }),
        el('span', { class: 'caa-label', text: a.label }),
      ]));
    }
    // Botão Lançar Magia — só pra casters
    if (shouldShowCastButton(this.character)) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-spell',
        attrs: { type: 'button', disabled },
        on: { click: () => this.openSpellModal() },
      }, [
        el('span', { class: 'caa-icon', text: '🔮' }),
        el('span', { class: 'caa-label', text: 'Magia' }),
      ]));
    }
    // Botão Inventário (sempre disponível)
    if (this.character) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-inv',
        attrs: { type: 'button', disabled, title: 'Inventário, equipamentos, usar itens' },
        on: { click: () => this.openInventory() },
      }, [
        el('span', { class: 'caa-icon', text: '🎒' }),
        el('span', { class: 'caa-label', text: 'Inventário' }),
      ]));
    }
    // Rest buttons (só fora de combate)
    const canRest = this.currentState?.mode !== 'combat';
    if (canRest && this.character) {
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-rest',
        attrs: { type: 'button', disabled, title: 'Descanso Curto — gasta 1+ hit dice pra curar HP' },
        on: { click: () => this.openShortRestModal() },
      }, [
        el('span', { class: 'caa-icon', text: '🛌' }),
        el('span', { class: 'caa-label', text: 'Curto' }),
      ]));
      grid.appendChild(el('button', {
        class: 'camp-action-btn is-rest',
        attrs: { type: 'button', disabled, title: 'Descanso Longo — HP cheio, slots resetam' },
        on: { click: () => this.confirmLongRest() },
      }, [
        el('span', { class: 'caa-icon', text: '🏕' }),
        el('span', { class: 'caa-label', text: 'Longo' }),
      ]));
    }
    actionsEl.appendChild(grid);

    const customInput = el('input', {
      class: 'camp-custom-input',
      attrs: { type: 'text', placeholder: 'Ou digite uma ação livre (ex: "abro o baú devagar")', maxlength: '200' },
    }) as HTMLInputElement;
    const customBtn = el('button', {
      class: 'wiz-cta',
      text: 'Enviar →',
      attrs: { type: 'button', disabled },
      on: {
        click: () => {
          const v = customInput.value.trim();
          if (v) { this.takeAction('explore', v); customInput.value = ''; }
        },
      },
    });
    customInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const v = customInput.value.trim();
        if (v) { this.takeAction('explore', v); customInput.value = ''; }
      }
    });
    actionsEl.appendChild(el('div', { class: 'camp-custom-row' }, [customInput, customBtn]));
    return actionsEl;
  }

  private takeAction(action: ExplorationAction, details?: string): void {
    this.opts.socket.emit('takeAction', { action, details });
  }

  private openSpellModal(): void {
    if (!this.character) return;
    openCastSpellModal({
      caster: this.character,
      party: this.party,
      combat: this.currentState?.combat ?? null,
      socket: this.opts.socket,
      onClose: () => { /* re-render acontece via campaignState event */ },
    });
  }

  private openInventory(): void {
    if (!this.character) return;
    openInventoryModal({
      character: this.character,
      socket: this.opts.socket,
      onClose: () => { /* re-render via partyUpdate */ },
    });
  }

  private openShortRestModal(): void {
    if (!this.character) return;
    const maxDice = this.character.hitDiceRemaining;
    if (maxDice === 0) {
      this.flashToast('Sem hit dice. Precisa de descanso longo.');
      return;
    }
    const input = prompt(`Quantos hit dice gastar? (1-${maxDice})`, '1');
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n < 1) return;
    this.opts.socket.emit('shortRest', { hitDiceToSpend: Math.min(n, maxDice) });
  }

  private confirmLongRest(): void {
    if (confirm('Descanso longo (8h): HP cheio + spell slots resetam. Avança o tempo. Confirmar?')) {
      this.opts.socket.emit('longRest');
    }
  }

  private flashToast(text: string): void {
    const t = el('div', { class: 'camp-toast', text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
}

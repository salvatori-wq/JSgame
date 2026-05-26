// JSgame · Combat screen — UI de combate D&D 5e.
// Initiative tracker + enemy portraits + player action buttons + combat log.
// Acionado quando state.mode === 'combat' && state.combat.active.

import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  CombatState, EnemySnapshot, CharacterSheet, CombatActionKind, CombatEvent,
} from '../../shared/types';
import { el, escapeHtml } from '../util';
import { openCastSpellModal, shouldShowCastButton } from '../spells/cast-spell-modal';
import { portraitFor } from '../../dnd/portrait';
import { renderClassFeaturesBar } from './class-features-bar';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface CombatScreenOpts {
  combat: CombatState;
  party: CharacterSheet[];
  myCharacterId: string;
  socket: SocketT;
  combatLog: string[];          // mensagens combat events recentes
}

export function renderCombatScreen(container: HTMLElement, opts: CombatScreenOpts): void {
  const { combat, party, myCharacterId, socket, combatLog } = opts;
  const myChar = party.find((p) => p.id === myCharacterId) ?? null;

  const root = el('section', { class: 'combat-screen' });

  // ── Header: round + current turn
  const current = combat.initiativeOrder[combat.currentTurnIndex];
  root.appendChild(el('div', { class: 'cb-header' }, [
    el('span', { class: 'cb-round', text: `Round ${combat.round}` }),
    el('span', { class: 'cb-turn', text: current ? `Vez de ${current.name}` : '—' }),
  ]));

  // ── Initiative tracker (F31: horizontal scroll, portrait do PJ se conhecido)
  const initTracker = el('div', { class: 'cb-initiative' });
  combat.initiativeOrder.forEach((p, idx) => {
    const isCurrent = idx === combat.currentTurnIndex;
    const isMe = p.kind === 'player' && p.id === myCharacterId;
    const downed = isDowned(p, combat, party);
    const cls = `cb-init-row ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${downed ? 'is-down' : ''} cb-${p.kind}`;
    // Portrait pra players, glyph pra inimigos
    let avatar: HTMLElement;
    if (p.kind === 'player') {
      const pj = party.find((x) => x.id === p.id);
      if (pj) {
        const portrait = portraitFor({ raceId: pj.raceId, classId: pj.classId });
        avatar = el('span', { class: 'cb-init-avatar', style: { background: portrait.aura } }, [
          el('span', { class: 'cb-init-avatar-race', text: portrait.race }),
        ]);
      } else {
        avatar = el('span', { class: 'cb-init-kind', text: '🧙' });
      }
    } else {
      avatar = el('span', { class: 'cb-init-kind', text: '👹' });
    }
    initTracker.appendChild(el('div', { class: cls }, [
      el('span', { class: 'cb-init-num', text: String(p.initiative) }),
      avatar,
      el('span', { class: 'cb-init-name', text: p.name }),
    ]));
  });
  root.appendChild(initTracker);

  // ── Enemies portraits
  if (combat.enemies.length > 0) {
    const enemiesGrid = el('div', { class: 'cb-enemies' });
    for (const en of combat.enemies) {
      enemiesGrid.appendChild(renderEnemyCard(en, () => {
        // Se for meu turno e o enemy estiver vivo, ataca (ou pending action)
        if (!isMyTurn(combat, myCharacterId)) return;
        if (en.currentHp <= 0) return;
        const w = window as unknown as { __pendingCombatAction?: CombatActionKind };
        const pending = w.__pendingCombatAction;
        const action: CombatActionKind = pending ?? 'attack';
        delete w.__pendingCombatAction;
        socket.emit('combatAction', { action, targetId: en.id });
      }, isMyTurn(combat, myCharacterId)));
    }
    root.appendChild(enemiesGrid);
  }

  // ── Player turn action bar (só aparece se for meu turno)
  if (isMyTurn(combat, myCharacterId) && myChar) {
    const actions: Array<{ id: CombatActionKind; label: string; icon: string; hint: string }> = [
      { id: 'attack', label: 'Atacar', icon: '⚔', hint: 'Clique num inimigo acima' },
      { id: 'dodge', label: 'Esquivar', icon: '🛡', hint: 'Ataques contra você têm desvantagem' },
      { id: 'dash', label: 'Disparada', icon: '💨', hint: 'Movimento dobrado' },
      { id: 'disengage', label: 'Desengajar', icon: '↩', hint: 'Sai sem provocar ataque de oportunidade' },
      { id: 'hide', label: 'Esconder', icon: '🥷', hint: 'Tenta ficar invisível' },
      { id: 'help', label: 'Ajudar', icon: '🤝', hint: 'Aliado ganha vantagem no próximo ataque' },
      // F24
      { id: 'grapple', label: 'Agarrar', icon: '🤼', hint: 'Atletismo contestado — alvo restrito' },
      { id: 'shove', label: 'Empurrar', icon: '👐', hint: 'Atletismo contestado — alvo derrubado (caído)' },
      { id: 'two-weapon', label: '2ª Arma', icon: '🗡', hint: 'Ataque bônus com weapon off-hand (1 por turno)' },
    ];
    const bar = el('div', { class: 'cb-actions' });
    bar.appendChild(el('div', { class: 'cb-actions-title', text: `🎯 Seu turno, ${escapeHtml(myChar.characterName)}` }));
    const grid = el('div', { class: 'cb-actions-grid' });
    for (const a of actions) {
      grid.appendChild(el('button', {
        class: 'cb-action-btn',
        attrs: { type: 'button', title: a.hint },
        on: {
          click: () => {
            if (a.id === 'attack' || a.id === 'grapple' || a.id === 'shove' || a.id === 'two-weapon') {
              alert(`Clique no inimigo alvo (cards acima). Ação: ${a.label}.`);
              // Marca ação pendente
              (window as unknown as { __pendingCombatAction?: CombatActionKind }).__pendingCombatAction = a.id;
              return;
            }
            if (a.id === 'help') {
              const allies = party.filter((p) => p.id !== myCharacterId && p.currentHp > 0);
              if (allies.length === 0) { alert('Nenhum aliado vivo pra ajudar.'); return; }
              const choice = prompt(`Ajudar quem? Digite o nome:\n${allies.map((al) => `- ${al.characterName}`).join('\n')}`);
              if (!choice) return;
              const target = allies.find((al) => al.characterName.toLowerCase() === choice.toLowerCase());
              if (!target) { alert(`Aliado "${choice}" não encontrado.`); return; }
              socket.emit('combatAction', { action: 'help', targetId: target.id });
              return;
            }
            socket.emit('combatAction', { action: a.id });
          },
        },
      }, [
        el('span', { class: 'cba-icon', text: a.icon }),
        el('span', { class: 'cba-label', text: a.label }),
      ]));
    }
    // Botão Lançar Magia (caster only)
    if (shouldShowCastButton(myChar)) {
      grid.appendChild(el('button', {
        class: 'cb-action-btn is-spell',
        attrs: { type: 'button', title: 'Abrir grimório e lançar magia' },
        on: {
          click: () => {
            openCastSpellModal({
              caster: myChar,
              party,
              combat,
              socket,
              onClose: () => { /* re-render via state event */ },
            });
          },
        },
      }, [
        el('span', { class: 'cba-icon', text: '🔮' }),
        el('span', { class: 'cba-label', text: 'Magia' }),
      ]));
    }
    bar.appendChild(grid);
    root.appendChild(bar);

    // F23 — Class Features Big 7 bar (rage/surge/etc) — só se classe tem
    const featuresBar = renderClassFeaturesBar(myChar, socket, party);
    if (featuresBar) root.appendChild(featuresBar);
  } else {
    const waiting = el('div', { class: 'cb-waiting' });
    waiting.appendChild(el('div', { class: 'cb-waiting-txt', text: current ? `⏳ Aguardando ${current.name}…` : '⏳ Aguardando próximo turno' }));
    root.appendChild(waiting);
  }

  // ── Combat log
  if (combatLog.length > 0 || combat.log.length > 0) {
    const logEl = el('div', { class: 'cb-log' });
    logEl.appendChild(el('div', { class: 'cb-log-title', text: '📜 Log de combate' }));
    const items = [...combat.log.slice(-6), ...combatLog.slice(-4)];
    for (const ln of items.slice(-10)) {
      logEl.appendChild(el('div', { class: 'cb-log-line', text: ln }));
    }
    root.appendChild(logEl);
  }

  container.appendChild(root);
}

function renderEnemyCard(en: EnemySnapshot, onClick: () => void, clickable: boolean): HTMLElement {
  const pct = en.maxHp > 0 ? Math.round((en.currentHp / en.maxHp) * 100) : 0;
  const dead = en.currentHp <= 0;
  const card = el('div', {
    class: `cb-enemy-card ${dead ? 'is-dead' : ''} ${clickable && !dead ? 'is-clickable' : ''}`,
    attrs: { 'data-combat-target': en.id },
    on: clickable && !dead ? { click: onClick } : undefined,
  }, [
    el('div', { class: 'cb-enemy-name', text: en.name }),
    el('div', { class: 'cb-enemy-meta', text: `CA ${en.armorClass} · +${en.attackBonus} · ${en.damageDice}${en.damageBonus ? `+${en.damageBonus}` : ''}` }),
    el('div', { class: 'cb-enemy-hp-bar' }, [
      el('div', {
        class: `cb-enemy-hp-fill ${pct < 33 ? 'is-low' : pct < 66 ? 'is-mid' : ''}`,
        style: { width: `${pct}%` },
      }),
    ]),
    el('div', { class: 'cb-enemy-hp-txt', text: `HP ${en.currentHp}/${en.maxHp}` }),
  ]);
  if (en.conditions.length > 0) {
    card.appendChild(el('div', { class: 'cb-enemy-cond', text: en.conditions.join(' · ') }));
  }
  if (en.description) {
    card.appendChild(el('div', { class: 'cb-enemy-desc', text: en.description }));
  }
  return card;
}

function isMyTurn(combat: CombatState, myCharacterId: string): boolean {
  if (!combat.active) return false;
  const cur = combat.initiativeOrder[combat.currentTurnIndex];
  return !!cur && cur.kind === 'player' && cur.id === myCharacterId;
}

function isDowned(
  p: CombatState['initiativeOrder'][number],
  combat: CombatState,
  party: CharacterSheet[],
): boolean {
  if (p.kind === 'enemy') {
    const en = combat.enemies.find((e) => e.id === p.id);
    return !en || en.currentHp <= 0;
  }
  const pj = party.find((x) => x.id === p.id);
  return !pj || pj.currentHp <= 0;
}

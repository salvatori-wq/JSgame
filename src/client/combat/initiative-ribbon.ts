// JSgame · ο.4 — Initiative Ribbon Uber-Style.
// Timeline visual com avatares 40-48px, current pulsando dourado,
// connector animado entre participantes. Tap em participante expande
// mini-card HP/AC/conditions inline.

import type { CombatState, CharacterSheet } from '../../shared/types';
import { el } from '../util';
import { portraitFor } from '../../dnd/portrait';
import { getCondition } from '../../dnd/conditions';
import { iconEl, enemyIconName } from '../icons/game-icons';

export interface InitiativeRibbonContext {
  combat: CombatState;
  party: CharacterSheet[];
  myCharacterId: string;
}

// Sprint X.B2 — Tracker module-level pra detectar transição currentTurnIndex
// → meu turno. Combinado com lastMyTurnState do combat-screen, sincroniza a
// animação "passou pra você" no node atual com o toast "▶ Seu turno".
// Reset quando combat ativo termina.
let lastRibbonTurnIndex = -1;
let lastRibbonCombatRound = -1;

/**
 * Renderiza ribbon de initiative em formato timeline.
 * Estados especiais:
 *  - current: scale + glow pulsante dourado
 *  - me: border dourado fixo
 *  - downed: grayscale + skull 💀 overlay
 *  - just-arrived (X.B2): pulse cinematográfico 600ms ao virar meu turno
 */
export function renderInitiativeRibbon(ctx: InitiativeRibbonContext): HTMLElement {
  const { combat, party, myCharacterId } = ctx;
  const root = el('div', { class: 'init-ribbon', attrs: { role: 'list', 'aria-label': 'Ordem de iniciativa' } });

  // X.B2 — Detecta TRANSIÇÃO de turno PRA mim. Quando true, aplica
  // .irb-just-arrived no node atual = keyframe cinematográfico.
  const newCurrent = combat.initiativeOrder[combat.currentTurnIndex];
  const isMyTurnArrival =
    !!newCurrent && newCurrent.kind === 'player' && newCurrent.id === myCharacterId &&
    (lastRibbonTurnIndex !== combat.currentTurnIndex || lastRibbonCombatRound !== combat.round);
  lastRibbonTurnIndex = combat.currentTurnIndex;
  lastRibbonCombatRound = combat.round;

  // Estado: qual avatar está expandido (id ou null)
  let expandedId: string | null = null;

  const ribbonRow = el('div', { class: 'irb-row' });
  const expandArea = el('div', { class: 'irb-expand-area' });

  const rerender = (): void => {
    ribbonRow.innerHTML = '';
    expandArea.innerHTML = '';

    combat.initiativeOrder.forEach((p, idx) => {
      const isCurrent = idx === combat.currentTurnIndex;
      const isMe = p.kind === 'player' && p.id === myCharacterId;
      const downed = isDowned(p, combat, party);
      // X.B2 — Marca o NODE ATUAL como just-arrived quando a transição é PRA mim
      const justArrived = isCurrent && isMyTurnArrival;
      const cls = `irb-node ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${downed ? 'is-down' : ''} ${justArrived ? 'is-just-arrived' : ''} irb-${p.kind}`;

      let avatar: HTMLElement;
      if (p.kind === 'player') {
        const pj = party.find((x) => x.id === p.id);
        if (pj) {
          const portrait = portraitFor({ raceId: pj.raceId, classId: pj.classId });
          avatar = el('span', {
            class: 'irb-avatar',
            attrs: { style: `background:${portrait.aura}` },
          }, [
            el('span', { class: 'irb-avatar-glyph', text: portrait.race }),
          ]);
        } else {
          avatar = el('span', { class: 'irb-avatar irb-avatar-default', text: '🧙' });
        }
      } else {
        avatar = iconEl(enemyIconName(p.name), '👹', { className: 'irb-avatar irb-avatar-enemy' });
      }

      const node = el('button', {
        class: cls,
        attrs: { type: 'button', role: 'listitem', 'aria-pressed': String(expandedId === p.id) },
        on: {
          click: () => {
            expandedId = expandedId === p.id ? null : p.id;
            rerender();
          },
        },
      }, [
        avatar,
        el('span', { class: 'irb-name', text: shorten(p.name, 9) }),
        el('span', { class: 'irb-init-num', text: String(p.initiative) }),
        downed ? el('span', { class: 'irb-downed-overlay', text: '💀', attrs: { 'aria-hidden': 'true' } }) : null,
      ].filter(Boolean) as HTMLElement[]);

      ribbonRow.appendChild(node);

      // Connector entre nodes (não no último)
      if (idx < combat.initiativeOrder.length - 1) {
        const isActiveConn = isCurrent;
        ribbonRow.appendChild(el('span', {
          class: `irb-connector ${isActiveConn ? 'is-active' : ''}`,
          attrs: { 'aria-hidden': 'true' },
        }));
      }
    });

    if (expandedId) {
      const expanded = renderExpandedCard(expandedId, combat, party);
      if (expanded) expandArea.appendChild(expanded);
    }

    // W3-DnD — Iniciativa next-up preview SEMPRE (não só coop). Pula
    // participantes downed pra mostrar quem REALMENTE joga em seguida.
    // Tipografia Cardo italic — "ordem dramática" do consultor D&D ("DM diz
    // 'depois do orc é a anã, depois o goblin foge'"). Em vez de timeline
    // asséptica, vira narração de turno.
    const nextAlive = findNextAliveAfter(combat, party, combat.currentTurnIndex);
    if (nextAlive) {
      const isMyNext = nextAlive.kind === 'player' && nextAlive.id === myCharacterId;
      const glyph = isMyNext ? '▶' : (nextAlive.kind === 'enemy' ? '🩸' : '🤝');
      const label = isMyNext ? 'você' : nextAlive.name;
      expandArea.appendChild(el('div', {
        class: `irb-next-hint irb-next-${nextAlive.kind}${isMyNext ? ' is-me-next' : ''}`,
        text: `${glyph} Próximo: ${label}`,
      }));
    }
  };

  rerender();
  root.appendChild(ribbonRow);
  root.appendChild(expandArea);
  return root;
}

function renderExpandedCard(
  id: string,
  combat: CombatState,
  party: CharacterSheet[],
): HTMLElement | null {
  const order = combat.initiativeOrder.find((p) => p.id === id);
  if (!order) return null;

  if (order.kind === 'player') {
    const pj = party.find((x) => x.id === id);
    if (!pj) return null;
    const conditions = pj.conditions
      .map((c) => `${getCondition(c).glyph} ${getCondition(c).name}`)
      .join(' · ');
    return el('div', { class: 'irb-expand-card' }, [
      el('div', { class: 'irb-exp-row' }, [
        el('span', { class: 'irb-exp-label', text: order.name }),
      ]),
      el('div', { class: 'irb-exp-row' }, [
        el('span', { class: 'irb-exp-stat', text: `❤ ${pj.currentHp}/${pj.maxHp}` }),
        el('span', { class: 'irb-exp-stat', text: `🛡 CA ${pj.armorClass}` }),
        el('span', { class: 'irb-exp-stat', text: `🎲 Init ${order.initiative}` }),
      ]),
      conditions
        ? el('div', { class: 'irb-exp-conditions', text: conditions })
        : null,
    ].filter(Boolean) as HTMLElement[]);
  }

  // Enemy
  const en = combat.enemies.find((e) => e.id === id);
  if (!en) return null;
  const conditions = en.conditions
    .map((c) => `${getCondition(c).glyph} ${getCondition(c).name}`)
    .join(' · ');
  return el('div', { class: 'irb-expand-card' }, [
    el('div', { class: 'irb-exp-row' }, [
      el('span', { class: 'irb-exp-label', text: en.name }),
    ]),
    el('div', { class: 'irb-exp-row' }, [
      el('span', { class: 'irb-exp-stat', text: `❤ ${en.currentHp}/${en.maxHp}` }),
      el('span', { class: 'irb-exp-stat', text: `🛡 CA ${en.armorClass}` }),
      el('span', { class: 'irb-exp-stat', text: `🎲 Init ${order.initiative}` }),
    ]),
    conditions
      ? el('div', { class: 'irb-exp-conditions', text: conditions })
      : null,
  ].filter(Boolean) as HTMLElement[]);
}

function isDowned(
  p: CombatState['initiativeOrder'][number],
  combat: CombatState,
  party: CharacterSheet[],
): boolean {
  if (p.kind === 'enemy') {
    const e = combat.enemies.find((x) => x.id === p.id);
    return !!e && e.currentHp <= 0;
  }
  const pj = party.find((x) => x.id === p.id);
  return !!pj && (pj.currentHp <= 0 || pj.conditions.includes('inconsciente'));
}

/**
 * W3-DnD — Encontra o próximo participante vivo após currentTurnIndex.
 * Pula downed. Retorna null se ninguém vivo além do atual (boss solo, etc).
 * Exportado pra tests.
 */
export function findNextAliveAfter(
  combat: CombatState,
  party: CharacterSheet[],
  fromIdx: number,
): CombatState['initiativeOrder'][number] | null {
  const n = combat.initiativeOrder.length;
  if (n === 0) return null;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (idx === fromIdx) break;
    const cand = combat.initiativeOrder[idx];
    if (cand && !isDowned(cand, combat, party)) return cand;
  }
  return null;
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

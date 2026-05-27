// JSgame · ο.4 — Initiative Ribbon Uber-Style.
// Timeline visual com avatares 40-48px, current pulsando dourado,
// connector animado entre participantes. Tap em participante expande
// mini-card HP/AC/conditions inline.

import type { CombatState, CharacterSheet } from '../../shared/types';
import { el } from '../util';
import { portraitFor } from '../../dnd/portrait';
import { getCondition } from '../../dnd/conditions';

export interface InitiativeRibbonContext {
  combat: CombatState;
  party: CharacterSheet[];
  myCharacterId: string;
}

/**
 * Renderiza ribbon de initiative em formato timeline.
 * Estados especiais:
 *  - current: scale + glow pulsante dourado
 *  - me: border dourado fixo
 *  - downed: grayscale + skull 💀 overlay
 */
export function renderInitiativeRibbon(ctx: InitiativeRibbonContext): HTMLElement {
  const { combat, party, myCharacterId } = ctx;
  const root = el('div', { class: 'init-ribbon', attrs: { role: 'list', 'aria-label': 'Ordem de iniciativa' } });

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
      const cls = `irb-node ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${downed ? 'is-down' : ''} irb-${p.kind}`;

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
        avatar = el('span', { class: 'irb-avatar irb-avatar-enemy', text: '👹' });
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

    // Hint coop: "↓ Lyra é a próxima" se o próximo turno é aliado
    const nextIdx = (combat.currentTurnIndex + 1) % combat.initiativeOrder.length;
    const next = combat.initiativeOrder[nextIdx];
    if (next && next.kind === 'player' && next.id !== myCharacterId && !isDowned(next, combat, party)) {
      expandArea.appendChild(el('div', {
        class: 'irb-next-hint',
        text: `↓ ${next.name} é o próximo`,
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

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

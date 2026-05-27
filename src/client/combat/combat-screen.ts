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
import { getConditionIcon, getConditionDescription } from './condition-icons';
import { renderInitiativeRibbon } from './initiative-ribbon';

type SocketT = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface CombatScreenOpts {
  combat: CombatState;
  party: CharacterSheet[];
  myCharacterId: string;
  socket: SocketT;
  combatLog: string[];          // mensagens combat events recentes
}

// C1 — Mobile tabs: persistente entre re-renders via window state.
// Default 'actions' (mais usado). Mobile only — desktop mostra tudo de uma vez.
type CombatTab = 'enemies' | 'actions' | 'log';
function getActiveTab(): CombatTab {
  return ((window as unknown as { __combatTab?: CombatTab }).__combatTab) ?? 'actions';
}
function setActiveTab(tab: CombatTab): void {
  (window as unknown as { __combatTab?: CombatTab }).__combatTab = tab;
  document.querySelectorAll('.combat-screen').forEach((el) => el.setAttribute('data-active-tab', tab));
  document.querySelectorAll('.cb-tab-btn').forEach((b) => {
    const target = b.getAttribute('data-tab');
    b.classList.toggle('is-active', target === tab);
  });
}

export function renderCombatScreen(container: HTMLElement, opts: CombatScreenOpts): void {
  const { combat, party, myCharacterId, socket, combatLog } = opts;
  const myChar = party.find((p) => p.id === myCharacterId) ?? null;

  const activeTab = getActiveTab();
  const root = el('section', { class: 'combat-screen', attrs: { 'data-active-tab': activeTab } });

  // C1 — Tab strip (mobile only via CSS; desktop hide via .cb-tabs { display: none })
  const tabStrip = el('div', { class: 'cb-tabs' }, [
    el('button', {
      class: `cb-tab-btn ${activeTab === 'enemies' ? 'is-active' : ''}`,
      text: `⚔ Inimigos (${combat.enemies.filter((e) => e.currentHp > 0).length})`,
      attrs: { type: 'button', 'data-tab': 'enemies' },
      on: { click: () => setActiveTab('enemies') },
    }),
    el('button', {
      class: `cb-tab-btn ${activeTab === 'actions' ? 'is-active' : ''}`,
      text: '🎲 Ações',
      attrs: { type: 'button', 'data-tab': 'actions' },
      on: { click: () => setActiveTab('actions') },
    }),
    el('button', {
      class: `cb-tab-btn ${activeTab === 'log' ? 'is-active' : ''}`,
      text: `📜 Log${combatLog.length > 0 ? ` (${combatLog.length})` : ''}`,
      attrs: { type: 'button', 'data-tab': 'log' },
      on: { click: () => setActiveTab('log') },
    }),
  ]);
  root.appendChild(tabStrip);

  // Swipe handlers (mobile)
  // ψ.5 — Guard: só dispara se gesto for predominantemente horizontal
  // (dx > 2*dy). Antes triggava com scroll vertical leve, atrapalhando.
  let touchStartX = 0;
  let touchStartY = 0;
  root.addEventListener('touchstart', (e: TouchEvent) => {
    touchStartX = e.touches[0]?.clientX ?? 0;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }, { passive: true });
  root.addEventListener('touchend', (e: TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const dx = endX - touchStartX;
    const dy = endY - touchStartY;
    if (Math.abs(dx) < 60) return;
    // ψ.5 — Só conta como swipe horizontal se dx for 2× maior que dy.
    // Mata false-positive quando player rola log vertical.
    if (Math.abs(dx) < Math.abs(dy) * 2) return;
    const tabs: CombatTab[] = ['enemies', 'actions', 'log'];
    const idx = tabs.indexOf(getActiveTab());
    if (dx > 0 && idx > 0) setActiveTab(tabs[idx - 1]!);
    else if (dx < 0 && idx < tabs.length - 1) setActiveTab(tabs[idx + 1]!);
  });

  // ── Header: round + current turn
  const current = combat.initiativeOrder[combat.currentTurnIndex];
  root.appendChild(el('div', { class: 'cb-header' }, [
    el('span', { class: 'cb-round', text: `Round ${combat.round}` }),
    el('span', { class: 'cb-turn', text: current ? `Vez de ${current.name}` : '—' }),
  ]));

  // β.4 — Action Economy badge (PHB pág 189-193). Mostra pro PJ ativo se for o
  // turno dele. 4 slots: ação / bônus / movimento / reação.
  if (current && current.kind === 'player' && current.id === myCharacterId && combat.actionEconomy) {
    const ec = combat.actionEconomy[current.id];
    if (ec) {
      root.appendChild(el('div', { class: 'cb-economy', attrs: { title: 'Economia de ações PHB pág 189' } }, [
        el('span', { class: `cb-eco-slot ${ec.action ? 'is-avail' : 'is-used'}`, attrs: { title: 'Ação principal (attack, dash, dodge, cast)' }, text: ec.action ? '🎯 Ação' : '— Ação' }),
        el('span', { class: `cb-eco-slot ${ec.bonusAction ? 'is-avail' : 'is-used'}`, attrs: { title: 'Ação bônus (1 por turno SE você tem feature/spell que dá)' }, text: ec.bonusAction ? '✨ Bônus' : '— Bônus' }),
        el('span', { class: `cb-eco-slot ${ec.movement > 0 ? 'is-avail' : 'is-used'}`, attrs: { title: 'Movimento restante (em pés)' }, text: `👟 ${ec.movement}ft` }),
        el('span', { class: `cb-eco-slot ${ec.reaction ? 'is-avail' : 'is-used'}`, attrs: { title: 'Reação (1 por round) — opportunity attack, counterspell, shield' }, text: ec.reaction ? '🛡 Reação' : '— Reação' }),
      ]));
    }
  }

  // ο.4 — Initiative Ribbon Uber-Style. Substitui cb-initiative legacy.
  // Avatars 40-48px, current pulsando dourado, connectors animados, tap expande mini-card.
  root.appendChild(renderInitiativeRibbon({ combat, party, myCharacterId }));

  // ── Enemies portraits (C1: wrap em tab)
  if (combat.enemies.length > 0) {
    const enemiesGrid = el('div', { class: 'cb-enemies cb-tab-content cb-tab-enemies' });
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
    const bar = el('div', { class: 'cb-actions cb-tab-content cb-tab-actions' });
    bar.appendChild(el('div', { class: 'cb-actions-title', text: `🎯 Seu turno, ${escapeHtml(myChar.characterName)}` }));
    const grid = el('div', { class: 'cb-actions-grid' });

    // β.4 V2 — Action Economy: desabilita botões cujo slot já foi gasto.
    // 'two-weapon' = bonus action; resto = action. Helper consulta state direto.
    const ec = combat.actionEconomy?.[myCharacterId];
    const isBlocked = (id: CombatActionKind): boolean => {
      if (!ec) return false;
      if (id === 'two-weapon') return !ec.bonusAction;
      return !ec.action;
    };

    for (const a of actions) {
      const blocked = isBlocked(a.id);
      const blockedTitle = blocked
        ? (a.id === 'two-weapon' ? '⛔ Já gastou Ação Bônus' : '⛔ Já gastou Ação principal')
        : a.hint;
      grid.appendChild(el('button', {
        class: `cb-action-btn ${blocked ? 'is-blocked' : ''}`,
        attrs: { type: 'button', title: blockedTitle, ...(blocked ? { disabled: true } : {}) },
        on: {
          click: () => {
            if (a.id === 'attack' || a.id === 'grapple' || a.id === 'shove' || a.id === 'two-weapon') {
              void import('../toast').then(({ toastInfo }) => toastInfo(`Clique no inimigo alvo (cards acima). Ação: ${a.label}.`));
              // Marca ação pendente
              (window as unknown as { __pendingCombatAction?: CombatActionKind }).__pendingCombatAction = a.id;
              return;
            }
            if (a.id === 'help') {
              const allies = party.filter((p) => p.id !== myCharacterId && p.currentHp > 0);
              if (allies.length === 0) {
                void import('../toast').then(({ toastWarn }) => toastWarn('Nenhum aliado vivo pra ajudar.'));
                return;
              }
              const choice = prompt(`Ajudar quem? Digite o nome:\n${allies.map((al) => `- ${al.characterName}`).join('\n')}`);
              if (!choice) return;
              const target = allies.find((al) => al.characterName.toLowerCase() === choice.toLowerCase());
              if (!target) {
                void import('../toast').then(({ toastError }) => toastError(`Aliado "${choice}" não encontrado.`));
                return;
              }
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

    // POLISH β.7 — Encerrar turno chip. Aparece quando action principal já
    // foi gasta (player provavelmente não tem mais o que fazer útil). Pulsa
    // visualmente quando TODOS slots (action + bonus) estão vazios — sinal
    // óbvio que turno deveria acabar.
    if (ec && !ec.action) {
      const allUsed = !ec.action && !ec.bonusAction;
      bar.appendChild(el('button', {
        class: `cb-end-turn-chip ${allUsed ? 'is-pulsing' : ''}`,
        attrs: { type: 'button', title: 'Encerra seu turno (passa pra próximo na initiative)' },
        text: allUsed ? '✓ Encerrar turno (tudo gasto)' : '✓ Encerrar turno',
        on: {
          click: () => socket.emit('endTurn'),
        },
      }));
    }
    root.appendChild(bar);

    // F23 — Class Features Big 7 bar (rage/surge/etc) — só se classe tem
    const featuresBar = renderClassFeaturesBar(myChar, socket, party);
    if (featuresBar) {
      // C1: dentro da tab actions
      featuresBar.classList.add('cb-tab-content', 'cb-tab-actions');
      root.appendChild(featuresBar);
    }
  } else {
    // POLISH δ.4 — turn indicator visual mais rico em coop.
    // Mostra avatar do current player + "torcendo 🤞" pra fazer espera menos pesada.
    const waiting = el('div', { class: 'cb-waiting cb-tab-content cb-tab-actions' });
    if (current) {
      const isEnemy = current.kind === 'enemy';
      const isAlly = current.kind === 'player' && current.id !== myCharacterId;
      const headerText = isEnemy
        ? `🩸 Turno do inimigo`
        : isAlly
          ? `🤝 Vez de ${current.name}`
          : `⏳ Aguardando ${current.name}…`;
      const hint = isEnemy
        ? 'A criatura ataca, aguenta firme.'
        : isAlly
          ? 'Vamos torcer 🤞 — joga do lado.'
          : 'Próximo turno em breve.';
      waiting.appendChild(el('div', { class: 'cb-waiting-header', text: headerText }));
      waiting.appendChild(el('div', { class: 'cb-waiting-hint', text: hint }));
    } else {
      waiting.appendChild(el('div', { class: 'cb-waiting-txt', text: '⏳ Aguardando próximo turno' }));
    }
    root.appendChild(waiting);
  }

  // ── Combat log
  if (combatLog.length > 0 || combat.log.length > 0) {
    const logEl = el('div', { class: 'cb-log cb-tab-content cb-tab-log' });
    logEl.appendChild(el('div', { class: 'cb-log-title', text: '📜 Log de combate' }));
    const items = [...combat.log.slice(-6), ...combatLog.slice(-4)];
    for (const ln of items.slice(-10)) {
      // POLISH β.6 — Classifica linha pra colorir (player/enemy/crit/miss/skill)
      const kind = classifyLogLine(ln);
      logEl.appendChild(el('div', { class: `cb-log-line cb-log-${kind}`, text: ln }));
    }
    root.appendChild(logEl);
  }

  container.appendChild(root);
}

// POLISH β.6 — classifica linha de combat log por tipo pra colorir.
// Heurístico baseado em keywords. Default 'neutral' (cinza).
function classifyLogLine(line: string): 'crit' | 'miss' | 'player' | 'enemy' | 'skill' | 'death' | 'neutral' {
  const l = line.toLowerCase();
  if (l.includes('crit') || l.includes('crítico')) return 'crit';
  if (l.includes('errou') || l.includes('miss') || l.includes('falhou')) return 'miss';
  if (l.includes('morreu') || l.includes('caiu') || l.includes('inconsciente')) return 'death';
  if (l.includes('teste de') || l.includes('check') || l.includes('rolou ') || l.includes('save')) return 'skill';
  // Inicia com ▶ ou tem "você" / nome do PJ → player. Heurístico fraco mas útil.
  if (line.startsWith('▶') || l.includes('você') || l.includes('seu ')) return 'player';
  // "inimigo X atacou", "goblin", "orc" etc → enemy
  if (l.includes('atacou') || l.includes('ataca ') || l.includes('inimigo')) return 'enemy';
  return 'neutral';
}

// 1B — coloring de condition por severidade pra UI imediata.
// severe: imobiliza/incapacita. moderate: penalty grande. mild: penalty menor.
function conditionSeverity(c: string): 'severe' | 'moderate' | 'mild' {
  if (['inconsciente', 'paralisado', 'petrificado', 'atordoado'].includes(c)) return 'severe';
  if (['amedrontado', 'agarrado', 'restrito', 'envenenado', 'enfeiticado', 'caido'].includes(c)) return 'moderate';
  return 'mild';
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
    const condRow = el('div', { class: 'cb-enemy-cond' });
    for (const c of en.conditions) {
      // POLISH β.4 — pill agora tem icon visual + tooltip com descrição mecânica
      const desc = getConditionDescription(c);
      condRow.appendChild(el('span', {
        class: `cb-cond-pill cb-cond-${conditionSeverity(c)}`,
        text: `${getConditionIcon(c)} ${c}`,
        attrs: desc ? { title: desc } : {},
      }));
    }
    card.appendChild(condRow);
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

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
import { iconEl, enemyIconName, conditionIconName } from '../icons/game-icons';
import { renderInitiativeRibbon } from './initiative-ribbon';
import { enemyToStatBlock } from '../components/stat-block';
import { openStatBlockModal } from '../components/stat-block-modal';
import { hapticSuccess, hapticTap } from '../haptic';
import { showToast } from '../toast';
import { enemyHpAdjective as _enemyHpAdjective } from './combat-screen-helpers';
import { openCombatTargetSheet } from './combat-target-sheet';

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

// W3.4 — Tracker module-level pra detectar TRANSIÇÃO turn → my-turn (não
// só estado atual). Quando aparece o turno do player, dispara haptic + toast
// "▶ Seu turno" + body.is-my-turn. Evita re-trigger em re-renders dentro do
// mesmo turno. Reset quando combat termina (combat.active=false).
let lastMyTurnState = false;

export function renderCombatScreen(container: HTMLElement, opts: CombatScreenOpts): void {
  const { combat, party, myCharacterId, socket, combatLog } = opts;
  const myChar = party.find((p) => p.id === myCharacterId) ?? null;

  // W3.4 — Detecta meu turno e aplica/remova body class + side effects de transição.
  const myTurnNow = isMyTurn(combat, myCharacterId);
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('is-my-turn', myTurnNow);
  }
  if (myTurnNow && !lastMyTurnState) {
    // Transição EXTERNO → seu turno: drama "AGORA É VOCÊ"
    try { hapticSuccess(); } catch { /* silent */ }
    try { showToast({ kind: 'info', message: '▶ Seu turno', durationMs: 1800 }); } catch { /* silent */ }
  }
  lastMyTurnState = myTurnNow;

  const activeTab = getActiveTab();
  const root = el('section', { class: 'combat-screen', attrs: { 'data-active-tab': activeTab } });

  // C1 — Tab strip (mobile only via CSS; desktop hide via .cb-tabs { display: none })
  // O3.2 — Counts extraídos pra .cb-tab-badge dourado destacado (não inline)
  const enemyCount = combat.enemies.filter((e) => e.currentHp > 0).length;
  const logCount = combatLog.length;
  const tabStrip = el('div', { class: 'cb-tabs' }, [
    el('button', {
      class: `cb-tab-btn ${activeTab === 'enemies' ? 'is-active' : ''}`,
      attrs: { type: 'button', 'data-tab': 'enemies' },
      on: { click: () => setActiveTab('enemies') },
    }, [
      el('span', { class: 'cb-tab-label', text: '⚔ Inimigos' }),
      enemyCount > 0 ? el('span', { class: 'cb-tab-badge', text: String(enemyCount) }) : null,
    ].filter(Boolean) as HTMLElement[]),
    el('button', {
      class: `cb-tab-btn ${activeTab === 'actions' ? 'is-active' : ''}`,
      attrs: { type: 'button', 'data-tab': 'actions' },
      on: { click: () => setActiveTab('actions') },
    }, [
      el('span', { class: 'cb-tab-label', text: '🎲 Ações' }),
    ]),
    el('button', {
      class: `cb-tab-btn ${activeTab === 'log' ? 'is-active' : ''}`,
      attrs: { type: 'button', 'data-tab': 'log' },
      on: { click: () => setActiveTab('log') },
    }, [
      el('span', { class: 'cb-tab-label', text: '📜 Log' }),
      logCount > 0 ? el('span', { class: 'cb-tab-badge', text: String(logCount) }) : null,
    ].filter(Boolean) as HTMLElement[]),
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

  // ── Header: turno (dominante) + round (secundário)
  // U4 — antes "Round N" era grande e "Vez de X" minúsculo itálico apagado.
  // Inverte: de quem é a vez é a info #1 do combate; "Sua vez" ganha destaque
  // dourado. Round recua pra secundário.
  const current = combat.initiativeOrder[combat.currentTurnIndex];
  const headerIsMine = isMyTurn(combat, myCharacterId);
  root.appendChild(el('div', { class: 'cb-header' }, [
    el('span', { class: `cb-turn ${headerIsMine ? 'is-my-turn' : ''}`, text: headerIsMine ? '▶ Sua vez' : (current ? `Vez de ${current.name}` : '—') }),
    el('span', { class: 'cb-round', text: `Round ${combat.round}` }),
  ]));

  // W3.3 — Sprint W: Action Economy STICKY top.
  // Mostra MEU economy mesmo entre turnos (read-only quando não é minha vez) —
  // antes só renderizava no meu turno = chips sumiam ao vencer minha vez.
  // Sticky top: ribbon persiste enquanto scroll desce. Consultor Mobile:
  // "player gasta Bonus Action sem perceber porque chips estão escondidos".
  if (combat.actionEconomy) {
    const myEc = combat.actionEconomy[myCharacterId];
    const isMyTurnNow = !!current && current.kind === 'player' && current.id === myCharacterId;
    if (myEc) {
      const eco = el('div', {
        class: `cb-economy${isMyTurnNow ? ' is-active-turn' : ' is-readonly'}`,
        attrs: { title: isMyTurnNow ? 'Economia de ações PHB pág 189 — seu turno' : 'Economia (read-only — não é seu turno)' },
      }, [
        el('span', { class: `cb-eco-slot ${myEc.action ? 'is-avail' : 'is-used'}`, attrs: { title: 'Ação principal (attack, dash, dodge, cast)' }, text: myEc.action ? '🎯 Ação' : '— Ação' }),
        el('span', { class: `cb-eco-slot ${myEc.bonusAction ? 'is-avail' : 'is-used'}`, attrs: { title: 'Ação bônus (1 por turno SE você tem feature/spell que dá)' }, text: myEc.bonusAction ? '✨ Bônus' : '— Bônus' }),
        el('span', { class: `cb-eco-slot ${myEc.movement > 0 ? 'is-avail' : 'is-used'}`, attrs: { title: `Movimento restante — ${Math.round(myEc.movement * 0.3 * 10) / 10}m / ${myEc.movement}ft (1 quadrado = 1.5m = 5ft)` }, text: `👟 ${Math.round(myEc.movement * 0.3 * 10) / 10}m` }),
        el('span', { class: `cb-eco-slot ${myEc.reaction ? 'is-avail' : 'is-used'}`, attrs: { title: 'Reação (1 por round) — opportunity attack, counterspell, shield' }, text: myEc.reaction ? '🛡 Reação' : '— Reação' }),
      ]);
      root.appendChild(eco);
    }
  }

  // ο.4 — Initiative Ribbon Uber-Style. Substitui cb-initiative legacy.
  // Avatars 40-48px, current pulsando dourado, connectors animados, tap expande mini-card.
  root.appendChild(renderInitiativeRibbon({ combat, party, myCharacterId }));

  // ── Enemies portraits (C1: wrap em tab)
  if (combat.enemies.length > 0) {
    const enemiesGrid = el('div', { class: 'cb-enemies cb-tab-content cb-tab-enemies' });
    for (const en of combat.enemies) {
      const enemyForClosure = en; // closure capture
      enemiesGrid.appendChild(renderEnemyCard(en, () => {
        // Se for meu turno e o enemy estiver vivo, ataca (ou pending action)
        if (!isMyTurn(combat, myCharacterId)) return;
        if (enemyForClosure.currentHp <= 0) return;
        if (!myChar) return;

        // W3-Mobile — Targeting glow 200ms + haptic 15ms ANTES do sheet abrir.
        // Consultor Mobile: Genshin/HSR fazem isso, "sensação de mira travada".
        const cardEl = root.querySelector(`[data-combat-target="${enemyForClosure.id}"]`) as HTMLElement | null;
        cardEl?.classList.add('is-targeted');
        try { hapticTap(); } catch { /* silent */ }

        const w = window as unknown as { __pendingCombatAction?: CombatActionKind };
        const pending = w.__pendingCombatAction;
        const pendingAction: CombatActionKind = pending ?? 'attack';
        delete w.__pendingCombatAction;

        // 200ms drama → abre target sheet contextual (W3.2)
        window.setTimeout(() => {
          cardEl?.classList.remove('is-targeted');
          openCombatTargetSheet({
            enemy: enemyForClosure,
            myChar,
            pendingAction,
            onConfirm: (action) => {
              socket.emit('combatAction', { action, targetId: enemyForClosure.id });
            },
            // Sprint X.B1 — Chip de feature dispara useClassFeature direto.
            // Features que precisam target (bardic-inspiration) caem na
            // class-features-bar fallback (não aparecem aqui).
            onUseFeature: (key) => {
              socket.emit('useClassFeature', { feature: key });
            },
          });
        }, 200);
      }, isMyTurn(combat, myCharacterId)));
    }
    root.appendChild(enemiesGrid);
  }

  // ── Player turn action bar (só aparece se for meu turno)
  if (isMyTurn(combat, myCharacterId) && myChar) {
    // Sub-sprint B (Mariana/Henrique) — labels PHB PT-BR + hints didáticos.
    // "Disparada" → "Disparar" (verbo, alinha PHB), hints mais claros pra novatos.
    const actions: Array<{ id: CombatActionKind; label: string; icon: string; hint: string }> = [
      { id: 'attack', label: 'Atacar', icon: '⚔', hint: 'Selecione o inimigo alvo nos cards acima' },
      { id: 'dodge', label: 'Esquivar', icon: '🛡', hint: 'Ataques contra você têm desvantagem até seu próximo turno' },
      { id: 'dash', label: 'Disparar', icon: '💨', hint: 'Movimento dobrado neste turno (PHB Disparar)' },
      { id: 'disengage', label: 'Desengajar', icon: '↩', hint: 'Recua sem sofrer ataque de oportunidade' },
      { id: 'hide', label: 'Esconder', icon: '🥷', hint: 'Teste de Furtividade — se ninguém te vê, fica oculto' },
      { id: 'help', label: 'Ajudar', icon: '🤝', hint: 'Aliado ganha vantagem no próximo ataque' },
      // F24
      { id: 'grapple', label: 'Agarrar', icon: '🤼', hint: 'Atletismo vs Atletismo/Acrobacia — alvo fica preso' },
      { id: 'shove', label: 'Empurrar', icon: '👐', hint: 'Atletismo contestado — derruba alvo (caído)' },
      { id: 'two-weapon', label: '2ª Arma', icon: '🗡', hint: 'Ataque bônus com arma da mão fraca (1× por turno)' },
    ];
    const bar = el('div', { class: 'cb-actions cb-tab-content cb-tab-actions' });
    bar.appendChild(el('div', { class: 'cb-actions-title', text: `🎯 Seu turno, ${escapeHtml(myChar.characterName)}` }));
    // U3 — clareza do fluxo target-first SEM remover a grade (consultor W3.5
    // manteve-a opt-in de propósito). Uma linha curta explica que ações de
    // alvo passam pelo inimigo — dissolve a sensação de "2 sistemas competindo".
    bar.appendChild(el('div', { class: 'cb-actions-hint', text: 'Ações com alvo (⚔ 🤼 👐 🗡) abrem a ficha do inimigo pra confirmar.' }));
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
      // Sub-sprint B (Beatriz) — "Atacar" é a ação mais comum no turno (90%+).
      // Marca .is-primary pra ganhar destaque visual (border dourado + accent sangue).
      const isPrimary = a.id === 'attack';
      grid.appendChild(el('button', {
        class: `cb-action-btn ${blocked ? 'is-blocked' : ''} ${isPrimary ? 'is-primary' : ''}`,
        attrs: { type: 'button', title: blockedTitle, ...(blocked ? { disabled: true } : {}) },
        on: {
          click: () => {
            if (a.id === 'attack' || a.id === 'grapple' || a.id === 'shove' || a.id === 'two-weapon') {
              // Marca ação pendente E revela a aba de inimigos (U2). O default
              // é 'actions', que ESCONDE os enemy cards em mobile (combat.css
              // display:none) — o player era mandado clicar em cards invisíveis.
              // setActiveTab só troca data-active-tab; o pending persiste no window.
              (window as unknown as { __pendingCombatAction?: CombatActionKind }).__pendingCombatAction = a.id;
              setActiveTab('enemies');
              void import('../toast').then(({ toastInfo }) => toastInfo(`Escolha o inimigo alvo. Ação: ${a.label}.`));
              return;
            }
            if (a.id === 'help') {
              const allies = party.filter((p) => p.id !== myCharacterId && p.currentHp > 0);
              if (allies.length === 0) {
                void import('../toast').then(({ toastWarn }) => toastWarn('Nenhum aliado vivo pra ajudar.'));
                return;
              }
              // ψ.4 — Picker modal (era prompt() nativo type-name)
              void import('../ui-modal').then(async ({ pickerDialog }) => {
                const targetId = await pickerDialog<string>({
                  title: '🤝 Ajudar aliado',
                  text: 'Próximo ataque dele tem vantagem',
                  options: allies.map((al) => ({
                    value: al.id,
                    label: al.characterName,
                    description: `HP ${al.currentHp}/${al.maxHp} · CA ${al.armorClass}`,
                  })),
                });
                if (targetId) {
                  socket.emit('combatAction', { action: 'help', targetId });
                }
              });
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

// W3.1 — enemyHpAdjective moved to combat-screen-helpers.ts pra ser compartilhado
// com combat-target-sheet sem circular dep. Re-export pra compat existente.
export { enemyHpAdjective } from './combat-screen-helpers';

function renderEnemyCard(en: EnemySnapshot, onClick: () => void, clickable: boolean): HTMLElement {
  const pct = en.maxHp > 0 ? Math.round((en.currentHp / en.maxHp) * 100) : 0;
  const dead = en.currentHp <= 0;
  // W3.1 — Fog of war: stats CA/+atq/dano REMOVIDOS do card principal.
  // Player vê: nome + adjetivo HP ("ferido") + barra relativa + conditions.
  // Stats completos via botão ℹ (abre stat-block modal Φ.2).
  const hpAdj = _enemyHpAdjective(en.currentHp, en.maxHp);
  const card = el('div', {
    class: `cb-enemy-card ${dead ? 'is-dead' : ''} ${clickable && !dead ? 'is-clickable' : ''}`,
    attrs: { 'data-combat-target': en.id },
    on: clickable && !dead ? { click: onClick } : undefined,
  }, [
    el('button', {
      class: 'cb-enemy-info-btn',
      attrs: { type: 'button', 'aria-label': `Ver ficha completa de ${en.name}`, title: 'Ver ficha completa (CA, ataque, dano, HP exato)' },
      text: 'ℹ',
      on: { click: (e): void => {
        e.stopPropagation();
        openStatBlockModal(enemyToStatBlock(en));
      } },
    }),
    el('div', { class: 'cb-enemy-name-row' }, [
      iconEl(enemyIconName(en.name, en.isBoss), en.isBoss ? '👺' : '👹', { className: `cb-enemy-glyph ${en.isBoss ? 'is-boss-glyph' : ''}` }),
      el('span', { class: 'cb-enemy-name', text: en.name }),
    ]),
    // W3.1 — Adjetivo HP em vez de stats numéricos. Tooltip explica como ver detalhes.
    el('div', {
      class: `cb-enemy-meta cb-enemy-hp-adj cb-enemy-hp-${hpAdj.replace(/\s+/g, '-')}`,
      text: hpAdj,
      attrs: { title: 'Toque em ℹ pra ver CA, ataque, dano e HP exato' },
    }),
    el('div', { class: 'cb-enemy-hp-bar' }, [
      el('div', {
        class: `cb-enemy-hp-fill ${pct < 33 ? 'is-low' : pct < 66 ? 'is-mid' : ''}`,
        style: { width: `${pct}%` },
      }),
    ]),
  ]);
  if (en.conditions.length > 0) {
    const condRow = el('div', { class: 'cb-enemy-cond' });
    for (const c of en.conditions) {
      // POLISH β.4 — pill agora tem icon visual + tooltip com descrição mecânica
      const desc = getConditionDescription(c);
      condRow.appendChild(el('span', {
        class: `cb-cond-pill cb-cond-${conditionSeverity(c)}`,
        attrs: desc ? { title: desc } : {},
      }, [
        iconEl(conditionIconName(c), getConditionIcon(c), { className: 'cb-cond-icon' }),
        ` ${c}`,
      ]));
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

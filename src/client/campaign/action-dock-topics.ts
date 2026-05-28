// JSgame · ο.3 — Action Dock Topicizado (pegada Uber).
// 4 tópicos visíveis (cards 80x80) + drill-down inline. Reduz cognitive load:
// player vê 4-5 categorias em vez de 8-12 botões flat.
//
// Topics: ⚔️ Combate · 🔍 Explorar · 🗣 Social · ⚡ Magia · ⋯ Mais
// Em combat ativo, tópicos mudam pra ações táticas (Attack/Dodge/Dash/etc).

import type { ExplorationAction } from '../../shared/types';
import { el } from '../util';
import { inputDialog } from '../ui-modal';

type TopicId = 'combat' | 'explore' | 'social' | 'magic' | 'more' | 'custom';

export interface ActionDockContext {
  isCombat: boolean;
  isMyTurn?: boolean;       // só relevante em combat
  canRest: boolean;
  isCaster: boolean;
  isDmThinking: boolean;
  /** Exploration actions */
  onAction: (action: ExplorationAction, details?: string) => void;
  /** Free-form action */
  onCustomAction: (details: string) => void;
  /** Combat action (attack, dodge, dash, etc) */
  onCombatAction?: (action: string) => void;
  onCastSpell: () => void;
  onInventory: () => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onEndTurn?: () => void;
}

interface TopicDef {
  id: TopicId;
  glyph: string;
  label: string;
  /** se visible=false, topic não aparece */
  visible: boolean;
}

interface SubAction {
  glyph: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Renderiza o dock topicizado mode-aware. Retorna container com 4-5 cards de tópicos
 * + drill-down quando algum tópico está aberto.
 */
// ψ.5 — Estado externo do action dock — sobrevive a re-mounts (cada render()
// do campaign-screen cria novo closure de renderActionDockTopics, perdendo
// state local). Mantém customDetails + currentTopic preservados.
const dockState = {
  customDetails: '',
  currentTopic: null as TopicId | null,
};

/** ψ.5 — Reset state externo (limpa quando sair da campanha). */
export function resetActionDockState(): void {
  dockState.customDetails = '';
  dockState.currentTopic = null;
}

export function renderActionDockTopics(ctx: ActionDockContext): HTMLElement {
  const root = el('section', { class: 'action-dock-topics', attrs: { 'aria-label': 'Ações disponíveis' } });

  // ψ.5 — Estado lê/escreve do module-level pra preservar entre re-mounts

  const topics: TopicDef[] = ctx.isCombat ? combatTopics(ctx) : explorationTopics(ctx);

  const cardsRow = el('div', { class: 'adt-cards' });
  const drillArea = el('div', { class: 'adt-drill' });

  const rerender = (): void => {
    cardsRow.innerHTML = '';
    drillArea.innerHTML = '';

    for (const t of topics) {
      if (!t.visible) continue;
      const isActive = dockState.currentTopic === t.id;
      cardsRow.appendChild(el('button', {
        class: `adt-card ${isActive ? 'is-active' : ''}`,
        attrs: { type: 'button', title: t.label, 'aria-pressed': String(isActive) },
        on: {
          click: () => {
            // Ω.9 — 'custom' (Livre) NÃO expande drill inline (tampava narração).
            // Abre modal bottom-sheet via inputDialog multiline.
            if (t.id === 'custom') {
              openCustomActionModal(ctx);
              return;
            }
            dockState.currentTopic = isActive ? null : t.id;
            rerender();
          },
        },
      }, [
        el('span', { class: 'adt-glyph', text: t.glyph }),
        el('span', { class: 'adt-label', text: t.label }),
      ]));
    }

    if (dockState.currentTopic && dockState.currentTopic !== 'custom') {
      drillArea.appendChild(renderDrill(
        dockState.currentTopic,
        ctx,
        () => { dockState.currentTopic = null; rerender(); },
      ));
    }

    // Sticky End Turn em combate (sempre visível, NÃO covered por drill)
    if (ctx.isCombat && ctx.isMyTurn && ctx.onEndTurn) {
      const endTurnBar = el('div', { class: 'adt-end-turn-bar' });
      endTurnBar.appendChild(el('button', {
        class: 'adt-end-turn-btn',
        attrs: { type: 'button' },
        text: '⏱ Encerrar Turno',
        on: { click: () => ctx.onEndTurn!() },
      }));
      drillArea.appendChild(endTurnBar);
    }
  };

  rerender();

  root.appendChild(cardsRow);
  root.appendChild(drillArea);

  return root;
}

function explorationTopics(ctx: ActionDockContext): TopicDef[] {
  return [
    { id: 'combat',  glyph: '⚔️', label: 'Combate',  visible: true },
    { id: 'explore', glyph: '🔍', label: 'Explorar', visible: true },
    { id: 'social',  glyph: '🗣',  label: 'Social',   visible: true },
    { id: 'magic',   glyph: '⚡', label: 'Magia',    visible: ctx.isCaster },
    { id: 'more',    glyph: '⋯',  label: 'Mais',     visible: true },
    { id: 'custom',  glyph: '✎',  label: 'Livre',    visible: true },
  ];
}

function combatTopics(ctx: ActionDockContext): TopicDef[] {
  return [
    { id: 'combat',  glyph: '⚔️', label: 'Combate',  visible: true },
    { id: 'magic',   glyph: '⚡', label: 'Magia',    visible: ctx.isCaster },
    { id: 'social',  glyph: '🗣',  label: 'Social',   visible: true },
    { id: 'more',    glyph: '⋯',  label: 'Mais',     visible: true },
    { id: 'custom',  glyph: '✎',  label: 'Livre',    visible: true },
  ];
}

function renderDrill(
  topic: TopicId,
  ctx: ActionDockContext,
  onBack: () => void,
): HTMLElement {
  const drill = el('div', { class: 'adt-drill-panel' });
  drill.appendChild(el('button', {
    class: 'adt-back-btn',
    attrs: { type: 'button', 'aria-label': 'Voltar pra tópicos' },
    text: '← Voltar',
    on: { click: onBack },
  }));

  // Ω.9 — 'custom' nunca chega aqui (abre via openCustomActionModal direto do card)

  const subActions = subActionsFor(topic, ctx);
  const grid = el('div', { class: 'adt-sub-grid' });
  for (const sa of subActions) {
    grid.appendChild(el('button', {
      class: 'adt-sub-btn',
      attrs: { type: 'button', disabled: sa.disabled || ctx.isDmThinking, title: sa.label },
      on: { click: () => sa.onClick() },
    }, [
      el('span', { class: 'adt-sub-glyph', text: sa.glyph }),
      el('span', { class: 'adt-sub-label', text: sa.label }),
      sa.hint ? el('span', { class: 'adt-sub-hint', text: sa.hint }) : null,
    ].filter(Boolean) as HTMLElement[]));
  }
  drill.appendChild(grid);
  return drill;
}

function subActionsFor(topic: TopicId, ctx: ActionDockContext): SubAction[] {
  if (ctx.isCombat) {
    return combatSubActions(topic, ctx);
  }
  return explorationSubActions(topic, ctx);
}

function explorationSubActions(topic: TopicId, ctx: ActionDockContext): SubAction[] {
  switch (topic) {
    case 'combat':
      return [
        { glyph: '⚔', label: 'Atacar', onClick: () => ctx.onAction('attack', '') },
      ];
    case 'explore':
      return [
        { glyph: '🔍', label: 'Explorar', hint: 'olhar/varrer', onClick: () => ctx.onAction('explore', '') },
        { glyph: '🔎', label: 'Investigar', hint: 'analisar pista', onClick: () => ctx.onAction('investigate', '') },
        { glyph: '🥷', label: 'Furtar-se', hint: 'esconder/passar', onClick: () => ctx.onAction('sneak', '') },
        { glyph: '🚶', label: 'Viajar', hint: 'pra outro local', onClick: () => ctx.onAction('travel', '') },
      ];
    case 'social':
      return [
        { glyph: '🗣', label: 'Falar', hint: 'conversar com NPC', onClick: () => ctx.onAction('talk', '') },
      ];
    case 'magic':
      return [
        { glyph: '🔮', label: 'Lançar Magia', onClick: () => ctx.onCastSpell() },
      ];
    case 'more':
      return [
        { glyph: '🎒', label: 'Inventário', onClick: () => ctx.onInventory() },
        ...(ctx.canRest ? [
          { glyph: '🛌', label: 'Descanso Curto', hint: 'gasta hit dice', onClick: () => ctx.onShortRest() },
          { glyph: '🏕', label: 'Descanso Longo', hint: '8h, restaura tudo', onClick: () => ctx.onLongRest() },
        ] : []),
        { glyph: '🧪', label: 'Usar Item', onClick: () => ctx.onAction('use-item', '') },
      ];
    default:
      return [];
  }
}

function combatSubActions(topic: TopicId, ctx: ActionDockContext): SubAction[] {
  const myTurn = !!ctx.isMyTurn;
  const cb = ctx.onCombatAction;
  switch (topic) {
    case 'combat':
      return [
        { glyph: '⚔', label: 'Atacar', disabled: !myTurn, onClick: () => cb?.('attack') },
        { glyph: '🛡', label: 'Esquivar', hint: 'Dodge', disabled: !myTurn, onClick: () => cb?.('dodge') },
        { glyph: '🏃', label: 'Disparada', hint: 'Dash', disabled: !myTurn, onClick: () => cb?.('dash') },
        { glyph: '↩', label: 'Recuar', hint: 'Disengage', disabled: !myTurn, onClick: () => cb?.('disengage') },
        { glyph: '👻', label: 'Esconder', hint: 'Hide', disabled: !myTurn, onClick: () => cb?.('hide') },
        { glyph: '🤝', label: 'Ajudar', hint: 'Help aliado', disabled: !myTurn, onClick: () => cb?.('help') },
        { glyph: '🔗', label: 'Agarrar', hint: 'Grapple', disabled: !myTurn, onClick: () => cb?.('grapple') },
        { glyph: '💪', label: 'Empurrar', hint: 'Shove', disabled: !myTurn, onClick: () => cb?.('shove') },
      ];
    case 'magic':
      return [
        { glyph: '🔮', label: 'Lançar Magia', disabled: !myTurn, onClick: () => ctx.onCastSpell() },
      ];
    case 'social':
      return [
        { glyph: '🗣', label: 'Falar', hint: 'mid-combat', disabled: !myTurn, onClick: () => ctx.onAction('talk', '') },
      ];
    case 'more':
      return [
        { glyph: '🎒', label: 'Inventário', onClick: () => ctx.onInventory() },
        { glyph: '🧪', label: 'Usar Item', disabled: !myTurn, onClick: () => ctx.onAction('use-item', '') },
      ];
    default:
      return [];
  }
}

// Ω.9 — "Livre" abre modal bottom-sheet em vez de drill inline.
// Inline tampava a narração em portrait-narrow. Modal usa altura controlada,
// fecha com swipe-down/ESC, libera dock pra ações rápidas.
async function openCustomActionModal(ctx: ActionDockContext): Promise<void> {
  if (ctx.isDmThinking) return;
  const result = await inputDialog({
    title: '✎ Ação livre',
    text: 'Descreva o que seu personagem faz. O Mestre interpreta e responde.',
    placeholder: 'ex: "abro o baú devagar olhando pra ver se tem trap"',
    initialValue: dockState.customDetails,
    maxLength: 500,
    multiline: true,
    confirmText: 'Enviar ação',
    cancelText: 'Cancelar',
    validator: (v) => v.trim().length === 0 ? 'Descreva o que você faz.' : null,
  });
  if (result !== null && result.trim().length > 0) {
    dockState.customDetails = '';
    ctx.onCustomAction(result.trim());
  } else {
    // Cancelou — guarda rascunho pra próxima abertura
    if (result === null) {
      // Cancelou via backdrop/ESC — não muda rascunho
    } else {
      // Submit vazio — limpa
      dockState.customDetails = '';
    }
  }
}

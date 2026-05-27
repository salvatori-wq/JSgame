// JSgame · ο.1 — Status Ribbon mode-aware (pegada Uber).
// Em portrait-narrow, substitui o header full por uma ribbon densa de 1 linha
// que reflete o modo atual da campanha (exploration / combat / rest / error).
// Tap no corpo da ribbon expande pra header completo (modais quests/ach/npc).

import type { CampaignState, CharacterSheet } from '../../shared/types';
import { el, escapeHtml } from '../util';

export interface RibbonContext {
  state: CampaignState | null;
  character: CharacterSheet | null;
  /** Tap no corpo da ribbon — abre overflow menu/expansão de detalhes. */
  onExpand: (anchor: HTMLElement) => void;
  /** Tap no botão ← */
  onExit: () => void;
}

/**
 * Renderiza ribbon mode-aware. Estados:
 *  - 'combat'      → ⚔️ R{n} · Sua vez · ⏱{s} · ⚡✦↩️ ft
 *  - 'rest'        → 🌙 Repouso · {restores}
 *  - 'social'      → 🗣 NPC · atitude
 *  - 'exploration' → 🌲 Local · HP/Slots/XP
 *  - null/loading  → ⏳ Carregando…
 */
export function renderStatusRibbon(ctx: RibbonContext): HTMLElement {
  const { state, character } = ctx;
  const mode = inferMode(state);

  const root = el('header', { class: `status-ribbon status-ribbon-${mode}`, attrs: { 'aria-label': 'Status da campanha' } });

  // Botão Sair sempre acessível (1 tap)
  root.appendChild(el('button', {
    class: 'sr-exit',
    text: '←',
    attrs: { type: 'button', title: 'Sair', 'aria-label': 'Sair da campanha' },
    on: { click: () => ctx.onExit() },
  }));

  // Corpo da ribbon — denso, tap expande
  const body = el('button', {
    class: 'sr-body',
    attrs: { type: 'button', 'aria-label': 'Expandir detalhes' },
    on: { click: (e) => ctx.onExpand(e.currentTarget as HTMLElement) },
  });

  body.appendChild(renderBodyContent(mode, state, character));

  root.appendChild(body);

  // Indicador "expand" sutil
  root.appendChild(el('span', { class: 'sr-expand-glyph', text: '⋯', attrs: { 'aria-hidden': 'true' } }));

  return root;
}

function inferMode(state: CampaignState | null): 'loading' | 'combat' | 'rest' | 'social' | 'exploration' {
  if (!state) return 'loading';
  if (state.mode === 'combat' && state.combat?.active) return 'combat';
  if (state.mode === 'rest') return 'rest';
  if (state.mode === 'social') return 'social';
  return 'exploration';
}

function renderBodyContent(
  mode: ReturnType<typeof inferMode>,
  state: CampaignState | null,
  character: CharacterSheet | null,
): HTMLElement {
  if (mode === 'loading') {
    return el('span', { class: 'sr-text', text: '⏳ Carregando…' });
  }

  if (mode === 'combat' && state?.combat) {
    return renderCombatBody(state, character);
  }

  if (mode === 'rest') {
    return renderRestBody(state!, character);
  }

  if (mode === 'social') {
    return renderSocialBody(state!, character);
  }

  return renderExplorationBody(state!, character);
}

function renderCombatBody(state: CampaignState, character: CharacterSheet | null): HTMLElement {
  const combat = state.combat!;
  const currentTurn = combat.initiativeOrder[combat.currentTurnIndex];
  const isMyTurn = !!character && currentTurn?.id === character.id;
  const turnText = isMyTurn ? 'Sua vez' : `Vez de ${shorten(currentTurn?.name ?? '?', 12)}`;
  const economy = character && combat.actionEconomy?.[character.id];
  const economyGlyphs = renderEconomyGlyphs(economy);

  return el('span', { class: 'sr-text' }, [
    el('span', { class: 'sr-glyph', text: '⚔️' }),
    el('span', { class: 'sr-mode-label', text: `R${combat.round}` }),
    el('span', { class: 'sr-sep', text: '·' }),
    el('span', { class: `sr-turn ${isMyTurn ? 'is-my-turn' : ''}`, text: turnText }),
    economyGlyphs ? el('span', { class: 'sr-sep', text: '·' }) : null,
    economyGlyphs,
  ].filter(Boolean) as HTMLElement[]);
}

function renderEconomyGlyphs(economy: { action: boolean; bonusAction: boolean; reaction: boolean; movement: number } | null | undefined): HTMLElement | null {
  if (!economy) return null;
  const a = economy.action ? '⚡' : '·';
  const b = economy.bonusAction ? '✦' : '·';
  const r = economy.reaction ? '↩️' : '·';
  const move = economy.movement > 0 ? `${economy.movement}ft` : '';
  return el('span', { class: 'sr-economy', text: `${a}${b}${r} ${move}` });
}

function renderRestBody(state: CampaignState, character: CharacterSheet | null): HTMLElement {
  const hp = character ? `❤${character.currentHp}/${character.maxHp}` : '';
  return el('span', { class: 'sr-text' }, [
    el('span', { class: 'sr-glyph', text: '🌙' }),
    el('span', { class: 'sr-mode-label', text: 'Repouso' }),
    hp ? el('span', { class: 'sr-sep', text: '·' }) : null,
    hp ? el('span', { class: 'sr-hp', text: hp }) : null,
  ].filter(Boolean) as HTMLElement[]);
}

function renderSocialBody(state: CampaignState, character: CharacterSheet | null): HTMLElement {
  // V1: usamos o último NPC ativo de npcsMet se houver
  const recentNpc = state.npcsMet?.[state.npcsMet.length - 1];
  if (recentNpc) {
    return el('span', { class: 'sr-text' }, [
      el('span', { class: 'sr-glyph', text: '🗣' }),
      el('span', { class: 'sr-mode-label', text: shorten(recentNpc.name, 14) }),
      el('span', { class: 'sr-sep', text: '·' }),
      el('span', { class: `sr-attitude attitude-${recentNpc.attitude}`, text: attitudeGlyph(recentNpc.attitude) }),
    ]);
  }
  return renderExplorationBody(state, character);
}

function renderExplorationBody(state: CampaignState, character: CharacterSheet | null): HTMLElement {
  const loc = state.currentLocation || 'Em algum lugar';
  const hp = character ? `❤${character.currentHp}/${character.maxHp}` : '';
  const slots = character ? totalAvailableSlots(character) : null;
  const xp = character ? `${character.xp}xp` : '';

  const items: (HTMLElement | null)[] = [
    el('span', { class: 'sr-glyph', text: glyphForLocation(loc) }),
    el('span', { class: 'sr-mode-label', text: shorten(loc, 18) }),
  ];

  if (hp) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(el('span', { class: `sr-hp ${hpIsCritical(character!) ? 'is-critical' : ''}`, text: hp }));
  }
  if (slots && slots.max > 0) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(el('span', { class: 'sr-slots', text: `✦${slots.available}/${slots.max}` }));
  }
  if (xp) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(el('span', { class: 'sr-xp', text: xp }));
  }

  return el('span', { class: 'sr-text' }, items.filter(Boolean) as HTMLElement[]);
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function totalAvailableSlots(character: CharacterSheet): { available: number; max: number } {
  let available = 0;
  let max = 0;
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const slot = character.spellSlots?.[k];
    if (!slot) continue;
    max += slot.max;
    available += Math.max(0, slot.max - slot.used);
  }
  return { available, max };
}

function hpIsCritical(character: CharacterSheet): boolean {
  if (character.maxHp <= 0) return false;
  return character.currentHp / character.maxHp < 0.25;
}

function glyphForLocation(loc: string): string {
  const l = loc.toLowerCase();
  if (l.includes('caverna') || l.includes('cripta') || l.includes('masmorra')) return '🕳';
  if (l.includes('floresta') || l.includes('mata')) return '🌲';
  if (l.includes('cidade') || l.includes('vila') || l.includes('vilarejo')) return '🏘';
  if (l.includes('taverna') || l.includes('estalagem')) return '🍺';
  if (l.includes('castelo') || l.includes('fortaleza')) return '🏰';
  if (l.includes('templo') || l.includes('igreja')) return '⛪';
  if (l.includes('montanha') || l.includes('pico')) return '⛰';
  if (l.includes('rio') || l.includes('lago')) return '🌊';
  if (l.includes('desert')) return '🏜';
  if (l.includes('estrada') || l.includes('caminho')) return '🛤';
  return '📍';
}

function attitudeGlyph(attitude: 'amigavel' | 'neutro' | 'hostil' | 'misterioso'): string {
  switch (attitude) {
    case 'amigavel': return '😊 amigável';
    case 'hostil': return '😠 hostil';
    case 'misterioso': return '🕵 misterioso';
    default: return '😐 neutra';
  }
}

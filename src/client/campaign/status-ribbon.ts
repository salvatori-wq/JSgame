// JSgame · ο.1 — Status Ribbon mode-aware (pegada Uber).
// Em portrait-narrow, substitui o header full por uma ribbon densa de 1 linha
// que reflete o modo atual da campanha (exploration / combat / rest / error).
// Tap no corpo da ribbon expande pra header completo (modais quests/ach/npc).

import type { CampaignState, CharacterSheet } from '../../shared/types';
import { el, escapeHtml } from '../util';
import { effectiveArmorClass } from '../../dnd/active-buffs';

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

  // BUG-Ω.4 — Removido `sr-expand-glyph` "⋯" (decorativo, sem click handler,
  // era IRMÃO de .sr-body em vez de filho). Player tap nele esperando abrir
  // menu, nada acontecia. O menu "Mais" funcional já existe no slot 5 do
  // bottom-tab-bar. Toda ribbon agora é a área clicável via .sr-body.

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
  // W3-DnD — Concentração visível mesmo em combate (consultor D&D pediu)
  const concEl = renderConcentrationChip(character);

  const items: (HTMLElement | null)[] = [
    el('span', { class: 'sr-glyph', text: '⚔️' }),
    el('span', { class: 'sr-mode-label', text: `R${combat.round}` }),
    el('span', { class: 'sr-sep', text: '·' }),
    el('span', { class: `sr-turn ${isMyTurn ? 'is-my-turn' : ''}`, text: turnText }),
  ];

  // U1 — HP/CA do PRÓPRIO PJ na ribbon de combate. Antes só turno + economia;
  // no momento de maior risco o jogador tinha que abrir a party panel pra ver
  // a vida. HP é a info #1 em luta (cor crítica <25% via is-critical).
  if (character) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(el('span', {
      class: `sr-hp ${hpIsCritical(character) ? 'is-critical' : ''}`,
      text: `❤${character.currentHp}/${character.maxHp}`,
    }));
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(el('span', { class: 'sr-ac', text: `🛡${effectiveArmorClass(character)}`, attrs: { title: 'Classe de Armadura (com buffs ativos)' } }));
  }

  if (economyGlyphs) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(economyGlyphs);
  }
  if (concEl) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(concEl);
  }

  return el('span', { class: 'sr-text' }, items.filter(Boolean) as HTMLElement[]);
}

/**
 * W3-DnD — Sprint W: Concentration visible chip pro status ribbon.
 * Quando character.concentratingOn é set (F25), mostra "🧠 [Spell]" no
 * ribbon. Consultor D&D: "F25 já implementou concentration mas plano W não
 * tinha UI. Perder Bless mid-combat por falhar CON save = drama puro D&D".
 * Exportado pra tests.
 */
export function renderConcentrationChip(character: CharacterSheet | null): HTMLElement | null {
  if (!character) return null;
  const spellId = character.concentratingOn;
  if (!spellId) return null;
  // SpellId vem como "bless" → display "Bless" (1ª letra maiúscula).
  const displayName = spellId.charAt(0).toUpperCase() + spellId.slice(1).replace(/[-_]/g, ' ');
  return el('span', {
    class: 'sr-conc',
    text: `🧠 ${displayName}`,
    attrs: {
      title: `Concentrando: ${displayName}. Receber dano dispara save Constituição (DC max(10, dano/2)). Falhar = magia perdida.`,
      'aria-label': `Concentrando em ${displayName}`,
    },
  });
}

function renderEconomyGlyphs(economy: { action: boolean; bonusAction: boolean; reaction: boolean; movement: number } | null | undefined): HTMLElement | null {
  if (!economy) return null;
  const a = economy.action ? '⚡' : '·';
  const b = economy.bonusAction ? '✦' : '·';
  const r = economy.reaction ? '↩️' : '·';
  // O2.1 — Metros primeiro (PT-BR). 1 quadrado = 1.5m = 5ft (glossary alinhado).
  const moveM = economy.movement > 0 ? `${Math.round(economy.movement * 0.3 * 10) / 10}m` : '';
  return el('span', { class: 'sr-economy', text: `${a}${b}${r} ${moveM}` });
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

  // N3.1 — Quando há pendingCheck ativo PRO PLAYER, glyph troca pra 🎲 +
  // ribbon ganha class .is-pending-roll (border pulse dourado). Sinaliza
  // "tem teste rolando, não esqueci de você". Saving throw também aciona.
  const hasPendingForMe = !!(
    (state.pendingCheck && state.pendingCheck.playerId === character?.id) ||
    (state.pendingSave && state.pendingSave.playerId === character?.id)
  );
  const glyph = hasPendingForMe ? '🎲' : glyphForLocation(loc);

  // M1.3 — Location ganha .sr-loc com text-overflow:ellipsis fluido (CSS) +
  // title attr com texto completo (tooltip desktop, accessible mobile).
  // shorten() removido: layout flex distribui largura entre loc + stats.
  const items: (HTMLElement | null)[] = [
    el('span', { class: `sr-glyph${hasPendingForMe ? ' is-pending-roll' : ''}`, text: glyph }),
    el('span', { class: 'sr-mode-label sr-loc', text: loc, attrs: { title: loc, 'aria-label': loc } }),
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
  // W3-DnD — concentração visível também fora de combate
  const concEl = renderConcentrationChip(character);
  if (concEl) {
    items.push(el('span', { class: 'sr-sep', text: '·' }));
    items.push(concEl);
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

// Sprint Φ.3 — SpellCard D&D 5e autêntico.
// Cards de magia com cores e ícones por escola (8 escolas oficiais).
// Layout: school icon + level → nome + meta → V/S/M components → description.
// Usado em cast-spell-modal (compact) + tooltips/details (full).

import { el, escapeHtml } from '../util';
import type { SpellDef, SpellSchool } from '../../dnd/spells';

export interface RenderSpellCardOpts {
  compact?: boolean;       // se true: layout 1-row mais denso (cs-modal)
  canCast?: boolean;       // se false: dim + cursor not-allowed
  onClick?: () => void;    // click handler (apenas quando canCast)
}

export function renderSpellCard(sp: SpellDef, opts: RenderSpellCardOpts = {}): HTMLElement {
  const { compact = false, canCast = true, onClick } = opts;
  const variant = compact ? 'sc-card-compact' : 'sc-card-full';
  const disabledCls = !canCast ? 'is-disabled' : '';
  const schoolClass = `sc-school-${sp.school}`;
  const card = el('div', {
    class: `sc-card ${variant} ${schoolClass} ${disabledCls}`,
    attrs: { 'data-school': sp.school, 'data-level': String(sp.level) },
    on: canCast && onClick ? { click: onClick } : undefined,
  });

  // ── School badge: ícone + cor ─────────────────────────────────────────
  card.appendChild(el('div', { class: 'sc-school-badge', attrs: { title: schoolLabel(sp.school) } }, [
    el('span', { class: 'sc-school-icon', text: schoolIcon(sp.school) }),
  ]));

  // ── Level chip ────────────────────────────────────────────────────────
  card.appendChild(el('span', {
    class: 'sc-level-chip',
    text: sp.level === 0 ? 'TRUQUE' : `Nv ${sp.level}`,
  }));

  // ── Header (nome + meta) ──────────────────────────────────────────────
  const head = el('div', { class: 'sc-head' });
  head.appendChild(el('h4', { class: 'sc-name', text: sp.name }));
  head.appendChild(el('div', { class: 'sc-subline', text: `${schoolLabel(sp.school)} · ${sp.castingTime}` }));
  card.appendChild(head);

  // ── Stats grid ────────────────────────────────────────────────────────
  const stats = el('div', { class: 'sc-stats' });
  stats.appendChild(renderStat('Alcance', sp.range));
  stats.appendChild(renderStat('Componentes', sp.components));
  stats.appendChild(renderStat('Duração', sp.duration));
  card.appendChild(stats);

  // ── Tags row (concentração / ritual) ──────────────────────────────────
  const tags: HTMLElement[] = [];
  if (sp.concentration) tags.push(el('span', { class: 'sc-tag is-conc', text: '◇ Concentração' }));
  if (sp.ritual) tags.push(el('span', { class: 'sc-tag is-ritual', text: '⚏ Ritual' }));
  if (tags.length > 0) {
    const tagRow = el('div', { class: 'sc-tags' });
    for (const t of tags) tagRow.appendChild(t);
    card.appendChild(tagRow);
  }

  // ── Description ───────────────────────────────────────────────────────
  card.appendChild(el('p', { class: 'sc-desc', text: sp.description }));

  // ── Upcast hint (se houver upcastDice) ────────────────────────────────
  if (sp.upcastDice && sp.level > 0) {
    const up = el('p', { class: 'sc-upcast' });
    up.innerHTML = `<span class="sc-upcast-label">Em níveis mais altos.</span> ${escapeHtml(`Cada slot acima do nv ${sp.level} adiciona ${sp.upcastDice}.`)}`;
    card.appendChild(up);
  }

  return card;
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers (testáveis sem DOM)
// ════════════════════════════════════════════════════════════════════════════

export function schoolLabel(school: SpellSchool): string {
  switch (school) {
    case 'abjuracao':    return 'Abjuração';
    case 'adivinhacao':  return 'Adivinhação';
    case 'conjuracao':   return 'Conjuração';
    case 'encantamento': return 'Encantamento';
    case 'evocacao':     return 'Evocação';
    case 'ilusao':       return 'Ilusão';
    case 'necromancia':  return 'Necromancia';
    case 'transmutacao': return 'Transmutação';
  }
}

export function schoolIcon(school: SpellSchool): string {
  switch (school) {
    case 'abjuracao':    return '🛡';   // escudo protetor
    case 'adivinhacao':  return '👁';   // olho que vê
    case 'conjuracao':   return '✨';   // criação do nada
    case 'encantamento': return '💗';   // charme/mente
    case 'evocacao':     return '🔥';   // energia bruta
    case 'ilusao':       return '🌀';   // distorção
    case 'necromancia':  return '💀';   // morte
    case 'transmutacao': return '🔮';   // mudança forma
  }
}

export function schoolToken(school: SpellSchool): string {
  return `--dnd-school-${school === 'abjuracao' ? 'abjuration'
    : school === 'adivinhacao' ? 'divination'
    : school === 'conjuracao' ? 'conjuration'
    : school === 'encantamento' ? 'enchantment'
    : school === 'evocacao' ? 'evocation'
    : school === 'ilusao' ? 'illusion'
    : school === 'necromancia' ? 'necromancy'
    : 'transmutation'}`;
}

// Detecta V/S/M nos components (string PT-BR "V, S, M (sal)" / "V, S" / etc).
// Retorna array com flags pra ícones.
export function parseComponents(components: string): { v: boolean; s: boolean; m: boolean; mDescription?: string } {
  const upper = components.toUpperCase();
  const v = /\bV\b/.test(upper);
  const s = /\bS\b/.test(upper);
  const m = /\bM\b/.test(upper);
  let mDescription: string | undefined;
  if (m) {
    const match = components.match(/M\s*\(([^)]*)\)/i);
    if (match && match[1]) mDescription = match[1].trim();
  }
  return { v, s, m, mDescription };
}

// ════════════════════════════════════════════════════════════════════════════
// Internal render helpers
// ════════════════════════════════════════════════════════════════════════════

function renderStat(label: string, value: string): HTMLElement {
  return el('div', { class: 'sc-stat' }, [
    el('div', { class: 'sc-stat-label', text: label }),
    el('div', { class: 'sc-stat-value', text: value }),
  ]);
}

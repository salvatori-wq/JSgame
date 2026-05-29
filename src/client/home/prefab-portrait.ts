// JSgame · Fase 1B — Retrato de personagem (medalhão).
//
// Zero-budget, zero asset baixado: compõe o retrato com o que já temos —
// ícone de CLASSE (game-icons.net SVG, Fase 1A) sobre a AURA da classe, com
// um pequeno glyph de RAÇA no canto. Resultado: cada prefab/PJ ganha um
// "rosto" reconhecível e distinto, consistente com o resto da arte do jogo.
//
// Usado na home (cards de prefab) e reutilizável em party/ficha.

import { el } from '../util';
import { iconEl, classIconName } from '../icons/game-icons';
import { portraitFor } from '../../dnd/portrait';
import type { RaceId } from '../../dnd/races';
import type { ClassId } from '../../dnd/classes';

export interface PrefabPortraitOpts {
  raceId: RaceId;
  classId: ClassId;
  /** classe(s) CSS extra no container */
  className?: string;
  /** rótulo acessível (ex: "Borin Forjarocha") */
  ariaLabel?: string;
}

/**
 * Medalhão circular: aura da classe (radial) + ícone de classe (SVG) centrado +
 * glyph de raça num badge. Fallback do ícone de classe é o emoji de classe
 * (portrait.ts) — nunca quebra.
 */
export function renderPrefabPortrait(opts: PrefabPortraitOpts): HTMLElement {
  const spec = portraitFor({ raceId: opts.raceId, classId: opts.classId });
  const root = el('div', {
    class: opts.className ? `pf-portrait ${opts.className}` : 'pf-portrait',
    attrs: {
      style: `--pf-aura:${spec.aura}`,
      role: 'img',
      'aria-label': opts.ariaLabel ?? `${opts.raceId} ${opts.classId}`,
      title: opts.ariaLabel ?? `${opts.raceId} ${opts.classId}`,
    },
  });
  // Ícone de classe (SVG) — herda cor clara via CSS; fallback no emoji de classe.
  root.appendChild(iconEl(classIconName(opts.classId), spec.class, { className: 'pf-portrait-class' }));
  // Badge de raça (emoji) — canto inferior direito.
  root.appendChild(el('span', { class: 'pf-portrait-race', text: spec.race, attrs: { 'aria-hidden': 'true' } }));
  return root;
}

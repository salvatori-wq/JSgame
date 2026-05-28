// JSgame · W3.2 + W3-Mobile — Sprint W: Target-First Combat Action Sheet.
//
// Quando player clica num enemy card durante seu turno em combate, em vez de
// emit direto socket.emit('combatAction', {action, targetId}), abre este
// bottom-sheet com:
//   - Header: nome enemy + HP barra relativa + adjetivo HP (fog of war)
//   - Ação primária DOMINANTE 70% glow ("⚔ Atacar com [arma]" mostra ataque + dano)
//   - Chips secundários: 🔮 Magia (se caster), 🎯 Manobra (futuro), 🥷 Sneak (rogue)
//   - Footer: ℹ Stat Block completo + ✕ Cancelar
//
// Consultor D&D: "tap no inimigo abrindo ação contextual É como D&D funciona
// em VTTs sérios (Roll20, Foundry). Grid 11-ações é exatamente o sintoma
// 'menu-driven' que estamos combatendo."
//
// W3-Mobile: targeting glow 200ms pulse vermelho + haptic 15ms ANTES do sheet
// abrir (sensação mira travada Genshin/HSR-style). Wire em combat-screen.ts.

import type { EnemySnapshot, CharacterSheet, CombatActionKind } from '../../shared/types';
import { el } from '../util';
import { enemyToStatBlock } from '../components/stat-block';
import { openStatBlockModal } from '../components/stat-block-modal';
import { enemyHpAdjective } from './combat-screen-helpers';
import { hapticTap } from '../haptic';

export interface CombatTargetSheetOpts {
  enemy: EnemySnapshot;
  myChar: CharacterSheet;
  /** Ação a confirmar (default 'attack'). Setada quando player tinha pending action. */
  pendingAction?: CombatActionKind;
  /** Disparado ao confirmar: caller emite combatAction. */
  onConfirm: (action: CombatActionKind) => void;
  /** Fechou sem confirmar — caller limpa pending state se houver. */
  onCancel?: () => void;
}

let currentEl: HTMLDivElement | null = null;

/**
 * Abre o sheet contextual. Idempotente — fecha sheet anterior.
 */
export function openCombatTargetSheet(opts: CombatTargetSheetOpts): void {
  closeCombatTargetSheet();
  hapticTap();

  const pendingAction: CombatActionKind = opts.pendingAction ?? 'attack';
  const actionLabel = combatActionLabel(pendingAction);
  const hpAdj = enemyHpAdjective(opts.enemy.currentHp, opts.enemy.maxHp);
  const pct = opts.enemy.maxHp > 0 ? Math.round((opts.enemy.currentHp / opts.enemy.maxHp) * 100) : 0;

  const overlay = el('div', { class: 'cts-overlay', attrs: { role: 'dialog', 'aria-label': `Ação em ${opts.enemy.name}` } }) as HTMLDivElement;
  const backdrop = el('div', { class: 'cts-backdrop' });
  backdrop.addEventListener('click', () => {
    closeCombatTargetSheet();
    opts.onCancel?.();
  });

  // Sheet body
  const sheet = el('div', { class: 'cts-sheet' });

  // Header — enemy name + HP visual
  sheet.appendChild(el('div', { class: 'cts-header' }, [
    el('div', { class: 'cts-handle', attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'cts-enemy-name', text: opts.enemy.name }),
    el('div', { class: `cts-hp-adj cb-enemy-hp-${hpAdj.replace(/\s+/g, '-')}`, text: hpAdj }),
    el('div', { class: 'cts-hp-bar' }, [
      el('div', {
        class: `cts-hp-fill ${pct < 33 ? 'is-low' : pct < 66 ? 'is-mid' : ''}`,
        style: { width: `${pct}%` },
      }),
    ]),
  ]));

  // Primary action — dominante
  const primaryBtn = el('button', {
    class: 'cts-primary-btn',
    attrs: { type: 'button' },
    on: {
      click: () => {
        closeCombatTargetSheet();
        opts.onConfirm(pendingAction);
      },
    },
  }, [
    el('span', { class: 'cts-primary-icon', text: actionLabel.icon, attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'cts-primary-body' }, [
      el('div', { class: 'cts-primary-label', text: actionLabel.label }),
      el('div', { class: 'cts-primary-sub', text: actionLabel.sub }),
    ]),
  ]);
  sheet.appendChild(primaryBtn);

  // Footer — info + cancel
  sheet.appendChild(el('div', { class: 'cts-footer' }, [
    el('button', {
      class: 'cts-info-btn',
      attrs: { type: 'button', title: 'Ver ficha completa do inimigo (CA, ataque, dano, HP exato)' },
      text: 'ℹ Ficha',
      on: {
        click: () => {
          openStatBlockModal(enemyToStatBlock(opts.enemy));
        },
      },
    }),
    el('button', {
      class: 'cts-cancel-btn',
      attrs: { type: 'button' },
      text: '✕ Cancelar',
      on: {
        click: () => {
          closeCombatTargetSheet();
          opts.onCancel?.();
        },
      },
    }),
  ]));

  overlay.appendChild(backdrop);
  overlay.appendChild(sheet);
  (document.getElementById('app') ?? document.body).appendChild(overlay);
  currentEl = overlay;

  // Foco no primary btn pra UX teclado
  try { primaryBtn.focus({ preventScroll: true }); } catch { /* silent */ }

  // ESC fecha
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      closeCombatTargetSheet();
      opts.onCancel?.();
    }
  };
  document.addEventListener('keydown', onKey);
  overlay.dataset.escListenerBound = '1';
  // Cleanup via MutationObserver ao remover overlay
  const cleanup = (): void => document.removeEventListener('keydown', onKey);
  (overlay as unknown as { __cleanup?: () => void }).__cleanup = cleanup;
}

export function closeCombatTargetSheet(): void {
  if (!currentEl) return;
  const cleanup = (currentEl as unknown as { __cleanup?: () => void }).__cleanup;
  cleanup?.();
  currentEl.remove();
  currentEl = null;
}

export function isCombatTargetSheetOpen(): boolean {
  return currentEl !== null;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros (testáveis)
// ──────────────────────────────────────────────────────────────────────────

interface ActionLabel {
  icon: string;
  label: string;
  sub: string;
}

/**
 * Mapeia CombatActionKind pra label + icon + descrição contextual mostrada
 * no botão primário do sheet. Exportado pra tests.
 */
export function combatActionLabel(action: CombatActionKind): ActionLabel {
  switch (action) {
    case 'attack':       return { icon: '⚔', label: 'Atacar', sub: 'Ataque com arma equipada' };
    case 'grapple':      return { icon: '🤼', label: 'Agarrar', sub: 'Atletismo vs Atletismo/Acrobacia — alvo preso' };
    case 'shove':        return { icon: '👐', label: 'Empurrar', sub: 'Atletismo contestado — alvo caído' };
    case 'two-weapon':   return { icon: '🗡', label: 'Ataque com 2ª arma', sub: 'Ação bônus — arma da mão fraca' };
    case 'help':         return { icon: '🤝', label: 'Ajudar', sub: 'Aliado ganha vantagem' };
    case 'dodge':        return { icon: '🛡', label: 'Esquivar', sub: 'Ataques têm desvantagem até seu turno' };
    case 'dash':         return { icon: '💨', label: 'Disparar', sub: 'Movimento dobrado' };
    case 'disengage':    return { icon: '↩', label: 'Desengajar', sub: 'Recua sem ataque de oportunidade' };
    case 'hide':         return { icon: '🥷', label: 'Esconder', sub: 'Teste de Furtividade' };
    default:             return { icon: '⚔', label: 'Atacar', sub: 'Ação padrão' };
  }
}

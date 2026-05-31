// QA-lançamento (Ciclo Combate) — guards dos fixes visuais do Inspetor Visual.
//
// Bugs reproduzidos no preview real (390×844, combate vivo):
//  1) z-inversão: "ℹ Ficha" no combat-target-sheet (.cts-overlay z-9400) abria a
//     ficha do inimigo ATRÁS do sheet (.stat-block-modal-overlay z-modal=9000),
//     então o player tocava "Ficha" e não via NADA. Fix: opção `elevated` sobe o
//     z-index pra 9450 (acima do sheet, abaixo do dado 9500).
//  2) hit-target: a ℹ do enemy card tinha 26×26px — abaixo do piso de toque 44px.
//     Fix: ::after transparente em portrait expande a área tocável pra ~44px sem
//     crescer o círculo visual (não cobre o nome/glyph do inimigo).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const statBlockCss = readFileSync(resolve(here, '../../styles/stat-block.css'), 'utf8');
const ctsCss = readFileSync(resolve(here, '../../styles/combat-target-sheet.css'), 'utf8');

describe('QA-lançamento Combate — Inspetor Visual', () => {
  it('FIX z-inversão: .is-elevated tem z-index acima do combat-target-sheet (9400)', () => {
    // a ficha elevada precisa ficar acima do sheet
    expect(statBlockCss).toMatch(
      /\.stat-block-modal-overlay\.is-elevated\s*\{[^}]*z-index:\s*9450/,
    );
    // sanity: o sheet realmente está em 9400 (a premissa do fix)
    expect(ctsCss).toMatch(/\.cts-overlay\s*\{[^}]*z-index:\s*9400/);
    // e fica abaixo do dado (9500) pra não tapar a rolagem
    expect(9450).toBeLessThan(9500);
  });

  it('FIX hit-target: ℹ ganha área de toque expandida em portrait (::after inset)', () => {
    expect(statBlockCss).toMatch(
      /is-portrait-narrow\s+\.cb-enemy-info-btn::after\s*\{[^}]*inset:\s*-9px/,
    );
  });
});

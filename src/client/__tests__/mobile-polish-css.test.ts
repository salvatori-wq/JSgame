// MP2+ — Snapshot do CSS mobile-polish.
// Lê os arquivos CSS e confirma que seletores críticos pra mobile-narrow estão presentes.
// Garante que regras não regridem em edições futuras.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_DIR = resolve(__dirname, '../styles');

function readCss(filename: string): string {
  return readFileSync(resolve(CSS_DIR, filename), 'utf-8');
}

describe('MP1 — _tokens.css mobile tokens', () => {
  const css = readCss('_tokens.css');

  it('expõe tokens --m-* de spacing/hit/modal', () => {
    expect(css).toMatch(/--m-padding-screen:\s*12px/);
    expect(css).toMatch(/--m-padding-modal:\s*14px/);
    expect(css).toMatch(/--m-hit-min:\s*40px/);
    expect(css).toMatch(/--m-hit-comfortable:\s*44px/);
    expect(css).toMatch(/--m-modal-max-h:\s*90dvh/);
    expect(css).toMatch(/--m-modal-radius:\s*12px/);
  });

  it('aplica override de --gap-loose em is-portrait-narrow', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s*\{\s*--gap-loose:\s*var\(--m-padding-screen\)/);
  });
});

describe('MP1 — m-layout.css helpers', () => {
  const css = readCss('m-layout.css');

  it('define .m-stack e .m-row com gap consistente', () => {
    expect(css).toMatch(/\.m-stack\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.m-row\s*\{[^}]*flex-direction:\s*row/);
  });

  it('define .m-hit e .m-hit-cta com hit target enforced', () => {
    expect(css).toMatch(/\.m-hit\s*\{[^}]*min-width:\s*var\(--m-hit-min\)[^}]*min-height:\s*var\(--m-hit-min\)/);
    expect(css).toMatch(/\.m-hit-cta\s*\{[^}]*min-width:\s*var\(--m-hit-comfortable\)/);
  });

  it('aplica pattern .m-modal bottom-sheet em portrait-narrow', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.m-modal\s*\{[^}]*100vw[^}]*var\(--m-modal-max-h\)/);
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.m-modal-header\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/);
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.m-modal-footer\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/);
  });

  it('respeita prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('insere safe-area-inset-bottom no footer', () => {
    expect(css).toMatch(/env\(safe-area-inset-bottom/);
  });
});

describe('MP2 — campaign-core.css header mobile', () => {
  const css = readCss('campaign-core.css');

  it('agrupa chips secundários via .camp-header-chips (display:contents desktop)', () => {
    expect(css).toMatch(/\.camp-header-chips\s*\{\s*display:\s*contents/);
  });

  it('header vira 2-row em portrait-narrow com grid-template-areas', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.camp-header\s*\{[^}]*grid-template-areas/);
    expect(css).toMatch(/"back\s+title\s+menu"/);
    expect(css).toMatch(/"chips\s+chips\s+chips"/);
  });

  it('camp-header-chips vira scroll-x em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.camp-header\s*>\s*\.camp-header-chips\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('título com text-overflow ellipsis em mobile (anti-truncate)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.camp-title\s+h2\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('narration cresce com viewport em mobile (sem max-height fixo)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.camp-narration\s*\{[^}]*max-height:\s*none/);
  });

  it('action buttons mobile hit ≥44px', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.camp-action-btn\s*\{[^}]*min-height:\s*var\(--m-hit-comfortable/);
  });

  it('skill-check overlay roll button hit ≥44px em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.sc-roll-btn\s*\{[^}]*min-height:\s*var\(--m-hit-comfortable/);
  });
});

describe('MP3 — m-layout.css aplicado aos 7 modais em portrait-narrow', () => {
  const css = readCss('m-layout.css');

  it('overlays alinham flex-end (bottom-sheet) em 7 modais', () => {
    // Tem que cobrir todas as 7 classes de overlay/backdrop
    expect(css).toMatch(/\.inv-modal-overlay/);
    expect(css).toMatch(/\.shop-modal-overlay/);
    expect(css).toMatch(/\.cs-modal-overlay/);
    expect(css).toMatch(/\.mem-modal-overlay/);
    expect(css).toMatch(/\.ach-modal-overlay/);
    expect(css).toMatch(/\.npc-modal-overlay/);
    expect(css).toMatch(/\.qlm-backdrop/);
    // Regra inclui align-items flex-end
    expect(css).toMatch(/align-items:\s*flex-end\s*!important/);
  });

  it('cards de modal viram full-width + 90dvh + bottom border-radius', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.inv-modal,[\s\S]*?\.qlm-card[\s\S]*?\{[\s\S]*?width:\s*100vw\s*!important/);
    expect(css).toMatch(/border-radius:\s*var\(--m-modal-radius\)\s+var\(--m-modal-radius\)\s+0\s+0\s+!important/);
    expect(css).toMatch(/animation:\s*m-sheet-up/);
  });

  it('headers viram sticky em 4 modais com header explícito', () => {
    expect(css).toMatch(/\.inv-modal-header[\s\S]*?\.cs-modal-header[\s\S]*?\.mem-modal-header[\s\S]*?\.qlm-header[\s\S]*?\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0/);
  });

  it('bodies/lists viram flex:1 overflow:auto', () => {
    expect(css).toMatch(/\.inv-modal-list[\s\S]*?\.cs-modal-list[\s\S]*?\.mem-modal-list[\s\S]*?\.ach-modal-body[\s\S]*?\.npc-modal-body[\s\S]*?\.shop-content[\s\S]*?\{[\s\S]*?flex:\s*1\s+1\s+auto[\s\S]*?overflow-y:\s*auto/);
  });

  it('close buttons hit ≥40px em todos os modais', () => {
    expect(css).toMatch(/\.inv-modal-close[\s\S]*?\.cs-modal-close[\s\S]*?\.mem-modal-close[\s\S]*?\.qlm-close-btn[\s\S]*?\{[\s\S]*?min-width:\s*var\(--m-hit-min/);
  });

  it('shop/inv action buttons hit ≥40px em mobile', () => {
    expect(css).toMatch(/\.inv-action-btn[\s\S]*?\.shop-buy-btn[\s\S]*?\.shop-sell-btn[\s\S]*?min-height:\s*var\(--m-hit-min/);
  });

  it('grids viram 1-col em mobile (inv/shop/cs/npc)', () => {
    expect(css).toMatch(/\.inv-grid[\s\S]*?\.shop-grid[\s\S]*?\.cs-modal-grid[\s\S]*?\.npc-grid[\s\S]*?\{[\s\S]*?grid-template-columns:\s*1fr\s*!important/);
  });

  it('achievement tabs viram scroll-x em mobile', () => {
    expect(css).toMatch(/\.ach-tabs[\s\S]*?overflow-x:\s*auto/);
  });

  it('reduced-motion kill animation pra todos modais', () => {
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*?\.inv-modal,[\s\S]*?\.qlm-card[\s\S]*?animation:\s*none/);
  });
});

describe('MP2 — modals.css combat mobile', () => {
  const css = readCss('modals.css');

  it('cb-enemies vira 1-col em mobile (era 2-col)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-enemies\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('cb-actions-grid vira 2-col em mobile (era 3-col)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-actions-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  });

  it('cb-action-btn hit ≥44px em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-action-btn\s*\{[^}]*min-height:\s*var\(--m-hit-comfortable/);
  });

  it('cb-initiative ganha mask gradient pra indicar scroll-x', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-initiative\s*\{[^}]*mask-image:\s*linear-gradient/);
  });

  it('cb-economy vira grid 2-col em mobile (não wrap)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-economy\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*1fr\s+1fr/);
  });

  it('cb-enemy-desc clamp 2 linhas em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.cb-enemy-desc\s*\{[^}]*-webkit-line-clamp:\s*2/);
  });
});

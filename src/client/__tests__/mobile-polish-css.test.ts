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

  it('expõe tokens --m-* de spacing (fluidos F1) + hit/modal (pisos fixos)', () => {
    // Responsivo F1 — padding/gap agora fluidos (clamp vw); pisos de toque fixos.
    expect(css).toMatch(/--m-padding-screen:\s*clamp\(/);
    expect(css).toMatch(/--m-padding-modal:\s*clamp\(/);
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

describe('MP4 — wizard.css mobile (Sessão 4)', () => {
  const css = readCss('wizard.css');

  it('cards de wizard padding compacto + desc line-clamp 3 em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.wc-desc\s*\{[\s\S]*?-webkit-line-clamp:\s*3/);
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.wiz-card\s*\{[\s\S]*?padding:\s*10px\s+12px/);
  });

  it('CTAs wizard hit ≥44px em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.wiz-back,[\s\S]*?\.wiz-cta\s*\{[\s\S]*?min-height:\s*var\(--m-hit-comfortable/);
  });

  it('wiz-footer-sticky respeita safe-area-inset-bottom', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.wiz-footer-sticky\s*\{[\s\S]*?env\(safe-area-inset-bottom/);
  });
});

describe('MP4 — sheet.css mobile (Sessão 4)', () => {
  const css = readCss('sheet.css');

  it('sheet-top-row vira 3-col fixo em mobile (era auto-fit)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.sheet-top-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  });

  it('sheet-attrs vira 3-col em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.sheet-attrs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  });

  it('sheet-skills vira 1-col em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.sheet-skills\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  });

  it('sheet-print hit ≥40px em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.sheet-print\s*\{[\s\S]*?min-width:\s*var\(--m-hit-min/);
  });
});

describe('MP4 — lobby.css mobile (Sessão 4)', () => {
  const css = readCss('lobby.css');

  it('ready-card vira sticky bottom em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.lobby-ready-card\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/);
  });

  it('start-btn hit ≥44px CTA em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.lobby-start-btn\s*\{[\s\S]*?min-height:\s*var\(--m-hit-comfortable/);
  });

  it('player-row hit ≥40px em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.lobby-player-row\s*\{[\s\S]*?min-height:\s*var\(--m-hit-min/);
  });
});

describe('MP4 — campaign-party.css profile mobile (Sessão 4)', () => {
  const css = readCss('campaign-party.css');

  it('profile-summary vira sticky em mobile (S2.3 offset 0 → 52, abaixo do header)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.profile-summary\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*52px/);
  });

  it('profile-section-h vira sticky abaixo do summary (S2.3 offset 92 → 142)', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.profile-section-h\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*142px/);
  });
});

describe('MP4 — m-layout.css toques finais (Sessão 4)', () => {
  const css = readCss('m-layout.css');

  it('toast container respeita env safe-area-inset-bottom em mobile', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s+\.toast-container\s*\{[\s\S]*?env\(safe-area-inset-bottom/);
  });

  it('achievement toast vira top-banner em mobile', () => {
    expect(css).toMatch(/\.achievement-toast[\s\S]*?\.ach-toast[\s\S]*?\{[\s\S]*?top:\s*calc\(/);
  });

  it('tap-highlight-color transparent aplicado em ≥10 classes interativas', () => {
    // Pega o bloco grande de tap-highlight-color: transparent
    const matches = css.match(/-webkit-tap-highlight-color:\s*transparent/g);
    expect(matches).not.toBeNull();
    // Bloco transversal + bloco do .m-* helpers = ao menos 2 ocorrências; selectors cobertos contam classes diferentes
    const blockMatch = css.match(/(body\.is-portrait-narrow\s+\.[\w-]+,?\s*)+\{\s*-webkit-tap-highlight-color:\s*transparent;\s*\}/);
    expect(blockMatch).not.toBeNull();
    expect(blockMatch![0].split(',').length).toBeGreaterThanOrEqual(10);
  });

  it('body scroll-padding-bottom em mobile pra sticky footers', () => {
    expect(css).toMatch(/body\.is-portrait-narrow\s*\{\s*scroll-padding-bottom:\s*80px/);
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

describe('M1 — m-camp-dock + status-ribbon + campaign-core CSS', () => {
  const dock = readCss('m-camp-dock.css');
  const ribbon = readCss('status-ribbon.css');
  const core = readCss('campaign-core.css');

  // Responsivo F2 — o cap rígido 16vh virou clamp(54px,16vh,110px): tela curta
  // não esmaga, tela alta não desperdiça (cap). O 16vh segue no meio do clamp.
  it('M1.1/F2 — slot party.is-solo tem max-height fluido clamp(…16vh…)', () => {
    expect(dock).toMatch(/\.ch-slot-party\.is-solo\s*\{[^}]*max-height:\s*clamp\([^)]*16vh[^)]*\)/);
  });

  it('M1.1 — dock-attention keyframe + classe pulse one-shot', () => {
    expect(dock).toMatch(/@keyframes\s+dock-attention-once/);
    expect(dock).toMatch(/\.ch-slot-main-content\.is-dock-attention\s*\{[^}]*animation:\s*dock-attention-once/);
  });

  it('M1.1 — prefers-reduced-motion override dock-attention', () => {
    expect(dock).toMatch(/prefers-reduced-motion[^}]+\.ch-slot-main-content\.is-dock-attention/);
  });

  it('M1.3 — .sr-loc com flex 1 1 auto + min-width 0 pra truncate fluido', () => {
    expect(ribbon).toMatch(/\.sr-loc\s*\{[^}]*flex:\s*1\s+1\s+auto/);
    expect(ribbon).toMatch(/\.sr-loc\s*\{[^}]*min-width:\s*0/);
  });

  it('M1.2 — .sc-skip-btn estilo sutil link-like', () => {
    expect(core).toMatch(/\.sc-skip-btn\s*\{[^}]*font-style:\s*italic/);
    expect(core).toMatch(/\.sc-skip-btn\s*\{[^}]*text-decoration:\s*underline\s+dotted/);
  });

  it('M2.1 — .cn-chip-action-icon estilo distinto do dado', () => {
    expect(core).toMatch(/\.cn-chip-action-icon\s*\{[^}]*font-size:\s*13px/);
  });

  // W1.2 — Sprint W substitui M2.2 grid 2-col por flex column stack single
  // (dado protagonista 140px no centro, chips em grid 2x abaixo).
  it('W1.2 — sc-stage em portrait-narrow vira flex column (dado protagonista)', () => {
    expect(core).toMatch(/body\.is-portrait-narrow\s+\.sc-stage\s*\{[\s\S]*?display:\s*flex/);
    expect(core).toMatch(/body\.is-portrait-narrow\s+\.sc-stage\s*\{[\s\S]*?flex-direction:\s*column/);
  });

  // W1.2 — sc-row agora é GRID com 2 areas (die row 1 span 2 / chip-attr+chip-dc row 2)
  it('W1.2 — sc-row em portrait-narrow vira grid com area "die die"', () => {
    expect(core).toMatch(/body\.is-portrait-narrow\s+\.sc-row\s*\{[\s\S]*?display:\s*grid/);
    expect(core).toMatch(/grid-template-areas:[\s\S]*?"die die"/);
  });

  it('M2.3 — .is-roll-echo styling distinto (italic + opacity baixa)', () => {
    expect(core).toMatch(/\.camp-narr-entry\.is-roll-echo\s*\{[^}]*opacity:\s*0\.78/);
    expect(core).toMatch(/\.is-roll-echo\s+\.cnn-text\s*\{[\s\S]*?font-style:\s*italic/);
  });

  // W2.1 — drop-cap inteligente: aparece em is-first-narration E em
  // [data-drop-cap-active='1'] (primeiras 3 da cena + 1ª após location change).
  it('W2.1 — drop-cap pseudo-element em first-narration OU data-drop-cap-active', () => {
    expect(core).toMatch(/\.camp-narr-entry\.is-first-narration\s+\.cnn-text::first-letter/);
    expect(core).toMatch(/\[data-drop-cap-active='1'\]\s+\.cnn-text::first-letter/);
    expect(core).toMatch(/::first-letter[\s\S]*?float:\s*left/);
  });

  it('M3.3 — textura pergaminho via SVG noise no .camp-screen::before', () => {
    expect(core).toMatch(/\.camp-screen::before\s*\{[\s\S]*?opacity:\s*0\.05/);
    expect(core).toMatch(/\.camp-screen::before\s*\{[\s\S]*?mix-blend-mode:\s*overlay/);
    expect(core).toMatch(/\.camp-screen::before\s*\{[\s\S]*?data:image\/svg\+xml/);
  });
});

describe('Redesign ① — proporção mode-aware em combate (portrait-narrow)', () => {
  const dock = readCss('m-camp-dock.css');

  // Responsivo F2 — o 18vh rígido virou clamp(96px,20vh,168px): piso ~4 linhas
  // a 568h, cap a 932h. flex 0 0 auto preservado (narração não cresce em combate).
  it('①/F2 combate ENCOLHE a narração: flex 0 0 auto + max-height fluido clamp(…20vh…)', () => {
    expect(dock).toMatch(
      /body\.is-portrait-narrow\s+\.camp-screen\.is-in-combat\s+\.ch-narration-host\s*\{[\s\S]*?flex:\s*0\s+0\s+auto[\s\S]*?max-height:\s*clamp\([^)]*20vh[^)]*\)/,
    );
  });

  it('① combate CRESCE o dock: flex 1 1 auto + max-height none (③ libera o cap)', () => {
    expect(dock).toMatch(
      /body\.is-portrait-narrow\s+\.camp-screen\.is-in-combat\s+\.ch-slot-main-content\s*\{[\s\S]*?flex:\s*1\s+1\s+auto[\s\S]*?max-height:\s*none/,
    );
  });

  // Responsivo F2 — o 35vh rígido virou clamp(180px,35vh,300px): piso pro
  // drill-down caber em tela curta, cap pra não virar meia tela em tela alta.
  it('①/F2 exploração: dock base fluido clamp(…35vh…) (Ω.9 preservado)', () => {
    expect(dock).toMatch(/body\.is-portrait-narrow\s+\.ch-slot-main-content\s*\{[^}]*max-height:\s*clamp\([^)]*35vh[^)]*\)/);
  });
});

describe('Redesign ③ — party faixa fina solo (m-camp-dock.css)', () => {
  const dock = readCss('m-camp-dock.css');

  it('③ slot host (.is-thin-host) zera padding + cap pra faixa full-bleed/curta', () => {
    expect(dock).toMatch(/\.ch-slot-party\.is-thin-host\s*\{[\s\S]*?max-height:\s*none[\s\S]*?padding:\s*0/);
  });

  it('③ .cp-strip é flex de 1 linha (portrait+nome+HP+CA)', () => {
    expect(dock).toMatch(/body\.is-portrait-narrow\s+\.cp-strip\s*\{[\s\S]*?display:\s*flex/);
  });

  it('③ portrait da faixa é 28px (override do float:right do card cheio)', () => {
    expect(dock).toMatch(/\.cp-strip\s+\.cp-strip-av\s*\{[\s\S]*?width:\s*28px/);
    expect(dock).toMatch(/\.cp-strip\s+\.cp-strip-av\s*\{[\s\S]*?float:\s*none/);
  });

  it('③ barra HP da faixa cresce (flex 1 1 auto)', () => {
    expect(dock).toMatch(/\.cp-strip\s+\.cp-strip-bar\s*\{[\s\S]*?flex:\s*1\s+1\s+auto/);
  });
});

describe('Redesign ④ — scene-pin sem sobreposição + narração centrada', () => {
  const dock = readCss('m-camp-dock.css');
  const core = readCss('campaign-core.css');

  it('④ scene-pin oculto por padrão, revelado só com .is-revealed', () => {
    expect(core).toMatch(/\.cn-scene-pin\s*\{[^}]*display:\s*none/);
    expect(core).toMatch(/\.cn-scene-pin\.is-revealed\s*\{[^}]*display:\s*block/);
  });

  it('④ narração curta centraliza via .is-narr-sparse (mata banda morta)', () => {
    expect(dock).toMatch(/\.ch-narration-host\.is-narr-sparse\s*\{[\s\S]*?justify-content:\s*center/);
  });
});

describe('Redesign WhatsApp — barra de ações no rodapé (.camp-action-bar)', () => {
  const dock = readCss('m-camp-dock.css');

  it('barra de ações é flex no rodapé (portrait)', () => {
    expect(dock).toMatch(/body\.is-portrait-narrow\s+\.camp-action-bar\s*\{[\s\S]*?display:\s*flex/);
  });

  it('botões da barra (.cab-btn) crescem iguais + hit ≥54px', () => {
    expect(dock).toMatch(/\.camp-action-bar\s+\.cab-btn\s*\{[\s\S]*?flex:\s*1\s+1\s+0/);
    expect(dock).toMatch(/\.camp-action-bar\s+\.cab-btn\s*\{[\s\S]*?min-height:\s*54px/);
  });

  it('Fase 3 — combate: ⚔ Atacar é o botão dominante (.is-primary flex 2)', () => {
    expect(dock).toMatch(/\.camp-action-bar\.is-combat\s+\.cab-btn\.is-primary\s*\{[\s\S]*?flex:\s*2\s+1\s+0/);
  });

  it('Fase 3 — dock de combate tem min-height:0 (overflow engata, batalha cabe)', () => {
    expect(dock).toMatch(/\.camp-screen\.is-in-combat\s+\.ch-slot-main-content\s*\{[\s\S]*?min-height:\s*0/);
  });
});

describe('Redesign ② — combate sem abas em portrait (combat.css)', () => {
  const combat = readCss('combat.css');

  it('② log inline do dock fica oculto em portrait (absorvido pelos echoes)', () => {
    expect(combat).toMatch(/body\.is-portrait-narrow\s+\.combat-screen\s+\.cb-tab-log\s*\{[^}]*display:\s*none/);
  });

  it('② regras de esconde-aba seguem gated por data-active-tab (fallback)', () => {
    // O combat-screen em portrait não seta mais data-active-tab, então estas
    // regras não disparam — mas continuam presentes como fallback.
    expect(combat).toMatch(/\.combat-screen\[data-active-tab="enemies"\]\s+\.cb-tab-content:not\(\.cb-tab-enemies\)/);
    expect(combat).toMatch(/\.combat-screen\[data-active-tab="actions"\]\s+\.cb-tab-content:not\(\.cb-tab-actions\)/);
  });
});

describe('M3.1 — duolingo-tutorial.css mobile padding + hit', () => {
  const css = readCss('duolingo-tutorial.css');

  it('mobile tooltip padding maior (18px) — texto respira', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\.dt-tooltip\s*\{[^}]*padding:\s*18px/);
  });

  it('mobile .dt-skip hit 44px (WCAG AAA polegar)', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\.dt-skip\s*\{[^}]*min-height:\s*44px/);
  });

  it('mobile .dt-nav-btn hit 44px (Voltar/Próximo)', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\.dt-nav-btn\s*\{[^}]*min-height:\s*44px/);
  });
});

describe('R — ciclo cross-cutting (toast hits + attention + clearance)', () => {
  const toasts = readCss('toasts.css');

  it('R1 — toast-action-btn min-height 44px (era 32)', () => {
    expect(toasts).toMatch(/\.toast-action-btn\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('R1 — toast-close-btn 36×36 (era 22×22)', () => {
    expect(toasts).toMatch(/\.toast-close-btn\s*\{[\s\S]*?width:\s*36px/);
    expect(toasts).toMatch(/\.toast-close-btn\s*\{[\s\S]*?height:\s*36px/);
  });

  it('R1 — toast-close-btn ganha border-radius 50% (target circular)', () => {
    expect(toasts).toMatch(/\.toast-close-btn\s*\{[\s\S]*?border-radius:\s*50%/);
  });

  it('R2 — toast-error com keyframe attention-error one-shot', () => {
    expect(toasts).toMatch(/\.toast-error\s*\{[\s\S]*?animation:\s*toast-attention-error/);
    expect(toasts).toMatch(/@keyframes\s+toast-attention-error/);
  });

  it('R2 — toast-warn com keyframe attention-warn one-shot', () => {
    expect(toasts).toMatch(/\.toast-warn\s*\{[\s\S]*?animation:\s*toast-attention-warn/);
    expect(toasts).toMatch(/@keyframes\s+toast-attention-warn/);
  });

  it('R3 — toast-container mobile usa --m-toast-bottom-offset var', () => {
    expect(toasts).toMatch(/--m-toast-bottom-offset/);
    expect(toasts).toMatch(/body\.is-portrait-narrow\s+\.toast-container\s*\{[\s\S]*?bottom:\s*calc\(var\(--m-toast-bottom-offset/);
  });
});

describe('Q — ciclo home polish (prefab compact + coop toggle + footer)', () => {
  const home = readCss('home-tavern.css');

  it('Q1 — home-prefab-teaser hidden em portrait-narrow', () => {
    expect(home).toMatch(/body\.is-portrait-narrow\s+\.home-prefab-teaser\s*\{[^}]*display:\s*none/);
  });

  it('Q1 — home-prefab-label 14px em mobile (era maior)', () => {
    expect(home).toMatch(/body\.is-portrait-narrow\s+\.home-prefab-label\s*\{[^}]*font-size:\s*14px/);
  });

  it('Q2 — home-coop-input.is-hidden com max-height 0 (collapsed)', () => {
    expect(home).toMatch(/\.home-coop-input\.is-hidden\s*\{[\s\S]*?max-height:\s*0/);
    expect(home).toMatch(/\.home-coop-input\.is-hidden\s*\{[\s\S]*?overflow:\s*hidden/);
  });

  it('Q2 — home-coop-input ganha transition max-height pra animar abertura', () => {
    expect(home).toMatch(/\.home-coop-input\s*\{[\s\S]*?transition:[^;]*max-height/);
  });

  it('Q4 — home-footer-link min-height 48px (compact)', () => {
    expect(home).toMatch(/\.home-footer-link\s*\{[\s\S]*?min-height:\s*48px/);
  });

  it('Q4 — home-footer-link-icon 22px (era 24)', () => {
    expect(home).toMatch(/\.home-footer-link-icon\s*\{[\s\S]*?font-size:\s*22px/);
  });

  it('Q4 — home-footer-link-label 10px (era 11)', () => {
    expect(home).toMatch(/\.home-footer-link-label\s*\{[\s\S]*?font-size:\s*10px/);
  });
});

describe('P — ciclo modais (spell CTA + slots + empty CTA + acessorio)', () => {
  const modals = readCss('modals.css');
  const spellCard = readCss('spell-card.css');

  it('P1 — inv-badge.inv-attuned com glow gold + border solid', () => {
    expect(modals).toMatch(/\.inv-badge\.inv-attuned\s*\{[\s\S]*?border:\s*1px\s+solid\s+rgba\(244,\s*208,\s*127/);
    expect(modals).toMatch(/\.inv-badge\.inv-attuned\s*\{[\s\S]*?box-shadow:[^;]*rgba\(244,\s*208,\s*127/);
  });

  it('P1 — inv-badge.inv-needs-attunement com border dashed', () => {
    expect(modals).toMatch(/\.inv-badge\.inv-needs-attunement\s*\{[\s\S]*?border:\s*1px\s+dashed/);
  });

  it('P2 — sc-cta-btn.is-castable gradient gold + uppercase', () => {
    expect(spellCard).toMatch(/\.sc-cta-btn\.is-castable\s*\{[\s\S]*?background:\s*linear-gradient[^;]*--ink-gold/);
    expect(spellCard).toMatch(/\.sc-cta-btn\s*\{[\s\S]*?text-transform:\s*uppercase/);
  });

  it('P2 — sc-cta-btn.is-no-slot dim + italic', () => {
    expect(spellCard).toMatch(/\.sc-cta-btn\.is-no-slot\s*\{[\s\S]*?font-style:\s*italic/);
  });

  it('P3 — cs-modal-slot.is-empty com line-through + italic', () => {
    expect(modals).toMatch(/\.cs-modal-slot\.is-empty\s*\{[\s\S]*?text-decoration:\s*line-through/);
    expect(modals).toMatch(/\.cs-modal-slot\.is-empty\s*\{[\s\S]*?font-style:\s*italic/);
  });

  it('P3 — cs-modal-slot ativo ganha box-shadow violet glow', () => {
    expect(modals).toMatch(/\.cs-modal-slot\s*\{[\s\S]*?box-shadow:[^;]*rgba\(160,\s*120,\s*220/);
  });

  it('P4 — cs-modal-empty estruturado: icon + title + sub + CTA', () => {
    expect(modals).toMatch(/\.cs-modal-empty-icon\s*\{[\s\S]*?font-size:\s*44px/);
    expect(modals).toMatch(/\.cs-modal-empty-title\s*\{/);
    expect(modals).toMatch(/\.cs-modal-empty-sub\s*\{/);
    expect(modals).toMatch(/\.cs-modal-empty-cta\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('P5 — inv-empty estruturado: icon 44px + title + sub', () => {
    expect(modals).toMatch(/\.inv-empty-icon\s*\{[\s\S]*?font-size:\s*44px/);
    expect(modals).toMatch(/\.inv-empty-title\s*\{/);
    expect(modals).toMatch(/\.inv-empty-sub\s*\{/);
  });
});

describe('O1/O2/O3 — ciclo 5 (combat hit + party coop + economy gasto)', () => {
  const combat = readCss('combat.css');
  const party = readCss('campaign-party.css');
  const dock = readCss('m-camp-dock.css');

  it('O1.2 — cb-tab-btn min-height 44px em portrait-narrow', () => {
    expect(combat).toMatch(/body\.is-portrait-narrow\s+\.cb-tab-btn\s*\{[^}]*min-height:\s*44px/);
  });

  it('O1.3 — cdb-roll-btn min-height 48px + animação urgency', () => {
    expect(party).toMatch(/\.cdb-roll-btn\s*\{[^}]*min-height:\s*48px/);
    expect(party).toMatch(/@keyframes\s+cdb-roll-urgency/);
    expect(party).toMatch(/\.cdb-roll-btn\s*\{[^}]*animation:\s*cdb-roll-urgency/);
  });

  it('O1.3 — reduced-motion override pra cdb-roll-btn urgency', () => {
    expect(party).toMatch(/prefers-reduced-motion[^}]+\.cdb-roll-btn/);
  });

  it('O2.2 — cp-list.is-coop vira flex horizontal scroll-x em mobile', () => {
    expect(dock).toMatch(/\.cp-list\.is-coop\s*\{[^}]*display:\s*flex/);
    expect(dock).toMatch(/\.cp-list\.is-coop\s*\{[^}]*flex-direction:\s*row/);
    expect(dock).toMatch(/\.cp-list\.is-coop\s*\{[^}]*scroll-snap-type:\s*x\s+mandatory/);
  });

  // Responsivo F2 — o 200px rígido virou clamp(168px,56vw,220px): a 320w cabem
  // mais cards visíveis, a 430w sobe sem esticar. scroll-snap-align preservado.
  it('O2.2/F2 — cp-pj em coop ganha width fluido clamp(…56vw…) + scroll-snap-align', () => {
    expect(dock).toMatch(/\.cp-list\.is-coop\s+\.cp-pj\s*\{[^}]*width:\s*clamp\([^)]*56vw[^)]*\)/);
    expect(dock).toMatch(/\.cp-list\.is-coop\s+\.cp-pj\s*\{[^}]*scroll-snap-align:\s*start/);
  });

  it('O2.2 — cp-pj.is-me em coop ganha order -1 (sempre primeiro)', () => {
    expect(dock).toMatch(/\.cp-list\.is-coop\s+\.cp-pj\.is-me\s*\{[^}]*order:\s*-1/);
  });

  it('O3.1 — cb-eco-slot.is-avail ganha box-shadow gold sutil', () => {
    expect(combat).toMatch(/\.cb-eco-slot\.is-avail\s*\{[\s\S]*?box-shadow:[^;]*rgba\(244,\s*208,\s*127/);
  });

  it('O3.1 — cb-eco-slot.is-used ganha grayscale filter + bg escurecido', () => {
    expect(combat).toMatch(/\.cb-eco-slot\.is-used\s*\{[\s\S]*?filter:\s*grayscale/);
  });

  it('O3.2 — cb-tab-badge pill dourada com font-size 10 + min-width 18', () => {
    expect(combat).toMatch(/\.cb-tab-badge\s*\{[\s\S]*?min-width:\s*18px/);
    expect(combat).toMatch(/\.cb-tab-badge\s*\{[\s\S]*?font-size:\s*10px/);
    expect(combat).toMatch(/\.cb-tab-badge\s*\{[\s\S]*?background:\s*linear-gradient[^;]*--ink-gold/);
  });
});

describe('N1/N2/N3 — round 4 (hierarquia + visual rich + polish vivo)', () => {
  const core = readCss('campaign-core.css');
  const ribbon = readCss('status-ribbon.css');

  it('N1.2 — first-narration speaker 13px com letter-spacing 0.18em', () => {
    expect(core).toMatch(/\.is-first-narration\s+\.cnn-speaker\s*\{[\s\S]*?font-size:\s*13px/);
    expect(core).toMatch(/\.is-first-narration\s+\.cnn-speaker\s*\{[\s\S]*?letter-spacing:\s*0\.18em/);
  });

  it('N1.3 — .sc-skip-btn margin-top 14 + min-height 38 (gap maior)', () => {
    expect(core).toMatch(/\.sc-skip-btn\s*\{[^}]*margin-top:\s*14px/);
    expect(core).toMatch(/\.sc-skip-btn\s*\{[^}]*min-height:\s*38px/);
  });

  it('N1.3 — skip btn mobile hit 44px', () => {
    expect(core).toMatch(/body\.is-portrait-narrow\s+\.sc-skip-btn\s*\{[^}]*min-height:\s*44px/);
  });

  it('N2.1 — textura mobile opacity 0.07 (era 0.05 default)', () => {
    expect(core).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\.camp-screen::before\s*\{[\s\S]*?opacity:\s*0\.07/);
  });

  it('N2.2 — separator visual após echo entry (gradient gold-28)', () => {
    expect(core).toMatch(/\.is-roll-echo\s*\+\s*\.camp-narr-entry:not\(\.is-roll-echo\)::before/);
    expect(core).toMatch(/rgba\(244,\s*208,\s*127,\s*0\.28\)/);
  });

  it('N3.1 — ribbon .is-pending-roll com sr-roll-pulse keyframe', () => {
    expect(ribbon).toMatch(/\.sr-glyph\.is-pending-roll\s*\{[^}]*animation:\s*sr-roll-pulse/);
    expect(ribbon).toMatch(/@keyframes\s+sr-roll-pulse/);
  });

  it('N3.1 — reduced-motion override pra ribbon pending roll', () => {
    expect(ribbon).toMatch(/prefers-reduced-motion[^}]+\.sr-glyph\.is-pending-roll/);
  });

  it('N3.3 — drop-cap data-attr sm reduz pra 32px', () => {
    expect(core).toMatch(/\[data-drop-cap='sm'\]\s+\.cnn-text::first-letter\s*\{[^}]*font-size:\s*32px/);
  });

  it('N3.3 — drop-cap data-attr sm mobile reduz pra 28px', () => {
    expect(core).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*?\[data-drop-cap='sm'\]\s+\.cnn-text::first-letter\s*\{[^}]*font-size:\s*28px/);
  });
});

describe('T3 — Ciclo T round 3 (polish)', () => {
  const modals = readCss('modals.css');
  const dice = readCss('dice.css');
  const lrr = readCss('long-rest-ritual.css');

  it('T3.1 — ach-card.is-hidden tem visual DISTINTO de is-locked (blur + roxo)', () => {
    expect(modals).toMatch(/\.ach-card\.is-hidden\s*\{[\s\S]*?filter:\s*blur/);
    expect(modals).toMatch(/\.ach-card\.is-hidden\s*\{[\s\S]*?border-color:\s*rgba\(160,\s*110,\s*200/);
  });

  it('T3.2 — dro-preview vira inline-flex com chips coloridos', () => {
    expect(dice).toMatch(/\.dro-preview\s*\{[\s\S]*?display:\s*inline-flex/);
    expect(dice).toMatch(/\.dro-prev-die\s*\{[\s\S]*?background:\s*rgba\(244,\s*208,\s*127/);
    expect(dice).toMatch(/\.dro-prev-bonus\s*\{[\s\S]*?color:\s*#b8e8a0/);
  });

  it('T3.3 — lrr-overlay com radial-gradient noturno + fade-in keyframe', () => {
    expect(lrr).toMatch(/\.lrr-overlay\s*\{[\s\S]*?background:\s*radial-gradient/);
    expect(lrr).toMatch(/@keyframes\s+lrr-fade-in/);
    expect(lrr).toMatch(/@keyframes\s+lrr-icon-breath/);
  });

  it('T3.3 — reduced-motion override pra lrr-overlay e lrr-icon', () => {
    expect(lrr).toMatch(/prefers-reduced-motion[\s\S]*?\.lrr-overlay[\s\S]*?animation:\s*none/);
    expect(lrr).toMatch(/prefers-reduced-motion[\s\S]*?\.lrr-icon[\s\S]*?animation:\s*none/);
  });
});

describe('T2 — Ciclo T round 2 (médio)', () => {
  const sheet = readCss('sheet.css');
  const modals = readCss('modals.css');
  const lobby = readCss('lobby-personality-preview.css');
  const srm = readCss('short-rest.css');

  it('T2.1 — sheet-saves-card ganha bg/border distintos dos atributos', () => {
    expect(sheet).toMatch(/\.sheet-saves-card\s*\{[\s\S]*?background:\s*rgba\(40,\s*30,\s*18/);
    expect(sheet).toMatch(/\.sheet-saves-card\s*\{[\s\S]*?border:\s*1px\s+solid\s+rgba\(184,\s*128,\s*48/);
  });

  it('T2.2 — sheet-inv-group ganha border-bottom + padding-bottom (separator)', () => {
    expect(sheet).toMatch(/\.sheet-inv-group\s*\{[\s\S]*?border-bottom:\s*1px\s+solid\s+rgba\(184,\s*128,\s*48/);
    expect(sheet).toMatch(/\.sheet-inv-group:last-of-type\s*\{[^}]*border-bottom:\s*none/);
  });

  it('T2.3 — ach-anon-banner com gradient gold + border', () => {
    expect(modals).toMatch(/\.ach-anon-banner\s*\{[\s\S]*?background:\s*linear-gradient[^;]*rgba\(244,\s*208,\s*127/);
    expect(modals).toMatch(/\.ach-anon-banner\s*\{[\s\S]*?border:\s*1px\s+solid\s+rgba\(244,\s*208,\s*127/);
  });

  it('T2.4 — lpp-preview ganha max-width + word-break (mobile-safe)', () => {
    expect(lobby).toMatch(/\.lpp-preview\s*\{[\s\S]*?max-width:\s*100%/);
    expect(lobby).toMatch(/\.lpp-preview\s*\{[\s\S]*?word-break:\s*break-word/);
  });

  it('T2.4 — lpp-preview mobile reduce padding/font', () => {
    expect(lobby).toMatch(/body\.is-portrait-narrow\s+\.lpp-preview\s*\{[\s\S]*?font-size:\s*12px/);
  });

  it('T2.5 — srm-chip tem WCAG AAA hit (44×44 min) + chip selected gold', () => {
    expect(srm).toMatch(/\.srm-chip\s*\{[\s\S]*?min-width:\s*44px/);
    expect(srm).toMatch(/\.srm-chip\s*\{[\s\S]*?min-height:\s*44px/);
    expect(srm).toMatch(/\.srm-chip\.is-selected\s*\{[\s\S]*?border-color:\s*var\(--ink-gold/);
  });

  it('T2.5 — srm-preview com tint vermelho-vida + accent-life cor', () => {
    expect(srm).toMatch(/\.srm-preview-val\s*\{[\s\S]*?color:\s*var\(--accent-life/);
  });
});

describe('T1 — Ciclo T round 1 (crítico)', () => {
  const party = readCss('campaign-party.css');
  const modals = readCss('modals.css');
  const lobby = readCss('lobby.css');

  it('T1.2 — ot-card vira flex column com max-height 85vh (mobile landscape fix)', () => {
    expect(party).toMatch(/\.ot-card\s*\{[\s\S]*?display:\s*flex/);
    expect(party).toMatch(/\.ot-card\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(party).toMatch(/\.ot-card\s*\{[\s\S]*?max-height:\s*85vh/);
  });

  it('T1.2 — ot-body é scrollable + ot-actions colado no bottom', () => {
    expect(party).toMatch(/\.ot-card\s+\.ot-body\s*\{[\s\S]*?overflow-y:\s*auto/);
    expect(party).toMatch(/\.ot-card\s+\.ot-actions\s*\{[^}]*margin-top:\s*auto/);
  });

  it('T1.3 — login-submit-btn loading state com opacity + cursor wait', () => {
    expect(modals).toMatch(/\.login-submit-btn\.is-loading[\s\S]*?\.login-submit-btn:disabled\s*\{[\s\S]*?opacity:\s*0\.65/);
    expect(modals).toMatch(/\.login-submit-btn\.is-loading[\s\S]*?\.login-submit-btn:disabled\s*\{[\s\S]*?cursor:\s*wait/);
  });

  it('T1.4 — ach-empty estruturado (icon + title + sub)', () => {
    expect(modals).toMatch(/\.ach-empty-icon\s*\{[^}]*font-size:\s*36px/);
    expect(modals).toMatch(/\.ach-empty-title\s*\{[^}]*font-family:\s*var\(--font-heading/);
    expect(modals).toMatch(/\.ach-empty-sub\s*\{/);
  });

  it('T1.5 — lobby-player-row.is-status-selecting ganha tint azul-aço distinto', () => {
    expect(lobby).toMatch(/\.lobby-player-row\.is-status-selecting\s*\{[\s\S]*?background:\s*rgba\(40,\s*70,\s*110/);
    expect(lobby).toMatch(/\.lobby-player-row\.is-status-selecting\s*\{[\s\S]*?border-color:\s*rgba\(120,\s*160,\s*220/);
  });
});

describe('S3 — Ciclo S round 3 (polish)', () => {
  const home = readCss('home-tavern.css');
  const gloss = readCss('glossary.css');
  const party = readCss('campaign-party.css');
  const modals = readCss('modals.css');

  it('S3.1 — home-prefab-archetype em portrait-narrow ganha min-height 24 + flex center', () => {
    expect(home).toMatch(/body\.is-portrait-narrow\s+\.home-prefab-archetype\s*\{[\s\S]*?min-height:\s*24px/);
    expect(home).toMatch(/body\.is-portrait-narrow\s+\.home-prefab-archetype\s*\{[\s\S]*?align-items:\s*center/);
  });

  it('S3.2 — gl-empty estruturado com icon + title + cta (3 sub-classes)', () => {
    expect(gloss).toMatch(/\.gl-empty-icon\s*\{[^}]*font-size:\s*36px/);
    expect(gloss).toMatch(/\.gl-empty-title\s*\{[^}]*font-family:\s*var\(--font-heading/);
    expect(gloss).toMatch(/\.gl-empty-cta\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('S3.3 — qlm-empty estruturado com icon + title + hints', () => {
    expect(party).toMatch(/\.qlm-empty-icon\s*\{[^}]*font-size:\s*36px/);
    expect(party).toMatch(/\.qlm-empty-title\s*\{[^}]*font-family:\s*var\(--font-heading/);
    expect(party).toMatch(/\.qlm-empty-hints\s*\{[\s\S]*?list-style:\s*none/);
  });

  it('S3.4 — login-anon-btn loading state com opacity + pointer-events:none', () => {
    expect(modals).toMatch(/\.login-anon-btn\.is-loading[\s\S]*?\.login-anon-btn:disabled\s*\{[\s\S]*?opacity:\s*0\.6/);
    expect(modals).toMatch(/\.login-anon-btn\.is-loading[\s\S]*?\.login-anon-btn:disabled\s*\{[\s\S]*?pointer-events:\s*none/);
  });
});

describe('S2 — Ciclo S round 2 (médio mobile polish)', () => {
  const wiz = readCss('wizard.css');
  const party = readCss('campaign-party.css');
  const gloss = readCss('glossary.css');

  it('S2.1 — cs-stats-grid em portrait-narrow vira 2-col (era auto-fit minmax 120)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.cs-stats-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  });

  it('S2.1 — csb-value mobile 24 → 18px (compacta vital block)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.csb-value\s*\{[^}]*font-size:\s*18px/);
  });

  it('S2.2 — ab-row em portrait-narrow ganha row-gap:8 (slider respira)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.ab-row\s*\{[\s\S]*?row-gap:\s*8px/);
  });

  it('S2.2 — ab-slider mobile ganha min-height 28px (touch target)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.ab-slider\s*\{[\s\S]*?min-height:\s*28px/);
  });

  it('S2.3 — profile-screen > wiz-header vira sticky top:0 em portrait-narrow', () => {
    expect(party).toMatch(/body\.is-portrait-narrow\s+\.profile-screen\s*>\s*\.wiz-header\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0/);
  });

  it('S2.3 — profile-summary mobile sticky offset 0 → 52 (abaixo do header)', () => {
    expect(party).toMatch(/body\.is-portrait-narrow\s+\.profile-summary\s*\{[\s\S]*?top:\s*52px/);
  });

  it('S2.4 — wlp-body mobile padding 14 → 10/8 (live-preview respira)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wlp-body\s*\{[^}]*padding:\s*10px\s+8px/);
  });

  it('S2.5 — gl-search hit min-height 40 → 44px (WCAG AAA)', () => {
    expect(gloss).toMatch(/\.gl-search\s*\{[\s\S]*?min-height:\s*44px/);
    expect(gloss).toMatch(/\.gl-search\s*\{[\s\S]*?padding:\s*10px\s+14px/);
  });
});

describe('S1 — Ciclo S round 1 (crítico)', () => {
  const wiz = readCss('wizard.css');

  it('S1.3 — wiz-progress vira horizontal scroll-snap em portrait-narrow', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wiz-progress\s*\{[\s\S]*?overflow-x:\s*auto/);
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wiz-progress\s*\{[\s\S]*?scroll-snap-type:\s*x\s+mandatory/);
  });

  it('S1.3 — wp-step mobile ganha flex:0 0 auto + min-width:44 (cabe scroll)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wp-step\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/);
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wp-step\s*\{[\s\S]*?min-width:\s*44px/);
  });

  it('S1.3 — wp-step.is-current ganha scroll-snap-align:center (centraliza atual)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wp-step\.is-current\s*\{[^}]*scroll-snap-align:\s*center/);
  });

  it('S1.3 — scrollbar hidden no wiz-progress mobile (clean look)', () => {
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wiz-progress\s*\{[\s\S]*?scrollbar-width:\s*none/);
    expect(wiz).toMatch(/body\.is-portrait-narrow\s+\.wiz-progress::-webkit-scrollbar\s*\{\s*display:\s*none/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Sprint W — Redesign Visceral (W1 Dado / W2 Mestre / W3 Combate)
// ═════════════════════════════════════════════════════════════════════════

describe('Sprint W1 — Dado Protagonista', () => {
  const dice = readCss('dice.css');
  const core = readCss('campaign-core.css');

  it('W1-Mobile — dice-roll-overlay tem screen dim 0.72 + backdrop-filter blur(6px)', () => {
    expect(dice).toMatch(/\.dice-roll-overlay\s*\{[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*0\.72\)/);
    expect(dice).toMatch(/\.dice-roll-overlay\s*\{[\s\S]*?backdrop-filter:\s*blur\(6px\)/);
  });

  it('W1.3 — is-rolling guard inutiliza chips do overlay durante reveal', () => {
    expect(dice).toMatch(/\.dice-roll-overlay\.is-rolling[\s\S]*?pointer-events:\s*none/);
  });

  it('W1.5 — flash crit/fumble com gradientes radial (gold + red)', () => {
    expect(dice).toMatch(/\.dice-screen-flash\.is-crit[\s\S]*?255,\s*215,\s*0,\s*0\.35/);
    expect(dice).toMatch(/\.dice-screen-flash\.is-fumble[\s\S]*?220,\s*60,\s*50,\s*0\.35/);
  });

  it('W1.5 — die-crit-landed e die-fumble-landed têm keyframes com scale 1.2', () => {
    expect(dice).toMatch(/\.die-3d\.die-crit-landed[\s\S]*?dieCritLanded/);
    expect(dice).toMatch(/\.die-3d\.die-fumble-landed[\s\S]*?dieFumbleLanded/);
    expect(dice).toMatch(/@keyframes\s+dieCritLanded[\s\S]*?scale\(1\.2\)/);
  });

  it('W1-Mobile — sc-backdrop (skill-check) também tem backdrop-filter blur', () => {
    expect(core).toMatch(/\.sc-backdrop\s*\{[\s\S]*?backdrop-filter:\s*blur\(6px\)/);
  });
});

describe('Sprint W2 — Mestre Narrativo', () => {
  const core = readCss('campaign-core.css');
  const combat = readCss('combat.css');

  it('W2.1 — read-aloud box (gradient gold + border-left + Cardo 16px) em is-narration não-echo', () => {
    expect(core).toMatch(/\.camp-narr-entry\.is-narration:not\(\.is-roll-echo\)\s*\{[\s\S]*?border-left:\s*3px\s+solid\s+var\(--ink-gold\)/);
    expect(core).toMatch(/\.camp-narr-entry\.is-narration:not\(\.is-roll-echo\)\s+\.cnn-text\s*\{[\s\S]*?font-size:\s*16px/);
    expect(core).toMatch(/\.camp-narr-entry\.is-narration:not\(\.is-roll-echo\)\s+\.cnn-text\s*\{[\s\S]*?line-height:\s*1\.6/);
  });

  it('W2.2 — player echo style azul-aço discreto (font 13 italic opacity)', () => {
    expect(core).toMatch(/\.camp-narr-entry\.is-player-echo\s+\.cnn-text\s*\{[\s\S]*?font-size:\s*13px/);
    expect(core).toMatch(/\.camp-narr-entry\.is-player-echo\s*\{[\s\S]*?opacity:\s*0\.86/);
  });

  it('W2.3 — party message com avatar circle 28px + bg azul-aço', () => {
    expect(core).toMatch(/\.cn-pm-avatar\s*\{[\s\S]*?width:\s*28px/);
    expect(core).toMatch(/\.cn-pm-avatar\s*\{[\s\S]*?border-radius:\s*50%/);
    expect(core).toMatch(/\.camp-narr-entry\.is-party-message\s*\{[\s\S]*?border-left:\s*3px\s+solid\s+rgba\(140,\s*180,\s*230/);
  });

  it('W2.4 — combat log usa Cardo serif italic 14px (não monospace)', () => {
    expect(combat).toMatch(/\.cb-log-line\s*\{[\s\S]*?font-family:\s*'Cardo'/);
    expect(combat).toMatch(/\.cb-log-line\s*\{[\s\S]*?font-style:\s*italic/);
    expect(combat).toMatch(/\.cb-log-line\s*\{[\s\S]*?font-size:\s*14px/);
  });

  it('W2-Mobile — thinking indicator tem skeleton shimmer', () => {
    expect(core).toMatch(/@keyframes\s+thinkingShimmer/);
    expect(core).toMatch(/\.camp-narr-entry\.is-thinking\s*\{[\s\S]*?thinkingShimmer/);
  });
});

describe('Sprint W3 — Combate Target-First', () => {
  const combat = readCss('combat.css');
  const cts = readCss('combat-target-sheet.css');
  const ribbon = readCss('initiative-ribbon.css');

  it('W3.1 — cb-enemy-meta usa Cardo italic (fog of war, não monospace)', () => {
    expect(combat).toMatch(/\.cb-enemy-meta\s*\{[\s\S]*?font-family:\s*'Cardo'/);
    expect(combat).toMatch(/\.cb-enemy-meta\s*\{[\s\S]*?font-style:\s*italic/);
  });

  it('W3.1 — cb-enemy-hp-adj tem cores por severidade (intacto verde, à beira vermelho)', () => {
    expect(combat).toMatch(/\.cb-enemy-hp-adj\.cb-enemy-hp-intacto/);
    expect(combat).toMatch(/\.cb-enemy-hp-adj\.cb-enemy-hp-à-beira/);
  });

  it('W3.2 — cts-overlay + cts-sheet com slide-up animation', () => {
    expect(cts).toMatch(/\.cts-overlay\s*\{[\s\S]*?animation:\s*ctsOverlayFadeIn/);
    expect(cts).toMatch(/\.cts-sheet\s*\{[\s\S]*?animation:\s*ctsSheetSlideUp/);
    expect(cts).toMatch(/@keyframes\s+ctsSheetSlideUp/);
  });

  it('W3.2 — primary action btn tem glow pulsante + hit target ≥64px', () => {
    expect(cts).toMatch(/\.cts-primary-btn\s*\{[\s\S]*?animation:\s*ctsPrimaryGlow/);
    expect(cts).toMatch(/\.cts-primary-btn\s*\{[\s\S]*?min-height:\s*64px/);
  });

  it('W3-Mobile — enemy card.is-targeted tem pulse 200ms vermelho', () => {
    expect(cts).toMatch(/\.cb-enemy-card\.is-targeted\s*\{[\s\S]*?cbTargetPulse/);
    expect(cts).toMatch(/@keyframes\s+cbTargetPulse[\s\S]*?scale\(1\.05\)/);
  });

  it('W3.3 — cb-economy é STICKY top com z-index 8', () => {
    expect(combat).toMatch(/\.cb-economy\s*\{[\s\S]*?position:\s*sticky/);
    expect(combat).toMatch(/\.cb-economy\s*\{[\s\S]*?top:\s*0/);
    expect(combat).toMatch(/\.cb-economy\s*\{[\s\S]*?z-index:\s*8/);
  });

  it('W3.4 — body.is-my-turn aplica box-shadow inset gold na combat-screen', () => {
    expect(combat).toMatch(/body\.is-my-turn\s+\.combat-screen\s*\{[\s\S]*?box-shadow:[\s\S]*?var\(--ink-gold\)/);
    expect(combat).toMatch(/@keyframes\s+turnEnterPulse/);
  });

  it('W3-DnD — body.is-took-damage tem screen-shake + dmgFlashFade', () => {
    expect(combat).toMatch(/body\.is-took-damage[\s\S]*?bodyDamageShake/);
    expect(combat).toMatch(/@keyframes\s+bodyDamageShake/);
    expect(combat).toMatch(/@keyframes\s+dmgFlashFade/);
  });

  it('Rank 14 — flash de dano usa .camp-screen::after (shell real), não .campaign-screen morto', () => {
    expect(combat).toMatch(/body\.is-took-damage\s+\.camp-screen::after/);
    expect(combat).toMatch(/body\.is-took-damage-crit\s+\.camp-screen::after/);
    // o seletor morto .campaign-screen::after não pode mais existir como regra
    expect(combat).not.toMatch(/\.campaign-screen::after/);
  });

  it('W3-DnD — irb-next-hint cor por kind (enemy red, player gold, me-next bg)', () => {
    expect(ribbon).toMatch(/\.irb-next-hint\.irb-next-enemy/);
    expect(ribbon).toMatch(/\.irb-next-hint\.irb-next-player/);
    expect(ribbon).toMatch(/\.irb-next-hint\.is-me-next/);
  });
});

describe('C1 — chat.css contador ancorado ao footer (não sobre o input)', () => {
  const css = readCss('chat.css');

  it('.cs-footer é position:relative pra ancorar o counter absoluto', () => {
    expect(css).toMatch(/\.cs-footer\s*\{[^}]*position:\s*relative/);
  });

  it('.cs-char-counter flutua ACIMA do footer (bottom: calc(100%...), não sobre a textarea)', () => {
    expect(css).toMatch(/\.cs-char-counter\s*\{[^}]*bottom:\s*calc\(100%/);
  });
});

describe('U4/U5 — combate: hierarquia de turno + end-turn alcançável', () => {
  const combat = readCss('combat.css');
  const polish = readCss('combat-polish.css');

  it('U4 — .cb-turn.is-my-turn destacado (bold dourado)', () => {
    expect(combat).toMatch(/\.cb-turn\.is-my-turn\s*\{[^}]*font-weight:\s*700/);
  });

  it('U4 — .cb-round recuado pra secundário (fs-sm)', () => {
    expect(combat).toMatch(/\.cb-round\s*\{[^}]*font-size:\s*var\(--fs-sm\)/);
  });

  it('U5 — .cb-end-turn-chip sticky no fim do dock em portrait', () => {
    expect(polish).toMatch(/is-portrait-narrow\s+\.cb-end-turn-chip\s*\{[^}]*position:\s*sticky/);
  });

  it('U3 — .cb-actions-hint existe (clareza target-first)', () => {
    expect(combat).toMatch(/\.cb-actions-hint\s*\{/);
  });
});

describe('Trade-offs dado — overlay D2/D4', () => {
  const dice = readCss('dice.css');

  it('D4 — .dice-roll-overlay tem overflow-y:auto (não corta em viewport curto)', () => {
    expect(dice).toMatch(/\.dice-roll-overlay\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('D2 — .dice-roll-overlay.is-physical remove o blur (dado físico legível)', () => {
    expect(dice).toMatch(/\.dice-roll-overlay\.is-physical\s*\{[^}]*backdrop-filter:\s*none/);
  });
});

describe('U7 — eco do roll colorido por desfecho', () => {
  const core = readCss('campaign-core.css');

  it('.is-roll-echo-success colore o .cnn-text', () => {
    expect(core).toMatch(/\.is-roll-echo-success\s+\.cnn-text\s*\{[^}]*color:/);
  });

  it('.is-roll-echo-fail colore o .cnn-text', () => {
    expect(core).toMatch(/\.is-roll-echo-fail\s+\.cnn-text\s*\{[^}]*color:/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Responsivo F1-F4 — sistema fluido (tokens + dado + landscape + overlays).
// Guards CSS determinísticos (a forma do token/seletor; pixel → preview). F5.2.
// ════════════════════════════════════════════════════════════════════════════
describe('Responsivo F1-F4 — sistema fluido', () => {
  const tokens = readCss('_tokens.css');
  const uxs = readCss('ux-settings.css');
  const dock = readCss('m-camp-dock.css');
  const core = readCss('campaign-core.css');
  const dice = readCss('dice.css');
  const duo = readCss('duolingo-tutorial.css');

  it('F1 — todos os --fs-* são calc(clamp(...) * var(--ux-font-scale))', () => {
    for (const t of ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl']) {
      const re = new RegExp(`--fs-${t}:\\s*calc\\(\\s*clamp\\([^)]*\\)\\s*\\*\\s*var\\(--ux-font-scale`);
      expect(tokens, `--fs-${t}`).toMatch(re);
    }
  });

  it('F1 — --m-gap-* fluidos (clamp); pisos de toque FIXOS (40/44)', () => {
    expect(tokens).toMatch(/--m-gap-tight:\s*clamp\(/);
    expect(tokens).toMatch(/--m-gap-base:\s*clamp\(/);
    expect(tokens).toMatch(/--m-gap-loose:\s*clamp\(/);
    expect(tokens).toMatch(/--m-hit-min:\s*40px/);
    expect(tokens).toMatch(/--m-hit-comfortable:\s*44px/);
  });

  it('F1 — tokens de componente QUADRADO em vmin (não incham no landscape)', () => {
    expect(tokens).toMatch(/--m-die-skillcheck:\s*clamp\([^)]*vmin[^)]*\)/);
    expect(tokens).toMatch(/--m-die-overlay:\s*clamp\([^)]*vmin[^)]*\)/);
    expect(tokens).toMatch(/--m-avatar-strip:\s*clamp\([^)]*vmin[^)]*\)/);
  });

  it('F1.4 — body usa var(--fs-base), NÃO re-multiplica calc(15px*…) (sem escala dupla)', () => {
    expect(uxs).toMatch(/body\s*\{[^}]*font-size:\s*var\(--fs-base\)/);
    expect(uxs).not.toMatch(/font-size:\s*calc\(\s*15px\s*\*/);
  });

  it('F2 — dado skill-check via var(--m-die-skillcheck); overlay via var(--m-die-overlay)', () => {
    expect(core).toMatch(/\.sc-die\s*\{[\s\S]*?width:\s*var\(--m-die-skillcheck\)/);
    expect(dice).toMatch(/\.dice-roll-overlay\s+\.die-3d\s*\{[\s\S]*?width:\s*var\(--m-die-overlay\)/);
    // o bump fixo 112px do overlay foi REMOVIDO (o clamp vmin cobre 320→430)
    expect(dice).not.toMatch(/\.dice-roll-overlay\s+\.die-3d\s*\{[^}]*width:\s*112px/);
  });

  it('F3 — m-camp-dock tem deltas de landscape (is-landscape-phone)', () => {
    expect(dock).toMatch(/body\.is-landscape-phone\s+\.ch-slot-party\s*\{[^}]*max-height:\s*clamp\(/);
    expect(dock).toMatch(/body\.is-landscape-phone\s+\.camp-screen\.is-in-combat\s+\.ch-narration-host\s*\{[^}]*max-height:\s*clamp\(/);
    expect(dock).toMatch(/body\.is-landscape-phone\s+\.ch-narration-host\s*>\s*\*\s*\{[^}]*max-width:\s*760px/);
    expect(dock).toMatch(/body\.is-landscape-phone\s+\.camp-action-bar\s+\.cab-btn\s*\{[^}]*min-height:\s*max\(/);
  });

  it('F4 — skill-check overlay: overflow-y auto + safe-area + flex-start em altura curta', () => {
    expect(core).toMatch(/\.sc-overlay\s*\{[\s\S]*?overflow-y:\s*auto/);
    // safe-area via os tokens --m-safe-* (que = env(safe-area-inset-*) no _tokens.css)
    expect(core).toMatch(/\.sc-overlay\s*\{[\s\S]*?var\(--m-safe-/);
    expect(core).toMatch(/@media\s*\(max-height:\s*660px\)[\s\S]*?\.sc-overlay\s*\{[^}]*align-items:\s*flex-start/);
  });

  it('F4 — dice overlay: dro-stage max-height 100dvh + drop-in gated por altura + safe-area', () => {
    expect(dice).toMatch(/\.dro-stage\s*\{[\s\S]*?max-height:\s*100dvh/);
    expect(dice).toMatch(/@media\s*\(max-height:\s*680px\)[\s\S]*?padding-top:\s*clamp\(/);
    // safe-area via os tokens --m-safe-* (que = env(safe-area-inset-*) no _tokens.css)
    expect(dice).toMatch(/\.dice-roll-overlay\s*\{[\s\S]*?var\(--m-safe-/);
  });

  it('F4 — tutorial Duolingo: fit-or-scroll (80dvh + overflow) em altura curta', () => {
    expect(duo).toMatch(/@media\s*\(max-height:\s*600px\)[\s\S]*?\.dt-tooltip\s*\{[\s\S]*?max-height:\s*80dvh/);
    expect(duo).toMatch(/@media\s*\(max-height:\s*600px\)[\s\S]*?overflow-y:\s*auto/);
  });

  // F6 — caça-bugs: fixes confirmados empiricamente
  it('F6 — login-screen usa 100dvh (não só 100vh — chrome do browser mobile)', () => {
    const modals = readCss('modals.css');
    expect(modals).toMatch(/\.login-screen\s*\{[\s\S]*?min-height:\s*100dvh/);
  });

  it('F6 — cond-pill de combate usa var(--fs-xs) (escala com font-scale, era 9px)', () => {
    const combat = readCss('combat.css');
    expect(combat).toMatch(/\.cb-cond-pill\s*\{[\s\S]*?font-size:\s*var\(--fs-xs\)/);
  });

  // F6.QA — ciclos de teste (glossário/ajustes/inventário)
  it('F6.QA — .cs-close (× compartilhado dos sheets) tem base + 44px no mobile', () => {
    const modals = readCss('modals.css');
    expect(modals).toMatch(/\.cs-close\s*\{[\s\S]*?width:\s*36px/);
    expect(modals).toMatch(/body\.is-portrait-narrow\s+\.cs-close\s*\{[^}]*(width|height):\s*44px/);
  });

  it('F6.QA — inputs de texto ≥16px no mobile (mata o auto-zoom do iOS)', () => {
    const ml = readCss('m-layout.css');
    expect(ml).toMatch(/body\.is-portrait-narrow\s+input[\s\S]*?font-size:\s*max\(16px,\s*var\(--fs-base\)\)/);
  });
});

// Ciclo D — fixes do smoke "no aparelho" (emulado no preview: classes forçadas,
// browser-bar/notch simulados). Cada guard trava um fix re-medido empiricamente.
describe('Responsivo Ciclo D — fixes do smoke mobile', () => {
  it('D1 — economia redundante (⚡✦↩️ 9m) some da ribbon em portrait (era clipada a 320; slot sticky tem)', () => {
    const sr = readCss('status-ribbon.css');
    expect(sr).toMatch(/body\.is-portrait-narrow\s+\.sr-economy\s*\{[^}]*display:\s*none/);
  });

  it('D2 — combat-tutorial "Pular" vira alvo de 44px no mobile (era link de 11px)', () => {
    const combat = readCss('combat.css');
    expect(combat).toMatch(/body\.is-portrait-narrow\s+\.ct-skip\s*\{[^}]*min-height:\s*44px/);
  });

  it('D3 — login respeita safe-area no padding (notch lateral no deitado)', () => {
    const modals = readCss('modals.css');
    expect(modals).toMatch(/\.login-screen\s*\{[\s\S]*?padding:[\s\S]*?env\(safe-area-inset-left/);
  });

  it('D3 — login comprime o cabeçalho em viewport curto (@media max-height:500 → title 26px)', () => {
    const modals = readCss('modals.css');
    expect(modals).toMatch(/@media\s*\(max-height:\s*500px\)[\s\S]*?\.login-screen\s+\.login-title\s*\{[^}]*font-size:\s*26px/);
  });

  it('D4 — recap de combate no deitado aperta (18vh, era 26vh) → o dock cresce', () => {
    const dock = readCss('m-camp-dock.css');
    expect(dock).toMatch(/body\.is-landscape-phone\s+\.camp-screen\.is-in-combat\s+\.ch-narration-host\s*\{[^}]*max-height:\s*clamp\(56px,\s*18vh,\s*110px\)/);
  });

  it('E1 — header de campanha vira UMA linha no deitado (chips na row 1 → header 110→61px)', () => {
    const core = readCss('campaign-core.css');
    expect(core).toMatch(/body\.is-landscape-phone\s+\.camp-header\s*\{[^}]*grid-template-areas:\s*"back title chips menu"/);
  });

  it('E2 — micro-labels (9-10px) escalam com --ux-font-scale via calc (sem shift no default)', () => {
    expect(readCss('campaign-party.css')).toMatch(/\.cp-pj-xp-txt\s*\{[^}]*font-size:\s*calc\(9px\s*\*\s*var\(--ux-font-scale/);
    expect(readCss('sheet.css')).toMatch(/\.sv-sub\s*\{[^}]*font-size:\s*calc\(9px\s*\*\s*var\(--ux-font-scale/);
    expect(readCss('sheet.css')).toMatch(/\.sa-name\s*\{[^}]*font-size:\s*calc\(9px\s*\*\s*var\(--ux-font-scale/);
    expect(readCss('wizard.css')).toMatch(/\.wlp-ab-key\s*\{\s*font-size:\s*calc\(9px\s*\*\s*var\(--ux-font-scale/);
  });
});

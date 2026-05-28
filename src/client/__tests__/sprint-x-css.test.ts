// Sprint X — CSS snapshot guards pras mudanças visuais novas.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_DIR = resolve(__dirname, '../styles');

function readCss(filename: string): string {
  return readFileSync(resolve(CSS_DIR, filename), 'utf-8');
}

describe('Sprint X.B1 — Feature chips no combat-target-sheet', () => {
  const cts = readCss('combat-target-sheet.css');

  it('cts-features-row container existe', () => {
    expect(cts).toMatch(/\.cts-features-row\s*\{/);
  });

  it('cts-feature-chip min-height 40 (hit WCAG AA)', () => {
    expect(cts).toMatch(/\.cts-feature-chip\s*\{[\s\S]*?min-height:\s*40px/);
  });

  it('cts-feature-uses tem badge com bg gold sutil', () => {
    expect(cts).toMatch(/\.cts-feature-uses\s*\{[\s\S]*?background:\s*rgba\(244,\s*208,\s*127,\s*0\.12\)/);
  });
});

describe('Sprint X.B2 — Initiative just-arrived transition', () => {
  const ribbon = readCss('initiative-ribbon.css');

  it('irb-just-arrived ring keyframe expansivo', () => {
    expect(ribbon).toMatch(/@keyframes\s+irb-arrived-ring/);
    expect(ribbon).toMatch(/@keyframes\s+irb-just-arrived/);
  });

  it('is-just-arrived avatar animation combina pulse + arrived', () => {
    expect(ribbon).toMatch(/\.irb-node\.is-just-arrived\s+\.irb-avatar\s*\{[\s\S]*?irb-current-pulse[\s\S]*?irb-just-arrived/);
  });

  it('is-just-arrived pseudo-element ring gold', () => {
    expect(ribbon).toMatch(/\.irb-node\.is-just-arrived::before\s*\{[\s\S]*?border:\s*2px\s+solid\s+var\(--ink-gold\)/);
  });

  it('reduced-motion fallback NÃO anima ring', () => {
    expect(ribbon).toMatch(/prefers-reduced-motion[\s\S]*?\.irb-node\.is-just-arrived::before[\s\S]*?animation:\s*none/);
  });
});

describe('Sprint X.B3 — Scene pin sticky', () => {
  const core = readCss('campaign-core.css');

  it('cn-scene-pin tem position sticky top 0 z-index 5', () => {
    expect(core).toMatch(/\.cn-scene-pin\s*\{[\s\S]*?position:\s*sticky/);
    expect(core).toMatch(/\.cn-scene-pin\s*\{[\s\S]*?top:\s*0/);
    expect(core).toMatch(/\.cn-scene-pin\s*\{[\s\S]*?z-index:\s*5/);
  });

  it('cn-scene-pin tem border-left gold + backdrop blur', () => {
    expect(core).toMatch(/\.cn-scene-pin\s*\{[\s\S]*?border-left:\s*3px\s+solid\s+var\(--ink-gold\)/);
    expect(core).toMatch(/\.cn-scene-pin\s*\{[\s\S]*?backdrop-filter:\s*blur\(4px\)/);
  });

  it('preview Cardo italic 13px / full 14px', () => {
    expect(core).toMatch(/\.cn-scene-pin-preview\s*\{[\s\S]*?font-family:\s*'Cardo'/);
    expect(core).toMatch(/\.cn-scene-pin-preview\s*\{[\s\S]*?font-style:\s*italic/);
    expect(core).toMatch(/\.cn-scene-pin-preview\s*\{[\s\S]*?font-size:\s*13px/);
    expect(core).toMatch(/\.cn-scene-pin-full\s*\{[\s\S]*?font-size:\s*14px/);
  });

  it('is-expanded esconde preview mostra full', () => {
    expect(core).toMatch(/\.cn-scene-pin\.is-expanded\s+\.cn-scene-pin-preview\s*\{\s*display:\s*none/);
    expect(core).toMatch(/\.cn-scene-pin\.is-expanded\s+\.cn-scene-pin-full\s*\{\s*display:\s*block/);
  });
});

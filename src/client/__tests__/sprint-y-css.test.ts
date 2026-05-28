// Sprint Y — CSS snapshot guards.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_DIR = resolve(__dirname, '../styles');

function readCss(filename: string): string {
  return readFileSync(resolve(CSS_DIR, filename), 'utf-8');
}

describe('Y.A2 — Death save heartbeat vinheta', () => {
  const core = readCss('campaign-core.css');

  it('body.is-death-save-pending ativa pseudo-element vermelho', () => {
    expect(core).toMatch(/body\.is-death-save-pending::after/);
    expect(core).toMatch(/@keyframes\s+deathSaveHeartbeatVignette/);
  });

  it('keyframe tem 4 stops (sístole 20%, diástole 45%, batimento 2 60%, repouso 0/100)', () => {
    expect(core).toMatch(/@keyframes\s+deathSaveHeartbeatVignette[\s\S]*?0%,\s*100%/);
    expect(core).toMatch(/@keyframes\s+deathSaveHeartbeatVignette[\s\S]*?20%/);
    expect(core).toMatch(/@keyframes\s+deathSaveHeartbeatVignette[\s\S]*?45%/);
    expect(core).toMatch(/@keyframes\s+deathSaveHeartbeatVignette[\s\S]*?60%/);
  });

  it('reduced-motion fallback sem animation', () => {
    expect(core).toMatch(/prefers-reduced-motion[\s\S]*?is-death-save-pending::after[\s\S]*?animation:\s*none/);
  });
});

describe('Y.B1 — Vinheta + ring sincronizados', () => {
  const ribbon = readCss('initiative-ribbon.css');

  it('body.is-combat-just-started atrasa ring 400ms (animation-delay)', () => {
    expect(ribbon).toMatch(/body\.is-combat-just-started\s+\.irb-node\.is-just-arrived/);
    expect(ribbon).toMatch(/body\.is-combat-just-started[\s\S]*?irb-just-arrived[\s\S]*?400ms/);
    expect(ribbon).toMatch(/body\.is-combat-just-started\s+\.irb-node\.is-just-arrived::before\s*\{[\s\S]*?animation-delay:\s*400ms/);
  });
});

describe('Y.B2 — Reward juice confetti + item reveal', () => {
  const rj = readCss('reward-juice.css');

  it('confetti container z-index alto', () => {
    expect(rj).toMatch(/\.rj-confetti-container\s*\{[\s\S]*?z-index:\s*9700/);
  });

  it('keyframe rj-fall-spin (top) + rj-burst-radial (center)', () => {
    expect(rj).toMatch(/@keyframes\s+rj-fall-spin/);
    expect(rj).toMatch(/@keyframes\s+rj-burst-radial/);
  });

  it('item reveal card tem glow gold + scale-in keyframe', () => {
    expect(rj).toMatch(/\.rj-item-reveal-card\s*\{[\s\S]*?box-shadow:[\s\S]*?rgba\(244,\s*208,\s*127/);
    expect(rj).toMatch(/@keyframes\s+rj-card-reveal/);
  });

  it('reduced-motion fallback pra confetti (fade only)', () => {
    expect(rj).toMatch(/prefers-reduced-motion[\s\S]*?\.rj-confetti-particle[\s\S]*?rj-fade-only/);
  });

  it('reduced-motion fallback pra item reveal (sem scale-in)', () => {
    expect(rj).toMatch(/prefers-reduced-motion[\s\S]*?\.rj-item-reveal-card[\s\S]*?rj-overlay-fade-in/);
  });
});

describe('Y.B3 — Combat echo no narration-log', () => {
  const core = readCss('campaign-core.css');

  it('.is-combat-echo tem border-left rounded + Cardo italic', () => {
    expect(core).toMatch(/\.camp-narr-entry\.is-combat-echo\s*\{[\s\S]*?border-left/);
    expect(core).toMatch(/\.is-combat-echo\s+\.cnn-text\s*\{[\s\S]*?font-family:\s*'Cardo'/);
    expect(core).toMatch(/\.is-combat-echo\s+\.cnn-text\s*\{[\s\S]*?font-style:\s*italic/);
  });

  it('cor distinta por kind: crit gold uppercase / death red bold / miss mute', () => {
    expect(core).toMatch(/\.is-combat-echo-crit[\s\S]*?text-transform:\s*uppercase/);
    expect(core).toMatch(/\.is-combat-echo-death[\s\S]*?ff8070/);
    expect(core).toMatch(/\.is-combat-echo-miss[\s\S]*?ink-mute/);
  });

  it('tabular-nums pro número estável', () => {
    expect(core).toMatch(/\.is-combat-echo\s+\.cnn-text\s*\{[\s\S]*?tabular-nums/);
  });
});

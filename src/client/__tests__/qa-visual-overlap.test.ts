// QA-lançamento — Ciclo H (visual global). Guards das sobreposições reais
// achadas por DOIS Inspetores Visuais independentes (modais D/E + mapa z-index
// global) e reproduzidas:
//   H4/#2: confetti do level-up ficava ATRÁS do backdrop (.lvlup-backdrop
//          z-9999, fundo rgba(0,0,0,.75)) → o "Marvel Snap moment" era engolido.
//   #1:    .lvlup-backdrop/.lvlup-card sem scroll → topo do card cortado em
//          viewport curto (celular deitado / level-up de muitas notas).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rewardCss = readFileSync(resolve(here, '../styles/reward-juice.css'), 'utf8');
const partyCss = readFileSync(resolve(here, '../styles/campaign-party.css'), 'utf8');

function zOf(css: string, selector: string): number {
  // pega o primeiro bloco do seletor e extrai z-index
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  const body = m?.[1];
  if (!body) return NaN;
  const z = body.match(/z-index:\s*(\d+)/);
  return z?.[1] ? parseInt(z[1], 10) : NaN;
}

describe('QA-lançamento H — sobreposições do level-up', () => {
  it('H4/#2: confetti fica ACIMA do backdrop do level-up (não é engolido)', () => {
    const confettiZ = zOf(rewardCss, '.rj-confetti-container');
    const backdropZ = zOf(partyCss, '.lvlup-backdrop');
    expect(confettiZ).toBeGreaterThan(0);
    expect(backdropZ).toBeGreaterThan(0);
    expect(confettiZ).toBeGreaterThan(backdropZ); // antes: 9700 < 9999 (occluso)
  });

  it('#1: o backdrop do level-up rola (overflow-y) — não prende conteúdo cortado', () => {
    const block = partyCss.match(/\.lvlup-backdrop\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/overflow-y:\s*auto/);
  });

  it('#1: o card do level-up tem teto de altura + scroll interno (viewport curto)', () => {
    const block = partyCss.match(/\.lvlup-card\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/max-height:/);
    expect(block).toMatch(/overflow-y:\s*auto/);
  });
});

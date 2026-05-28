// Sprint Φ.5 — Snapshot da tipografia D&D autêntica.
// Garante que Cinzel (heading) + Cardo (body) estão carregadas via Google Fonts
// e aplicadas via tokens em componentes-chave.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf-8');
}

describe('Φ.5 — Google Fonts loading', () => {
  const html = read('index.html');

  it('inclui preconnect pra fonts.googleapis.com (perf)', () => {
    expect(html).toMatch(/preconnect.*fonts\.googleapis\.com/);
  });

  it('inclui preconnect pra fonts.gstatic.com (perf)', () => {
    expect(html).toMatch(/preconnect.*fonts\.gstatic\.com/);
  });

  it('carrega Cinzel via Google Fonts CSS2', () => {
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?[^"]*family=Cinzel/);
  });

  it('carrega Cardo via Google Fonts CSS2 (na mesma URL)', () => {
    expect(html).toMatch(/family=Cardo/);
  });

  it('usa display=swap pra evitar FOIT', () => {
    expect(html).toMatch(/display=swap/);
  });
});

describe('Φ.5 — Tokens de fonte', () => {
  const tokens = read('src/client/styles/_tokens.css');

  it('--font-heading inicia com Cinzel + fallback Trajan', () => {
    expect(tokens).toMatch(/--font-heading:\s*'Cinzel',\s*'Trajan Pro'/);
  });

  it('--font-body inicia com Cardo (autêntica D&D)', () => {
    expect(tokens).toMatch(/--font-body:\s*'Cardo',/);
  });

  it('--font-body tem fallback Bookman Old Style', () => {
    expect(tokens).toMatch(/--font-body:[^;]*'Bookman Old Style'/);
  });

  it('--font-body termina em fallback serif', () => {
    expect(tokens).toMatch(/--font-body:[^;]*serif/);
  });

  it('--font-ui mantém sans-serif do sistema (UI controls)', () => {
    expect(tokens).toMatch(/--font-ui:[^;]*sans-serif/);
  });
});

describe('Φ.5 — Componentes Φ.* usam tokens corretos', () => {
  it('stat-block.css usa var(--font-body) pro body do livro', () => {
    const css = read('src/client/styles/stat-block.css');
    expect(css).toMatch(/font-family:\s*var\(--font-body\)/);
  });

  it('stat-block-name usa var(--font-heading) (Cinzel uppercase)', () => {
    const css = read('src/client/styles/stat-block.css');
    expect(css).toMatch(/\.stat-block-name\s*\{[\s\S]*?font-family:\s*var\(--font-heading\)/);
  });

  it('spell-card .sc-name usa var(--font-heading)', () => {
    const css = read('src/client/styles/spell-card.css');
    expect(css).toMatch(/\.sc-name\s*\{[\s\S]*?font-family:\s*var\(--font-heading\)/);
  });

  it('item-card .ic-name usa var(--font-heading)', () => {
    const css = read('src/client/styles/item-card.css');
    expect(css).toMatch(/\.ic-name\s*\{[\s\S]*?font-family:\s*var\(--font-heading\)/);
  });

  it('item-card meta usa var(--font-ui) (small caps style)', () => {
    const css = read('src/client/styles/item-card.css');
    expect(css).toMatch(/\.ic-meta\s*\{[\s\S]*?font-family:\s*var\(--font-ui\)/);
  });

  it('spell-card subline usa var(--font-ui)', () => {
    const css = read('src/client/styles/spell-card.css');
    expect(css).toMatch(/\.sc-subline\s*\{[\s\S]*?font-family:\s*var\(--font-ui\)/);
  });
});

// T1.1 — Onboarding tour content PT-BR família.
// Lê o source e garante que termos em inglês não voltam.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOUR_PATH = resolve(__dirname, '../onboarding-tour.ts');
const src = readFileSync(TOUR_PATH, 'utf-8');

// Extrai o array STEPS (só os campos title/text). Suficiente pra verificar
// content sem rodar o módulo (que depende do DOM).
function extractStepTexts(): string {
  // Pega da declaração const STEPS até o ];
  const m = src.match(/const STEPS:\s*Step\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('STEPS array not found');
  return m[1]!;
}

describe('T1.1 — onboarding tour microcopy PT-BR família', () => {
  const steps = extractStepTexts();

  it('NÃO usa "Player\'s Handbook" (inglês)', () => {
    expect(steps).not.toContain("Player's Handbook");
    expect(steps).not.toContain('Players Handbook');
  });

  it('usa "Livro do Jogador" (PT-BR equivalente)', () => {
    expect(steps).toContain('Livro do Jogador');
  });

  it('mantém referência D&D 5e (precisão Mariana)', () => {
    expect(steps).toContain('D&D 5e');
  });

  it('mantém 4 steps (estrutura)', () => {
    const titles = steps.match(/title:\s*['"]/g) ?? [];
    expect(titles.length).toBe(4);
  });
});

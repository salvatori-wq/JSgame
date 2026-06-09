// QW-2 — Guards: a prévia de streaming (Fase 2) é limpa em TODOS os desfechos
// de turno, não só no caminho feliz. Sem isso a prévia fica órfã (texto
// fantasma) quando: narração degrada, socket dá erro, player toca ação nova
// antes do final, ou o watchdog estoura. Guards de fonte no estilo do repo
// (mobile-polish-css.test.ts) — o primitivo em si é testado em
// narration-log-streaming.test.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '../campaign-screen.ts'), 'utf-8');

function between(start: string, end: string): string {
  const i = src.indexOf(start);
  expect(i, `âncora "${start}" sumiu — guard precisa de update`).toBeGreaterThan(-1);
  const j = src.indexOf(end, i);
  expect(j, `âncora final "${end}" sumiu — guard precisa de update`).toBeGreaterThan(i);
  return src.slice(i, j);
}

describe('QW-2 — clearStreamingPreview em todos os desfechos de turno', () => {
  it('dmNarration: limpa ANTES do branch degradado (cobre final E degradado)', () => {
    const block = between('// Append no log persistente OU error card se degradado', 'if (isDegraded) {');
    expect(block).toContain('clearStreamingPreview()');
  });

  it('onError do socket: limpa a prévia (o final que a substituiria nunca vem)', () => {
    const block = between('const onError = (msg: string): void =>', "s.on('error', onError)");
    expect(block).toContain('clearStreamingPreview()');
  });

  it('takeAction novo: descarta prévia do turno anterior (player impaciente)', () => {
    const block = between('private takeAction(', 'startResponseWatchdog();');
    expect(block).toContain('clearStreamingPreview()');
  });

  it('watchdog estourado (Mestre mudo): prévia órfã sai junto com o aviso', () => {
    const block = between('private startResponseWatchdog(', 'DM_RESPONSE_TIMEOUT_MS');
    expect(block).toContain('clearStreamingPreview()');
  });
});

describe('QW-2 — toggle typewriter morto removido dos Ajustes', () => {
  it('ux-settings-modal não renderiza mais o segment de typewriter', () => {
    const modal = readFileSync(resolve(__dirname, '../../ux-settings-modal.ts'), 'utf-8');
    expect(modal).not.toContain('Velocidade narração');
    expect(modal).not.toContain('typewriterSpeed');
  });

  it('ux-prefs não tem mais a pref typewriterSpeed (storage antigo é ignorado)', () => {
    const prefs = readFileSync(resolve(__dirname, '../../ux-prefs.ts'), 'utf-8');
    expect(prefs).not.toContain('typewriterSpeed:');
    expect(prefs).not.toContain("out.typewriterSpeed");
  });
});

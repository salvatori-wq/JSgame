// QW-3 — Guards: nenhuma espera de servidor fica MUDA. O takeAction já tinha
// watchdog (30s); agora: joinCampaign (cold-open, 2 estágios 12s/45s),
// descansos (curto/longo, 15s esperando campaignState) e o start do lobby
// (loading + 20s). Guards de fonte no estilo do repo.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const campaign = readFileSync(resolve(__dirname, '../campaign-screen.ts'), 'utf-8');
const lobby = readFileSync(resolve(__dirname, '../../lobby/lobby-screen.ts'), 'utf-8');
const spellModal = readFileSync(resolve(__dirname, '../../spells/cast-spell-modal.ts'), 'utf-8');

function section(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  expect(i, `âncora "${start}" sumiu — guard precisa de update`).toBeGreaterThan(-1);
  const j = src.indexOf(end, i);
  expect(j, `âncora final "${end}" sumiu — guard precisa de update`).toBeGreaterThan(i);
  return src.slice(i, j);
}

describe('QW-3 — joinCampaign (cold-open) com watchdog', () => {
  it('start() arma o watchdog logo após o emit joinCampaign', () => {
    const block = section(campaign, "emit('joinCampaign'", 'destroy()');
    expect(block).toContain('armJoinWatchdog()');
  });

  it('1º campaignState desarma join + state watchdogs (sem falso positivo no rejoin)', () => {
    const block = section(campaign, 'const onState = (state: CampaignState)', 'Detecta "agora é teu turno');
    expect(block).toContain('clearJoinWatchdog()');
    expect(block).toContain('clearStateWatchdog()');
  });

  it('estágios: aviso de cold-start (12s) e erro com saída (45s)', () => {
    const block = section(campaign, 'private armJoinWatchdog', 'private clearJoinWatchdog');
    expect(block).toContain('12_000');
    expect(block).toContain('45_000');
    expect(block).toContain('acordando'); // mensagem cobre o cold-start do Render free
  });

  it('destroy() limpa os watchdogs novos (sem toast fantasma pós-saída)', () => {
    const block = section(campaign, 'destroy(): void {', 'socketCleanups = []');
    expect(block).toContain('clearJoinWatchdog()');
    expect(block).toContain('clearStateWatchdog()');
  });
});

describe('QW-3 — descansos com watchdog de estado', () => {
  it('shortRest arma o watchdog junto do emit', () => {
    const block = section(campaign, "emit('shortRest'", 'confirmLongRest');
    expect(block).toContain("armStateWatchdog('O descanso')");
  });

  it('longRest (ritual) arma o watchdog junto do emit — tela não fica presa no amanhecer', () => {
    expect(campaign).toContain('private performLongRest');
    expect(campaign).toContain("armStateWatchdog('O descanso longo')");
    // e o emit longRest do ritual vem acompanhado do watchdog (mesmo bloco)
    const ritual = section(campaign, "this.opts.socket.emit('longRest')", '}');
    expect(ritual).toContain('armStateWatchdog');
  });

  it('CTA "Descansar 8h" do grimório delega pro caller (ritual + watchdog)', () => {
    expect(spellModal).toContain('onLongRest?: () => void');
    expect(spellModal).toContain('opts.onLongRest');
    expect(campaign).toContain('onLongRest: () => this.performLongRest()');
  });
});

describe('QW-3 — lobby start com loading + timeout', () => {
  it('clique vira estado pending (1 clique só) + timeout de 20s re-habilita', () => {
    const block = section(lobby, 'private handleStartCampaign', 'private render');
    expect(block).toContain('if (this.startPending) return');
    expect(block).toContain('20_000');
  });

  it('botão desabilita e mostra "Convocando" enquanto pending', () => {
    expect(lobby).toContain('Convocando o Mestre');
    expect(lobby).toContain('disabled: !allReady || this.startPending');
  });

  it('lobbyRedirect e error desarmam o pending (sem toast atrasado)', () => {
    const redirect = section(lobby, 'const onRedirect', "s.on('lobbyRedirect'");
    expect(redirect).toContain('clearStartTimeout()');
    const err = section(lobby, 'const onError', "s.on('error'");
    expect(err).toContain('startPending = false');
  });
});

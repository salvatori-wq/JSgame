// @vitest-environment happy-dom
// Chat refactor — tests pras helpers puras do narration-log.
// O componente NarrationLog em si depende de DOM, mas as funções de decisão
// (isDegradedNarration, shouldAutoRetrySilent, shouldTtsSpeak) são puras.
// Sub-sprint C — happy-dom adicionado pra cobrir is-first-narration class.

import { describe, it, expect, vi } from 'vitest';
import { isDegradedNarration, shouldAutoRetrySilent } from '../narration-log';

describe('isDegradedNarration', () => {
  it('reconhece "Mestre (degradado)"', () => {
    expect(isDegradedNarration('Mestre (degradado)')).toBe(true);
  });
  it('reconhece "Mestre (offline)"', () => {
    expect(isDegradedNarration('Mestre (offline)')).toBe(true);
  });
  it('NÃO sinaliza "Mestre" puro', () => {
    expect(isDegradedNarration('Mestre')).toBe(false);
  });
  it('NÃO sinaliza NPCs', () => {
    expect(isDegradedNarration('Borin Forjarocha')).toBe(false);
    expect(isDegradedNarration('Sistema')).toBe(false);
  });
  it('NÃO sinaliza "Mestre (sombrio)" — personality, não fallback', () => {
    expect(isDegradedNarration('Mestre (sombrio)')).toBe(false);
  });
});

describe('shouldAutoRetrySilent', () => {
  const baseAction = { action: 'explore', timestamp: Date.now() };

  it('retry quando degradado + lastAction recente + não retry ainda', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(true);
  });

  it('NÃO retry se speaker for narração normal', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry se já tentou no ciclo', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: baseAction,
      alreadyRetried: true,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry sem lastAction (não sabemos o que reenviar)', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: null,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(false);
  });

  it('NÃO retry se lastAction muito velha (>30s)', () => {
    const now = Date.now();
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (degradado)',
      lastAction: { action: 'explore', timestamp: now - 35_000 },
      alreadyRetried: false,
      nowMs: now,
    });
    expect(r).toBe(false);
  });

  it('retry borderline 29s atrás (dentro da janela)', () => {
    const now = Date.now();
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (offline)',
      lastAction: { action: 'attack', timestamp: now - 29_000 },
      alreadyRetried: false,
      nowMs: now,
    });
    expect(r).toBe(true);
  });

  it('reconhece variant "offline" também', () => {
    const r = shouldAutoRetrySilent({
      speaker: 'Mestre (offline)',
      lastAction: baseAction,
      alreadyRetried: false,
      nowMs: Date.now(),
    });
    expect(r).toBe(true);
  });
});

describe('NarrationLog — DOM smoke (JSDOM)', () => {
  // Vitest default env é node — pulamos esses tests no CI atual.
  // Mas marcamos a expectativa: o componente é exercitado em e2e/preview.
  it.skip('append entries persistem entre updates', async () => {
    // Placeholder pra futura suite com @vitest/browser ou playwright.
  });
});

// Sub-sprint C — Tests do is-first-narration usando happy-dom (não persiste,
// só smoke do build do entry el).
describe('NarrationLog — is-first-narration (DOM)', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — não tem DOM', () => {});
    return;
  }
  const { NarrationLog } = await import('../narration-log');
  const newLog = (): { log: InstanceType<typeof NarrationLog>; el: HTMLElement } => {
    const log = new NarrationLog();
    return { log, el: log.element };
  };

  it('primeira narração ganha .is-first-narration', () => {
    const { log, el } = newLog();
    log.appendNarration({ speaker: 'Mestre', text: 'A chuva cai. Você abre os olhos.' });
    const entry = el.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-first-narration')).toBe(true);
    log.destroy();
  });

  it('narrações seguintes NÃO ganham .is-first-narration', () => {
    const { log, el } = newLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Primeira.' });
    log.appendNarration({ speaker: 'Mestre', text: 'Segunda.' });
    const entries = el.querySelectorAll('.camp-narr-entry');
    expect(entries.length).toBe(2);
    expect(entries[0]?.classList.contains('is-first-narration')).toBe(true);
    expect(entries[1]?.classList.contains('is-first-narration')).toBe(false);
    log.destroy();
  });

  it('só a primeira entry de qualquer speaker recebe .is-first-narration', () => {
    const { log, el } = newLog();
    // primeira entry — não importa speaker, ganha is-first
    log.appendNarration({ speaker: 'TestPlayer', text: 'oi galera' });
    log.appendNarration({ speaker: 'Mestre', text: 'O Mestre olha.' });
    const entries = el.querySelectorAll('.camp-narr-entry');
    expect(entries[0]?.classList.contains('is-first-narration')).toBe(true);
    expect(entries[1]?.classList.contains('is-first-narration')).toBe(false);
    log.destroy();
  });
});

// M2.3 — Echo do roll/save/skip ganha class .is-roll-echo pra styling distinto.
describe('NarrationLog — M2.3 is-roll-echo', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — não tem DOM', () => {});
    return;
  }
  const { NarrationLog } = await import('../narration-log');

  it('echo de skill-check ("🎲 Borin: ...") ganha .is-roll-echo', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🎲 Borin Forjarocha', text: 'percepcao (DC 12): rolou 15 → SUCESSO' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo')).toBe(true);
    log.destroy();
  });

  it('echo de save ("🛡 Borin: ...") ganha .is-roll-echo', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🛡 Borin Forjarocha', text: 'Save DEX (DC 13): rolou 18 → SUCESSO' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo')).toBe(true);
    log.destroy();
  });

  it('echo de skip ("🚶 Borin: ...") ganha .is-roll-echo', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🚶 Borin Forjarocha', text: 'pula o teste e segue em frente' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo')).toBe(true);
    log.destroy();
  });

  // U7 — eco do roll colorido por desfecho (verde sucesso / vermelho falha).
  it('U7 — echo SUCESSO ganha .is-roll-echo-success', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🎲 Borin', text: 'percepcao (DC 12): rolou 18 → SUCESSO' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo-success')).toBe(true);
    expect(entry?.classList.contains('is-roll-echo-fail')).toBe(false);
    log.destroy();
  });

  it('U7 — echo FALHOU ganha .is-roll-echo-fail', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🎲 Borin', text: 'furtividade (DC 15): rolou 7 → FALHOU' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo-fail')).toBe(true);
    expect(entry?.classList.contains('is-roll-echo-success')).toBe(false);
    log.destroy();
  });

  it('U7 — NAT1 FALHA classifica como fail', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🎲 Borin', text: 'atletismo (DC 10): rolou 1 → NAT1 FALHA' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo-fail')).toBe(true);
    log.destroy();
  });

  it('U7 — NAT20 CRIT classifica como success', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: '🎲 Borin', text: 'persuasao (DC 18): rolou 20 → NAT20 CRIT' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo-success')).toBe(true);
    log.destroy();
  });

  it('U7 — narração normal com "sucesso" no texto NÃO ganha outcome (só roll-echo)', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Você obteve sucesso em fugir da cidade.' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo-success')).toBe(false);
    log.destroy();
  });

  it('narração normal do Mestre NÃO ganha .is-roll-echo', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'A chuva fina cai sobre a estrada.' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo')).toBe(false);
    log.destroy();
  });

  it('NPC speaker ("Borin" sem prefix de dado) NÃO ganha .is-roll-echo', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Forjarocha', text: 'Quem vem lá?' });
    const entry = log.element.querySelector('.camp-narr-entry');
    expect(entry?.classList.contains('is-roll-echo')).toBe(false);
    log.destroy();
  });
});

// W2.1 (era N3.3) — Drop-cap inteligente: aparece nas primeiras 3 narrações
// da cena + 1ª após location change. Consultor Mobile pediu: NÃO drop-cap
// sempre — vira ruído visual em log longo. Tamanho via data-drop-cap='sm'|'md'
// (curta < 100 chars vira sm).
describe('NarrationLog — W2.1 drop-cap inteligente', async () => {
  if (typeof document === 'undefined') {
    it.skip('skip — não tem DOM', () => {});
    return;
  }
  const { NarrationLog } = await import('../narration-log');

  it('primeira narração CURTA (<100 chars) recebe data-drop-cap="sm"', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Chuva fria começa.' }); // curto
    const entry = log.element.querySelector('.is-first-narration') as HTMLElement;
    expect(entry?.dataset.dropCap).toBe('sm');
    expect(entry?.dataset.dropCapActive).toBe('1');
    log.destroy();
  });

  it('narração começando com palavra de 1 letra ("O ", "A ") NÃO recebe drop-cap (evita "Obrutamonte")', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'O brutamonte avança pelo mercado.' });
    const entry = log.element.querySelector('.is-first-narration') as HTMLElement;
    expect(entry?.dataset.dropCapActive).toBeUndefined();
    log.destroy();
  });

  it('primeira narração LONGA (>100 chars) recebe data-drop-cap="md"', () => {
    const log = new NarrationLog();
    const longText = 'Chuva fina cai sobre a estrada. Borin Forjarocha reconhece o caminho — passou por aqui há anos, em outra vida.';
    log.appendNarration({ speaker: 'Mestre', text: longText });
    const entry = log.element.querySelector('.is-first-narration') as HTMLElement;
    expect(entry?.dataset.dropCap).toBe('md');
    expect(entry?.dataset.dropCapActive).toBe('1');
    log.destroy();
  });

  it('primeiras 3 narrações do Mestre na mesma cena recebem drop-cap; 4ª NÃO', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Primeira.', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: 'Segunda.', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: 'Terceira.', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: 'Quarta.', currentLocation: 'taverna' });
    const entries = log.element.querySelectorAll('.camp-narr-entry');
    expect((entries[0] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    expect((entries[1] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    expect((entries[2] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    expect((entries[3] as HTMLElement)?.dataset.dropCapActive).toBeUndefined();
    log.destroy();
  });

  it('1ª narração após location change reseta counter e ganha drop-cap (mesmo após 3+ na cena anterior)', () => {
    const log = new NarrationLog();
    // 4 na taverna → 4ª não tem drop-cap
    log.appendNarration({ speaker: 'Mestre', text: '1', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: '2', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: '3', currentLocation: 'taverna' });
    log.appendNarration({ speaker: 'Mestre', text: '4', currentLocation: 'taverna' });
    // Vira a esquina → nova cena, dropcap volta
    log.appendNarration({ speaker: 'Mestre', text: 'Floresta densa começa…', currentLocation: 'floresta' });
    const entries = log.element.querySelectorAll('.camp-narr-entry');
    expect((entries[3] as HTMLElement)?.dataset.dropCapActive).toBeUndefined();
    expect((entries[4] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    log.destroy();
  });

  it('echo de roll NÃO consome cota de drop-cap (não é narração do Mestre)', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'Primeira.', currentLocation: 'cela' });
    log.appendNarration({ speaker: '🎲 Borin', text: 'percepcao DC 12 → SUCESSO', currentLocation: 'cela' });
    log.appendNarration({ speaker: 'Mestre', text: 'Segunda.', currentLocation: 'cela' });
    log.appendNarration({ speaker: 'Mestre', text: 'Terceira.', currentLocation: 'cela' });
    const entries = log.element.querySelectorAll('.camp-narr-entry');
    // Roll-echo não conta — 3 Mestre narrations todas têm drop-cap.
    expect((entries[0] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    expect((entries[2] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    expect((entries[3] as HTMLElement)?.dataset.dropCapActive).toBe('1');
    log.destroy();
  });
});

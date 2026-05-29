// @vitest-environment happy-dom
// ④ Redesign — scene-pin scroll-aware + supressão em combate.
//
// O reveal "quando a narração viva saiu de vista" depende de layout real
// (getBoundingClientRect) → coberto na verificação do preview. Aqui cobrimos
// o que é determinístico sem layout: pin não nasce revelado, combate esconde,
// e setCombatMode é seguro/idempotente.

import { describe, it, expect } from 'vitest';
import { NarrationLog } from '../narration-log';

function withTwoScenes(): NarrationLog {
  const log = new NarrationLog();
  log.appendNarration({ speaker: 'Mestre', text: 'A chuva começa a cair sobre a estrada.' });
  log.appendNarration({ speaker: 'Mestre', text: 'Três capuzes se fecham ao seu redor.' });
  return log;
}

describe('④ scene-pin — não duplica a cena viva (não nasce revelado)', () => {
  it('pin existe após 2 narrações mas SEM is-revealed (cena viva visível)', () => {
    const log = withTwoScenes();
    const pin = log.element.querySelector('.cn-scene-pin');
    expect(pin).toBeTruthy();
    expect(pin!.classList.contains('is-revealed')).toBe(false);
    log.destroy();
  });
});

describe('④ scene-pin — some em combate (setCombatMode)', () => {
  it('setCombatMode(true) remove is-revealed do pin', () => {
    const log = withTwoScenes();
    const pin = log.element.querySelector('.cn-scene-pin') as HTMLElement;
    pin.classList.add('is-revealed'); // simula pin revelado (scrollado)
    log.setCombatMode(true);
    expect(pin.classList.contains('is-revealed')).toBe(false);
    log.destroy();
  });

  it('setCombatMode é idempotente e não lança', () => {
    const log = withTwoScenes();
    expect(() => {
      log.setCombatMode(true);
      log.setCombatMode(true);
      log.setCombatMode(false);
    }).not.toThrow();
    log.destroy();
  });
});

describe('④ scene-pin — lifecycle legado preservado', () => {
  it('1ª narração de Mestre ainda NÃO cria pin (não duplica cold-open)', () => {
    const log = new NarrationLog();
    log.appendNarration({ speaker: 'Mestre', text: 'A chuva começa.' });
    expect(log.element.querySelector('.cn-scene-pin')).toBeNull();
    log.destroy();
  });

  it('toggle expande/colapsa mesmo com o pin oculto por padrão', () => {
    const log = withTwoScenes();
    const head = log.element.querySelector('.cn-scene-pin-head') as HTMLButtonElement;
    const pin = log.element.querySelector('.cn-scene-pin') as HTMLElement;
    head.click();
    expect(pin.classList.contains('is-expanded')).toBe(true);
    head.click();
    expect(pin.classList.contains('is-expanded')).toBe(false);
    log.destroy();
  });
});

// α.4 — Tests helpers puros do voice-stt.
// O wrapper sobre SpeechRecognition em si depende de browser API e é
// exercitado via E2E/preview (não fácil de mockar em vitest node env).

import { describe, it, expect } from 'vitest';
import { sttErrorMessage, shouldShowVoiceMic } from '../voice-stt';

describe('sttErrorMessage', () => {
  it('mensagem amigável pra not-allowed (mic bloqueado)', () => {
    expect(sttErrorMessage('not-allowed')).toMatch(/Microfone/i);
    expect(sttErrorMessage('not-allowed')).toMatch(/permissão/i);
  });

  it('alias service-not-allowed mesma mensagem', () => {
    expect(sttErrorMessage('service-not-allowed')).toBe(sttErrorMessage('not-allowed'));
  });

  it('no-speech sugere falar mais perto', () => {
    expect(sttErrorMessage('no-speech')).toMatch(/mic|microfone/i);
  });

  it('audio-capture menciona mic não encontrado', () => {
    expect(sttErrorMessage('audio-capture')).toMatch(/[Mm]ic/i);
  });

  it('network menciona rede', () => {
    expect(sttErrorMessage('network')).toMatch(/[Rr]ede/i);
  });

  it('unsupported sugere browser alternativo', () => {
    expect(sttErrorMessage('unsupported')).toMatch(/Chrome|Edge|Safari/i);
  });

  it('código desconhecido mostra o próprio código', () => {
    expect(sttErrorMessage('weirdo-code')).toMatch(/weirdo-code/);
  });

  it('aborted é mensagem neutra', () => {
    expect(sttErrorMessage('aborted')).toMatch(/[Cc]ancelada/);
  });
});

describe('shouldShowVoiceMic', () => {
  it('retorna false em ambiente node (sem SpeechRecognition)', () => {
    // vitest default env é node — sem window.SpeechRecognition
    expect(shouldShowVoiceMic()).toBe(false);
  });
});

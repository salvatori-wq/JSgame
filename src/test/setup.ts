// Fase 1 — setup global de testes (setupFiles no vitest.config). Mata, por
// construção, o vazamento de body.* entre arquivos no singleFork: vários testes
// setam document.body.className/innerHTML e dependiam de um afterEach copiado em
// cada arquivo. Agora um afterEach central limpa SEMPRE, mesmo onde esqueceram.
// (Só limpa o body — restaurar mocks globalmente quebraria specs que montam spy
// em beforeAll e asseguram entre vários it.)

import { afterEach } from 'vitest';

afterEach(() => {
  if (typeof document !== 'undefined' && document.body) {
    document.body.className = '';
    document.body.innerHTML = '';
  }
});

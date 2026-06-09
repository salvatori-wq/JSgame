// JSgame · Vitest config separada do Vite (UI dev).
// Testes que usam persistence (libsql/sqlite local) precisam rodar sequenciais
// pra evitar SQLITE_BUSY. Single-fork + sequence hooks default.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // todos os test files rodam no mesmo fork = sequencial
      },
    },
    // Aumenta timeout pra suites com I/O sqlite
    testTimeout: 10_000,
    // Fase 1 — testes de client default a happy-dom. Antes, um teste de DOM sem
    // o // @vitest-environment happy-dom rodava em node e PULAVA em silêncio
    // (typeof document === 'undefined' → it.skip) = cobertura-fantasma. Server/
    // dnd/shared seguem node (default). Um docblock explícito ainda sobrepõe isto.
    environmentMatchGlobs: [
      ['src/client/**', 'happy-dom'],
    ],
  },
});

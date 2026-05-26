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
  },
});

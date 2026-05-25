import { defineConfig } from 'vite';
import path from 'node:path';

// JSgame frontend dev server. Proxy /api e /socket.io pro backend Node (porta 3001).
// Backend roda separado via tsx watch — concurrently em dev.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@dnd': path.resolve(__dirname, 'src/dnd'),
    },
  },
  build: {
    outDir: 'dist/client',
    target: 'es2022',
    sourcemap: true,
  },
});

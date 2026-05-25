// JSgame · Client entry point. DOM puro, sem framework.
// F1 boot: splash + health check + mostra raças/classes carregadas do server.

import './styles.css';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';

const app = document.getElementById('app');
if (!app) throw new Error('#app não existe no DOM');

// Mobile-first body classes (aprendizado Cave Run mobile-3.0).
(function applyEnvironmentClasses(): void {
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const narrowScreen = Math.min(window.innerWidth, window.innerHeight) <= 480;
  if (hasCoarsePointer || hasTouch) document.body.classList.add('is-touch');
  if (narrowScreen) document.body.classList.add('is-portrait-narrow');
  document.body.classList.add('vertical-layout');

  // Vars CSS pra safe-area iOS (notch / home indicator)
  const root = document.documentElement;
  root.style.setProperty('--m-vh', '100dvh');
})();

// Socket.io connect — dev usa proxy do vite (/socket.io → :3001).
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
});

socket.on('connect', () => {
  console.log('[client] socket connected', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[client] socket disconnected:', reason);
});

socket.on('dmNarration', ({ text, speaker, mood }) => {
  console.log('[dm]', mood, speaker, text);
  // F2 vai renderizar isso em UI dedicada (narration box).
});

// Boot real
async function boot(): Promise<void> {
  // 1. Health check
  let health: { ok: boolean; service?: string; dmProvider?: string; hasGroq?: boolean; hasAnthropic?: boolean } = { ok: false };
  try {
    const res = await fetch('/api/health');
    health = await res.json();
  } catch (err) {
    console.warn('[boot] health falhou:', err);
  }

  // 2. Carrega D&D reference data
  const [races, classes] = await Promise.all([
    fetch('/api/dnd/races').then((r) => r.json()).catch(() => ({ races: [] })),
    fetch('/api/dnd/classes').then((r) => r.json()).catch(() => ({ classes: [] })),
  ]);

  // 3. Render
  app!.innerHTML = `
    <main class="boot-screen">
      <header class="boot-header">
        <h1 class="boot-title">JSGAME</h1>
        <div class="boot-divider">
          <span class="bd-line"></span>
          <span class="bd-glyph">◆</span>
          <span class="bd-line"></span>
        </div>
        <p class="boot-tagline">D&D 5e Online · Mestre IA · Coop até 3</p>
      </header>

      <section class="boot-status">
        <div class="bs-row ${health.ok ? 'is-ok' : 'is-fail'}">
          <span class="bs-key">Servidor</span>
          <span class="bs-val">${health.ok ? '✓ online' : '✗ offline'}</span>
        </div>
        <div class="bs-row ${health.hasGroq ? 'is-ok' : 'is-warn'}">
          <span class="bs-key">DM Provider</span>
          <span class="bs-val">${health.hasGroq ? `✓ ${health.dmProvider}` : '⚠ sem GROQ_API_KEY'}</span>
        </div>
        <div class="bs-row is-ok">
          <span class="bs-key">Raças</span>
          <span class="bs-val">${races.races?.length ?? 0} carregadas</span>
        </div>
        <div class="bs-row is-ok">
          <span class="bs-key">Classes</span>
          <span class="bs-val">${classes.classes?.length ?? 0} carregadas</span>
        </div>
      </section>

      <section class="boot-next">
        <h2>Próximas fases</h2>
        <ul class="boot-roadmap">
          <li><b>F1 Foundation</b> ✓ — config, server, client, D&D core</li>
          <li class="todo"><b>F2 Criação de PJ</b> — wizard raça → classe → atributos → antecedente</li>
          <li class="todo"><b>F3 Mestre + Exploração</b> — narração + skill checks</li>
          <li class="todo"><b>F4 Combate D&D</b> — initiative, ações, CA/HP/saves</li>
          <li class="todo"><b>F5 Social + Rest + Polish</b> — diálogos, descanso, mobile</li>
        </ul>
      </section>

      <footer class="boot-foot">
        <small>Pasta isolada · Cave Run preservado em prod · v0.1.0</small>
      </footer>
    </main>
  `;
}

boot().catch((err) => {
  console.error('[boot] erro:', err);
  app!.innerHTML = `<div class="boot-error">Falha no boot: ${String(err)}</div>`;
});

// JSgame · POLISH δ.2 — Connection status banner.
//
// Mostra banner sticky no topo quando socket desconecta. Some auto quando
// reconecta. Permite "Tentar agora" manual se demora.
//
// Status hierarquia:
//   - connected: nada visível
//   - disconnected: banner âmbar "🔌 Reconectando…" + spinner
//   - failed (timeout >15s): banner vermelho "❌ Sem conexão. Tentar agora?"

import type { Socket } from 'socket.io-client';

const BANNER_ID = 'jsgame-conn-banner';
const DISCONNECT_TIMEOUT_MS = 15000;  // após 15s muda pra "failed"

let disconnectTimer: number | null = null;

function ensureBanner(): HTMLDivElement {
  let banner = document.getElementById(BANNER_ID) as HTMLDivElement | null;
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'jsgame-conn-banner is-hidden';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  document.body.appendChild(banner);
  return banner;
}

function showReconnecting(): void {
  const banner = ensureBanner();
  banner.className = 'jsgame-conn-banner is-reconnecting';
  banner.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'jsgame-conn-spinner';
  spinner.textContent = '🔌';
  const txt = document.createElement('span');
  txt.className = 'jsgame-conn-text';
  txt.textContent = 'Reconectando ao servidor…';
  banner.appendChild(spinner);
  banner.appendChild(txt);
}

function showFailed(socket: Socket): void {
  const banner = ensureBanner();
  banner.className = 'jsgame-conn-banner is-failed';
  banner.textContent = '';
  const txt = document.createElement('span');
  txt.className = 'jsgame-conn-text';
  txt.textContent = '❌ Sem conexão. ';
  const retryBtn = document.createElement('button');
  retryBtn.className = 'jsgame-conn-retry';
  retryBtn.type = 'button';
  retryBtn.textContent = 'Tentar agora';
  retryBtn.addEventListener('click', () => {
    showReconnecting();
    socket.connect();
  });
  banner.appendChild(txt);
  banner.appendChild(retryBtn);
}

function hide(): void {
  const banner = document.getElementById(BANNER_ID) as HTMLDivElement | null;
  if (!banner) return;
  banner.className = 'jsgame-conn-banner is-hidden';
  banner.innerHTML = '';
}

/**
 * Instala handlers no socket pra mostrar/ocultar banner de status.
 * Idempotente — múltiplas chamadas só registram uma vez.
 */
let installed = false;
export function installConnectionStatusBanner(socket: Socket): void {
  if (installed) return;
  installed = true;

  socket.on('disconnect', () => {
    showReconnecting();
    if (disconnectTimer !== null) window.clearTimeout(disconnectTimer);
    disconnectTimer = window.setTimeout(() => {
      // Continua desconectado após 15s → muda pra failed
      if (!socket.connected) showFailed(socket);
    }, DISCONNECT_TIMEOUT_MS);
  });

  socket.on('connect', () => {
    if (disconnectTimer !== null) {
      window.clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    hide();
  });
}

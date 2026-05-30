// JSgame · Client entry point. Router DOM puro.
// Views: home → wizard (criação) → sheet (preview) → campaign (jogo real).

import './styles.css';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet } from '../shared/types';
import { listCharacters, getCharacter, deleteCharacter, getHealth, listCampaigns, deleteCampaign as deleteCampaignApi, trackClientMetric, type CampaignSummary } from './api';
import { el, getOwnerName, setOwnerName, getLastSession, clearLastSession } from './util';
import { CharacterWizard } from './character-creation/wizard';
import { CampaignScreen } from './campaign/campaign-screen';
import { LobbyScreen } from './lobby/lobby-screen';
import { LoginScreen } from './auth/login-screen';
import { ProfileScreen } from './profile/profile-screen';
import { toastError, toastWarn } from './toast';
import { confirmDialog } from './ui-modal';
import { SheetScreen } from './sheet/sheet-screen';
import { getMe, logout, type AuthUser } from './api';
import { getRace } from '../dnd/races';
import { getClass } from '../dnd/classes';
import { portraitFor } from '../dnd/portrait';
import { listTombstones, getStreak, type TombstoneDTO } from './api';
import { setupAudioGesture } from './audio';
import { initA11yEnhancements, initEscapeKeyHandler, initGlobalErrorBoundary } from './a11y';
import { installConnectionStatusBanner } from './connection-status';
import { initUxPrefs } from './ux-prefs';
import { mountHomeScreen } from './home/home-screen';
import { initInstallBanner } from './install-banner';
import { applyEnvironmentClasses } from './environment';

const app = document.getElementById('app');
if (!app) throw new Error('#app não existe no DOM');

// === Mobile-first body classes (device-aware) — Responsivo F3 ===
// O predicado vive em ./environment.ts (fonte única, testável pelo sweep F5).
// compact = retrato-estreito (w<600) OU deitado-curto-de-toque (coarse && h<600
// && w<950). landscape-phone = modifier aditivo. O gate `coarse` protege o
// desktop (janela fina/baixa de laptop NUNCA vira compact). Reavalia em resize.
applyEnvironmentClasses();
window.addEventListener('resize', applyEnvironmentClasses, { passive: true });
window.addEventListener('orientationchange', applyEnvironmentClasses, { passive: true });

// === Audio gesture (mobile autoplay policy) — resume AudioContext em qualquer click ===
setupAudioGesture();

// === POLISH ε — Acessibilidade & Resiliência ===
// initA11yEnhancements: MutationObserver aplica aria-label/role em todo DOM dinâmico
// initEscapeKeyHandler: ESC fecha modais bottom-sheet sem refactor por componente
// initGlobalErrorBoundary: window.onerror + unhandledrejection → toast user-friendly
initA11yEnhancements();
initEscapeKeyHandler();
initGlobalErrorBoundary();

// ο.8 — UX Preferences: load + apply ANTES de qualquer render pra evitar FOUC.
initUxPrefs();

// Ω.7 — PWA install banner: aparece em mobile browser (não standalone).
// João pediu "toda vez que entramos no jogo pelo celular sem ser pelo app".
// Dismiss válido só por sessão (sessionStorage) — banner reaparece na próxima visita.
initInstallBanner();

// === Service Worker (PWA — só em prod, evita conflito com HMR do Vite) ===
// Ω.3 — Detecção de update: se SW novo virar waiting, força skipWaiting + recarrega
// uma vez (com guard via flag pra evitar loop infinito). Player não fica preso em
// versão velha após deploy.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Update check explícito quando user volta pra tela
      reg.update().catch(() => undefined);
      // Listener pra SW novo entrando em waiting
      reg.addEventListener('updatefound', () => {
        const newSw = reg.installing;
        if (!newSw) return;
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            // Há SW antigo controlando + novo waiting → força ativar
            newSw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      // Quando controller muda (SW novo assumiu), recarrega 1x
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }).catch((err) => {
      console.warn('[sw] register failed:', err);
    });
  });
}

// === Socket connect ===
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
});
socket.on('connect', () => console.log('[client] socket connected', socket.id));
socket.on('disconnect', (reason) => console.log('[client] socket disconnected:', reason));

// POLISH δ.2 — Banner sticky no topo durante reconexão + failed-state com "Tentar agora"
installConnectionStatusBanner(socket);

// A1.3 — Reconnection robustez: se socket reconecta E user está em campaign, re-emite
// joinCampaign pra restaurar a room no server (server perde socket.join quando socket.id muda).
// Server tem isStarted guard contra dupla startSession; partyUpdate é idempotente.
let reconnectCount = 0;
socket.on('connect', () => {
  if (reconnectCount > 0 && currentView.kind === 'campaign') {
    console.log('[client] reconnecting to campaign', currentView.campaignId);
    socket.emit('joinCampaign', {
      ownerName: getOwnerName(),
      characterId: currentView.characterId,
      campaignId: currentView.campaignId,
    });
  }
  reconnectCount++;
});

// === Router state ===
type View =
  | { kind: 'home' }
  | { kind: 'login' }
  | { kind: 'wizard'; fromLobby?: boolean }
  | { kind: 'sheet'; id: string }
  | { kind: 'campaign'; characterId: string; campaignId?: string }
  | { kind: 'lobby'; lobbyId?: string }
  | { kind: 'profile' };

let currentView: View = { kind: 'home' };
let currentWizard: CharacterWizard | null = null;
let currentCampaign: CampaignScreen | null = null;
let currentLobby: LobbyScreen | null = null;
let currentUser: AuthUser | null = null;

async function render(): Promise<void> {
  if (currentView.kind !== 'wizard' && currentWizard) {
    currentWizard.destroy();
    currentWizard = null;
  }
  if (currentView.kind !== 'campaign' && currentCampaign) {
    currentCampaign.destroy();
    currentCampaign = null;
  }
  if (currentView.kind !== 'lobby' && currentLobby) {
    currentLobby.destroy();
    currentLobby = null;
  }

  app!.innerHTML = '';
  // POLISH ζ.4 — fade-in suave entre rotas (CSS class removida e re-aplicada
  // pra force reflow). prefers-reduced-motion respeitado via CSS.
  app!.classList.remove('route-fade-in');
  void app!.offsetWidth; // force reflow
  app!.classList.add('route-fade-in');

  switch (currentView.kind) {
    case 'home':
      await renderHome();
      break;
    case 'login':
      renderLogin();
      break;
    case 'wizard':
      renderWizard(currentView.fromLobby ?? false);
      break;
    case 'sheet':
      await renderSheet(currentView.id);
      break;
    case 'campaign':
      await renderCampaign(currentView.characterId, currentView.campaignId);
      break;
    case 'lobby':
      await renderLobby(currentView.lobbyId);
      break;
    case 'profile':
      await renderProfile();
      break;
  }
}

async function renderProfile(): Promise<void> {
  const container = el('div', { class: 'profile-container' });
  app!.appendChild(container);
  const screen = new ProfileScreen({
    container,
    onExit: () => navigate({ kind: 'home' }),
  });
  await screen.start();
}

function renderLogin(): void {
  const screen = new LoginScreen({
    container: app!,
    onAuthenticated: (user) => {
      currentUser = user;
      navigate({ kind: 'home' });
    },
    onContinueAnonymous: () => {
      currentUser = null;
      navigate({ kind: 'home' });
    },
  });
  screen.start();
}

function navigate(view: View): void {
  currentView = view;
  void render();
}

// === Views ===

async function renderHome(): Promise<void> {
  // Ω.2 — renderHome delegado pra HomeScreen. Antes: 250+ linhas inline.
  // Agora: 1 chamada de composição em src/client/home/ com seções organizadas.
  await mountHomeScreen({
    container: app!,
    currentUser,
    navigate,
    onLogout: async () => {
      currentUser = null;
      await render();
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Ω.2 — Helpers legacy removidos: renderTombstoneCard, renderCampaignCard,
// PREFAB_CARDS, renderPrefabSection, renderPrefabCard, e todo o corpo antigo
// de renderHome moveram pra src/client/home/. Mantemos abaixo apenas as
// outras views (wizard, sheet, lobby, campaign, profile, login).
// ════════════════════════════════════════════════════════════════════════════


function renderWizard(fromLobby: boolean): void {
  const container = el('div', { class: 'wizard-container' });
  app!.appendChild(container);
  currentWizard = new CharacterWizard(
    container,
    (sheet: CharacterSheet) => {
      if (fromLobby) {
        // Quando wizard termina e veio do lobby, marca como ready com o PJ recém-criado
        socket.emit('lobbyUpdateStatus', { status: 'ready', characterId: sheet.id });
        navigate({ kind: 'lobby' });
      } else {
        navigate({ kind: 'home' });
      }
    },
    () => {
      if (fromLobby) navigate({ kind: 'lobby' });
      else navigate({ kind: 'home' });
    },
    fromLobby ? (step: string) => {
      socket.emit('lobbyUpdateStatus', { status: 'wizard', wizardStep: step });
    } : undefined,
  );
  currentWizard.start();
}

async function renderLobby(lobbyId?: string): Promise<void> {
  const container = el('div', { class: 'lobby-container' });
  app!.appendChild(container);
  currentLobby = new LobbyScreen(container, {
    socket,
    ownerName: getOwnerName(),
    onCampaignStart: (campaignId, characterId) => {
      navigate({ kind: 'campaign', characterId, campaignId });
    },
    onCreateCharacter: () => {
      navigate({ kind: 'wizard', fromLobby: true });
    },
    onExit: () => navigate({ kind: 'home' }),
  });
  await currentLobby.start();
  // Se veio com lobbyId, joina; senão, cria lobby
  if (lobbyId) {
    socket.emit('joinLobby', { lobbyId, ownerName: getOwnerName() });
  } else {
    socket.emit('createLobby', { ownerName: getOwnerName() });
  }
}

async function renderSheet(id: string): Promise<void> {
  const container = el('div', { class: 'sheet-container' });
  app!.appendChild(container);
  const screen = new SheetScreen({
    container,
    characterId: id,
    onExit: () => navigate({ kind: 'home' }),
  });
  await screen.start();
}

async function renderCampaign(characterId: string, campaignId?: string): Promise<void> {
  const container = el('div', { class: 'campaign-container' });
  app!.appendChild(container);
  currentCampaign = new CampaignScreen(container, {
    characterId,
    campaignId,
    socket,
    ownerName: getOwnerName(),
    onExit: () => navigate({ kind: 'home' }),
  });
  try {
    await currentCampaign.start();
  } catch (err) {
    // Auto-rejoin falhou — ex: PJ/campanha não existe mais (getCharacter 404
    // quando o servidor free dormiu e perdeu o estado, ou sessão antiga
    // inválida). Sem isto, a tela fica EM BRANCO (campaign-container vazio) e
    // o jogador trava — sintoma que aparecia como refresh repetido na
    // telemetria. Degrada: limpa a sessão inválida e volta pra home com aviso.
    console.warn('[campaign] start falhou — limpando sessão e voltando pra home:', err);
    clearLastSession();
    try { currentCampaign?.destroy(); } catch { /* ignore */ }
    currentCampaign = null;
    container.remove();
    toastError('🌙 Essa aventura não está mais disponível. Comece uma nova partida.');
    navigate({ kind: 'home' });
  }
}

// Auto-rejoin: se havia sessão ativa no localStorage, volta direto pra ela.
// Server valida — se PJ/campanha não existe, joinCampaign emit error e usuário cai pro Home via clearLastSession.
const last = getLastSession();
if (last) {
  currentView = { kind: 'campaign', characterId: last.characterId, campaignId: last.campaignId };
}

// Detecta erro de auth no querystring (vindo de redirect /verify) → vai pra login
{
  const params = new URLSearchParams(window.location.search);
  if (params.has('auth_error') || params.has('auth')) {
    currentView = { kind: 'login' };
  }
}

// Debug helper exposto no console.
(window as unknown as { jsgameClearSession?: () => void }).jsgameClearSession = () => {
  clearLastSession();
  navigate({ kind: 'home' });
};


// Bootstrap: tenta hidratar sessão atual antes do primeiro render.
// Se sessão válida, popula currentUser; senão segue anônimo.
(async (): Promise<void> => {
  try {
    currentUser = await getMe();
  } catch { /* offline ou erro — segue anônimo */ }
  void render();
  // P0 funil — onboarding tour da home REMOVIDO do auto-disparo. 4 passos
  // modais antes de jogar eram fricção pura na primeira tela (34% saíam em
  // started_only, p50 37s pra 1ª ação). A home é auto-explicativa e o
  // tutorial Duolingo contextual cobre a tela de jogo. openOnboardingTour
  // segue disponível em onboarding-tour.ts se quisermos religar via Ajustes.
})();

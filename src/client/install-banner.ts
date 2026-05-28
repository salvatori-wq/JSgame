// JSgame · Ω.7 — PWA Install Banner.
// Aparece em mobile browser (NÃO standalone) com CTA "Instalar app".
//
// Android Chrome/Edge: captura `beforeinstallprompt` event → click chama prompt()
//   nativo do browser. Após accept/dismiss, evento `appinstalled` confirma.
//
// iOS Safari: não emite beforeinstallprompt. Mostra instruções manuais
//   (Compartilhar → "Adicionar à Tela Inicial").
//
// Dismiss: botão "Agora não" some o banner POR SESSÃO (sessionStorage). João
// pediu "toda vez que entramos" — então não persiste em localStorage.
// Quando o user fecha o browser e volta, banner reaparece. Quando ele instala,
// PWA abre em `display: standalone` e o banner não aparece (detecta).

import { el } from './util';
import { trackClientMetric } from './api';

const SESSION_DISMISS_KEY = 'jsgame.installBanner.dismissed';

let bannerEl: HTMLElement | null = null;
// Stash do beforeinstallprompt event pra disparar no click do banner.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/** Detecta se app já está rodando como PWA instalado (standalone display mode). */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    || document.referrer.startsWith('android-app://')
  );
}

/** Heurística iOS Safari (não emite beforeinstallprompt). */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Mobile browser que SUPORTA install prompt (Chrome Android, Edge, Samsung Internet). */
function isMobileBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Dismiss válido só pra sessão atual (sessionStorage). João quer banner toda vez. */
function isDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissedThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
  } catch { /* ignore */ }
}

/** Inicializa o banner. Chamar 1x no boot do main.ts. */
export function initInstallBanner(): void {
  // Pré-checks
  if (typeof window === 'undefined' || isStandalone() || !isMobileBrowser()) return;
  if (isDismissedThisSession()) return;

  // Android path — captura beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    if (!bannerEl) renderBanner('android');
  });

  // appinstalled — confirma instalação
  window.addEventListener('appinstalled', () => {
    try { trackClientMetric('home_loaded', { installed: true }); } catch { /* silent */ }
    closeBanner();
    deferredPrompt = null;
  });

  // iOS path — não tem beforeinstallprompt, mostra instruções imediato
  if (isIOS()) {
    // Aguarda DOM ready pra evitar layout shift no FOUC
    if (document.readyState === 'complete') renderBanner('ios');
    else window.addEventListener('load', () => renderBanner('ios'), { once: true });
  }

  // Fallback Android: se beforeinstallprompt não disparou em 3s (já visitou antes
  // → browser não re-emite), mostra banner com instruções genéricas.
  setTimeout(() => {
    if (!bannerEl && !isStandalone() && !isIOS()) {
      renderBanner('android-fallback');
    }
  }, 3000);
}

type BannerMode = 'android' | 'android-fallback' | 'ios';

function renderBanner(mode: BannerMode): void {
  if (bannerEl) return; // idempotente

  const isIosMode = mode === 'ios';

  const banner = el('div', {
    class: 'install-banner',
    attrs: { role: 'dialog', 'aria-label': 'Instalar app JSgame', 'data-mode': mode },
  });

  banner.appendChild(el('div', { class: 'install-banner-glyph', text: '⚔', attrs: { 'aria-hidden': 'true' } }));

  const body = el('div', { class: 'install-banner-body' }, [
    el('div', { class: 'install-banner-title', text: 'Instalar JSgame' }),
    el('div', {
      class: 'install-banner-sub',
      text: isIosMode
        ? 'Toque em Compartilhar → "Adicionar à Tela Inicial"'
        : 'Tela cheia, abre instantâneo, joga offline',
    }),
  ]);
  banner.appendChild(body);

  const actions = el('div', { class: 'install-banner-actions' });

  if (!isIosMode) {
    actions.appendChild(el('button', {
      class: 'install-banner-cta',
      attrs: { type: 'button' },
      text: 'Instalar',
      on: {
        click: async () => {
          if (deferredPrompt) {
            try {
              await deferredPrompt.prompt();
              const result = await deferredPrompt.userChoice;
              try { trackClientMetric('home_loaded', { install_choice: result.outcome }); } catch { /* silent */ }
              if (result.outcome === 'accepted') closeBanner();
              else markDismissedThisSession();
              deferredPrompt = null;
            } catch (err) {
              console.warn('[install] prompt failed:', err);
              closeBanner();
            }
          } else {
            // android-fallback — browser não re-emitiu prompt. Tooltip orientativo.
            alert('Pra instalar: toque no menu ⋮ do browser → "Adicionar à tela inicial" ou "Instalar app".');
          }
        },
      },
    }));
  }

  actions.appendChild(el('button', {
    class: 'install-banner-dismiss',
    attrs: { type: 'button', 'aria-label': 'Fechar' },
    text: '×',
    on: {
      click: () => {
        markDismissedThisSession();
        closeBanner();
      },
    },
  }));

  banner.appendChild(actions);

  document.body.appendChild(banner);
  bannerEl = banner;
  // Trigger entry animation no próximo frame
  requestAnimationFrame(() => {
    banner.classList.add('is-visible');
  });
}

function closeBanner(): void {
  if (!bannerEl) return;
  bannerEl.classList.remove('is-visible');
  const el = bannerEl;
  setTimeout(() => {
    el.remove();
    if (bannerEl === el) bannerEl = null;
  }, 250);
}

/** Helper pra tests — reseta state. */
export function _resetForTest(): void {
  if (bannerEl) {
    bannerEl.remove();
    bannerEl = null;
  }
  deferredPrompt = null;
}

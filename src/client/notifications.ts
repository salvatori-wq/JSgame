// JSgame · Local notifications via Web Notifications API.
// Não usa Web Push Protocol (precisa de VAPID + server). Faz notificações locais
// disparadas pelo client quando socket recebe eventos E document está hidden.
// Resolve 90% do use case "PJ tomou ação no coop, notifica os outros".

const STORAGE_KEY = 'jsgame.notifs.enabled';
let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
})();

export function isNotifsEnabled(): boolean {
  return enabled && hasPermission();
}

export function notifsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function hasPermission(): boolean {
  return notifsSupported() && Notification.permission === 'granted';
}

/** Pede permissão (precisa de user gesture). Retorna estado final. */
export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!notifsSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Liga/desliga (persistido). Se ligando e permissão ainda 'default', pede. */
export async function setNotifsEnabled(v: boolean): Promise<boolean> {
  if (v && Notification.permission !== 'granted') {
    const perm = await requestNotifPermission();
    if (perm !== 'granted') {
      enabled = false;
      try { localStorage.setItem(STORAGE_KEY, '0'); } catch { /* ignore */ }
      return false;
    }
  }
  enabled = v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  return enabled;
}

/**
 * Dispara notif SE: enabled + permission + document.hidden (aba sem foco).
 * Auto-close em 5s. Click traz aba pro foco. Não acumula — mesma tag substitui.
 */
export function notify(opts: { title: string; body: string; tag?: string }): void {
  if (!enabled || !hasPermission()) return;
  if (!document.hidden) return; // só notifica se aba está em background

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag ?? 'jsgame',
      icon: '/favicon.png',
      silent: false,
    });
    n.onclick = (): void => {
      window.focus();
      n.close();
    };
    // Auto-close após 5s pra não acumular
    setTimeout(() => n.close(), 5000);
  } catch (err) {
    console.warn('[notifs] dispatch falhou:', err);
  }
}

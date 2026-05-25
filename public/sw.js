// JSgame · Service Worker básico.
// Cache shell (HTML/CSS/JS/icons) pra abrir offline. NUNCA cacheia API/socket.

const CACHE = 'jsgame-v1';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // API e socket.io: sempre online (não cacheia)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;

  // Cache-first com fallback de rede + revalidação
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Atualiza em background
        fetch(req).then((resp) => {
          if (resp && resp.ok) {
            caches.open(CACHE).then((cache) => cache.put(req, resp.clone())).catch(() => undefined);
          }
        }).catch(() => undefined);
        return cached;
      }
      return fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => undefined);
        }
        return resp;
      }).catch(() => caches.match('/index.html').then((r) => r ?? new Response('Sem conexão. Volte a internet pra jogar.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
    })
  );
});

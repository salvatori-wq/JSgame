// JSgame · Service Worker — Ω.3 cache bust definitivo.
//
// Antes (v1): cache-first com revalidação background pra TODO request, inclusive
// HTML/assets. Resultado: João abre app → SW serve cache velho → bundle hash
// antigo → melhorias nunca aparecem mesmo após deploy. Bug crítico.
//
// Agora (v2): network-first pra HTML e assets hashed (que MUDAM a cada build),
// cache-first SÓ pra static assets imutáveis (icons, manifest). Garante que
// player sempre puxa versão fresca quando online; offline ainda funciona.
//
// CACHE name bumped → activate handler antigo deleta v1 → cache stale some.
// skipWaiting + clients.claim já força SW novo a tomar controle imediato.

const CACHE = 'jsgame-v2-omega';
const SHELL_URLS = [
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

self.addEventListener('message', (event) => {
  // Client pode forçar update via { type: 'SKIP_WAITING' }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API e socket.io: sempre online, NUNCA cacheia
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;

  const accept = req.headers.get('accept') || '';
  const isHTML = accept.includes('text/html')
    || url.pathname === '/'
    || url.pathname === '/index.html'
    || url.pathname.endsWith('.html');
  // Vite gera hash no nome → cada build muda. Tem que ser network-first.
  const isHashedAsset = url.pathname.startsWith('/assets/');

  if (isHTML || isHashedAsset) {
    // Network-first: tenta rede sempre. Cache só fallback offline.
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => undefined);
        }
        return resp;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // HTML fallback genérico se offline e sem cache
          if (isHTML) {
            return caches.match('/index.html').then((idx) =>
              idx ?? new Response('Sem conexão. Volte a internet pra jogar.', {
                status: 503, headers: { 'Content-Type': 'text/plain' },
              }),
            );
          }
          return new Response('', { status: 503 });
        });
      }),
    );
    return;
  }

  // Static assets imutáveis (icons, manifest): cache-first com revalidação background
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
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
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

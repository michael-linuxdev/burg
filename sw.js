// Zinnenwerk – Service Worker: App-Shell offline verfügbar machen.
// Bei jeder Änderung an Spieldateien VERSION erhöhen und neue Dateien in SHELL aufnehmen,
// damit Spieler das Update bekommen. Ein neuer Worker wartet, bis der Spieler „Aktualisieren“ tippt.
const VERSION = 'zinnenwerk-v5.4.0';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'fonts/fonts.css',
  'fonts/alegreya-sans-400.woff2',
  'fonts/alegreya-sans-500.woff2',
  'fonts/alegreya-sans-700.woff2',
  'fonts/pirata-one-400.woff2',
  'js/data.js',
  'js/core.js',
  'js/economy.js',
  'js/combat.js',
  'js/units.js',
  'js/settings.js',
  'js/audio.js',
  'js/render.js',
  'js/ui.js',
  'js/tutorial.js',
  'js/pwa.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Frisch laden (am HTTP-Cache vorbei), damit keine veralteten Dateien in den neuen Cache geraten.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Erst aus dem Cache der eigenen Version, sonst Netz. Seitenaufrufe fallen offline auf index.html zurück.
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && url.pathname.indexOf('/docs/') < 0) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
        return Response.error();
      }
    })
  );
});

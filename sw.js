// Zinnenwerk – Service Worker: App-Shell offline verfügbar machen.
// Bei jeder Änderung an Spieldateien VERSION erhöhen, damit Spieler das Update bekommen.
const VERSION = 'zinnenwerk-v5.0.0';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/game.js',
  'js/render.js',
  'js/ui.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + '-fonts').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Eigene Dateien: erst Cache, im Hintergrund aktualisieren
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  // Schriften von Google: einmal laden, dann aus dem Cache
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(VERSION + '-fonts').then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }
        catch { return new Response('', { status: 504 }); }
      })
    );
  }
});

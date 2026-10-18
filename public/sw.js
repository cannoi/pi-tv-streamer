const CACHE = 'pi-vintage-tv-v1.9';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/ai-panel.css', '/ai-panel.js', '/manifest.webmanifest', '/ai-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // network only for API
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      const copy = resp.clone();
      if (e.request.method === 'GET' && resp.ok && (u.origin === self.location.origin)) {
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => caches.match('/index.html')))
  );
});

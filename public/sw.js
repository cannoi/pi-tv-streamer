const CACHE = 'pi-vintage-tv-v1.9.5';
const PRECACHE = [
  '/', '/index.html', '/style.css', '/app.js', '/ai-panel.css', '/ai-panel.js',
  '/manifest.webmanifest', '/ai-icon.png', '/qrcode.min.js', '/vendor/hls.min.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // network only
  // Network-first for HTML/JS/CSS
  if (e.request.method !== 'GET') return;
  const netFirst = /\.(js|css|html|webmanifest)?$/i.test(u.pathname) || u.pathname === '/';
  if (netFirst) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        if (resp.ok && u.origin === self.location.origin) {
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(x => x || caches.match('/index.html')))
    );
    return;
  }
  // Cache-first for images/fonts
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      const copy = resp.clone();
      if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }))
  );
});

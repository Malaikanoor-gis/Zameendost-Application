// ZameenDost service worker: installable, and the last advice stays readable with no signal in the field.
// Network-first for everything; whatever was fetched last (app files, weather, NASA tiles read for values,
// place search) is served when offline. Map background tiles are not stored: they arrive as opaque
// responses, which browsers charge several MB each against the storage quota.
const CACHE = 'zameendost-v4';
const SHELL = ['./', './index.html', './engine.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && r.type !== 'opaque') caches.open(CACHE).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

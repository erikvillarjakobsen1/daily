// sw.js — offline support for Daily.
// Bump CACHE (e.g. 'daily-v2') whenever you change index.html so phones drop the old copy.
const CACHE = 'daily-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add one by one so a missing icon can't break the whole install.
    await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Stale-while-revalidate: answer from cache immediately (works offline),
// refresh the cached copy in the background when online.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isNav = req.mode === 'navigate';
    const key = isNav ? new URL(req.url).pathname : req;   // ignore ?date= etc. for page loads
    const cached = (await cache.match(key, { ignoreSearch: true }))
      || (isNav ? await cache.match('./index.html') : undefined);
    const network = fetch(req)
      .then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => undefined);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});

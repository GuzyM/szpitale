'use strict';
const CACHE_NAME = 'hospitalapp-v2.0.0';
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./src/core.js",
  "./src/storage.js",
  "./src/ui.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/jgp-data-meta.js",
  "./data/jgp-data-01.js",
  "./data/jgp-data-02.js",
  "./data/jgp-data-03.js",
  "./data/jgp-data-04.js",
  "./data/jgp-characteristics-meta.js",
  "./data/jgp-characteristics-01.js",
  "./data/jgp-characteristics-02.js",
  "./data/jgp-characteristics-03.js",
  "./data/jgp-characteristics-04.js",
  "./data/jgp-characteristics-05.js",
  "./data/jgp-characteristics-06.js",
  "./data/jgp-characteristics-07.js",
  "./data/jgp-characteristics-08.js",
  "./data/jgp-characteristics-09.js",
  "./data/jgp-characteristics-10.js",
  "./data/jgp-characteristics-11.js",
  "./data/jgp-characteristics-12.js",
  "./data/jgp-characteristics-13.js",
  "./data/jgp-characteristics-14.js",
  "./data/nfz-coefficients.js",
  "./data/cost-accounting.js",
  "./data/cost-accounting-regulation.js",
  "./data/key-change.js",
  "./data/mz-legislation.json"
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('hospitalapp-v') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('/data/mz-legislation.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.clone().json();
        if (!data.meta || !Array.isArray(data.items)) throw new Error('Invalid data');
        await cache.put('./data/mz-legislation.json', response.clone());
        return response;
      } catch {
        return await cache.match('./data/mz-legislation.json') || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type':'application/json' } });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch {
      if (event.request.mode === 'navigate') return await cache.match('./index.html') || new Response('Offline', { status: 503 });
      return new Response('Asset unavailable offline', { status: 503 });
    }
  })());
});

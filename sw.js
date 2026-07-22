"use strict";

const CACHE_NAME = "hospitalapp-v0.7.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.css",
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
  "./data/nfz-contract.js",
  "./data/nfz-coefficients.js",
  "./data/mz-legislation.json",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith("/data/mz-legislation.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./data/mz-legislation.json", copy));
        }
        return response;
      }).catch(() => caches.match("./data/mz-legislation.json"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }).catch(() => caches.match("./index.html"))
  );
});

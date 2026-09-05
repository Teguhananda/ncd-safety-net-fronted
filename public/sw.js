/**
 * sw.js — service worker MINIMAL, khusus dipakai halaman /portal/* (My NCD
 * Safety). Didaftarkan secara manual lewat usePortalPwa.js, BUKAN otomatis
 * untuk seluruh aplikasi — halaman staff tidak terpengaruh sama sekali.
 *
 * Strategi: network-first, fallback ke cache kalau offline. Sengaja
 * sederhana (bukan precache daftar file, karena nama file hasil build Vite
 * selalu berganti hash) — cukup untuk "buka lagi tanpa internet" di HP
 * pasien setelah pernah dibuka sekali.
 */
const CACHE_NAME = "ncd-portal-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* =========================================================
   Service Worker – macht die App offline nutzbar.
   Strategie "Netzwerk zuerst": Mit Internet siehst du immer
   die neueste Version, ohne Internet die zuletzt geladene.
   Neue Dateien (z. B. Bilder) in FILES eintragen.
   ========================================================= */

const CACHE = "mischa-app-v4";

const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/markdown.js",
  "./Regelwerk/regelwerk.js",
  "./Regelwerk/spielfeld.svg",
  "./Regelwerk/Bierball%20Regelwerk%20Version%201.0.pdf",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./Schriftarten/BADABB__.TTF"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((cached) => cached || (request.mode === "navigate" ? caches.match("./index.html") : null))
          .then((response) => response || Response.error())
      )
  );
});

/* =========================================================
   Service Worker – macht die App offline nutzbar.
   Strategie "Netzwerk zuerst": Mit Internet siehst du immer
   die neueste Version, ohne Internet die zuletzt geladene.
   Neue Dateien (z. B. Bilder) in FILES eintragen.

   Firebase: Nur die SDK-Dateien von gstatic.com werden gecacht
   (sie ändern sich pro Version nie). Anfragen an Firestore selbst
   (firestore.googleapis.com) werden NICHT angefasst – dafür hat
   Firestore seine eigene Offline-Speicherung.
   ========================================================= */

const CACHE = "mischa-app-v6";

/* Muss mit FIREBASE_VERSION in js/app.js übereinstimmen */
const FIREBASE_VERSION = "12.19.0";
const SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";

const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./Schriftarten/Anton-Regular.ttf"
];

const SDK_FILES = [SDK + "firebase-app.js", SDK + "firebase-firestore.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      /* SDK-Fehler (z. B. CDN nicht erreichbar) sollen die Installation nicht verhindern */
      cache.addAll(FILES).then(() => cache.addAll(SDK_FILES).catch(() => {}))
    )
  );
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
  if (request.method !== "GET") return;

  /* Firebase SDK: "Cache zuerst", da die Dateien pro Version unveränderlich sind */
  if (request.url.startsWith(SDK)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      )
    );
    return;
  }

  /* Alles andere von fremden Servern (u. a. Firestore) läuft ungefiltert durch */
  if (new URL(request.url).origin !== location.origin) return;

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

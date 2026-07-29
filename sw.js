// Service worker de centrail (v1.4.0) — capacidad offline real.
//
// ─── COLISIÓN CON EL CACHE-BUSTING (leer antes de tocar nada) ───────────────
// Centrail ya versiona sus imports con query string (`?v=1.4.0`) por el problema
// documentado de caché agresiva de módulos ES (§11 de la especificación). Este
// service worker agrega una SEGUNDA capa de caché encima de esa. Mal hecho,
// reproduce el mismo bug fantasma pero peor, porque un service worker sobrevive
// a un recargado forzado.
//
// Reglas que lo evitan, y que no se negocian:
//   1. CACHE_VERSION es exactamente la misma versión del cache-busting. NO se
//      edita a mano: `scripts/bump-cache-version.sh` la actualiza junto con
//      todos los `?v=` del proyecto, y falla si queda alguna desincronizada.
//   2. En `activate` se borra TODO caché cuyo nombre no sea el de esta versión.
//      Un release nuevo deja el anterior sin rastro.
//   3. Los recursos versionados van cache-first: la query string ya garantiza
//      que un cambio de contenido es una URL distinta, así que servir desde
//      caché nunca puede devolver contenido viejo bajo la misma URL.
//   4. El documento HTML va network-first: es el único recurso SIN versión en la
//      URL, así que es el que debe poder cambiar. Si la red falla, cae al caché.
const CACHE_VERSION = "1.4.0";
const CACHE_NAME = `centrail-v${CACHE_VERSION}`;
const V = `?v=${CACHE_VERSION}`;

// App shell completo. Si algo de esto falta, la corrección offline falla — por eso
// están el WASM de Rubber Band, los encoders y los 10 idiomas, no solo el HTML.
const PRECACHE = [
  "./",
  "./index.html",
  "./privacidad.html",
  "./manifest.webmanifest",

  // Estilos y fuentes. fonts.css se pide con versión desde index.html; los .woff2
  // los pide el propio CSS con rutas relativas SIN query string.
  `./fonts/fonts.css${V}`,
  "./fonts/archivo-latin.woff2",
  "./fonts/archivo-latin-ext.woff2",
  "./fonts/ibm-plex-mono-400-latin.woff2",
  "./fonts/ibm-plex-mono-400-latin-ext.woff2",
  "./fonts/ibm-plex-mono-500-latin.woff2",
  "./fonts/ibm-plex-mono-500-latin-ext.woff2",

  // Motor (todos: el worker y el modo En vivo los cargan por caminos distintos)
  `./engine/aiff.mjs${V}`,
  `./engine/correct.mjs${V}`,
  `./engine/decode.mjs${V}`,
  `./engine/detect.mjs${V}`,
  `./engine/dial.mjs${V}`,
  `./engine/flac-encode.mjs${V}`,
  `./engine/i18n.mjs${V}`,
  `./engine/mp3-encode.mjs${V}`,
  `./engine/note-names.mjs${V}`,
  `./engine/pitch-detect.mjs${V}`,
  `./engine/reference-store.mjs${V}`,
  `./engine/temperament.mjs${V}`,
  `./engine/tuner-app.mjs${V}`,
  `./engine/wav.mjs${V}`,

  // Workers
  `./workers/engine.worker.mjs${V}`,
  `./workers/tuner-processor.mjs${V}`,

  // Vendor. OJO: libflac.min.wasm.wasm se resuelve desde dentro del wrapper
  // vendorizado y NO lleva query string (límite conocido, §11 de la spec) —
  // por eso va acá con su ruta desnuda.
  `./vendor/rubberband-wasm/index.esm.js${V}`,
  `./vendor/rubberband-wasm/rubberband.wasm${V}`,
  `./vendor/libflacjs/libflac.min.wasm.js${V}`,
  "./vendor/libflacjs/libflac.min.wasm.wasm",
  `./vendor/lamejs/lamejs.js${V}`,
  `./vendor/wasm-audio-decoders-flac/flac-decoder.min.js${V}`,

  // Los 10 idiomas: sin esto la app arranca offline sin textos.
  `./i18n/es.json${V}`, `./i18n/en.json${V}`, `./i18n/pt.json${V}`,
  `./i18n/fr.json${V}`, `./i18n/de.json${V}`, `./i18n/it.json${V}`,
  `./i18n/ja.json${V}`, `./i18n/ko.json${V}`, `./i18n/zh.json${V}`,
  `./i18n/ru.json${V}`,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Uno por uno en vez de addAll(): addAll aborta todo el precache si UN recurso
    // falla, y deja la app sin offline sin decir por qué. Así se sabe cuál falló.
    const results = await Promise.allSettled(
      PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))
    );
    const fallidos = results
      .map((r, i) => (r.status === "rejected" ? PRECACHE[i] : null))
      .filter(Boolean);
    if (fallidos.length) {
      console.warn(`[sw] ${fallidos.length} recurso(s) no se precachearon:`, fallidos);
    }
    await self.skipWaiting(); // la versión nueva toma el control sin recargado forzado
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((n) => n.startsWith("centrail-v") && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca tocar terceros

  // El documento es el único recurso sin versión en la URL: network-first para que
  // un release nuevo llegue sin depender de que caduque nada, con caché de respaldo.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresca = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresca.clone());
        return fresca;
      } catch {
        return (await caches.match(req)) ||
               (await caches.match("./index.html")) ||
               Response.error();
      }
    })());
    return;
  }

  // Todo lo demás es de la propia app y va versionado: cache-first es seguro
  // porque un cambio de contenido implica una URL distinta.
  event.respondWith((async () => {
    const enCache = await caches.match(req);
    if (enCache) return enCache;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});

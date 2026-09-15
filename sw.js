const CACHE = "mi-musica-pwa-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=20260916",
  "./app.js?v=20260916",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isApp = req.mode === "navigate" || /\/(index\.html|style\.css|app\.js|manifest\.json|icon\.svg|icon-192\.png|icon-512\.png)$/.test(url.pathname);
  if (!isApp) return;
  event.respondWith(fetch(req).then(res => {
    if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
    return res;
  }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html"))));
});
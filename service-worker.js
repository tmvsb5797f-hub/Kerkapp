// Service worker voor Liturgie Assistent Pro.
// Doel: de app laadt en werkt ook op wankele kerk-wifi. HTML is network-first
// (zodat updates direct binnenkomen), statische bestanden zijn cache-first.
const CACHE = 'liturgie-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Hosts met live data nooit cachen (auth, database, AI, bijbel, e-mail, github).
const DYNAMISCH = [
  'firestore.googleapis.com', 'firebaseio.com', 'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com', 'gemini-proxy.kerkapp.workers.dev', 'bolls.life',
  'api.github.com', 'api.web3forms.com'
];

function cachebaar(url) {
  return url.origin === location.origin ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('tailwindcss') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (DYNAMISCH.some((h) => url.hostname.includes(h))) return; // laat de browser dit afhandelen

  e.respondWith((async () => {
    // Navigatie/HTML: eerst netwerk (verse versie), val terug op cache bij offline.
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match(req)) || Response.error();
      }
    }
    // Statische bestanden: eerst cache, anders netwerk (en runtime cachen).
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && cachebaar(url)) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});

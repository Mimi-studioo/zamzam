const VERSION = 'v2';
const SHELL = 'zamzam-shell-v5';
// Content data files update independently: network-first so users get new content
// as soon as it is published, with cache fallback when offline.
const CONTENT_FILES = ['content.js', 'quran-full.json'];
const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'app.js',
  'content.js', 'quran-full.json',
  'zain-400.woff2', 'zain-700.woff2', 'amiri-quran.woff2',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('message', e => { if(e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== 'zamzam-audio').map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Same-origin
  if (url.origin === self.location.origin) {
    const isContent = CONTENT_FILES.some(f => url.pathname.endsWith('/'+f) || url.pathname.endsWith(f));
    if (isContent) {
      e.respondWith(
        fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(e.request, copy)).catch(()=>{});
          return res;
        }).catch(() => caches.match(e.request, {ignoreSearch: true}))
      );
      return;
    }
    e.respondWith(
      caches.match(e.request, {ignoreSearch: true}).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(e.request, copy)).catch(()=>{});
          return res;
        }).catch(() => {
          if (e.request.mode === 'navigate') return caches.match('index.html');
          return new Response('offline', {status: 503});
        });
      })
    );
    return;
  }

  // Cross-origin (audio CDN): serve from zamzam-audio cache if pre-downloaded
  e.respondWith(
    caches.open('zamzam-audio').then(c => c.match(e.request)).then(hit => {
      if (hit) return hit;
      return fetch(e.request).catch(() => new Response('audio not cached', {status: 503}));
    })
  );
});

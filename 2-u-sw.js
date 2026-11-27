const VERSION = 'v2';
const SHELL = 'zamzam-shell-v35';
// Content data files update independently: network-first so users get new content
// as soon as it is published, with cache fallback when offline.
const CONTENT_FILES = ['content.js', 'stories-data.js', 'stories-data.js', 'quran-full.json', 'tafsir-1-14.json', 'tafsir-15-39.json', 'tafsir-40-94.json', 'tafsir-95-114.json'];
const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'app.js',
  'extra.js',
  'extra.css',
  '2-moon.jpg',
  'mushaf.js', 'mushaf.css', 'push.js', 'icon-maskable-512.png',
  'sheikh-afs.jpg',
  'sheikh-naina.jpg',
  'lesson-1.jpg',
  'lesson-2.jpg',
  'lesson-3.jpg',
  'lesson-4.jpg',
  'lesson-5.jpg',
  'lesson-6.jpg',
  'lesson-7.jpg',
  'content.js', 'stories-data.js', 'quran-full.json',
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
    // Lesson/story audio: cache-first in a dedicated cache (immutable per path, plays offline)
    if (/\.(mp3|m4a|ogg|wav|opus|vtt)(\?|$)/.test(url.pathname)) {
      e.respondWith(
        caches.open('zamzam-audio').then(c => c.match(e.request, {ignoreSearch: true}).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(res => {
            if (res.ok) c.put(e.request, res.clone()).catch(()=>{});
            return res;
          });
        }))
      );
      return;
    }
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
// ============================================================
// Merge into Zamzam's EXISTING service worker (the one that does
// offline caching). Do not register a second service worker.
// iOS RULE: every push event MUST end in showNotification()
// within 30 seconds — on the 3rd silent push, Apple permanently
// deletes the app's push subscriptions. The fallbacks below keep
// that from ever happening.
// ============================================================

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "زمزم", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "زمزم";
  event.waitUntil(
    self.registration
      .showNotification(title, {
        body: data.body || "",
        icon: "icon-192.png",
        badge: "icon-192.png",
        dir: "rtl",
        lang: "ar",
        data: { url: data.url || "./" },
      })
      .catch(() =>
        // Absolute last resort: still show something, never go silent.
        self.registration.showNotification("زمزم", { body: "" })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "./";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return clients.openWindow(target);
      })
  );
});

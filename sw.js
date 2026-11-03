/* KeuanganKu Service Worker — Cache-First untuk aset statis (offline 100%).
 * PENTING: naikkan VERSION setiap kali Anda deploy perubahan agar cache lama diganti. */
const VERSION = 'v1.0.0';
const CACHE = `keuanganku-${VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
    // Tidak skipWaiting otomatis: aplikasi menampilkan toast "Versi baru" dan
    // mengirim pesan SKIP_WAITING agar update tidak memotong sesi yang sedang berjalan.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('keuanganku-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi (SPA): selalu sajikan index.html dari cache, fallback ke jaringan.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((hit) => hit || fetch(req).catch(() => caches.match('/')))
    );
    return;
  }

  // Aset statis: Cache-First, lalu simpan hasil jaringan jika belum ada.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});

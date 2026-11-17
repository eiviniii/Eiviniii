/* Cache offline simples: o app funciona sem internet depois da 1ª visita. */
const CACHE = 'vidaos-v5';
const ASSETS = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'vendor/chart.umd.js', 'vendor/xlsx.full.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'js/core.js', 'js/storage.js', 'js/money.js', 'js/library.js', 'js/parsers.js', 'js/body.js', 'js/app.js',
  'js/views/dashboard.js', 'js/views/finance.js', 'js/views/invest.js', 'js/views/study.js', 'js/views/fitness.js', 'js/views/agenda.js', 'js/views/settings.js', 'js/views/sites.js', 'js/views/planner.js', 'js/views/docs.js', 'js/views/rotina.js', 'js/weather.js', 'js/views/emergency.js', 'js/views/vehicle.js', 'js/views/extras.js', 'js/views/calc.js', 'js/views/finextra.js', 'js/views/health.js', 'js/views/editalmap.js', 'js/views/trips.js', 'js/views/notes.js', 'js/assistant.js', 'vendor/qrcode.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
// rede primeiro (pega atualizações), cache como reserva
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

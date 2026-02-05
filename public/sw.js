// Service Worker vuoto per evitare errore 404
// Se non serve PWA, questo file può rimanere vuoto

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passa tutte le richieste direttamente alla rete
  event.respondWith(fetch(event.request));
});

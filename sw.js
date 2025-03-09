const CACHE_NAME = 'tic-tac-toe-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/image.png',
    '/image2.png',
    '/1280_1.png',
    '/750_1.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
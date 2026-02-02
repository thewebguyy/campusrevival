const CACHE_NAME = 'crm-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/map.html',
    '/dashboard.html',
    '/signin.html',
    '/crmicon.png',
    '/ukflag.png',
    '/utils/api.js',
    '/utils/auth.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

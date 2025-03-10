// Version control
const CACHE_NAME = 'tic-tac-toe-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js'
];

// Images that should be cached
const IMAGES = [
    '/image.png',
    '/image2.png',
    '/1280_1.png',
    '/750_1.png',
    '/desktop_img.png',
    '/mobile.png'
];

// All assets to cache
const ASSETS = [...APP_SHELL, ...IMAGES];

// Offline fallback page content - inline HTML for reliability
const OFFLINE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - Tic Tac Toe</title>
    <style>
        body {
            font-family: 'Montserrat', sans-serif;
            background: #1a1a2e;
            color: #fff;
            min-height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 20px;
        }
        .offline-container {
            background: rgba(0, 0, 0, 0.7);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            max-width: 500px;
            width: 90%;
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 900;
            margin-bottom: 20px;
            background: linear-gradient(to right, #4d41ff, #ff416c);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        .button {
            padding: 15px 30px;
            font-size: 1.2rem;
            color: #fff;
            background: linear-gradient(to right, #4d41ff, #ff416c);
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 700;
            text-transform: uppercase;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        }
        .button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
        }
        .retry-icon {
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <h1>You're Offline</h1>
        <p>The Tic Tac Toe game can't be loaded right now because you're not connected to the internet.</p>
        <button class="button" onclick="window.location.reload()">
            <span class="retry-icon">↻</span> Try Again
        </button>
    </div>
</body>
</html>
`;

// Create a response for the offline page
const createOfflineResponse = () => {
    return new Response(OFFLINE_HTML, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        }
    });
};

// Install event handler
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    // Wait until all resources are cached
    event.waitUntil(
        // Open cache
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell and content');
                
                // Create an offline page in the cache
                cache.put(new Request('/offline'), createOfflineResponse());
                
                // Cache all assets
                return cache.addAll(ASSETS)
                    .then(() => {
                        console.log('[Service Worker] All resources cached successfully');
                    })
                    .catch(error => {
                        console.error('[Service Worker] Cache addAll failed:', error);
                        
                        // Log which files failed to cache
                        return Promise.all(
                            ASSETS.map(url => 
                                cache.add(url)
                                    .catch(err => console.error(`Failed to cache: ${url}`, err))
                            )
                        );
                    });
            })
    );
    
    // Force the waiting service worker to become active
    self.skipWaiting();
});

// Activate event handler
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    // Clean up old caches
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.filter((cacheName) => {
                        return cacheName !== CACHE_NAME;
                    }).map((cacheName) => {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated and claiming clients');
                // Ensure the service worker takes control immediately
                return self.clients.claim();
            })
    );
});

// Network-first strategy with cache fallback for dynamic content
const networkFirstStrategy = async (request) => {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // If successful, clone and cache the response
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not valid');
    } catch (error) {
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache either, return offline page for HTML requests
        if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/offline');
        }
        
        // For other resources, return a simple error response
        return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
};

// Cache-first strategy with network fallback for static resources
const cacheFirstStrategy = async (request) => {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        // If not in cache, try network
        const networkResponse = await fetch(request);
        
        // Clone and cache the response
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // If both cache and network fail
        if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/offline');
        }
        
        // For images, use a fallback image if available
        if (request.destination === 'image') {
            return caches.match('/image.png'); // Default fallback image
        }
        
        // For other resources, return a simple error response
        return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
};

// Fetch event handler
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }
    
    // Handle navigation requests (HTML pages)
    if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // For images and static assets, use cache-first
    if (IMAGES.some(image => request.url.includes(image)) || 
        request.destination === 'image' || 
        request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'manifest') {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }
    
    // For everything else, try network first then cache
    event.respondWith(networkFirstStrategy(request));
});

// Handle service worker errors
self.addEventListener('error', (event) => {
    console.error('[Service Worker] Error:', event.error);
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Force update of all caches
    if (event.data === 'UPDATE_CACHES') {
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Cache updated on demand');
                // Notify clients
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CACHE_UPDATED'
                        });
                    });
                });
            });
    }
});
// ============================================================================
// Cash Manager Service Worker — Bulletproof Offline App Shell
// Version: 2.0.0 — Works on localhost:3000 (dev) AND production
// ============================================================================

const CACHE_VERSION = 'v4';
const SHELL_CACHE    = `cashmanager-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE  = `cashmanager-runtime-${CACHE_VERSION}`;
const RSC_CACHE      = `cashmanager-rsc-${CACHE_VERSION}`;

// App-shell routes to pre-cache on install
const APP_ROUTES = [
  '/',
  '/transactions',
  '/debts',
  '/swiggy',
  '/milk',
  '/reports',
];

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Patterns that must NEVER be intercepted (dev tooling)
const BYPASS_PATTERNS = [
  '/_next/webpack-hmr',
  '/__nextjs',
  '/hot-update',
  '.hot-update.',
];

// External origins we never cache (Supabase, MongoDB, Google Sheets, etc.)
const EXTERNAL_ORIGINS_TO_SKIP = [
  'supabase.co',
  'supabase.in',
  'mongodb.net',
  'googleapis.com',
  'googleusercontent.com',
];

// ============================================================================
// INSTALL — Pre-cache app shell
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Pre-cache static icons + manifest
      const staticCache = await caches.open(SHELL_CACHE);
      await staticCache.addAll(STATIC_ASSETS).catch((e) => {
        console.warn('[SW] Static pre-cache partial failure:', e);
      });

      // Pre-cache all app routes with no-cache headers to get fresh HTML shells
      // We use individual try/catch so one failing route doesn't block the rest
      for (const route of APP_ROUTES) {
        try {
          const res = await fetch(route, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (res.ok) {
            await staticCache.put(route, res);
          }
        } catch (e) {
          console.warn(`[SW] Could not pre-cache route ${route} (offline during install):`, e);
        }
      }

      self.skipWaiting();
    })()
  );
});

// ============================================================================
// ACTIVATE — Prune stale caches
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // Delete any cache that isn't one of our current versioned caches
          const isOurs = [SHELL_CACHE, RUNTIME_CACHE, RSC_CACHE].includes(key);
          const isCurrentVersion =
            key.includes(`-${CACHE_VERSION}`) && key.startsWith('cashmanager-');
          if (key.startsWith('cashmanager-') && (!isOurs || !isCurrentVersion)) {
            console.log('[SW] Pruning old cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// ============================================================================
// FETCH — Intelligent routing
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') return;

  // 2. Never intercept in local development, dev ports, or local IP testing
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.port !== '' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.endsWith('.local')
  ) {
    return;
  }

  // 3. Skip external origins (Supabase, MongoDB, etc.)
  if (url.origin !== self.location.origin) {
    // Allow but don't intercept — let them fail naturally offline
    // (IndexedDB cache layer handles data-level fallback)
    return;
  }

  // 3. Skip dev tooling (HMR, webpack hot-update chunks, Next.js internal dev endpoints)
  const pathAndSearch = url.pathname + url.search;
  if (BYPASS_PATTERNS.some((p) => pathAndSearch.includes(p))) {
    return;
  }

  // 4. Skip Next.js server action / mutation requests
  if (request.headers.get('Next-Action')) return;

  // ── Strategy dispatch ──────────────────────────────────────────────────────

  // A. RSC (React Server Component) payloads: ?_rsc= or Next-Router-State-Tree header
  //    These are what cause ERR_INTERNET_DISCONNECTED on client-side navigation offline.
  //    Strategy: Network-First with 3s timeout → cache fallback → synthesized empty RSC shell
  const isRSC = url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree') !== null;

  if (isRSC) {
    event.respondWith(networkFirstRSC(request, url));
    return;
  }

  // B. Navigation requests (full HTML page loads / browser refreshes)
  //    Strategy: Network-First with fast timeout → cache fallback → root shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request, url));
    return;
  }

  // C. Next.js static chunks (JS/CSS bundles) — Cache-First
  //    These are content-hashed, safe to serve from cache forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // D. Next.js image optimization and other /_next/ paths — Network-First
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirstWithFallback(request, RUNTIME_CACHE));
    return;
  }

  // E. Local API routes (/api/...) — Network-Only (data is too dynamic to cache)
  //    But we don't return early so errors propagate naturally and IndexedDB handles data
  if (url.pathname.startsWith('/api/')) {
    return; // let it go to network; IndexedDB layer handles offline data fallback
  }

  // F. Everything else (icons, manifest, fonts) — Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// ============================================================================
// STRATEGY HELPERS
// ============================================================================

/**
 * Network-First for RSC payloads with 3s timeout.
 * Falls back to cached RSC response for the same route, then to a synthesized
 * "offline RSC" response that tells Next.js to render from client cache.
 */
async function networkFirstRSC(request, url) {
  const cache = await caches.open(RSC_CACHE);

  try {
    const networkResponse = await fetchWithTimeout(request.clone(), 8000);
    if (networkResponse.ok) {
      // Cache successful RSC responses keyed by pathname (drop the _rsc param so
      // different RSC timestamps for the same route share one cache entry)
      const cacheKey = new Request(url.pathname + (url.search.replace(/[?&]_rsc=[^&]*/g, '').replace(/^&/, '?') || ''), {
        headers: request.headers,
      });
      cache.put(cacheKey, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_err) {
    // Try exact cache match first
    const cached = await cache.match(request);
    if (cached) return cached;

    // Try pathname-only cache match (strips _rsc timestamp)
    const pathKey = new Request(url.pathname, { headers: request.headers });
    const pathCached = await cache.match(pathKey);
    if (pathCached) return pathCached;

    // If both network and cache fail, do NOT return an empty body with 200 OK.
    // Returning 503 causes Next.js router to gracefully handle fallback or navigation.
    return new Response('Offline - RSC unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain',
        'X-Offline-Fallback': '1',
      },
    });
  }
}

/**
 * Network-First for HTML navigation with 8s timeout.
 * Falls back to cached version of that page, then to the root shell (/),
 * never shows ERR_INTERNET_DISCONNECTED.
 */
async function networkFirstNavigate(request, url) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const networkResponse = await fetchWithTimeout(request.clone(), 8000);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_err) {
    // Try exact route
    const cached = await cache.match(request);
    if (cached) return cached;

    // Try pathname without query string
    const pathOnly = new Request(url.pathname);
    const pathCached = await cache.match(pathOnly);
    if (pathCached) return pathCached;

    // Fall back to root shell — React will hydrate from client cache
    const rootShell = await cache.match('/');
    if (rootShell) return rootShell;

    // Absolute last resort — a minimal HTML page that reloads when back online
    return new Response(offlineFallbackHTML(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Cache-First for content-hashed static assets (/_next/static/).
 * These never change once hashed, so cache is always correct.
 */
async function cacheFirstStatic(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (e) {
    return new Response('/* offline */', {
      status: 503,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}

/**
 * Network-First with cache fallback for a given named cache.
 */
async function networkFirstWithFallback(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetchWithTimeout(request.clone(), 3000);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: serve from cache immediately, update in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request.clone())
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/**
 * Wraps fetch with an AbortController timeout.
 */
function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * Minimal offline HTML page shown only when no shell is cached at all.
 */
function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Cash Manager – Offline</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #fafafa; color: #09090b; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border: 1px solid #e5e5e5; border-radius: 16px;
            padding: 32px; max-width: 320px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
    h2 { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
    p  { font-size: 13px; color: #737373; margin: 0 0 20px; line-height: 1.5; }
    button { background: #09090b; color: white; border: none; border-radius: 8px;
             padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
    button:hover { background: #18181b; }
    .dot { width: 10px; height: 10px; background: #f59e0b; border-radius: 50%;
           margin: 0 auto 16px; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <h2>You're offline</h2>
    <p>Cash Manager is trying to reconnect. Your data is safe and will sync when you're back online.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
  <script>
    // Auto-reload when network comes back
    window.addEventListener('online', () => location.reload());
  </script>
</body>
</html>`;
}

// Service Worker for PWA support
const CACHE_NAME = 'speakduck-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/duck-follow-me.png',
  '/manifest.json'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 仅处理 GET；跳过所有非 GET（例如 POST 到 /api）以避免缓存错误
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }
  // 跳过接口与动态数据路径（/api/* 不缓存）
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // 尝试写入缓存；失败时静默忽略
          try { cache.put(req, respClone) } catch (_) {}
        });
        return resp;
      }).catch(() => {
        // 网络失败时回退到缓存（若有）
        return caches.match(req);
      });
    })
  );
});


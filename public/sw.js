// Service Worker for PWA support
// 更新版本号以强制刷新缓存
const CACHE_NAME = 'speakduck-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/duck-follow-me.png',
  '/manifest.json'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  // 立即激活新的 Service Worker
  self.skipWaiting();
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
  // 立即控制所有页面
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
    }).then(() => self.clients.claim())
  );
});

// 拦截请求 - 使用"网络优先，缓存后备"策略
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

  // 网络优先策略：先尝试从网络获取，失败时使用缓存
  event.respondWith(
    fetch(req)
      .then((resp) => {
        // 网络请求成功，更新缓存
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(req, respClone) } catch (_) {}
          });
        }
        return resp;
      })
      .catch(() => {
        // 网络失败，回退到缓存
        return caches.match(req);
      })
  );
});


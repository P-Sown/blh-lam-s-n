
const CACHE_NAME = 'safespeak-cache-v1';

// Danh sách các tài nguyên tĩnh quan trọng cần cache ngay lập tức
const PRECACHE_URLS = [
  './',
  './index.html',
  './index.tsx',
  './App.tsx',
  './manifest.json'
];

// Sự kiện Install: Cache các file tĩnh
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching app shell');
        // Chúng ta cố gắng cache, nhưng nếu lỗi 1 file cũng không chặn install
        return cache.addAll(PRECACHE_URLS).catch(err => console.warn("Precache warning:", err));
      })
      .then(() => self.skipWaiting())
  );
});

// Sự kiện Activate: Xóa cache cũ nếu có update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Sự kiện Fetch: Xử lý request mạng
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bỏ qua các request API (Firebase, Gemini, Google APIs) -> Luôn dùng mạng
  // Lý do: App đã có logic xử lý offline cho data (IndexedDB) ở tầng ứng dụng (App.tsx),
  // nếu cache API response ở đây sẽ gây conflict hoặc dữ liệu cũ.
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') || 
      url.href.includes('firestore')) {
    return;
  }

  // 2. Chiến lược Stale-While-Revalidate cho các file tĩnh (JS, CSS, Images, Fonts)
  // Nghĩa là: Trả về Cache ngay lập tức cho nhanh, sau đó tải ngầm từ mạng để cập nhật Cache cho lần sau.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Chỉ cache những response hợp lệ (status 200)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Nếu mất mạng và không có trong cache -> Sẽ rơi xuống logic dưới
      });

      // Nếu có cache, trả về cache ngay (ưu tiên tốc độ & offline)
      // Nếu không có cache, chờ fetch mạng
      return cachedResponse || fetchPromise;
    })
  );
});

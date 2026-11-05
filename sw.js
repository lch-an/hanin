// han in 輸入記帳：讓「加入主畫面」後的網頁版沒網路也能打開
// 只快取 App 自己的檔案；記帳資料走 Supabase，不經過這裡。
// 改了 www 裡的檔案後，把 VERSION 加 1，使用者下次打開就會拿到新版。
const VERSION = 'hanin-v1';
const FILES = [
  './', 'index.html', 'config.js', 'privacy.html', 'manifest.webmanifest',
  'vendor/supabase.js', 'js/cloud.js', 'js/rewards.js',
  'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase 等外部請求不處理
  // 先拿網路上的新版，沒網路才用快取，避免使用者卡在舊版
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))),
  );
});

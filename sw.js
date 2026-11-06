// han in 輸入記帳：讓「加入主畫面」後的網頁版沒網路也能打開
// 只快取 App 自己的檔案；記帳資料走 Supabase，不經過這裡。
// 改了 www 裡的檔案後，把 VERSION 加 1，使用者下次打開就會拿到新版。
const VERSION = 'hanin-v12';
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

// 三餐提醒：收到推播就跳通知
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'han in 輸入記帳', {
    body: d.body || '記一筆吧！', tag: d.tag || 'hanin', icon: 'icon-192.png', badge: 'icon-192.png',
    data: { url: d.url || './' },
  }));
});

// 點通知：打開 App 並直接進入記一筆
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});

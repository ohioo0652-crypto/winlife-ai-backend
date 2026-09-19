const CACHE='solulu-shell-v2';
const APP=['./','./index-pub.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.pathname.startsWith('/api/')) return;
 if(e.request.method!=='GET') return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index-pub.html'))));
});

/* ── Push notifications ── */
self.addEventListener('push', e => {
  let p = { title: 'SoluluMind 🌸', body: 'Time for a check-in.', url: './index-pub.html' };
  try { if (e.data) p = { ...p, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(p.title, {
    body: p.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: p.url },
    vibrate: [90, 50, 90]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './index-pub.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) { c.navigate(url); return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});

self.addEventListener('message', e => {
  if (e.data?.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification(e.data.title || 'SoluluMind 🌸', {
      body: e.data.body || 'Notifications are working.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png'
    });
  }
});

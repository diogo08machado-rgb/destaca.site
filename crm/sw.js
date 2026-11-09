// Service worker of the CRM: shows the push notifications ("Destaca CRM", Destaca logo) and opens the company card on tap.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Destaca CRM', {
    body: d.body || '', icon: '/icon-512.png', badge: '/favicon-48.png', data: { url: d.url || '/crm/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/crm/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => new URL(w.url).pathname.startsWith('/crm'));
    if (open) return open.navigate(url).then((w) => (w || open).focus());
    return self.clients.openWindow(url);
  }));
});

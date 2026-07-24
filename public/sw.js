// Minimal service worker: its only job is to show a notification when a
// push arrives while Pinewood isn't open. No offline caching layer — at
// 9-13 users this isn't worth the added complexity of a caching strategy.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? 'Pinewood';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      data: { billId: data.billId }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const billId = event.notification.data?.billId;
  const url = billId ? `/bills/${billId}` : '/';
  event.waitUntil(self.clients.openWindow(url));
});

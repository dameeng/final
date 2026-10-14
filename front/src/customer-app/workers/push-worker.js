/* 별도 푸시 수신 워커: 기존 PWA 오프라인 워커를 교체하지 않습니다. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  if (!data || typeof data !== 'object') data = {};
  const title = typeof data.title === 'string' ? data.title : 'Routel 위험 안내';
  const appBase = new URL('/app/', self.location.origin);
  // 외부 URL을 그대로 열지 않고 알려진 앱 내부 경로만 생성합니다.
  const route = typeof data.underpassId === 'string'
    ? '/underpasses/' + encodeURIComponent(data.underpassId) : '/notifications';
  const target = new URL('#' + route, appBase).href;
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.content === 'string' ? data.content : '앱에서 최신 안내를 확인해 주세요.',
    tag: typeof data.id === 'string' ? data.id : undefined,
    data: { url: target },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/app/', self.location.href);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const current = new URL(client.url);
      if (current.origin === target.origin && current.pathname === target.pathname) {
        const navigated = await client.navigate(target.href);
        if (navigated) return navigated.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});

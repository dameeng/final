export function registerPwa() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) {
    // 같은 localhost에서 배포본을 열었던 경우 개발 화면에 예전 앱이 남지 않게 한다.
    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const managed = registrations.filter(registration => {
        const worker = registration.active || registration.waiting || registration.installing
        if (!worker) return false
        const url = new URL(worker.scriptURL)
        return url.origin === location.origin && url.pathname === '/sw.js'
      })
      const controlled = !!navigator.serviceWorker.controller
      await Promise.all(managed.map(registration => registration.unregister()))
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.filter(name => name.startsWith('routel-static-')).map(name => caches.delete(name)))
      }
      if (controlled && managed.length) location.reload()
    })().catch(error => console.warn('개발용 앱 캐시 정리 실패', error))
    return
  }
  if (!import.meta.env.PROD) return
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((error) => console.warn('PWA 등록 실패', error))
    },
    { once: true },
  )
}

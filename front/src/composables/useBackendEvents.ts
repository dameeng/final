import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useApp } from '../stores/app'
import { backend } from '../services/backend'
export type BackendEvent = { name: string; data: Record<string, any> }
const eventNames = [
  'connected',
  'risk-update',
  'water-update',
  'risk-level-change',
  'control-change',
  'transit-update',
  'plate-queue-add',
  'plate-queue-done',
  'notice-new',
  'inquiry-new',
  'display-change',
  'notification-new',
  'data-changed',
]
// One stream for the app, restarted when the authenticated identity changes.
export function useBackendStream() {
  const app = useApp()
  let stream: EventSource | undefined
  const stop = watch(
    () => [
      app.account?.id,
      app.account?.role,
      app.authVersion,
      (app.account?.regions || [])
        .map((region) => String(region.id))
        .sort()
        .join(','),
    ],
    () => {
      stream?.close()
      if (typeof EventSource === 'undefined') return
      const source = new EventSource(
        app.account?.role === 'REGIONAL_ADMIN' ? '/api/admin/stream' : '/api/stream',
        { withCredentials: true },
      )
      stream = source
      let countVersion = 0
      const refreshManagerUnread = async () => {
        if (app.account?.role !== 'REGIONAL_ADMIN') return
        const version = ++countVersion
        try {
          const result = await backend('/api/managers/me/notifications/unread-count')
          if (stream === source && version === countVersion)
            app.unread = Math.max(0, Number(result?.total) || 0)
        } catch {
          /* Keep the last count until the next event or reconnect. */
        }
      }
      void refreshManagerUnread()
      for (const name of eventNames)
        source.addEventListener(name, (event) => {
          if (stream !== source) return
          if (name === 'connected' || name === 'notification-new') void refreshManagerUnread()
          if (name === 'connected') {
            window.dispatchEvent(
              new CustomEvent<BackendEvent>('routel-backend-event', { detail: { name, data: {} } }),
            )
            return
          }
          try {
            const data = JSON.parse((event as MessageEvent).data || '{}')
            if (data && typeof data === 'object' && !Array.isArray(data))
              window.dispatchEvent(
                new CustomEvent<BackendEvent>('routel-backend-event', { detail: { name, data } }),
              )
          } catch {
            /* Ignore malformed events; REST remains authoritative. */
          }
        })
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    stop()
    stream?.close()
    stream = undefined
  })
}
export function useBackendEvents(handler: (event: BackendEvent) => void) {
  const receive = (event: Event) => handler((event as CustomEvent<BackendEvent>).detail)
  onMounted(() => window.addEventListener('routel-backend-event', receive))
  onBeforeUnmount(() => window.removeEventListener('routel-backend-event', receive))
}

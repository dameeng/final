import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApp } from './app'
import { backend, asPage, queryString } from '../services/backend'
export interface CustomerNotification {
  id: number
  category: string
  title: string
  body: string
  read: boolean
  createdAt: string
  urgent?: boolean
  refType?: string
  refId?: number
  regionId?: number | null
  severity?: string
  riskLevel?: string
  currentRiskLevel?: string
}
export const notificationCategories = [
  { value: '', label: '전체' },
  { value: 'RISK', label: '위험' },
  { value: 'NOTICE', label: '공지' },
  { value: 'INQUIRY', label: '문의' },
]
export const notificationCategory = (value: string) =>
  notificationCategories.find((item) => item.value === value)?.label || '알림'
export const useCustomerNotifications = defineStore('customer-notifications', () => {
  const app = useApp(),
    recent = ref<CustomerNotification[]>([]),
    counts = ref<Record<string, number>>({}),
    loading = ref(false),
    error = ref(''),
    browserEnabled = ref(false),
    appArrivals = ref<CustomerNotification[]>([])
  let appAlertsEnabled = false,
    appBaselineReady = false,
    appStartedAt = 0,
    appBaselineTime = 0
  const pendingAppEvents = new Map<number, CustomerNotification>(),
    presentedInApp = new Set<number>()
  function notificationTime(row: CustomerNotification) {
    if (typeof row.createdAt !== 'string' || !row.createdAt.trim()) return NaN
    const value = row.createdAt.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')
    return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : value + '+09:00')
  }
  function queueAppArrival(row: CustomerNotification) {
    const at = notificationTime(row)
    if (!appAlertsEnabled || row.read || presentedInApp.has(row.id) ||
      (Number.isFinite(at) && at < appBaselineTime)) return
    presentedInApp.add(row.id)
    appArrivals.value.push({ ...row })
  }
  function setAppAlertsEnabled(enabled: boolean) {
    if (appAlertsEnabled === enabled) return
    appAlertsEnabled = enabled
    appBaselineReady = false
    appStartedAt = Date.now()
    appBaselineTime = 0
    pendingAppEvents.clear()
    appArrivals.value = []
  }
  function dismissAppArrivals() { appArrivals.value = [] }
  let eventRevision = 0
  let owner = '',
    seen = new Set<number>(),
    initialized = false,
    sequence = 0
  function reset() {
    const nextOwner = app.account?.role === 'customer' ? app.account.id : ''
    // Header instances remount on app navigation. Keep the same account's
    // baseline and deduplication state; an identity change still clears all.
    if (owner === nextOwner && owner) return
    sequence++
    owner = nextOwner
    recent.value = []
    counts.value = {}
    seen = new Set()
    initialized = false
    error.value = ''
    loading.value = false
    appAlertsEnabled = false
    appBaselineReady = false
    appBaselineTime = 0
    appArrivals.value = []
    pendingAppEvents.clear()
    presentedInApp.clear()
    app.unread = 0
    browserEnabled.value = !!owner && localStorage.getItem('routel-browser-alerts:' + owner) === '1'
  }
  function setBrowserEnabled(enabled: boolean) {
    browserEnabled.value = enabled
    if (owner) localStorage.setItem('routel-browser-alerts:' + owner, enabled ? '1' : '0')
  }
  async function refresh() {
    if (!app.account || app.account.role !== 'customer') return
    if (owner !== app.account.id) reset()
    if (loading.value) return
    const revision = eventRevision,
      version = ++sequence,
      user = owner
    loading.value = true
    error.value = ''
    try {
      const [page, unread] = await Promise.all([
        backend('/api/customers/me/notifications?page=1&size=5'),
        backend('/api/customers/me/notifications/unread-count'),
      ])
      if (
        version !== sequence ||
        owner !== user ||
        app.account?.id !== user ||
        revision !== eventRevision
      )
        return
      const rows = asPage<CustomerNotification>(page).items
      if (appAlertsEnabled) {
        if (appBaselineReady) {
          // A reconnect/poll is a fallback for actual new IDs, not a replay of
          // all previously unread messages. Keep the normal bell preview intact.
          for (const row of [...rows].reverse())
            if (!seen.has(row.id)) queueAppArrival(row)
        } else {
          appBaselineReady = true
          // An SSE event can race the first REST snapshot. Only events created
          // after activation qualify during this bootstrap window.
          for (const row of pendingAppEvents.values()) {
            if (notificationTime(row) >= appStartedAt) {
              const snapshot = rows.find(item => item.id === row.id)
              queueAppArrival(snapshot || row)
            }
          }
          pendingAppEvents.clear()
          appBaselineTime = Math.max(0, ...rows.map(notificationTime).filter(Number.isFinite))
        }
      }
      if (
        initialized &&
        browserEnabled.value &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        for (const row of rows)
          if (!row.read && !seen.has(row.id)) {
            try {
              const message = new Notification(row.title, {
                body: row.body,
                tag: 'routel-notification-' + row.id,
              })
              message.onclick = () => {
                window.focus()
                window.location.assign('/my-alerts?notification=' + row.id)
                message.close()
              }
            } catch {
              /* Notification history remains available when the browser cannot display system notifications. */
            }
          }
      }
      rows.forEach((row) => seen.add(row.id))
      initialized = true
      recent.value = rows
      counts.value = unread?.byCategory || {}
      app.unread = Number(unread?.total) || 0
    } catch (e) {
      if (version === sequence) error.value = (e as Error).message
    } finally {
      if (version === sequence) {
        loading.value = false
        if (revision !== eventRevision && owner === user) void refresh()
      }
    }
  }
  function ingest(data: Record<string, any>) {
    if (app.account?.role !== 'customer' || !Number.isSafeInteger(data.id)) return
    if (owner !== app.account.id) reset()
    eventRevision++
    const existing = recent.value.find((row) => row.id === data.id),
      row: CustomerNotification = { ...data, read: existing?.read ?? data.read ?? false } as CustomerNotification
    if (!seen.has(row.id) && appAlertsEnabled) {
      if (appBaselineReady) queueAppArrival(row)
      else pendingAppEvents.set(row.id, row)
    }
    recent.value = [row, ...recent.value.filter((item) => item.id !== row.id)].slice(0, 5)
    if (data.unread) {
      counts.value = data.unread.byCategory || {}
      app.unread = Math.max(0, Number(data.unread.total) || 0)
    }
    if (
      !seen.has(row.id) &&
      browserEnabled.value &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(row.title, { body: row.body, tag: 'routel-notification-' + row.id })
      } catch {}
    }
    seen.add(row.id)
  }
  // SSE notification-read-change: 다른 탭·기기에서 읽음 처리한 결과를 이 화면에 맞춘다.
  // 새 알림이 아니므로 토스트·소리·강조 없이 읽음 상태와 건수만 바꾼다.
  function applyReadChange(data: Record<string, any>) {
    if (app.account?.role !== 'customer') return
    if (owner !== app.account.id) reset()
    eventRevision++
    if (data.all) {
      recent.value.forEach((row) => {
        if (!data.category || row.category === data.category) row.read = true
      })
      appArrivals.value = appArrivals.value.filter((item) => data.category && item.category !== data.category)
    } else if (Number.isSafeInteger(data.id)) {
      const row = recent.value.find((item) => item.id === data.id)
      if (row) row.read = true
      appArrivals.value = appArrivals.value.filter((item) => item.id !== data.id)
    }
    if (data.unread) {
      counts.value = data.unread.byCategory || {}
      app.unread = Math.max(0, Number(data.unread.total) || 0)
    }
    // 여러 탭의 응답 순서가 바뀔 수 있으니 최종 숫자는 REST 로 다시 확인한다
    void refresh()
  }
  async function list(filters: { page: number; size?: number; category?: string; unreadOnly?: boolean }) {
    return asPage<CustomerNotification>(
      await backend('/api/customers/me/notifications' + queryString({ ...filters, size: filters.size ?? 20 })),
    )
  }
  async function read(id: number) {
    const user = app.account?.id
    await backend(`/api/customers/me/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
    })
    if (user !== app.account?.id) return
    const row = recent.value.find((item) => item.id === id)
    if (row) row.read = true
    appArrivals.value = appArrivals.value.filter(item => item.id !== id)
    await refresh()
  }
  async function readAll(category = '') {
    const user = app.account?.id
    await backend('/api/customers/me/notifications/read-all' + queryString({ category }), {
      method: 'PUT',
    })
    if (user !== app.account?.id) return
    appArrivals.value = appArrivals.value.filter(item => category && item.category !== category)
    await refresh()
  }
  return {
    recent,
    counts,
    loading,
    error,
    browserEnabled,
    appArrivals,
    setAppAlertsEnabled,
    dismissAppArrivals,
    reset,
    setBrowserEnabled,
    refresh,
    ingest,
    applyReadChange,
    list,
    read,
    readAll,
  }
})

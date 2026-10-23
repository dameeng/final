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
  refType?: string
  refId?: number
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
    browserEnabled = ref(false)
  let eventRevision = 0
  let owner = '',
    seen = new Set<number>(),
    initialized = false,
    sequence = 0
  function reset() {
    sequence++
    owner = app.account?.role === 'customer' ? app.account.id : ''
    recent.value = []
    counts.value = {}
    seen = new Set()
    initialized = false
    error.value = ''
    loading.value = false
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
      row: CustomerNotification = { ...data, read: existing?.read ?? false } as CustomerNotification
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
    await refresh()
  }
  async function readAll(category = '') {
    await backend('/api/customers/me/notifications/read-all' + queryString({ category }), {
      method: 'PUT',
    })
    await refresh()
  }
  return {
    recent,
    counts,
    loading,
    error,
    browserEnabled,
    reset,
    setBrowserEnabled,
    refresh,
    ingest,
    list,
    read,
    readAll,
  }
})

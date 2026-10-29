import { defineStore } from 'pinia'
import { ref } from 'vue'
import { backend, asPage } from '../services/backend'
import type { CustomerNotification } from './customerNotifications'
import { useApp } from './app'
export const useManagerNotifications = defineStore('manager-notifications', () => {
  const unread = ref(0),
    recent = ref<CustomerNotification[]>([]),
    loading = ref(false),
    error = ref(''),
    app = useApp()
  let sequence = 0,
    previewSequence = 0,
    eventRevision = 0
  function reset() {
    sequence++
    previewSequence++
    recent.value = []
    loading.value = false
    error.value = ''
    unread.value = 0
  }
  // 미읽음 건수 조회. 실패하면 오류를 돌려준다(성공이면 undefined).
  async function fetchCount(): Promise<unknown> {
    if (app.account?.role !== 'REGIONAL_ADMIN') {
      reset()
      return
    }
    const id = app.account.id,
      version = ++sequence
    try {
      const data = await backend('/api/managers/me/notifications/unread-count')
      if (version === sequence && app.account?.id === id && app.account.role === 'REGIONAL_ADMIN') {
        unread.value = Math.max(0, Number(data?.total) || 0)
        app.unread = unread.value
      }
    } catch (e) {
      /* The notification list shows actionable API errors. */
      return e
    }
  }
  // 같은 순간에 여러 곳(SSE 연결, 헤더, 벨, 목록)에서 불러도 요청은 한 번만 보낸다.
  // 조회 중에 다시 부르면 끝난 뒤에 딱 한 번 더 조회해서 마지막 숫자를 맞춘다.
  let queued: Promise<unknown> | undefined,
    running: Promise<unknown> | undefined,
    rerun = false
  function refresh(): Promise<unknown> {
    if (queued) return queued
    queued = Promise.resolve().then(() => {
      queued = undefined
      if (running) {
        rerun = true
        return running
      }
      running = (async () => {
        let failure: unknown
        try {
          do {
            rerun = false
            failure = await fetchCount()
          } while (rerun)
        } finally {
          running = undefined
        }
        return failure
      })()
      return running
    })
    return queued
  }
  async function refreshPreview() {
    if (app.account?.role !== 'REGIONAL_ADMIN') return
    const user = app.account.id,
      version = ++previewSequence,
      revision = eventRevision
    loading.value = true
    error.value = ''
    try {
      const result = await backend('/api/managers/me/notifications?page=1&size=5')
      if (version !== previewSequence || app.account?.id !== user || revision !== eventRevision)
        return
      recent.value = asPage<CustomerNotification>(result).items.slice(0, 5)
    } catch (e) {
      if (version === previewSequence) error.value = (e as Error).message
    } finally {
      if (version === previewSequence) {
        loading.value = false
        if (revision !== eventRevision && app.account?.id === user) void refreshPreview()
      }
    }
    void refresh()
  }
  function ingest(data: Record<string, any>) {
    if (app.account?.role !== 'REGIONAL_ADMIN' || !Number.isSafeInteger(data.id)) return
    eventRevision++
    const previous = recent.value.find((item) => item.id === data.id)
    recent.value = [
      { ...data, read: previous?.read ?? false } as CustomerNotification,
      ...recent.value.filter((item) => item.id !== data.id),
    ].slice(0, 5)
  }
  // SSE notification-read-change: 다른 탭·기기에서 읽음 처리한 결과를 이 화면에 맞춘다.
  // 새 알림이 아니므로 ingest 와 달리 목록 맨 위에 올리거나 강조하지 않는다.
  function applyReadChange(data: Record<string, any>) {
    if (app.account?.role !== 'REGIONAL_ADMIN') return
    eventRevision++
    if (data.all) {
      recent.value.forEach((row) => {
        if (!data.category || row.category === data.category) row.read = true
      })
    } else if (Number.isSafeInteger(data.id)) {
      const row = recent.value.find((item) => item.id === data.id)
      if (row) row.read = true
    }
    const total = Number(data.unread?.total)
    if (data.unread && Number.isFinite(total)) {
      unread.value = Math.max(0, total)
      app.unread = unread.value
    }
    // 여러 탭의 응답 순서가 바뀔 수 있으니 최종 숫자는 REST 로 다시 확인한다
    void refresh()
  }
  async function read(id:number) {
    if(app.account?.role!=='REGIONAL_ADMIN')return
    const user=app.account.id
    await backend(`/api/managers/me/notifications/${encodeURIComponent(id)}/read`,{method:'PUT'})
    if(app.account?.id!==user||app.account.role!=='REGIONAL_ADMIN')return
    eventRevision++
    sequence++
    const row=recent.value.find(item=>item.id===id)
    if(row&&!row.read) {
      row.read=true
      unread.value=Math.max(0,unread.value-1)
      app.unread=unread.value
    }
    await refresh()
  }
  async function readAll() {
    if (app.account?.role !== 'REGIONAL_ADMIN') return
    const user = app.account.id
    await backend('/api/managers/me/notifications/read-all', { method: 'PUT' })
    if (app.account?.id !== user || app.account.role !== 'REGIONAL_ADMIN') return
    eventRevision++
    recent.value.forEach(row => { row.read = true })
    await Promise.all([refresh(), refreshPreview()])
  }
  return { unread, recent, loading, error, refresh, refreshPreview, ingest, applyReadChange, reset, read, readAll }
})

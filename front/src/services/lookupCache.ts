import { backend } from './backend'
import { useApp } from '../stores/app'

// 선택 목록(지하차도·지역·근무조·카메라 등) 조회 결과를 잠깐 공유한다.
// 같은 화면에서 필드마다 같은 주소를 반복해서 부르거나, 화면을 오가며 곧바로 다시 부를 때
// 요청이 한 번만 나가게 한다. 진행 중인 요청도 같은 Promise 를 같이 쓴다.
// 실패한 요청은 저장하지 않아서 다시 시도하면 새로 요청한다.
const TTL = 10_000
const entries = new Map<string, { at: number; promise: Promise<any> }>()

export function cachedGet<T = any>(url: string): Promise<T> {
  // 계정이 바뀌면 담당 지역 범위도 달라지므로 계정별로 따로 저장한다
  const key = `${useApp().account?.id || 'guest'}:${url}`
  const hit = entries.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.promise
  const promise = backend<T>(url)
  entries.set(key, { at: Date.now(), promise })
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key)
  })
  return promise
}

export function clearLookupCache() {
  entries.clear()
}

// 목록이 바뀌었다는 신호가 오면 저장한 결과를 버린다
if (typeof window !== 'undefined') {
  window.addEventListener('routel-backend-event', (event) => {
    const { name, data } = (event as CustomEvent<{ name: string; data: Record<string, any> }>).detail || {}
    if (
      name === 'manager-assignment-change' ||
      (name === 'data-changed' && ['underpass', 'camera', 'its-vms'].includes(String(data?.resource)))
    )
      clearLookupCache()
  })
}

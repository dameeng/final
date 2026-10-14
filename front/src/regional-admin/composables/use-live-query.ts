import { onBeforeUnmount, watch } from 'vue'

/** Independent visible-page polling: a slow camera request cannot delay alert rows. */
export function useLiveQuery<T>(
  key: () => string,
  request: (id: string, signal: AbortSignal) => Promise<T>,
  receive: (rows: T) => void,
  failed: () => void,
  reset: () => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let generation = 0, busy = false, disposed = false
  function cancel() {
    generation++
    clearTimeout(timer); clearTimeout(timeout)
    controller?.abort(); busy = false
  }
  async function refresh() {
    if (disposed || busy || document.hidden || !key()) return
    clearTimeout(timer)
    const id = key(), token = generation
    const current = new AbortController()
    controller = current; busy = true
    timeout = setTimeout(() => current.abort(), 8000)
    let retry = false
    try {
      const rows = await request(id, current.signal)
      if (!disposed && token === generation && id === key()) receive(rows)
    } catch {
      if (!disposed && token === generation && id === key()) { failed(); retry = true }
    } finally {
      if (token === generation) {
        clearTimeout(timeout); busy = false
        if (!disposed && !document.hidden) timer = setTimeout(() => void refresh(), retry ? 5000 : 1000)
      }
    }
  }
  watch(key, () => { cancel(); reset(); void refresh() }, { immediate: true })
  function visibilityChanged() {
    cancel()
    if (!document.hidden) void refresh()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  onBeforeUnmount(() => {
    disposed = true; cancel()
    document.removeEventListener('visibilitychange', visibilityChanged)
  })
  return { refresh }
}

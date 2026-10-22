import { onBeforeUnmount, ref, watch } from 'vue'

// The first snapshot is a baseline; only later arrivals glow, never a refresh of the same rows.
export function useNewItemGlow<T>(rows: () => T[], key: (row: T) => string, ready: () => boolean = () => true) {
  const fresh = ref(new Set<string>()),
    seen = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let initialized = false
  watch(
    () => ready() ? rows().map(key) : null,
    (keys) => {
      if (keys === null) return
      for (const id of keys) {
        if (initialized && !seen.has(id)) {
          fresh.value.add(id)
          timers.set(
            id,
            setTimeout(() => {
              fresh.value.delete(id)
              timers.delete(id)
            }, 6000),
          )
        }
        seen.add(id)
      }
      initialized = true
    },
  )
  onBeforeUnmount(() => {
    for (const timer of timers.values()) clearTimeout(timer)
  })
  return (row: T) => fresh.value.has(key(row))
}

import { onBeforeUnmount, ref } from 'vue'
/** First successful snapshot seeds the IDs; later unseen IDs highlight only once. */
export function useNewRecords() {
 const fresh = ref(new Set<number>())
 const seen = new Set<number>()
 const timers = new Map<number, ReturnType<typeof setTimeout>>()
 let initialized = false
 function reset() {
  timers.forEach(clearTimeout); timers.clear(); seen.clear()
  fresh.value = new Set(); initialized = false
 }
 function receive(rows: { id:number }[]) {
  const next = new Set(fresh.value)
  for (const row of rows) {
   if (initialized && !seen.has(row.id)) {
    next.add(row.id)
    timers.set(row.id, setTimeout(() => {
     const remaining = new Set(fresh.value); remaining.delete(row.id); fresh.value = remaining
     timers.delete(row.id)
    }, 1400))
   }
   seen.add(row.id)
  }
  fresh.value = next; initialized = true
 }
 onBeforeUnmount(reset)
 return { fresh, receive, reset }
}

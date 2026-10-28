<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { backend } from '../services/backend'
import { useManagerNotifications } from '../stores/managerNotifications'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import type { CustomerNotification } from '../stores/customerNotifications'
const app = useApp(), route = useRoute(), router = useRouter(), store = useManagerNotifications()
const dialog = ref<HTMLDialogElement>(), queue = ref<CustomerNotification[]>([]), busy = ref(false), error = ref('')
const current = computed(() => queue.value[0])
const seen = new Set<number>()
let request: AbortController | undefined, generation = 0
function ingest(row: CustomerNotification) {
  if (app.account?.role !== 'REGIONAL_ADMIN' || row.urgent !== true || row.read || seen.has(row.id)) return
  seen.add(row.id); queue.value.push(row)
}
async function refresh() {
  if (app.account?.role !== 'REGIONAL_ADMIN') return
  request?.abort(); const controller = new AbortController(); request = controller
  const version = generation
  try {
    const rows = await backend<CustomerNotification[]>('/api/managers/me/notifications/urgent', { signal: controller.signal })
    if (!controller.signal.aborted && version === generation) (Array.isArray(rows) ? rows : []).forEach(ingest)
  } catch (e) { if (!controller.signal.aborted && current.value) error.value = (e as Error).message }
}
async function acknowledge(details = false) {
  if (!current.value || busy.value) return
  const row = current.value, version = generation
  busy.value = true; error.value = ''
  try {
    await store.read(row.id)
    if (version !== generation) return
    queue.value = queue.value.filter(item => item.id !== row.id)
    if (details) await router.push({ path: route.path.startsWith('/admin-app/') ? '/admin-app/notifications' : '/admin-data/manager-notifications', query: { notification: String(row.id) } })
  } catch (e) { if (version === generation) error.value = (e as Error).message }
  finally { if (version === generation) busy.value = false }
}
watch(() => current.value?.id, async () => {
  await nextTick()
  if (current.value && !dialog.value?.open) dialog.value?.showModal()
  else if (!current.value) dialog.value?.close()
})
watch(() => [app.account?.id, app.account?.role], () => {
  generation++; request?.abort(); queue.value = []; seen.clear(); busy.value = false; error.value = ''
  void refresh()
}, { immediate: true })
useBackendEvents(({ name, data }) => {
  if (name === 'connected') void refresh()
  if (name === 'notification-new') ingest(data as CustomerNotification)
})
onBeforeUnmount(() => { generation++; request?.abort(); dialog.value?.close() })
</script>
<template>
  <Teleport to="body"><dialog ref="dialog" class="manager-urgent-alert" aria-labelledby="manager-urgent-title" @cancel.prevent="acknowledge()">
    <template v-if="current"><header><span>긴급 알림 <small v-if="queue.length>1">· {{queue.length}}건</small></span><button type="button" :disabled="busy" aria-label="긴급 알림 확인하고 닫기" @click="acknowledge()">×</button></header>
    <div class="urgent-copy"><h2 id="manager-urgent-title">{{current.title}}</h2><time>{{displayDate(current.createdAt)}}</time><p>{{current.body}}</p><p v-if="error" role="alert">{{error}}</p></div>
    <footer><button type="button" :disabled="busy" @click="acknowledge()">확인하고 닫기</button><button type="button" class="primary" :disabled="busy" @click="acknowledge(true)">알림 상세 보기</button></footer></template>
  </dialog></Teleport>
</template>
<style scoped>
.manager-urgent-alert { box-sizing:border-box; width:min(420px,calc(100% - 32px)); max-height:calc(100dvh - 48px); padding:0; border:1px solid var(--status-danger-ink,#a02e40); border-radius:16px; background:var(--r-surface,#fff); color:var(--r-ink,#172d48); box-shadow:0 20px 70px #0004; }
.manager-urgent-alert::backdrop { background:#10203999; }
header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:var(--status-danger-bg,#fce5e9); color:var(--status-danger-ink,#a02e40); font-weight:700; }
header button { border:0; background:transparent; color:inherit; font-size:24px; min-width:36px; min-height:36px; }
.urgent-copy { padding:20px; } h2 { margin:0 0 10px; font-size:20px; line-height:1.5; overflow-wrap:anywhere; } time { font-size:12px; color:var(--r-muted,#586b82); } p { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.8; font-size:14px; }
footer { display:flex; gap:8px; padding:0 20px 20px; } footer button { flex:1; min-height:44px; padding:10px; border:1px solid var(--r-line,#dbe3ed); border-radius:9px; background:var(--r-surface,#fff); color:inherit; } footer .primary { background:var(--r-accent,#225bb5); color:#fff; }
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { asPage, backend, queryString } from '../services/backend'
import { useCustomerNotifications, notificationCategory, type CustomerNotification } from '../stores/customerNotifications'
import { useManagerNotifications } from '../stores/managerNotifications'
import { notificationTarget } from '../utils/notification-target'
import { displayDate } from '../utils/display-date'
import { valueLabels } from '../data/backendResources'
const props = defineProps<{ manager?: boolean }>()
const route = useRoute(), router = useRouter()
const customer = useCustomerNotifications(), managerStore = useManagerNotifications()
const item = ref<CustomerNotification | null>(null), loading = ref(false), error = ref('')
const previousId = ref<number | null>(null), nextId = ref<number | null>(null)
function move(id: number | null) {
  if (id && !loading.value) void router.push({ path: route.path, query: { ...route.query, notification: String(id) } })
}
let controller: AbortController | undefined
const related = computed(() => item.value ? notificationTarget(item.value, !!props.manager, route.path, route.path) : null)
const hasRelated = computed(() => related.value && typeof related.value === 'object' && 'path' in related.value && related.value.path !== route.path)
function back() { void router.push({ path: route.path, query: { ...route.query, notification: undefined } }) }
async function load() {
  controller?.abort()
  const request = new AbortController(); controller = request
  const id = Number(route.query.notification)
  item.value = null; previousId.value = null; nextId.value = null; error.value = ''; loading.value = true
  try {
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('올바르지 않은 알림입니다.')
    const store = props.manager ? managerStore : customer
    let found: CustomerNotification | undefined
    let last: CustomerNotification | undefined
    // The notification API exposes a paginated list, without a single-item GET.
    for (let page = 1; !found; page++) {
      const result = asPage<CustomerNotification>(await backend(
        `/api/${props.manager ? 'managers' : 'customers'}/me/notifications` + queryString({ page, size: 100 }),
        { signal: request.signal },
      ))
      const index = result.items.findIndex(row => row.id === id)
      found = result.items[index]
      if (request.signal.aborted) return
      if (found) {
        previousId.value = (result.items[index - 1] || last)?.id ?? null
        nextId.value = result.items[index + 1]?.id ?? null
        if (!nextId.value && page < result.totalPages) {
          const following = asPage<CustomerNotification>(await backend(
            `/api/${props.manager ? 'managers' : 'customers'}/me/notifications` + queryString({ page: page + 1, size: 100 }),
            { signal: request.signal },
          ))
          if (request.signal.aborted) return
          nextId.value = following.items[0]?.id ?? null
        }
      }
      last = result.items.at(-1)
      if (found || page >= result.totalPages || !result.items.length) break
    }
    if (request.signal.aborted) return
    if (!found) throw Error('알림을 찾을 수 없습니다. 목록에서 다시 확인해 주세요.')
    item.value = { ...found }
    if (!found.read) {
      await store.read(id)
      if (!request.signal.aborted && item.value) item.value.read = true
    }
  } catch (e) { if (!request.signal.aborted) error.value = (e as Error).message }
  finally { if (!request.signal.aborted) loading.value = false }
}
watch(() => [route.query.notification, props.manager], load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <main class="service-workspace notification-detail-view">
    <button type="button" class="notification-detail-back" @click="back">‹ 알림 목록</button>
    <p v-if="loading" class="notification-detail-message" role="status">알림을 불러오는 중입니다.</p>
    <p v-if="error" class="notification-detail-message" role="alert">{{error}}</p>
    <article v-if="item" class="notification-detail-card">
      <header class="notification-detail-header">
        <div class="notification-detail-meta"><span class="notification-detail-category"><UiIcon name="bell" />{{manager ? valueLabels[item.category]||'알림' : notificationCategory(item.category)}}</span><span v-if="!/^\/(admin|customer)-app\//.test(route.path)" class="notification-detail-read">{{item.read?'읽음':'안 읽음'}}</span></div>
        <h1>{{item.title}}</h1>
        <p class="notification-detail-time"><span>수신 시각</span><time :datetime="item.createdAt">{{displayDate(item.createdAt)}}</time></p>
      </header>
      <p class="notification-detail-body">{{item.body||'추가 안내 내용이 없습니다.'}}</p>
      <footer v-if="hasRelated&&related" class="notification-detail-footer"><RouterLink :to="related" class="notification-detail-related">관련 내용 확인 <span aria-hidden="true">→</span></RouterLink></footer>
    </article>
    <nav v-if="item" class="notification-detail-navigation" aria-label="알림 이동">
      <button type="button" :disabled="loading||previousId===null" @click="move(previousId)">‹ 이전 알림</button>
      <button type="button" :disabled="loading||nextId===null" @click="move(nextId)">다음 알림 ›</button>
    </nav>
  </main>
</template>
<style scoped>
#app .notification-detail-view { box-sizing:border-box; display:block; width:100%; min-width:0; min-height:0; margin:0; padding:20px 16px 28px; color:var(--r-ink); }
#app .notification-detail-back { display:inline-flex; align-items:center; min-height:36px; margin:0 0 16px; padding:6px 10px; border:1px solid var(--r-line); border-radius:9px; background:var(--r-surface); color:var(--r-muted); font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
#app .notification-detail-card { display:flex; flex-direction:column; min-height:0; margin:0; overflow:hidden; border:1px solid var(--r-line); border-radius:16px; background:var(--r-surface); box-shadow:0 3px 14px #17365708; }
#app .notification-detail-header { display:block; padding:20px; border-bottom:1px solid var(--r-line); background:linear-gradient(135deg,var(--r-surface),var(--r-soft)); }
.notification-detail-meta { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.notification-detail-category { display:inline-flex; align-items:center; gap:6px; padding:5px 9px; border-radius:7px; background:var(--r-selected); color:var(--r-accent); font-size:11px; font-weight:650; }
.notification-detail-category :deep(.ui-icon) { --ui-icon-size:14px; }
.notification-detail-read { color:var(--r-muted); font-size:11px; }
#app .notification-detail-header h1 { margin:16px 0 12px; font-size:20px; font-weight:700; line-height:1.45; letter-spacing:-.025em; overflow-wrap:anywhere; }
.notification-detail-time { display:flex; align-items:baseline; flex-wrap:wrap; gap:8px; margin:0; color:var(--r-muted); font-size:11px; line-height:1.6; }
.notification-detail-time>span { font-weight:600; }
#app .notification-detail-body { margin:0; padding:22px 20px 26px; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--r-ink); line-height:1.85; font-size:14px; }
.notification-detail-footer { margin-top:0; padding:0 20px 20px; }
#app .notification-detail-related { box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:44px; padding:12px 14px; border:1px solid var(--r-accent); border-radius:10px; background:var(--r-primary); color:var(--r-on-brand,#fff); font-size:13px; font-weight:650; line-height:1.5; text-decoration:none; }
#app .notification-detail-related:hover { filter:brightness(1.08); }
#app .notification-detail-card>.notification-detail-body { flex:none; display:block; text-align:left; }
#app .notification-detail-related { background:var(--r-selected,#e8f0ff)!important; color:var(--r-ink,#172d48)!important; }
#app .notification-detail-navigation { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
#app .notification-detail-navigation button { display:flex; align-items:center; justify-content:center; min-height:44px; padding:10px 12px; border:1px solid var(--r-line); border-radius:10px; background:var(--r-surface); color:var(--r-ink); font:inherit; font-size:13px; cursor:pointer; }
#app .notification-detail-navigation button:disabled { opacity:.45; cursor:default; }
#app .notification-detail-message { margin:0; padding:20px; border:1px solid var(--r-line); border-radius:14px; background:var(--r-surface); font-size:13px; line-height:1.7; }
</style>

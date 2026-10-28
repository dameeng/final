<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBackendEvents } from '../composables/useBackendEvents'
import LiveMap from './c-live-map.vue'
import { backend } from '../services/backend'
import { useApp } from '../stores/app'
const app = useApp()
const hideToday = ref(false)
const noticeKey = () => `routel-control-notice-hidden:${app.account?.id ?? 'guest'}`
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
function hiddenToday() {
  try { return localStorage.getItem(noticeKey()) === today() } catch { return false }
}
function acknowledgeNotice() {
  if (hideToday.value) {
    try { localStorage.setItem(noticeKey(), today()) } catch { /* Closing still works if storage is unavailable. */ }
  }
}
const summary = ref<any>(),
  error = ref(''),
  loading = ref(false),
  controller = new AbortController()
const blocked = computed(() => summary.value?.blockedCount ?? '—')
const controlNotice = ref<HTMLDialogElement>()
watch(blocked, value => {
  if (Number(value) > 0 && !hiddenToday() && !controlNotice.value?.open && !document.querySelector('.ru-guide-dialog[open]')) controlNotice.value?.showModal()
  else if (Number(value) === 0) controlNotice.value?.close()
}, { flush: 'post' })
let reloadPending = false,
  liveTimer: ReturnType<typeof setTimeout> | undefined
async function load() {
  if (loading.value) {
    reloadPending = true
    return
  }
  loading.value = true
  error.value = ''
  const results = await Promise.allSettled([
    backend('/api/dashboard/facility-kpi', { signal: controller.signal }),
  ])
  if (controller.signal.aborted) return
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      summary.value = r.value
    } else error.value = r.reason.message
  })
  loading.value = false
  if (reloadPending) {
    reloadPending = false
    void load()
  }
}
useBackendEvents(({ name, data }) => {
  if (
    name === 'connected' ||
    [
      'risk-level-change',
      'control-change',
      'transit-update',
      'plate-queue-add',
      'plate-queue-done',
    ].includes(name) ||
    (name === 'data-changed' && ['underpass', 'threshold'].includes(data.resource))
  ) {
    clearTimeout(liveTimer)
    liveTimer = setTimeout(() => void load(), 200)
  }
})
onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(liveTimer)
  controller.abort()
})
</script>
<template>
  <section class="app-overview">
    <p v-if="error" role="alert">{{error}}</p>
    <Teleport to="body">
      <dialog ref="controlNotice" class="overview-control-notice" aria-labelledby="control-notice-title" aria-describedby="control-notice-description" @click="($event.target===controlNotice)&&controlNotice?.close()">
        <h2 id="control-notice-title">시설 통제 안내</h2>
        <p id="control-notice-description">현재 {{blocked}}곳이 통제 중입니다. 지도에서 현황을 확인해 주세요.</p>
        <form method="dialog" @submit="acknowledgeNotice"><label class="overview-notice-hide"><input v-model="hideToday" type="checkbox" />오늘 하루 보지 않기</label><button type="submit" autofocus>확인</button></form>
      </dialog>
    </Teleport>
    <LiveMap manager map-only />
  </section>
</template>
<style src="../styles/pages/admin-app-overview.css"></style>

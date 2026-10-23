<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBackendEvents } from '../composables/useBackendEvents'
import LiveMap from './c-live-map.vue'
import { backend } from '../services/backend'
const summary = ref<any>(),
  levels = ref<any[] | null>(null),
  error = ref(''),
  loading = ref(false),
  controller = new AbortController()
const count = (key: string) =>
  levels.value
    ? levels.value.reduce(
        (sum, row) =>
          sum +
          Number(
            key === 'warningCount'
              ? (row.warningCount ?? Number(row.watchCount || 0) + Number(row.cautionCount || 0))
              : key === 'dangerCount'
                ? (row.dangerCount ?? Number(row.alertCount || 0) + Number(row.severeCount || 0))
                : row[key] || 0,
          ),
        0,
      )
    : '—'
const blocked = computed(() => summary.value?.blockedCount ?? '—')
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
    backend('/api/dashboard/region-risk-level', { signal: controller.signal }),
  ])
  if (controller.signal.aborted) return
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (i === 0) summary.value = r.value
      else levels.value = Array.isArray(r.value) ? r.value : []
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
    <div v-if="summary?.blockedCount>0" class="ban">
      {{summary.blockedCount}}곳 통제 중 · 현황을 확인하세요.</div>
    <div class="kv">
      <div>
        <small>안전</small>
        <b>{{count('safeCount')}}</b>
      </div>
      <div>
        <small>주의</small>
        <b>{{count('warningCount')}}</b>
      </div>
      <div>
        <small>위험</small>
        <b>{{count('dangerCount')}}</b>
      </div>
      <div>
        <small>통제 중</small>
        <b>{{blocked}}</b>
      </div>
    </div>
    <LiveMap manager map-only />
  </section>
</template>
<style src="../styles/pages/admin-app-overview.css"></style>

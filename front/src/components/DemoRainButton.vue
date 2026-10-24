<script setup lang="ts">
// 시연용 호우 시나리오 버튼 (관리자 상단 바). Spring 이 puf.demo.enabled=true 일 때만 보인다.
// 누르면 초량지하차도가 속한 지역(동구) 전체에 약 2분 50초 동안 호우 → 위험도 상승 → 수위 급상승·자동 차단 → 회복 순서로 진행된다.
// 진행 중에 다시 누르면 중지한다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useApp } from '../stores/app'
import { backend, BackendError } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'

const CHORYANG_ID = 1   // 시드(2.seed_general_v9)의 초량지하차도 id. 이 지하차도의 지역으로 시작한다

type Status = {
  running: boolean
  phaseLabel: string | null
  elapsedSec: number
  totalSec: number
}

const app = useApp(),
  available = ref(false),
  status = ref<Status | null>(null),
  busy = ref(false),
  error = ref('')
const running = computed(() => !!status.value?.running)
let poll: ReturnType<typeof setInterval> | undefined

async function refresh() {
  if (app.account?.role !== 'REGIONAL_ADMIN') {
    available.value = false
    return
  }
  try {
    status.value = await backend<Status>('/api/demo/scenarios/current')
    available.value = true
  } catch (e) {
    // 404 = 데모 모드가 꺼져 있음 (운영). 그 밖의 오류도 버튼을 숨긴다
    if (e instanceof BackendError) available.value = false
  }
}

async function click() {
  error.value = ''
  if (running.value) {
    if (!confirm('진행 중인 호우 시나리오를 중지할까요?\n차단 해제는 직접 해야 합니다.')) return
  } else if (
    !confirm(
      '호우 시나리오를 시작할까요? (초량지하차도가 속한 지역 전체)\n' +
        '약 2분 50초 동안 위험도 상승 → 수위 급상승·자동 차단 → 회복 순서로 진행되고, 알림이 발송됩니다.\n' +
        '끝난 뒤 차단 해제는 직접 해야 합니다.',
    )
  )
    return
  busy.value = true
  try {
    if (running.value) {
      status.value = await backend<Status>('/api/demo/scenarios/stop', { method: 'POST' })
    } else {
      const choryang = await backend<{ regionId: number }>('/api/underpasses/' + CHORYANG_ID)
      status.value = await backend<Status>('/api/demo/scenarios/heavy-rain', {
        method: 'POST',
        body: { regionIds: [choryang.regionId], speed: 1.0 },
      })
    }
  } catch (e) {
    error.value = (e as Error).message
    alert(error.value)
  } finally {
    busy.value = false
  }
}

// 진행 중에는 2초마다 경과 시간을 갱신 (단계가 바뀌면 SSE 로도 온다)
watch(running, (on) => {
  clearInterval(poll)
  poll = on ? setInterval(() => void refresh(), 2000) : undefined
})
watch(() => [app.account?.id, app.account?.role], () => void refresh(), { immediate: true })
useBackendEvents(({ name, data }) => {
  if (name === 'connected' || (name === 'data-changed' && data.resource === 'demo-scenario')) void refresh()
})
onBeforeUnmount(() => clearInterval(poll))
</script>
<template>
  <button
    v-if="available"
    class="btn sm demo-rain-btn"
    :class="{ running }"
    type="button"
    :disabled="busy"
    :title="running ? '누르면 중지' : '호우 시나리오 시작 (시연용)'"
    @click="click"
  >
    <template v-if="running">
      호우 진행 · {{ status?.phaseLabel }} {{ status?.elapsedSec }}/{{ status?.totalSec }}초
    </template>
    <template v-else>호우 시연</template>
  </button>
</template>
<style scoped>
.demo-rain-btn.running {
  background: var(--warn, #d97706);
  border-color: var(--warn, #d97706);
  color: #fff;
}
</style>

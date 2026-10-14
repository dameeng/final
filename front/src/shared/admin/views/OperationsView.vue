<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminKey } from '../main'
import { adminApi, type Transit } from '../services/admin-api'

const props=defineProps<{lockedFacility?:string}>()
const route = useRoute()
const { state } = inject(adminKey)!
const selectedId = ref('')
const facility = computed(() => state.underpasses.find(item => item.id === selectedId.value))
const transits = ref<Transit[]>([])
const status = ref('')
const messageType = ref('RISK_WARNING')
const message = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
watch(() => route.params.id, id => { selectedId.value = props.lockedFacility || (typeof id === 'string' ? id : '') }, { immediate: true })
async function load() {
  if (!selectedId.value) { transits.value = []; return }
  try {
    const suffix = status.value ? `?status=${status.value}` : ''
    transits.value = await adminApi<Transit[]>(`/underpasses/${encodeURIComponent(selectedId.value)}/transits${suffix}`)
    message.value = ''
  } catch (e) { transits.value = []; message.value = (e as Error).message }
}
async function logDisplay() {
  if (!selectedId.value || busy.value) return
  if (!window.confirm('전광판 조작 기록을 저장하시겠습니까? 실제 장치는 제어되지 않습니다.')) return
  busy.value = true
  try {
    await adminApi(`/underpasses/${encodeURIComponent(selectedId.value)}/display-log`, {
      method: 'POST', body: JSON.stringify({ messageType: messageType.value }),
    })
    message.value = '전광판 조작 기록을 저장했습니다. 실제 장치에는 전송되지 않았습니다.'
  } catch (e) { message.value = (e as Error).message }
  finally { busy.value = false }
}
const labels: Record<string, string> = { REMAINING: '잔류', IN_TRANSIT: '통과 중', EXITED: '통과 완료' }
watch([selectedId, status], () => void load(), { immediate: true })
timer = setInterval(() => void load(), 30000)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
<div class="routel-admin-page">
  <main>
    <h1>차량 통과·전광판</h1>
    <p><label>지하차도 <select v-model="selectedId" :disabled="!!props.lockedFacility"><option value="">시설 선택</option><option v-for="item in state.underpasses" :key="item.id" :value="item.id">{{ item.name }}</option></select></label></p>
    <p role="status">{{ message }}</p>
    <template v-if="facility">
      <h2>통과·잔류 차량</h2>
      <p>통과 기록에는 카메라 ID가 포함되지 않습니다. <router-link to="/alert-evidence">번호판 판별 대기의 카메라 기록</router-link>은 별도로 확인할 수 있습니다.</p>
      <p><label>상태 <select v-model="status"><option value="">전체</option><option value="REMAINING">잔류</option><option value="IN_TRANSIT">통과 중</option><option value="EXITED">통과 완료</option></select></label> <button type="button" @click="load">새로고침</button></p>
      <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>차량번호</th><th>상태</th><th>진입 시각</th><th>진출 시각</th><th>인식 카메라</th></tr></thead><tbody>
        <tr v-for="row in transits" :key="row.id"><td>{{ row.carNum }}</td><td>{{ labels[row.status] || row.status }}</td><td>{{ row.entryAt || '-' }}</td><td>{{ row.exitAt || '-' }}</td><td>—</td></tr>
        <tr v-if="!transits.length"><td colspan="5">조회된 차량 기록이 없습니다.</td></tr>
      </tbody></table></div>
      <h2>전광판 조작 기록</h2>
      <p>백엔드에 조작 기록을 남깁니다. 실제 전광판 장치 제어는 연결되지 않았습니다.</p>
      <label>표출 유형 <select v-model="messageType"><option value="RISK_WARNING">위험 경고</option><option value="BLOCK_NOTICE">차단 안내</option><option value="RELEASE_NOTICE">해제 안내</option></select></label>
      <button type="button" :disabled="busy" @click="logDisplay">조작 기록 저장</button>
    </template>
  </main>
</div>
</template>
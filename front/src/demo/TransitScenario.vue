<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { adminApi, type Camera } from '../shared/admin/services/admin-api'

// ---- 시연 고정값 ----
const UNDERPASS_ID = 17
// 접근 알림 시연(AlertScenario)에서 쓰던 카메라. 입출구 지정 시 일반 CCTV로 되돌려 역할 충돌을 막는다.
const APPROACH_CAMERA_ID = 1

const TRANSIT_POLL_INTERVAL_MS = 2000
const TRANSIT_POLL_TIMEOUT_MS = 90000
// 입차→출차 매칭을 몇 대 반복해서 보여줄지
const TOTAL_ROUNDS = 5

type TransitStatus = 'REMAINING' | 'IN_TRANSIT' | 'EXITED'
type TransitItem = {
  id: number; underpassId: number; carNum: string; status: TransitStatus
  entryAt: string; exitAt: string | null
}
type UnderpassDetail = {
  id: number; name: string
  entryCameraId: number | null
  exitCameraId: number | null
}

type Phase = 'idle' | 'entry-running' | 'entry-done' | 'exit-running' | 'exit-done'

const statusLabels: Record<TransitStatus, string> = { REMAINING: '잔류', IN_TRANSIT: '통과 중', EXITED: '통과 완료' }

const cameras = ref<Camera[]>([])
const underpass = ref<UnderpassDetail | null>(null)
const loadingInfo = ref(false)
const infoError = ref('')

const entrySelection = ref<number | null>(null)
const exitSelection = ref<number | null>(null)
const assigning = ref(false)
const assignError = ref('')
const assigned = computed(() => !!underpass.value?.entryCameraId && !!underpass.value?.exitCameraId)

const phase = ref<Phase>('idle')
const stepBusy = ref(false)
const feedback = ref('')

const playing = ref(false)
const startedAt = ref(0)
const imgFailed = ref(false)

const transits = ref<TransitItem[]>([])
// 입차 단계에서 한 번에 모은 이번 회차 차량들(최대 TOTAL_ROUNDS대), 출차 단계에서 같은 목록을 추적한다
const batchTransits = ref<TransitItem[]>([])
const entryDoneCount = computed(() => batchTransits.value.length)
const exitDoneCount = computed(() => batchTransits.value.filter(t => t.status === 'EXITED').length)
// 출차 완료(EXITED) 되는 순간 해당 로그 행을 잠깐 반짝이게 하는 플래그
const flashMap = reactive<Record<number, boolean>>({})
function flashRow(id: number) {
  flashMap[id] = true
  setTimeout(() => { flashMap[id] = false }, 900)
}

let cancelToken = { cancelled: false }

const activeCamera = computed(() => {
  const id = (phase.value === 'exit-running' || phase.value === 'exit-done') ? exitSelection.value : entrySelection.value
  return cameras.value.find(c => c.id === id) ?? null
})
const isAiStream = computed(() => !!activeCamera.value?.streamUrl && activeCamera.value.streamUrl.startsWith('/ai/stream/'))
const streamSrc = computed(() => {
  const url = activeCamera.value?.streamUrl
  if (!url) return ''
  return url + (url.includes('?') ? '&' : '?') + 't=' + startedAt.value
})

const time = (v: string | null) => v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '—'

// ---- 조회 ----
async function loadInfo() {
  loadingInfo.value = true; infoError.value = ''
  try {
    const [cams, detail, transitRows] = await Promise.all([
      adminApi<Camera[]>(`/underpasses/${UNDERPASS_ID}/cameras`),
      adminApi<UnderpassDetail>(`/underpasses/${UNDERPASS_ID}`),
      adminApi<TransitItem[]>(`/underpasses/${UNDERPASS_ID}/transits`),
    ])
    cameras.value = cams
    underpass.value = detail
    transits.value = sortTransits(transitRows)
    if (entrySelection.value == null) entrySelection.value = detail.entryCameraId ?? cams[0]?.id ?? null
    if (exitSelection.value == null) {
      exitSelection.value = detail.exitCameraId ?? cams.find(c => c.id !== entrySelection.value)?.id ?? null
    }
  } catch (e) {
    infoError.value = e instanceof Error ? e.message : '지하차도/카메라/통과기록 정보를 불러오지 못했습니다.'
  } finally {
    loadingInfo.value = false
  }
}

function sortTransits(rows: TransitItem[]) {
  return [...rows].sort((a, b) => (Date.parse(b.entryAt) || 0) - (Date.parse(a.entryAt) || 0) || b.id - a.id)
}

async function fetchTransits(): Promise<TransitItem[]> {
  const rows = await adminApi<TransitItem[]>(`/underpasses/${UNDERPASS_ID}/transits`)
  return sortTransits(rows)
}

// ---- 입/출구 카메라 지정 ----
async function assignCameras() {
  if (assigning.value) return
  if (entrySelection.value == null || exitSelection.value == null) {
    assignError.value = '입구/출구 카메라를 모두 선택해 주세요.'
    return
  }
  if (entrySelection.value === exitSelection.value) {
    assignError.value = '입구와 출구는 서로 다른 카메라로 지정해 주세요.'
    return
  }
  assigning.value = true; assignError.value = ''; feedback.value = ''
  try {
    await adminApi(`/underpasses/${UNDERPASS_ID}/entry-camera`, { method: 'PUT', body: JSON.stringify({ cameraId: entrySelection.value }) })
    await adminApi(`/underpasses/${UNDERPASS_ID}/exit-camera`, { method: 'PUT', body: JSON.stringify({ cameraId: exitSelection.value }) })
    await revertApproachCameraToCctv()
    await loadInfo()
    feedback.value = '입구/출구 카메라를 지정했습니다.'
  } catch (e) {
    assignError.value = e instanceof Error ? e.message : '카메라 지정에 실패했습니다.'
  } finally {
    assigning.value = false
  }
}

// 접근 알림 시연에서 APPROACH_LPR(또는 ROI_LPR)로 바뀌어 있던 카메라를 일반 CCTV 역할로 되돌린다.
// (입출구 시연과 역할이 겹치지 않도록 하기 위함. 실패해도 입출구 지정 자체는 막지 않는다.)
async function revertApproachCameraToCctv() {
  try {
    const target = cameras.value.find(c => c.id === APPROACH_CAMERA_ID)
    if (!target || target.cameraRole === 'CCTV') return
    await adminApi(`/underpasses/${UNDERPASS_ID}/cameras/${APPROACH_CAMERA_ID}`, {
      method: 'PUT',
      body: JSON.stringify({
        cameraRole: 'CCTV',
        streamUrl: target.streamUrl,
        distanceM: target.distanceM,
        latitude: target.latitude,
        longitude: target.longitude,
      }),
    })
  } catch {
    // 역할 복원 실패는 입출구 지정을 막지 않고 무시한다
  }
}

// ---- AI 인식 서비스 제어 ----
async function setAiRunning(run: boolean) {
  const response = await fetch(`/ai/control/plate/${run ? 'start' : 'stop'}`, { method: 'POST', keepalive: !run })
  if (!response.ok) throw new Error('번호판 인식 서비스에 연결하지 못했습니다.')
  const result = await response.json()
  playing.value = result.running === true
  if (run) {
    if (!playing.value) throw new Error('인식 서비스가 시작되지 않았습니다. 다시 시도해 주세요.')
    startedAt.value = Date.now()
    imgFailed.value = false
  }
}

// ---- 입차: 영상 한 번 틀어서 TOTAL_ROUNDS대가 입차할 때까지 몰아서 인식 ----
async function runEntry() {
  if (stepBusy.value || !assigned.value) return
  stepBusy.value = true; feedback.value = ''; phase.value = 'entry-running'
  batchTransits.value = []
  const token = (cancelToken = { cancelled: false })
  try {
    const before = await fetchTransits()
    const beforeIds = new Set(before.map(t => t.id))
    await setAiRunning(true)

    const deadline = Date.now() + TRANSIT_POLL_TIMEOUT_MS
    const collected: TransitItem[] = []
    const collectedIds = new Set<number>()
    while (Date.now() < deadline && collected.length < TOTAL_ROUNDS) {
      if (token.cancelled) throw new Error('중단되었습니다.')
      const rows = await fetchTransits()
      transits.value = rows
      for (const row of rows) {
        if (collected.length >= TOTAL_ROUNDS) break
        if (!beforeIds.has(row.id) && !collectedIds.has(row.id)) {
          collected.push(row)
          collectedIds.add(row.id)
          batchTransits.value = [...collected]
        }
      }
      if (collected.length >= TOTAL_ROUNDS) break
      await new Promise(resolve => setTimeout(resolve, TRANSIT_POLL_INTERVAL_MS))
    }
    if (token.cancelled) return
    if (!collected.length) throw new Error('입차 기록이 생기지 않았습니다. 입구 카메라 지정과 번호판 인식 여부를 확인해 주세요.')
    await setAiRunning(false).catch(() => {})
    phase.value = 'entry-done'
    feedback.value = collected.length < TOTAL_ROUNDS
      ? `시간 안에 ${collected.length}대만 입차가 확인됐습니다. 이대로 출차 인식을 진행할 수 있습니다.`
      : ''
  } catch (e) {
    if (!token.cancelled) {
      feedback.value = e instanceof Error ? e.message : '입차 인식 중 오류가 발생했습니다.'
      phase.value = 'idle'
      await setAiRunning(false).catch(() => {})
    }
  } finally {
    if (!token.cancelled) stepBusy.value = false
  }
}

// ---- 출차: 영상 한 번 틀어서 입차 단계에서 모은 차량들이 전부 출차될 때까지 몰아서 인식 ----
async function runExit() {
  if (stepBusy.value || !batchTransits.value.length) return
  stepBusy.value = true; feedback.value = ''; phase.value = 'exit-running'
  const token = (cancelToken = { cancelled: false })
  const targetIds = new Set(batchTransits.value.map(t => t.id))
  try {
    await setAiRunning(true)

    const deadline = Date.now() + TRANSIT_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (token.cancelled) throw new Error('중단되었습니다.')
      const rows = await fetchTransits()
      transits.value = rows
      batchTransits.value = batchTransits.value.map(t => {
        const updated = rows.find(r => r.id === t.id) ?? t
        if (t.status !== 'EXITED' && updated.status === 'EXITED') flashRow(updated.id)
        return updated
      })
      const allExited = batchTransits.value.every(t => t.status === 'EXITED')
      if (allExited) break
      await new Promise(resolve => setTimeout(resolve, TRANSIT_POLL_INTERVAL_MS))
    }
    if (token.cancelled) return
    const stillPending = batchTransits.value.filter(t => t.status !== 'EXITED')
    await setAiRunning(false).catch(() => {})
    phase.value = 'exit-done'
    feedback.value = stillPending.length
      ? `${targetIds.size - stillPending.length}/${targetIds.size}대만 출차가 확인됐습니다. (나머지는 시간 초과)`
      : `총 ${batchTransits.value.length}대 입/출차 매칭 시연이 모두 끝났습니다.`
  } catch (e) {
    if (!token.cancelled) {
      feedback.value = e instanceof Error ? e.message : '출차 인식 중 오류가 발생했습니다.'
      phase.value = 'entry-done'
      await setAiRunning(false).catch(() => {})
    }
  } finally {
    if (!token.cancelled) stepBusy.value = false
  }
}

// ---- 초기화 (입출구 지정은 유지, 진행 회차는 1대부터 다시) ----
async function reset() {
  cancelToken.cancelled = true
  stepBusy.value = true; feedback.value = ''
  try {
    await setAiRunning(false).catch(() => {})
  } finally {
    phase.value = 'idle'
    batchTransits.value = []
    stepBusy.value = false
    await loadInfo()
  }
}

onMounted(loadInfo)
onBeforeUnmount(() => {
  cancelToken.cancelled = true
  if (playing.value) void fetch('/ai/control/plate/stop', { method: 'POST', keepalive: true }).catch(() => {})
})
</script>

<template>
  <div class="demo-page">
    <header class="demo-header">
      <h1>PUF 시연 — 입차 통과기록 → 출차 매칭</h1>
      <ol class="demo-steps">
        <li :class="{ active: !assigned, done: assigned }">① 입구/출구 카메라 지정</li>
        <li :class="{ active: phase === 'entry-running', done: ['entry-done','exit-running','exit-done'].includes(phase) }">② 입차 인식 · IN_TRANSIT</li>
        <li :class="{ active: phase === 'exit-running', done: phase === 'exit-done' }">③ 출차 인식 · EXITED</li>
        <li class="demo-steps-progress">입차 {{ entryDoneCount }}/{{ TOTAL_ROUNDS }}대 · 출차 {{ exitDoneCount }}/{{ TOTAL_ROUNDS }}대</li>
      </ol>
    </header>

    <p v-if="feedback" class="demo-feedback" role="status">{{ feedback }}</p>
    <p v-if="infoError || assignError" class="demo-feedback" role="alert">{{ infoError || assignError }}</p>

    <section class="demo-card">
      <div class="demo-card-heading"><h2>입구 · 출구 카메라 지정</h2></div>
      <div class="transit-assign-row">
        <label>입구 카메라
          <select v-model.number="entrySelection" :disabled="assigning || stepBusy">
            <option v-for="c in cameras" :key="c.id" :value="c.id">#{{ c.id }} · {{ c.cameraRole }}</option>
          </select>
        </label>
        <label>출구 카메라
          <select v-model.number="exitSelection" :disabled="assigning || stepBusy">
            <option v-for="c in cameras" :key="c.id" :value="c.id">#{{ c.id }} · {{ c.cameraRole }}</option>
          </select>
        </label>
        <button type="button" class="demo-btn demo-btn-primary" :disabled="assigning || stepBusy" @click="assignCameras">
          {{ assigning ? '지정 중…' : '지정' }}
        </button>
      </div>
      <p class="transit-assign-current">
        현재 지정: 입구 #{{ underpass?.entryCameraId ?? '—' }} · 출구 #{{ underpass?.exitCameraId ?? '—' }}
      </p>
    </section>

    <div class="demo-grid">
      <section class="demo-card demo-video-card">
        <div class="demo-card-heading">
          <h2>{{ phase === 'exit-running' || phase === 'exit-done' ? '출구' : '입구' }} 카메라 영상 {{ activeCamera ? '#' + activeCamera.id : '' }}</h2>
        </div>
        <div class="demo-screen">
          <template v-if="activeCamera && isAiStream">
            <img v-if="playing && !imgFailed" :key="startedAt" :src="streamSrc" alt="실시간 번호판 인식 영상" @error="imgFailed = true" />
            <p v-else class="demo-screen-caption">{{ imgFailed ? '영상 연결을 확인해 주세요.' : '대기 중' }}</p>
          </template>
          <template v-else-if="activeCamera && activeCamera.streamUrl">
            <video :src="activeCamera.streamUrl" controls autoplay muted playsinline preload="metadata" />
          </template>
          <p v-else class="demo-screen-caption">인식 시작을 누르면 영상이 나옵니다.</p>
        </div>
        <p class="demo-screen-status" role="status">{{ phase === 'entry-running' || phase === 'exit-running' ? '번호판 인식 중…' : '' }}</p>
      </section>

      <section class="demo-card demo-control-card">
        <div class="demo-card-heading"><h2>진행</h2></div>
        <div class="demo-actions">
          <button type="button" class="demo-btn demo-btn-primary"
                  :disabled="stepBusy || phase !== 'idle' || !assigned"
                  @click="runEntry">
            {{ phase === 'entry-running' ? `입차 인식 대기 중… (${entryDoneCount}/${TOTAL_ROUNDS}대)` : `입차 인식 시작 (${TOTAL_ROUNDS}대 몰아서)` }}
          </button>
          <button type="button" class="demo-btn demo-btn-primary"
                  :disabled="stepBusy || phase !== 'entry-done'"
                  @click="runExit">
            {{ phase === 'exit-running' ? `출차 인식 대기 중… (${exitDoneCount}/${batchTransits.length}대)` : '출차 인식 시작' }}
          </button>
          <button type="button" class="demo-btn demo-btn-ghost" :disabled="stepBusy && phase === 'idle'" @click="reset">초기화</button>
        </div>

        <ul class="transit-batch-log">
          <li v-for="t in batchTransits" :key="t.id" class="transit-batch-row" :class="{ 'is-flash': flashMap[t.id] }">
            <strong>{{ t.carNum }}</strong>
            <span class="transit-status" :class="'status-' + t.status">{{ statusLabels[t.status] }}</span>
          </li>
        </ul>
        <p v-if="!batchTransits.length" class="demo-screen-caption">입차 인식을 시작하면 이번 회차 차량이 여기 쌓입니다.</p>
      </section>
    </div>

    <section class="demo-card">
      <div class="demo-card-heading"><h2>통과 기록 (최신순)</h2></div>
      <ul class="transit-list">
        <li v-for="t in transits" :key="t.id" class="transit-row" :class="{ 'is-active': batchTransits.some(b => b.id === t.id) }">
          <strong>{{ t.carNum }}</strong>
          <span class="transit-status" :class="'status-' + t.status">{{ statusLabels[t.status] }}</span>
          <span class="transit-time">입차 {{ time(t.entryAt) }} · 출차 {{ t.exitAt ? time(t.exitAt) : '—' }}</span>
        </li>
      </ul>
      <p v-if="!transits.length" class="demo-screen-caption">통과 기록이 아직 없습니다.</p>
    </section>
  </div>
</template>

<style scoped src="./demo-theme.css"></style>
<style scoped>
.transit-assign-row { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.transit-assign-row label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
.transit-assign-row select {
  padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px; min-width: 160px;
}
.transit-assign-current { margin: 12px 0 0; font-size: 13px; color: var(--muted); }

.demo-steps-progress { background: transparent !important; color: var(--muted) !important; font-weight: 600; }

.transit-active-caption { margin: 0 0 14px; font-size: 14px; }

.transit-batch-log {
  list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px;
  max-height: 260px; overflow-y: auto;
}
.transit-batch-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: #f8fafc;
  font-size: 13px; transition: background-color .25s ease, box-shadow .25s ease;
}
.transit-batch-row.is-flash { animation: transit-flash .9s ease; }
@keyframes transit-flash {
  0% { background: #bbf7d0; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.35); }
  100% { background: #f8fafc; box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.transit-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.transit-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: #f8fafc;
  font-size: 13px; flex-wrap: wrap;
}
.transit-row.is-active { background: #dbeafe; }
.transit-status { padding: 2px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; background: #eef1f6; color: var(--muted); }
.transit-status.status-IN_TRANSIT { background: #dbeafe; color: var(--primary-dark); }
.transit-status.status-EXITED { background: #dcfce7; color: var(--safe); }
.transit-status.status-REMAINING { background: #fee2e2; color: var(--danger); }
.transit-time { color: var(--muted); margin-left: auto; }
</style>
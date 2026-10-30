<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { backend, queryString } from '../services/backend'
import { useRoute } from 'vue-router'
import TrafficVideo from './TrafficVideo.vue'
import FacilityOcrLog from './FacilityOcrLog.vue'
import { valueLabels } from '../data/backendResources'
import { DEMO_CAMERA_NAMES } from '../utils/camera-names'
import { useBackendEvents } from '../composables/useBackendEvents'
const props = defineProps<{ cameras: Record<string, any>[]; underpassId: string; facilityName?: string; compact?: boolean }>()
const route = useRoute(),
  selected = ref('')
// A route change must never keep playing a camera registered to the previous facility.
const availableCameras = computed(() => props.cameras.filter((camera) =>
  camera.underpassId == null || String(camera.underpassId) === props.underpassId,
))
const current = computed(() => availableCameras.value.find((camera) => String(camera.id) === selected.value))
const isRoadCamera = computed(() => String(current.value?.id) === '230')
const roadStatus = ref<Record<string, any>>()
const roadEquipmentId = ref<number>()
let statusTimer: ReturnType<typeof setInterval> | undefined
let statusBusy = false
async function refreshRoadStatus() {
  if (!isRoadCamera.value || statusBusy) return
  statusBusy = true
  const camera = selected.value, facility = props.underpassId
  try {
    const data = await backend<Record<string, any>>('/api/cctv/analysis/state?cameraId=' + encodeURIComponent(camera))
    if (selected.value !== camera || props.underpassId !== facility) return
    roadStatus.value = data.cameras?.find((item: Record<string, any>) => String(item.cameraId) === camera)
    if (!roadEquipmentId.value) {
      const equipment = await backend<{ items: { equipId: number }[] }>('/api/pm/equipments' + queryString({type:'ROAD',underpassId:facility,size:1}))
      if (selected.value === camera && props.underpassId === facility) roadEquipmentId.value = equipment.items?.[0]?.equipId
    }
  } catch { /* 실행 요청 실패는 버튼에서 안내한다. 상태 조회 실패가 기존 OCR 화면에 영향을 주지 않는다. */ }
  finally { statusBusy = false }
}
watch(() => [selected.value, props.underpassId], () => {
  clearInterval(statusTimer)
  roadStatus.value = undefined
  roadEquipmentId.value = undefined
  if (isRoadCamera.value) {
    void refreshRoadStatus()
    statusTimer = setInterval(() => void refreshRoadStatus(), 2000)
  }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(statusTimer))
const roadStateLabel = computed(() => ({STARTING:'시작 중',RUNNING:'영상 분석 중',STOPPING:'정지 중',STOPPED:'정지',COMPLETED:'분석 완료',ERROR:'분석 오류'}[String(roadStatus.value?.state)] || '실행 대기'))
const starting = ref(false)
const stopping = ref(false)
const recognitionMessage = ref('')
const recognitionError = ref(false)
// 분석 서버 상태는 SSE(analysis-state-change)로 받는다.
// 상태가 그대로면 새 이벤트가 오지 않으므로, 이미 실행 중인 서버에 접속한 경우를 위해 처음 한 번은 기존 상태 API로 조회한다.
type AnalysisState = { state: string; running: boolean; error: string | null }
const ANALYSIS_STATES = ['STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'COMPLETED', 'ERROR']
const analysisState = ref<AnalysisState>()
let stateShownAsError = false
let stateRequest = 0
const startingNow = computed(() => starting.value || analysisState.value?.state === 'STARTING')
const stoppingNow = computed(() => stopping.value || analysisState.value?.state === 'STOPPING')
function normalizeState(item: Record<string, any>): AnalysisState {
  const error = typeof item.error === 'string' && item.error.trim() ? item.error : null
  const running = Boolean(item.running)
  const state = error ? 'ERROR' : ANALYSIS_STATES.includes(String(item.state)) ? String(item.state) : running ? 'RUNNING' : 'COMPLETED'
  return { state, running, error }
}
function applyAnalysisState(next: AnalysisState) {
  analysisState.value = next
  if (isRoadCamera.value) roadStatus.value = { ...(roadStatus.value || {}), ...next }
  if (next.state === 'ERROR') {
    stateShownAsError = true
    recognitionError.value = true
    recognitionMessage.value = next.error || 'AI 분석 서버 상태를 확인하지 못했습니다.'
  } else if (stateShownAsError) {
    stateShownAsError = false
    recognitionError.value = false
    recognitionMessage.value = ''
  }
}
async function loadAnalysisState() {
  const camera = selected.value, facility = props.underpassId, version = ++stateRequest
  if (!camera) return
  try {
    const data = await backend<Record<string, any>>('/api/cctv/analysis/state?cameraId=' + encodeURIComponent(camera))
    if (version !== stateRequest || selected.value !== camera || props.underpassId !== facility) return
    const item = data?.cameras?.find((row: Record<string, any>) => String(row.cameraId) === camera)
    if (item) applyAnalysisState(normalizeState(item))
  } catch { /* 상태를 받지 못해도 실행·정지 버튼에서 오류를 안내한다 */ }
}
watch(() => [selected.value, props.underpassId], () => {
  stateRequest++
  analysisState.value = undefined
  stateShownAsError = false
  void loadAnalysisState()
}, { immediate: true })
useBackendEvents(({ name, data }) => {
  if (name === 'analysis-state-change') {
    if (String(data.cameraId) !== selected.value || String(data.underpassId) !== props.underpassId) return
    applyAnalysisState(normalizeState(data))
  } else if (name === 'connected') void loadAnalysisState()
})
// AI 서버(FastAPI) 실시간 영상 주소인지 (/stream/226 처럼 끝나면 그림책(MJPEG) 방식 -> <img> 로 보여줌)
// 영상과 실행·정지는 로그인 쿠키를 사용하는 Spring 중계 API로 요청합니다.
const isAiStream = computed(() => /\/stream\/\d+$/.test(current.value?.streamUrl || ''))
// 시작/정지할 때마다 숫자를 올려서 <img> 가 영상을 새로 받아오게 함
const streamVersion = ref(0)
const streamFailed = ref(false)
const aiStreamSrc = computed(() => `/api/cctv/${current.value?.id}/stream?v=${streamVersion.value}`)
watch(() => [props.underpassId, selected.value], () => {
  recognitionMessage.value = ''
  streamFailed.value = false
})
// action: 'start' = 번호판 인식 실행, 'stop' = 정지
async function controlRecognition(action: 'start' | 'stop') {
  if (!current.value || starting.value || stopping.value) return
  const busy = action === 'start' ? starting : stopping
  const cameraId = selected.value
  const facilityId = props.underpassId
  busy.value = true
  recognitionMessage.value = ''
  recognitionError.value = false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`/api/cctv/analysis/${action}?cameraId=${encodeURIComponent(cameraId)}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.success === false)
      throw new Error(typeof data?.detail === 'string' ? data.detail : data?.message
        || (action === 'start' ? '영상 분석을 시작하지 못했습니다.' : '영상 분석을 정지하지 못했습니다.') + ' AI 서버 연결과 카메라 설정을 확인해 주세요.')
    streamFailed.value = false
    streamVersion.value++
    if (cameraId === '230') void refreshRoadStatus()
    if (selected.value === cameraId && props.underpassId === facilityId)
      recognitionMessage.value = action === 'start'
        ? (cameraId === '230' ? '초량 CCTV230 싱크홀 분석을 시작했습니다. 탐지 사진은 장비 현황의 노면에서 확인하세요.' : '번호판 인식 시작 요청이 완료되었습니다. OCR 인식 기록에서 결과를 확인하세요.')
        : (cameraId === '230' ? '싱크홀 영상 분석 정지를 요청했습니다.' : '번호판 인식을 정지했습니다.')
  } catch (error) {
    if (selected.value === cameraId && props.underpassId === facilityId) {
      recognitionError.value = true
      recognitionMessage.value = controller.signal.aborted
        ? '응답 시간이 초과되었습니다. 인식 기록을 확인한 뒤 다시 시도해 주세요.'
        : error instanceof Error ? error.message : 'AI 서버에 연결하지 못했습니다.'
    }
  } finally {
    clearTimeout(timeout)
    busy.value = false
  }
}
watch(
  () => [props.underpassId, availableCameras.value] as const,
  () => {
    if (!availableCameras.value.some((camera) => String(camera.id) === selected.value))
      selected.value = String(availableCameras.value[0]?.id ?? '')
  },
  { immediate: true },
)
function label(camera: Record<string, any>) {
  return `${camera.name || DEMO_CAMERA_NAMES[String(camera.id)] || valueLabels[camera.cameraRole] || camera.cameraRole || 'CCTV'} · ${camera.id}`
}
const app = computed(() => route.path.startsWith('/admin-app/'))
const viewerState = computed(() => {
  if (startingNow.value) return '분석 시작 중'
  if (stoppingNow.value) return '정지 중'
  const state = analysisState.value?.state
  if (state) return ({ STARTING:'분석 시작 중', RUNNING:'영상 분석 중', STOPPING:'정지 중', STOPPED:'정지', COMPLETED:'분석 완료', ERROR:'분석 오류' } as Record<string,string>)[state] || '상태 확인 중'
  return !current.value?.streamUrl ? '영상 주소 미등록' : streamFailed.value ? '영상 대기' : '상태 확인 중'
})
</script>
<template>
  <div class="facility-cctv-layout" :class="{'compact-cctv':compact,'app-cctv-records':app}">
  <section class="facility-cctv-viewer" aria-label="시설 CCTV">
    <template v-if="current">
      <!-- 브라우저 기본 선택 목록은 실시간 영상과 함께 펼치면 글자가 안 그려지는 경우가 있어 버튼으로 고른다 -->
      <div class="facility-viewer-toolbar">
      <div class="facility-camera-select">
        <span id="facility-camera-select-label">CCTV 선택</span>
        <div class="facility-camera-buttons" role="group" aria-labelledby="facility-camera-select-label">
          <button v-for="camera in availableCameras" :key="camera.id" type="button" :data-camera-id="camera.id"
            :aria-pressed="String(camera.id) === selected" @click="selected = String(camera.id)">
            {{label(camera)}}
          </button>
        </div>
      </div>
      <div v-if="app" class="facility-recognition-controls">
        <div class="recognition-buttons">
          <button type="button" class="recognition-start" :disabled="startingNow || stoppingNow" @click="controlRecognition('start')">
            {{ startingNow ? '분석 시작 중…' : '영상 분석 실행' }}
          </button>
          <button type="button" class="recognition-start recognition-stop" :disabled="startingNow || stoppingNow" @click="controlRecognition('stop')">
            {{ stoppingNow ? '정지 중…' : '정지' }}
          </button>
        </div>
      </div>
      </div>
      <p v-if="recognitionMessage" class="facility-recognition-feedback" role="status" :class="{ 'recognition-error': recognitionError }">{{ recognitionMessage }}</p>
      <div class="facility-camera-row">
      <div v-if="!app" class="facility-video-panel">
      <header class="facility-video-heading">
        <h2>{{label(current)}}</h2>
        <div class="recognition-buttons" aria-label="영상 분석 제어">
          <button type="button" class="recognition-start" :disabled="startingNow || stoppingNow" @click="controlRecognition('start')">
            {{ startingNow ? '분석 시작 중…' : '영상 분석 실행' }}
          </button>
          <button type="button" class="recognition-start recognition-stop" :disabled="startingNow || stoppingNow" @click="controlRecognition('stop')">
            {{ stoppingNow ? '정지 중…' : '정지' }}
          </button>
        </div>
        <span class="facility-analysis-state" :class="{'is-running':analysisState?.state==='RUNNING','is-error':analysisState?.state==='ERROR'}">{{viewerState}}</span>
      </header>
      <div class="facility-camera-stage" :class="{'is-empty':(isAiStream&&streamFailed)||!current.streamUrl}">
        <template v-if="isAiStream">
          <img
            v-if="!streamFailed"
            :key="aiStreamSrc"
            :src="aiStreamSrc"
            :alt="label(current) + ' 실시간 영상'"
            @error="streamFailed = true"
          />
          <div v-else class="facility-video-empty"><UiIcon name="camera" /><strong>표시할 영상이 없습니다</strong><p>‘영상 분석 실행’을 눌러 영상을 불러오세요.</p></div>
        </template>
        <TrafficVideo
          v-else-if="current.streamUrl"
          :key="underpassId+':'+current.id+':'+current.streamUrl"
          :src="current.streamUrl"
          hls
        />
        <div v-else class="facility-video-empty"><UiIcon name="camera" /><strong>영상 주소가 등록되지 않았습니다</strong><p>설비 탭에서 카메라의 영상 주소를 확인해 주세요.</p></div>
      </div>
      <dl v-if="!compact" class="facility-camera-facts"><div><dt>카메라 번호</dt><dd>{{current.id}}</dd></div><div><dt>카메라 역할</dt><dd>{{isRoadCamera?'노면·싱크홀 분석':valueLabels[current.cameraRole]||current.cameraRole||'미지정'}}</dd></div><div><dt>설치 거리</dt><dd>{{current.distanceM == null?'미등록':current.distanceM+' m'}}</dd></div></dl>
      </div>
      <div v-if="!compact && isRoadCamera" class="facility-ocr-column facility-road-analysis">
        <h3>노면 · 싱크홀 분석</h3>
        <p role="status">{{roadStateLabel}}<template v-if="roadStatus?.frameSeconds != null"> · 영상 {{Number(roadStatus.frameSeconds).toFixed(1)}}초</template></p>
        <p v-if="roadStatus?.error" role="alert">{{roadStatus.error}}</p>
        <p v-if="roadStatus?.springDelivery==='SENT'">Spring 저장 완료 · 장비 현황에서 분석 결과를 확인하세요.</p>
        <p v-else-if="roadStatus?.springDelivery==='PENDING'">분석 결과를 저장했으며 Spring 전송을 시도 중입니다.</p>
        <p v-else>등록된 시연 영상을 한 번 재생하며 분석합니다. 226~229번 OCR과 독립적으로 실행됩니다.</p>
        <RouterLink :to="roadEquipmentId?{path:'/pm-equipment-detail',query:{id:String(roadEquipmentId)}}:{path:'/pm-equipment',query:{type:'ROAD'}}">장비 현황 · 노면 결과 보기 →</RouterLink>
      </div>
      <div v-else-if="!compact" class="facility-ocr-column"><FacilityOcrLog :key="underpassId" :underpass-id="underpassId" :app="app" /></div>
      </div>
      <nav v-if="!isRoadCamera" class="facility-camera-links" aria-label="CCTV 관련 기록">
        <RouterLink
          v-if="current.cameraRole!=='CCTV'"
          :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId}}"
        >이 시설의 OCR 인식 기록 보기 →</RouterLink>
        <RouterLink
          :to="{path:app?'/admin-app/transits':'/admin-data/transits',query:{underpassId}}"
        >차량 통과 기록 보기 →</RouterLink>
      </nav>
    </template>
    <template v-else><p>등록된 CCTV가 없습니다.</p><FacilityOcrLog v-if="!compact" :key="underpassId" :underpass-id="underpassId" :app="app" /></template>
  </section>
  </div>
</template>
<style scoped src="../styles/components/facility-cctv-viewer.css"></style>

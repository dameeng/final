<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TrafficVideo from './TrafficVideo.vue'
import TunnelReferenceVideo from './TunnelReferenceVideo.vue'
import FacilityOcrLog from './FacilityOcrLog.vue'
import { valueLabels } from '../data/backendResources'
const props = defineProps<{ cameras: Record<string, any>[]; underpassId: string; facilityName?: string }>()
const route = useRoute(),
  selected = ref('')
const current = computed(() => props.cameras.find((camera) => String(camera.id) === selected.value))
const starting = ref(false)
const stopping = ref(false)
const recognitionMessage = ref('')
const recognitionError = ref(false)
// AI 서버(FastAPI) 실시간 영상 주소인지 (/stream/226 처럼 끝나면 그림책(MJPEG) 방식 -> <img> 로 보여줌)
const isAiStream = computed(() => /\/stream\/\d+$/.test(current.value?.streamUrl || ''))
// 시작/정지할 때마다 숫자를 올려서 <img> 가 영상을 새로 받아오게 함
const streamVersion = ref(0)
const streamFailed = ref(false)
const aiStreamSrc = computed(() => `${current.value?.streamUrl}?v=${streamVersion.value}`)
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
    const response = await fetch(`/control/plate/${action}?cameraId=${encodeURIComponent(cameraId)}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.success === false)
      throw new Error(typeof data?.detail === 'string' ? data.detail : data?.message
        || (action === 'start' ? '번호판 인식을 시작하지 못했습니다.' : '번호판 인식을 정지하지 못했습니다.') + ' AI 서버 연결과 카메라 설정을 확인해 주세요.')
    streamFailed.value = false
    streamVersion.value++
    if (selected.value === cameraId && props.underpassId === facilityId)
      recognitionMessage.value = action === 'start'
        ? '번호판 인식 시작 요청이 완료되었습니다. OCR 인식 기록에서 결과를 확인하세요.'
        : '번호판 인식을 정지했습니다.'
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
  () => [props.underpassId, props.cameras] as const,
  () => {
    if (!props.cameras.some((camera) => String(camera.id) === selected.value))
      selected.value = String(props.cameras[0]?.id ?? '')
  },
  { immediate: true },
)
// 초량지하차도 시연용 번호판 카메라 이름 (DB camera 테이블에 이름 칸이 없어서 번호로 정함. seed_all_v8.sql 9-1 참고)
const demoCameraNames: Record<string, string> = { '226': 'APPROACH', '227': 'ROI', '228': '입구', '229': '출구' }
function label(camera: Record<string, any>) {
  return `${camera.name || demoCameraNames[String(camera.id)] || valueLabels[camera.cameraRole] || camera.cameraRole || 'CCTV'} · ${camera.id}`
}
const app = computed(() => route.path.startsWith('/admin-app/'))
</script>
<template>
  <div class="facility-cctv-layout">
  <section class="facility-cctv-viewer" aria-label="시설 CCTV">
    <TunnelReferenceVideo v-if="facilityName?.includes('초량')" />
    <template v-if="current">
      <label class="facility-camera-select">CCTV 선택<select v-model="selected">
          <option v-for="camera in cameras" :key="camera.id" :value="String(camera.id)">
            {{label(camera)}}
          </option>
        </select>
      </label>
      <h2>{{label(current)}}</h2>
      <div class="facility-recognition-controls">
        <div class="recognition-buttons">
          <button type="button" class="recognition-start" :disabled="starting || stopping" @click="controlRecognition('start')">
            {{ starting ? '인식 시작 중…' : '번호판 인식 실행' }}
          </button>
          <button type="button" class="recognition-start recognition-stop" :disabled="starting || stopping" @click="controlRecognition('stop')">
            {{ stopping ? '정지 중…' : '정지' }}
          </button>
        </div>
        <p v-if="recognitionMessage" role="status" :class="{ 'recognition-error': recognitionError }">{{ recognitionMessage }}</p>
      </div>
      <div class="facility-camera-row">
      <div class="facility-camera-stage">
        <template v-if="isAiStream">
          <img
            v-if="!streamFailed"
            :key="aiStreamSrc"
            :src="aiStreamSrc"
            :alt="label(current) + ' 실시간 영상'"
            @error="streamFailed = true"
          />
          <p v-else>영상이 꺼져 있습니다. '번호판 인식 실행'을 누르면 영상이 나옵니다.</p>
        </template>
        <TrafficVideo
          v-else-if="current.streamUrl"
          :key="underpassId+':'+current.id+':'+current.streamUrl"
          :src="current.streamUrl"
          hls
        />
        <p v-else>영상 주소가 등록되지 않았습니다.</p>
      </div>
      <div class="facility-ocr-column"><FacilityOcrLog :key="underpassId" :underpass-id="underpassId" :app="app" /></div>
      </div>
      <nav class="facility-camera-links" aria-label="CCTV 관련 기록">
        <RouterLink
          v-if="current.cameraRole!=='CCTV'"
          :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId}}"
        >이 시설의 OCR 인식 기록 보기 →</RouterLink>
        <RouterLink
          :to="{path:app?'/admin-app/transits':'/admin-data/transits',query:{underpassId}}"
        >차량 통과 기록 보기 →</RouterLink>
      </nav>
    </template>
    <template v-else><p>등록된 CCTV가 없습니다.</p><FacilityOcrLog :key="underpassId" :underpass-id="underpassId" :app="app" /></template>
  </section>
  </div>
</template>
<style scoped src="../styles/components/facility-cctv-viewer.css"></style>

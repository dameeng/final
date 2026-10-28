<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TrafficVideo from './TrafficVideo.vue'
import { getTunnelCameras, getTunnelCameraStream, seoulTunnelSource } from '../services/seoulTunnelCctv'

const props = defineProps<{ facilityName?: string; underpassId?: string | number }>()
const facilityTitle = computed(() => `${props.facilityName || '초량지하차도'} 내부`)
type FacilityCamera = {id:string;name:string;direction?:string;streamUrl?:string;underpassId?:string|number}
const route = useRoute()
const appMode = computed(() => /^\/(admin|customer)-app\//.test(route.path))
const trigger = ref<HTMLButtonElement>(), appBounds = ref<{left:string;width:string}>()
let shellObserver: ResizeObserver | undefined
function fitAppDialog() {
  if (!appMode.value) { appBounds.value = undefined; return }
  const shell = trigger.value?.closest<HTMLElement>('.manager-app-shell,.service-app-layout,.mobile-page')
  const rect = shell?.getBoundingClientRect()
  const left = Math.max(0, rect?.left ?? 0) + 12
  const right = Math.min(innerWidth, rect?.right ?? innerWidth) - 12
  appBounds.value = { left: `${left}px`, width: `${Math.max(0, right-left)}px` }
}
const dialog = ref<HTMLDialogElement>(), opened = ref(false), loading = ref(false), videoLoading = ref(false)
const cameras = ref<FacilityCamera[]>([]), selected = ref(''), stream = ref<FacilityCamera>(), error = ref('')
const names = ref<Record<string, string>>({}), playbackVersion = ref(0)
const streamFailed = ref(false)
const aiStream = computed(()=>/\/stream\/\d+$/.test(stream.value?.streamUrl || ''))
let listRequest: AbortController | undefined, videoRequest: AbortController | undefined

async function loadList() {
  listRequest?.abort()
  const request = new AbortController()
  listRequest = request
  const timeout = setTimeout(() => request.abort(), 15000)
  loading.value = true
  error.value = ''
  try {
    const rows = (await getTunnelCameras(request.signal)).map(row=>({...row,name:`CCTV ${row.id}`}))
    if (listRequest !== request || !opened.value) return
    cameras.value = rows
    names.value = Object.fromEntries(rows.map(row=>[row.id,row.name]))
    const initial = rows[0]?.id || ''
    if (selected.value===initial) loadStream()
    else selected.value = initial
  } catch (cause) {
    if (listRequest !== request || !opened.value) return
    error.value = request.signal.aborted ? 'CCTV 목록 응답이 지연되고 있습니다. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : 'CCTV 목록을 불러오지 못했습니다.'
  } finally {
    clearTimeout(timeout)
    if (listRequest === request) loading.value = false
  }
}
async function loadStream() {
  videoRequest?.abort()
  stream.value = undefined
  if (!selected.value || !opened.value) return
  const request = new AbortController()
  videoRequest = request
  const cameraId = selected.value
  const timeout = setTimeout(()=>request.abort(),15000)
  videoLoading.value = true
  streamFailed.value = false
  error.value = ''
  try {
    const result = await getTunnelCameraStream(cameraId, request.signal)
    if (videoRequest!==request || !opened.value || selected.value!==cameraId) return
    stream.value = result
    names.value[cameraId] = result.name
    playbackVersion.value++
  } catch(cause) {
    if(videoRequest!==request || !opened.value) return
    error.value = request.signal.aborted ? '영상 연결이 지연되고 있습니다. 다시 연결해 주세요.' : cause instanceof Error ? cause.message : '영상을 연결하지 못했습니다.'
  } finally {
    clearTimeout(timeout)
    if(videoRequest===request) videoLoading.value=false
  }
}

watch(selected, loadStream)
async function open() {
  if (opened.value) return
  opened.value = true
  fitAppDialog()
  window.addEventListener('resize', fitAppDialog)
  const shell = trigger.value?.closest<HTMLElement>('.manager-app-shell,.service-app-layout,.mobile-page')
  if (appMode.value && shell) {
    shellObserver = new ResizeObserver(fitAppDialog)
    shellObserver.observe(shell)
  }
  await nextTick()
  dialog.value?.showModal()
  void loadList()
}
function release() {
  window.removeEventListener('resize', fitAppDialog)
  shellObserver?.disconnect()
  shellObserver = undefined
  opened.value = false
  listRequest?.abort()
  videoRequest?.abort()
  listRequest = videoRequest = undefined
  stream.value = undefined
  cameras.value = []
  selected.value = ''
  loading.value = videoLoading.value = false
  error.value = ''
}
function close() { dialog.value?.close(); release() }
watch(()=>props.underpassId,()=>{ if(opened.value) close() })
onBeforeUnmount(release)
</script>
<template>
  <button ref="trigger" class="btn tunnel-cctv-trigger" :class="{'tunnel-cctv-trigger--app':appMode}" type="button" @click="open">내부 CCTV 보기</button>
  <Teleport to="body">
    <WorkflowPage ref="dialog" class="tunnel-cctv-modal" :class="{'tunnel-cctv-modal--app':appMode}" :style="appBounds" :aria-label="facilityTitle+' CCTV'" @close="release" @cancel="release">
      <header>
        <div><p class="tunnel-cctv-eyebrow">내부 CCTV</p><h2>{{facilityTitle}} CCTV</h2></div>
        <button class="tunnel-cctv-close" type="button" aria-label="내부 CCTV 창 닫기" @click="close">닫기</button>
      </header>
      <p class="tunnel-cctv-source-note">신월여의지하도로의 공개 내부 CCTV 영상입니다. 선택한 {{props.facilityName||'시설'}}의 실제 영상이 아닌 내부 영상 참고용입니다. <a :href="seoulTunnelSource" target="_blank" rel="noopener noreferrer">공식 제공처 ↗</a></p>
      <div v-if="opened" class="tunnel-cctv-content">
        <p v-if="loading" role="status">CCTV 목록을 불러오는 중입니다.</p>
        <label v-if="cameras.length" class="tunnel-cctv-select">CCTV 선택 <small>{{cameras.length}}대</small>
          <select v-model="selected" :aria-label="facilityTitle+' CCTV 선택'">
            <option v-for="(camera,index) in cameras" :key="camera.id" :value="camera.id">{{names[camera.id] || `${String(index+1).padStart(2,'0')} · 카메라 ${camera.id}`}}</option>
          </select>
        </label>
        <p v-if="videoLoading" role="status">선택한 CCTV 영상을 연결하는 중입니다.</p>
        <p v-if="error" class="tunnel-cctv-error" role="alert">{{error}}</p>
        <section v-if="stream" class="tunnel-cctv-player" :aria-label="names[stream.id]">
          <h3>{{stream.name}}<span v-if="stream.direction">{{stream.direction}}</span></h3>
          <img v-if="aiStream&&!streamFailed" :key="stream.id+':'+playbackVersion" :src="'/api/cctv/'+encodeURIComponent(stream.id)+'/stream?v='+playbackVersion" :alt="facilityTitle+' '+stream.name+' 영상'" style="display:block;width:100%;max-height:60dvh;object-fit:contain;background:#080e14" @error="streamFailed=true" />
          <p v-else-if="aiStream">영상을 불러오지 못했습니다. 시설 CCTV 화면에서 영상 분석 실행 상태를 확인해 주세요.</p>
          <TrafficVideo v-else-if="stream.streamUrl" :key="stream.id+':'+playbackVersion" :src="stream.streamUrl" hls />
          <p v-else>이 카메라에 등록된 영상 주소가 없습니다.</p>
        </section>
        <p v-if="!loading&&!cameras.length&&!error" role="status">{{facilityTitle}}에 등록된 CCTV가 없습니다.</p>
      </div>
      <footer>
        <p>제공처 사정에 따라 영상이 지연되거나 일시 중단될 수 있습니다.</p>
        <div><button type="button" :disabled="loading||videoLoading" @click="loadList">다시 연결</button></div>
      </footer>
    </WorkflowPage>
  </Teleport>
</template>
<style scoped src="../styles/components/tunnel-cctv-dialog.css"></style>

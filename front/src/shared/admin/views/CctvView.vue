<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminKey } from '../main'
import { adminApi, facilityDetailApi, type Camera, type FacilityDetail } from '../services/admin-api'
import '../styles/cctv.css'
import CctvLogPanel from '../components/CctvLogPanel.vue'
import CameraMonitor from '../components/CameraMonitor.vue'
const logsOpen=ref(true)
const failedStreams=ref<Record<number,boolean>>({})

const props=defineProps<{lockedFacility?:string; settingsOnly?:boolean}>()
const route = useRoute()
const { state } = inject(adminKey)!
const selectedId = ref('')
const registered = ref<Camera[]>([])
const detail = ref<FacilityDetail | null>(null)
const message = ref('')
const role = ref<Camera['cameraRole']>('CCTV')
const distance = ref('')
const latitude = ref('')
const longitude = ref('')
const streamUrl = ref('')
const editingCameraId = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined


watch(
  () => route.params.id,
  (id) => {
    selectedId.value = props.lockedFacility || (typeof id === 'string' ? id : state.selectedId || '')
  },
  { immediate: true },
)
const facility = computed(() => state.underpasses.find((item) => item.id === selectedId.value))
let loadVersion=0,disposed=false,loadBusy=false
async function load(force=false) {
  if(loadBusy&&!force)return
  const id=selectedId.value,version=++loadVersion
  if(!id){registered.value=[];detail.value=null;return}
  loadBusy=true
  try {
    const [list,info]=await Promise.all([adminApi<Camera[]>(`/underpasses/${encodeURIComponent(id)}/cameras`),facilityDetailApi(id)])
    if(disposed||version!==loadVersion)return
    registered.value=list;detail.value=info;message.value=''
  }catch(e){if(!disposed&&version===loadVersion)message.value=(e as Error).message}
  finally{if(version===loadVersion)loadBusy=false}
}
async function addCamera() {
  try {
    await adminApi(`/underpasses/${encodeURIComponent(selectedId.value)}/cameras${editingCameraId.value ? `/${editingCameraId.value}` : ''}`, {
      method: editingCameraId.value ? 'PUT' : 'POST', body: JSON.stringify({ cameraRole: role.value, streamUrl: streamUrl.value || null,
        distanceM: distance.value === '' ? null : Number(distance.value),
        latitude: latitude.value === '' ? null : Number(latitude.value),
        longitude: longitude.value === '' ? null : Number(longitude.value) }),
    })
    const savedMessage = editingCameraId.value ? '카메라 정보를 수정했습니다.' : '카메라를 등록했습니다.'
    editingCameraId.value = null
    distance.value = latitude.value = longitude.value = streamUrl.value = ''
    await load()
    message.value = savedMessage
  } catch (e) { message.value = (e as Error).message }
}
// 수정 폼을 열 때 목록 값 대신 단건 조회(GET /cameras/{id})로 최신 값을 불러온다.
async function editCamera(row: Camera) {
  try {
    const camera = await adminApi<Camera>(`/underpasses/${encodeURIComponent(selectedId.value)}/cameras/${row.id}`)
    editingCameraId.value = camera.id
    role.value = camera.cameraRole
    streamUrl.value = camera.streamUrl ?? ''
    distance.value = camera.distanceM == null ? '' : String(camera.distanceM)
    latitude.value = camera.latitude == null ? '' : String(camera.latitude)
    longitude.value = camera.longitude == null ? '' : String(camera.longitude)
  } catch (e) { message.value = (e as Error).message }
}
async function removeCamera(camera: Camera) {
  if (!window.confirm(`카메라 ${camera.id}을(를) 삭제하시겠습니까?`)) return
  try {
    await adminApi(`/underpasses/${encodeURIComponent(selectedId.value)}/cameras/${camera.id}`, { method: 'DELETE' })
    if (editingCameraId.value === camera.id) cancelEdit()
    await load()
    message.value = '카메라를 삭제했습니다.'
  } catch (e) { message.value = (e as Error).message }
}
function cancelEdit() {
  editingCameraId.value = null
  role.value = 'CCTV'
  distance.value = latitude.value = longitude.value = streamUrl.value = ''
}
async function assign(kind: 'entry' | 'exit', id: number) {
  try {
    await adminApi(`/underpasses/${encodeURIComponent(selectedId.value)}/${kind}-camera`, { method: 'PUT', body: JSON.stringify({ cameraId: id }) })
    await load()
    message.value = `${kind === 'entry' ? '입구' : '출구'} 카메라를 지정했습니다.`
  } catch (e) { message.value = (e as Error).message }
}
watch(selectedId, () => { cancelEdit(); registered.value=[];detail.value=null;failedStreams.value={};void load(true) }, { immediate: true })
timer = setInterval(() => void load(), 30000)
onBeforeUnmount(() => { disposed=true;loadVersion++;if (timer) clearInterval(timer) })
const roleLabel: Record<Camera['cameraRole'], string> = { CCTV: '일반 CCTV', APPROACH_LPR: '접근 번호판 인식', ROI_LPR: '진입 직전 번호판 인식' }
</script>

<template>
<div class="routel-admin-page">
  <main class="cctv-page">
    <h1>CCTV</h1>
    <label for="cctv-facility">지하차도</label>
    <select id="cctv-facility" v-model="selectedId" :disabled="!!props.lockedFacility">
      <option value="">시설 선택</option>
      <option v-for="item in state.underpasses" :key="item.id" :value="item.id">
        {{ item.name }}
      </option>
    </select>
    <p v-if="facility">{{ facility.region }} · {{ facility.status }}</p>
    <p v-else-if="selectedId">시설을 찾을 수 없습니다.</p>
    <p v-if="message" role="status">{{ message }}</p>
    <section v-if="facility && !settingsOnly" class="cctv-monitor"><div class="cctv-log-heading"><h2>{{ facility.name }} CCTV</h2><button :aria-expanded="logsOpen" aria-controls="cctv-logs" @click="logsOpen=!logsOpen">{{ logsOpen?'로그 접기':'로그 펼치기' }}</button></div>
      <div class="cctv-monitor-layout" :class="{'has-logs':logsOpen}"><CameraMonitor :cameras="registered" :facility-id="selectedId" :error="message" />
      <div v-if="logsOpen" id="cctv-logs"><CctvLogPanel :id="selectedId" /></div>
      </div>
    </section>
    <p v-if="!selectedId">목록에서 지하차도를 선택해 주세요.</p>
    <p v-if="facility && !settingsOnly">
      <router-link :to="`/facilities/${facility.id}`">시설 상세정보</router-link>
      · <router-link to="/alert-evidence">번호판 판별 대기</router-link>
    </p>
    <section v-if="facility">
      <h2>등록된 카메라</h2>
      <p>입구: {{ detail?.entryCameraId || '미지정' }} · 출구: {{ detail?.exitCameraId || '미지정' }}</p>
      <div class="cctv-scroll"><div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>ID</th><th>역할</th><th>스트림 URL</th><th>시설로부터 거리</th><th>위치</th><th>관리</th></tr></thead><tbody>
        <tr v-for="item in registered" :key="item.id"><td>{{ item.id }}</td><td>{{ roleLabel[item.cameraRole] }}</td><td>{{ item.streamUrl || '미등록' }}</td><td>{{ item.distanceM == null ? '미등록' : `${item.distanceM} m` }}</td>
          <td><a v-if="item.latitude != null && item.longitude != null" :href="`https://map.kakao.com/link/map/${item.latitude},${item.longitude}`" target="_blank" rel="noopener noreferrer">{{ item.latitude }}, {{ item.longitude }} · 지도</a><span v-else>미등록</span></td>
          <td><button type="button" @click="editCamera(item)">수정</button> <button type="button" @click="assign('entry', item.id)">입구 지정</button> <button type="button" @click="assign('exit', item.id)">출구 지정</button> <button class="routel-danger-action" type="button" @click="removeCamera(item)">삭제</button></td>
        </tr>
        <tr v-if="!registered.length"><td colspan="6">등록된 카메라가 없습니다.</td></tr>
      </tbody></table></div></div>
      <h2>{{ editingCameraId ? `카메라 ${editingCameraId} 수정` : '카메라 등록' }}</h2>
      <form class="cctv-camera-form" @submit.prevent="addCamera">
        <label>역할 <select v-model="role"><option value="CCTV">일반 CCTV</option><option value="APPROACH_LPR">접근 번호판 인식</option><option value="ROI_LPR">진입 직전 번호판 인식</option></select></label>
        <label>시설로부터 거리(m) <input v-model="distance" type="number" min="0" /></label>
        <label>위도 <input v-model="latitude" type="number" step="any" min="-90" max="90" /></label>
        <label>경도 <input v-model="longitude" type="number" step="any" min="-180" max="180" /></label>
        <label>스트림 URL <input v-model="streamUrl" type="text" placeholder="등록된 카메라의 실제 영상 주소" /></label>
        <div><button>{{ editingCameraId ? '수정 저장' : '카메라 등록' }}</button> <button v-if="editingCameraId" type="button" @click="cancelEdit">취소</button></div>
      </form>
    </section>
  </main>
</div>
</template>
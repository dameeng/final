<script setup lang="ts">
import { useLiveQuery } from "../composables/use-live-query"
import { useNewRecords } from "../composables/use-new-records"
import { plateImageUrl } from "../../shared/admin/services/plate-image"
import { ref, shallowRef, watch, onBeforeUnmount, computed, nextTick } from 'vue'
import CameraMonitor from '../../shared/admin/components/CameraMonitor.vue'
import { adminApi, type Camera, type Transit } from '../../shared/admin/services/admin-api'
const props = defineProps<{ id: string; updated: string | null; singleCamera?:boolean }>()
const imageDialog = ref<HTMLDialogElement|null>(null)
const previewRow = ref<Plate|null>(null)
const previewUrl = ref(''), previewLabel = ref(''), imageLoading = ref(false), imageFailed = ref(false)
let imageTrigger: HTMLElement|null = null
async function previewImage(row: Plate, event: MouseEvent) {
  if (!row.imagePath) return
  imageTrigger = event.currentTarget as HTMLElement
  previewRow.value = row
  previewUrl.value = plateImageUrl(row.imagePath)
  previewLabel.value = `${row.detectedNum || '차량'} 인식 이미지`
  imageLoading.value = true; imageFailed.value = false
  await nextTick()
  imageDialog.value?.showModal()
}
function imageClosed() {
  previewUrl.value = ''; imageLoading.value = false; previewRow.value = null
  imageTrigger?.focus(); imageTrigger = null
}
watch(() => props.id, () => imageDialog.value?.close())
const emit = defineEmits<{ changed: [] }>()
type Plate = { id:number; underpassId:number; detectedNum:string; confidence:number|null; imagePath:string|null; detectedAt:string }
type Alert = { id:number; carNum:string; alertType:string; sentAt:string }
const newTransits = useNewRecords(), newPlates = useNewRecords(), newAlerts = useNewRecords()
// 통과 기록은 시연 영상이 반복되면 수천 건이 쌓여요. 1초마다 전부 깊은 반응형으로 바꾸고 다 그리면
// 화면이 바빠져서 CCTV 영상이 끊기니까 shallowRef + 목록은 최근 TRANSIT_LIMIT 건만 그림
const TRANSIT_LIMIT = 50
const cameras = ref<Camera[]>([]), transits = shallowRef<Transit[]>([]), plates = ref<Plate[]>([]), alerts = ref<Alert[]>([])
const errors = ref<Record<string,string>>({}), loading = ref(false), cameraId = ref<number|null>(null)
const camerasLoaded=ref(false)
const cameraSlots=ref<(number|null)[]>([null,null])
const failedStreams=ref<Record<number,boolean>>({})
const displayCameras=computed(()=>cameraSlots.value.map(id=>cameras.value.find(c=>c.id===id)))
watch(cameras, rows=>{cameraSlots.value=cameraSlots.value.map((id,i)=>rows.some(c=>c.id===id)?id:rows[i]?.id??null);failedStreams.value={}})

const videoFailed = ref(false), busy = ref(false), feedback = ref(''), corrected = ref<Record<number,string>>({})
const messageType = ref('RISK_WARNING'), transitFilter = ref('ALL'), alertFilter = ref('ALL')
const matchedTransits = computed(() => transits.value.filter(t => transitFilter.value === 'ALL' || t.status === transitFilter.value))
const filteredTransits = computed(() => matchedTransits.value.slice(0, TRANSIT_LIMIT))
const transitCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const t of transits.value) counts[t.status] = (counts[t.status] ?? 0) + 1
  return counts
})
const filteredAlerts = computed(() => alerts.value.filter(a => alertFilter.value === 'ALL' || a.alertType === alertFilter.value))
let controller:AbortController|undefined
let version = 0, disposed = false, inFlight: string|null = null
const time = (v:string) => v ? new Date(v).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) : '—'
// Each record endpoint refreshes independently, without waiting for camera metadata.
const transitQuery = useLiveQuery(() => props.id,
  (id, signal) => adminApi<Transit[]>(`/underpasses/${encodeURIComponent(id)}/transits`, { signal }),
  rows => {
    if (!Array.isArray(rows)) { errors.value.transits='차량 조회 실패'; return }
    const sorted=[...rows].sort((a,b)=>(Date.parse(b.entryAt)||0)-(Date.parse(a.entryAt)||0)||b.id-a.id)
    newTransits.receive(sorted); transits.value=sorted; delete errors.value.transits
  }, () => { errors.value.transits='차량 조회 실패 · 재연결 중' },
  () => { newTransits.reset(); transits.value=[]; delete errors.value.transits })
const plateQuery = useLiveQuery(() => props.id,
  (id, signal) => adminApi<Plate[]>(`/plate-logs/pending?underpassId=${encodeURIComponent(id)}`, { signal }),
  rows => {
    if (!Array.isArray(rows)) { errors.value.plates='판별 대기 조회 실패'; return }
    plates.value=rows.filter(row=>String(row.underpassId)===props.id)
    newPlates.receive(plates.value); delete errors.value.plates
    for (const row of plates.value) {
      if (!Object.prototype.hasOwnProperty.call(corrected.value,row.id)) corrected.value[row.id]=row.detectedNum??''
    }
  }, () => { errors.value.plates='판별 대기 조회 실패 · 재연결 중' },
  () => { newPlates.reset(); plates.value=[]; corrected.value={}; delete errors.value.plates })
const alertQuery = useLiveQuery(() => props.id,
  (id, signal) => adminApi<{items:Alert[]}>(`/alert-logs?page=1&size=20&underpassId=${encodeURIComponent(id)}`, { signal }),
  result => {
    if (!Array.isArray(result?.items)) { errors.value.alerts='알림 기록 조회 실패'; return }
    const sorted=[...result.items].sort((a,b)=>(Date.parse(b.sentAt)||0)-(Date.parse(a.sentAt)||0)||b.id-a.id)
    newAlerts.receive(sorted); alerts.value=sorted; delete errors.value.alerts
  }, () => { errors.value.alerts='알림 기록 조회 실패 · 재연결 중' },
  () => { newAlerts.reset(); alerts.value=[]; delete errors.value.alerts })
async function load(reset = false) {
  if (!reset) { void transitQuery.refresh(); void plateQuery.refresh(); void alertQuery.refresh() }
  const id = props.id
  if (inFlight === id) return
  inFlight = id
  controller?.abort(); controller=new AbortController()
  const current=controller, seq=++version
  const timeout=setTimeout(()=>current.abort(),8000)
  if (reset) { camerasLoaded.value=false; cameras.value=[]; cameraId.value=null; feedback.value='' }
  loading.value=true; delete errors.value.cameras
  try {
    const rows=await adminApi<Camera[]>(`/underpasses/${encodeURIComponent(id)}/cameras`,{signal:current.signal})
    if(disposed || seq!==version || id!==props.id)return
    if(!Array.isArray(rows))throw new Error('카메라 응답 오류')
    cameras.value=rows; camerasLoaded.value=true
    if(!rows.some(c=>c.id===cameraId.value))cameraId.value=rows[0]?.id??null
  } catch {
    if(!disposed && seq===version && id===props.id)errors.value.cameras='카메라 조회 실패'
  } finally {
    clearTimeout(timeout)
    if(seq===version){inFlight=null;loading.value=false}
  }
}
watch(()=>props.id,()=>{ corrected.value={}; void load(true) },{immediate:true})
watch(()=>props.updated,()=>void load())
watch(cameraId,()=>{videoFailed.value=false})
onBeforeUnmount(()=>{disposed=true;version++;controller?.abort()})
async function display() {
  if(busy.value || !confirm('선택 시설의 전광판 조작 기록을 저장하시겠습니까? 실제 장치 전송 기능이 아닙니다.')) return
  const id=props.id;busy.value=true;feedback.value=''
  try { await adminApi(`/underpasses/${id}/display-log`,{method:'POST',body:JSON.stringify({messageType:messageType.value})}); if(id===props.id){feedback.value='전광판 조작 기록을 저장했습니다. 장치 전송 여부는 확인되지 않습니다.';emit('changed')} }
  catch(e){if(id===props.id)feedback.value=e instanceof Error?e.message:'저장 실패'}finally{busy.value=false}
}
async function review(row:Plate) {
  if(!plates.value.some(p=>p.id===row.id)){feedback.value='이미 처리되었거나 더 이상 대기 중인 기록이 아닙니다.';return}
  const value=(corrected.value[row.id]||'').trim()
  if(!value || busy.value || !confirm(`인식 번호 ${row.detectedNum} → ${value}\n판별 결과를 저장하시겠습니까?`))return
  const id=props.id;busy.value=true
  try{await adminApi(`/plate-logs/${row.id}/review`,{method:'PUT',body:JSON.stringify({correctedNum:value})});if(id===props.id){feedback.value='판별 결과를 저장했습니다.';if(previewRow.value?.id===row.id)imageDialog.value?.close();await load();emit('changed')}}catch(e){if(id===props.id)feedback.value=e instanceof Error?e.message:'판별 실패'}finally{busy.value=false}
}
</script>
<template>
  <div class="regional-operations" :aria-busy="loading">
    <div v-if="feedback" class="regional-operation-notices" role="status">{{ feedback }}</div>
    <div class="regional-lower-grid">
      <section class="regional-panel regional-camera-panel"><div class="regional-panel-heading"><h2>CCTV</h2><router-link :to="`/facilities/${id}/cctv`">CCTV 상세 보기</router-link></div>
        <p v-if="errors.cameras" role="alert">{{ errors.cameras }}</p>
        <CameraMonitor :cameras="cameras" :facility-id="id" :loading="loading" :error="errors.cameras" />
      </section>
      <div class="regional-stack">
        <section class="regional-panel"><h2>차량 통과 현황</h2><p v-if="errors.transits" role="alert">{{ errors.transits }}</p><div v-else class="regional-transit-counts"><div v-for="s in [['REMAINING','잔류'],['IN_TRANSIT','통과 중'],['EXITED','통과 완료']]" :key="s[0]"><span>{{ s[1] }}</span><strong>{{ loading ? '—' : transitCounts[s[0]] ?? 0 }}</strong></div></div></section>
        <section class="regional-panel"><h2>전광판 기록</h2><div class="regional-action-row"><select v-model="messageType" aria-label="전광판 기록 종류"><option value="RISK_WARNING">위험 안내</option><option value="BLOCK_NOTICE">통제 안내</option><option value="RELEASE_NOTICE">해제 안내</option></select><button :disabled="busy" @click="display">기록 저장</button></div></section>
        <section class="regional-panel"><h2>번호판 판별 대기</h2><p v-if="errors.plates" role="alert">{{ errors.plates }}</p><p v-else-if="!plates.length" class="regional-caption">{{ loading ? '조회 중' : '판별 대기 없음' }}</p><div class="regional-review-list"><article v-for="p in plates" :key="p.id" :class="{'regional-new-record':newPlates.fresh.value.has(p.id)}"><p>{{ p.detectedNum }} · {{ time(p.detectedAt) }}</p><p v-if="p.confidence!=null" class="regional-caption">인식 확신도: {{ p.confidence }}</p><button v-if="p.imagePath" type="button" class="regional-image-link" @click="previewImage(p,$event)">사진 확대</button><p v-else class="regional-caption">저장된 인식 사진 없음</p><div class="regional-action-row regional-review-actions"><input v-model="corrected[p.id]" :aria-label="`${p.detectedNum} 수정 번호`" placeholder="인식 번호가 없으면 직접 입력"/><button :disabled="busy || !corrected[p.id]?.trim()" @click="review(p)">판별 저장</button></div></article></div></section>
      </div>
    </div>
    <div class="regional-bottom-grid"><section class="regional-panel regional-log-panel"><div class="regional-panel-heading"><h2>번호판·차량 및 알림 기록</h2></div><div class="regional-observation-grid"><div><label>차량 상태 <select v-model="transitFilter"><option value="ALL">전체</option><option value="REMAINING">잔류</option><option value="IN_TRANSIT">통과 중</option><option value="EXITED">통과 완료</option></select></label><p v-if="errors.transits" role="alert">{{ errors.transits }}</p><ul class="regional-compact-log"><li v-for="t in filteredTransits" :key="t.id" :class="{'regional-new-record':newTransits.fresh.value.has(t.id)}"><strong>{{ t.carNum }}</strong> · {{ ({REMAINING:'잔류',IN_TRANSIT:'통과 중',EXITED:'통과 완료'})[t.status] }}<small>{{ time(t.entryAt) }} / 출차 {{ t.exitAt ? time(t.exitAt) : '—' }}</small></li></ul><p v-if="matchedTransits.length > TRANSIT_LIMIT" class="regional-caption">최근 {{ TRANSIT_LIMIT }}건만 표시 (전체 {{ matchedTransits.length }}건)</p><p v-if="!filteredTransits.length && !errors.transits" class="regional-caption">{{ loading ? '조회 중' : '차량 기록 없음' }}</p></div><div><label>알림 유형 <select v-model="alertFilter"><option value="ALL">전체</option><option value="PREDICTIVE">예측 알림</option><option value="ROI_FINAL">최종 알림</option></select></label><p v-if="errors.alerts" role="alert">{{ errors.alerts }}</p><ul class="regional-compact-log"><li v-for="a in filteredAlerts" :key="a.id" :class="{'regional-new-record':newAlerts.fresh.value.has(a.id)}"><strong>{{ a.carNum }}</strong> · {{ a.alertType==='PREDICTIVE'?'예측 알림':'최종 알림' }}<small>{{ time(a.sentAt) }}</small></li></ul><p v-if="!filteredAlerts.length && !errors.alerts" class="regional-caption">{{ loading ? '조회 중' : '알림 기록 없음' }}</p></div></div></section><slot /></div>
    <dialog ref="imageDialog" class="regional-image-dialog" aria-labelledby="recognition-image-title" @close="imageClosed" @click="event => { if(event.target === imageDialog) imageDialog?.close() }">
      <div class="regional-image-content">
        <h2 id="recognition-image-title">{{ previewLabel }}</h2>
        <p v-if="imageLoading" role="status">이미지를 불러오는 중…</p>
        <p v-if="imageFailed" role="alert">이미지를 불러오지 못했습니다. 닫은 후 다시 시도해 주세요.</p>
        <img v-if="previewUrl" :key="previewUrl" :src="previewUrl" :alt="previewLabel" v-show="!imageFailed" @load="imageLoading=false" @error="imageLoading=false;imageFailed=true" />
        <form v-if="previewRow" class="regional-image-review-form" @submit.prevent="review(previewRow)">
          <label class="regional-image-review-field">번호판 수정
            <input v-model="corrected[previewRow.id]" autofocus required maxlength="20" aria-label="확대 사진 번호판 수정" placeholder="차량번호 입력" :disabled="busy" />
          </label>
          <div class="regional-image-review-buttons"><button type="submit" :disabled="busy || !corrected[previewRow.id]?.trim() || !plates.some(p=>p.id===previewRow?.id)">{{ busy ? '저장 중…' : '판별 저장' }}</button><button type="button" @click="imageDialog?.close()">닫기</button></div>
          <p v-if="!plates.some(p=>p.id===previewRow?.id)" class="regional-image-review-message" role="status">이 기록은 더 이상 판별 대기 목록에 없습니다.</p>
          <p v-if="feedback" class="regional-image-review-message" role="status">{{ feedback }}</p>
        </form>
      </div>
    </dialog>
  </div>
</template>
<style src="../styles/recognition-preview.css"></style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { asPage, backend, queryString } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { valueLabels } from '../data/backendResources'
import { useNewItemGlow } from '../composables/useNewItemGlow'
const props=defineProps<{underpassId:string; app?:boolean}>()
const rows=ref<Record<string,any>[]>([]), loading=ref(false), error=ref(''), updated=ref('')
const ready=ref(false)
const isNewRecord=useNewItemGlow(()=>rows.value,record=>String(record.id),()=>ready.value)
let controller:AbortController|undefined, refreshTimer:ReturnType<typeof setTimeout>|undefined, poll:ReturnType<typeof setInterval>|undefined
async function load(clear=false){
  controller?.abort()
  const request=new AbortController();controller=request
  if(clear){rows.value=[];updated.value=''}
  if(!props.underpassId){loading.value=false;return}
  loading.value=true;error.value=''
  try{
    const result=await backend('/api/plate-logs'+queryString({underpassId:props.underpassId,page:1,size:20}),{signal:request.signal})
    if(request.signal.aborted)return
    rows.value=asPage<Record<string,any>>(result).items
    ready.value=true
    updated.value=new Date().toISOString()
  }catch(e){if(!request.signal.aborted)error.value=(e as Error).message}
  finally{if(!request.signal.aborted)loading.value=false}
}
watch(()=>props.underpassId,()=>void load(true),{immediate:true})
useBackendEvents(({name,data})=>{
  if(data.underpassId!=null&&String(data.underpassId)!==props.underpassId)return
  if(name==='connected'||name.startsWith('plate-queue-')||name==='transit-update'||(name==='data-changed'&&['plate','plate-log'].includes(data.resource))){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void load(),200)
  }
})
onMounted(()=>{poll=setInterval(()=>{if(!document.hidden&&!loading.value)void load()},10000)})
onBeforeUnmount(()=>{controller?.abort();clearTimeout(refreshTimer);clearInterval(poll)})
</script>
<template>
  <aside class="facility-ocr-log" aria-label="OCR 인식 로그">
    <header><div><h2>OCR 인식 로그</h2><p>이 시설의 최근 인식 기록 · 최대 20건</p></div><button type="button" :disabled="loading" @click="load()">{{loading?'조회 중…':'새로고침'}}</button></header>
    <p v-if="error" class="ocr-log-error" role="alert">{{error}}</p>
    <p v-if="loading&&!rows.length" class="ocr-log-empty" role="status">인식 기록을 불러오는 중입니다.</p>
    <p v-else-if="!error&&!rows.length" class="ocr-log-empty">아직 인식된 번호판이 없습니다.</p>
    <ol class="ocr-log-list" tabindex="0" aria-label="최근 OCR 인식 목록">
      <li v-for="record in rows" :key="record.id" :class="{'notification-arrival-glow':isNewRecord(record)}">
        <div class="ocr-log-row"><strong>{{record.correctedNum||record.detectedNum||'번호 미인식'}}</strong><span class="ocr-log-state" :class="{'ocr-log-failed':record.recognitionStatus==='FAIL','ocr-log-pending':record.reviewStatus==='PENDING'}">{{valueLabels[record.recognitionStatus]||record.recognitionStatus||'상태 미제공'}}</span></div>
        <time :datetime="record.detectedAt">{{displayDate(record.detectedAt)}}</time>
        <div class="ocr-log-meta"><span v-if="record.cameraId!=null">카메라 {{record.cameraId}}</span><span>{{valueLabels[record.reviewStatus]||record.reviewStatus||'판별 상태 미제공'}}</span></div>
        <RouterLink :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId,id:String(record.id)}}">인식 기록 보기 →</RouterLink>
      </li>
    </ol>
    <footer><small v-if="updated">갱신 {{displayDate(updated)}} · 10초마다 갱신</small><RouterLink :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId}}">전체 기록 보기 →</RouterLink></footer>
  </aside>
</template>
<style scoped src="../styles/components/facility-ocr-log.css"></style>

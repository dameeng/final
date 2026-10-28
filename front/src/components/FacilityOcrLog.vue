<script setup lang="ts">
import AppPagination from './AppPagination.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { asPage, backend, queryString } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { valueLabels } from '../data/backendResources'
import { useNewItemGlow } from '../composables/useNewItemGlow'
const props=defineProps<{underpassId:string; app?:boolean}>()
const rows=ref<Record<string,any>[]>([]), loading=ref(false), error=ref(''), updated=ref('')
const ready=ref(false)
const page=ref(1), pages=ref(1), list=ref<HTMLOListElement>()
const pageSize=computed(()=>props.app?20:10)
async function changePage(value:number){page.value=value;await load();await nextTick();if(list.value)list.value.scrollTop=0}
const isNewRecord=useNewItemGlow(()=>rows.value,record=>String(record.id),()=>ready.value)
let controller:AbortController|undefined, refreshTimer:ReturnType<typeof setTimeout>|undefined
async function load(clear=false){
  controller?.abort()
  const request=new AbortController();controller=request
  if(clear){rows.value=[];updated.value=''}
  if(!props.underpassId){loading.value=false;return}
  loading.value=true;error.value=''
  try{
    const result=await backend('/api/plate-logs'+queryString({underpassId:props.underpassId,page:page.value,size:pageSize.value}),{signal:request.signal})
    if(request.signal.aborted)return
    const data=asPage<Record<string,any>>(result,page.value,pageSize.value)
    pages.value=Math.max(1,Array.isArray(result)?Math.ceil(result.length/pageSize.value):data.totalPages)
    if(page.value>pages.value){page.value=pages.value;void load();return}
    rows.value=Array.isArray(result)?result.slice((page.value-1)*pageSize.value,page.value*pageSize.value):data.items
    ready.value=true
    updated.value=new Date().toISOString()
  }catch(e){if(!request.signal.aborted)error.value=(e as Error).message}
  finally{if(!request.signal.aborted)loading.value=false}
}
watch(()=>props.underpassId,()=>{page.value=1;void load(true)},{immediate:true})
useBackendEvents(({name,data})=>{
  if(data.underpassId!=null&&String(data.underpassId)!==props.underpassId)return
  if(name==='connected'||name.startsWith('plate-queue-')||name==='transit-update'||(name==='data-changed'&&['plate','plate-log'].includes(data.resource))){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void load(),200)
  }
})
// 10초 폴링은 없앴다. 새 인식 로그는 data-changed(plate-log) / plate-queue-* / transit-update 로 받고,
// SSE 가 끊겼다 다시 붙으면 connected 에서 한 번 다시 조회한다.
onBeforeUnmount(()=>{controller?.abort();clearTimeout(refreshTimer)})
</script>
<template>
  <aside class="facility-ocr-log" aria-label="OCR 인식 로그">
    <header><div><h2>OCR 인식 로그</h2><p>이 시설의 최근 인식 기록 · 페이지당 {{pageSize}}건</p></div><button type="button" :disabled="loading" @click="load()">{{loading?'조회 중…':'새로고침'}}</button></header>
    <p v-if="error" class="ocr-log-error" role="alert">{{error}}</p>
    <p v-if="loading&&!rows.length" class="ocr-log-empty" role="status">인식 기록을 불러오는 중입니다.</p>
    <p v-else-if="!error&&!rows.length" class="ocr-log-empty">아직 인식된 번호판이 없습니다.</p>
    <ol ref="list" class="ocr-log-list" tabindex="0" aria-label="최근 OCR 인식 목록">
      <li v-for="record in rows" :key="record.id" :class="{'notification-arrival-glow':isNewRecord(record)}">
        <div class="ocr-log-row"><strong>{{record.correctedNum||record.detectedNum||'번호 미인식'}}</strong><span class="ocr-log-state" :class="{'ocr-log-failed':record.recognitionStatus==='FAIL','ocr-log-pending':record.reviewStatus==='PENDING'}">{{valueLabels[record.recognitionStatus]||record.recognitionStatus||'상태 미제공'}}</span></div>
        <time :datetime="record.detectedAt">{{displayDate(record.detectedAt)}}</time>
        <div class="ocr-log-meta"><span v-if="record.cameraId!=null">카메라 {{record.cameraId}}</span><span>{{valueLabels[record.reviewStatus]||record.reviewStatus||'판별 상태 미제공'}}</span></div>
        <RouterLink :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId,id:String(record.id)}}">인식 기록 보기 →</RouterLink>
      </li>
    </ol>
    <AppPagination v-if="app&&rows.length" :page="page" :pages="pages" :disabled="loading" @change="changePage" />
    <nav v-else-if="rows.length" class="service-pagination" aria-label="OCR 인식 로그 페이지">
      <button :disabled="loading||page===1" @click="changePage(page-1)">이전</button>
      <span>{{page}} / {{pages}} 페이지</span>
      <button :disabled="loading||page===pages" @click="changePage(page+1)">다음</button>
    </nav>
    <footer><small v-if="updated">갱신 {{displayDate(updated)}} · 10초마다 갱신</small><RouterLink :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId}}">전체 기록 보기 →</RouterLink></footer>
  </aside>
</template>
<style scoped src="../styles/components/facility-ocr-log.css"></style>

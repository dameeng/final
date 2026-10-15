<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { adminApi } from '../../shared/admin/services/admin-api'
import type { Underpass } from '../../shared/admin/services/underpasses'
const props=defineProps<{items:Underpass[];updated:string|null}>()
const emit=defineEmits<{select:[id:string]}>()
type Row={facility:string;id:string;kind:string;eventType:string|null;messageType:string|null;createdAt:string}
const rows=ref<Row[]>([]), loading=ref(false), errors=ref(0), cursor=ref(0), filter=ref('ALL')
const now=ref(Date.now())
const clock=setInterval(()=>{now.value=Date.now()},1000)
let disposed=false,version=0
let requestController:AbortController|undefined
const visible=computed(()=>rows.value.filter(r=>filter.value==='ALL'||r.kind===filter.value).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)))
const label=(r:Row)=>r.kind==='DISPLAY'?`전광판 기록 · ${({BLOCK_NOTICE:'차단 알림',RISK_WARNING:'위험 알림',RELEASE_NOTICE:'해제 알림'}[r.messageType||'']||r.messageType||'—')}`:({BLOCK:'통제',RELEASE:'통제 해제',RISK_LEVEL_UP:'위험 등급 상승',RISK_LEVEL_DOWN:'위험 등급 하락'}[r.eventType||'']||r.eventType||'시설 이벤트')
async function load(_reset=true){
 if(disposed)return
 requestController?.abort()
 const controller=new AbortController();requestController=controller
 const seq=++version
 loading.value=true;cursor.value=0;errors.value=0
 const targets=[...props.items]
 const allowed=new Set(targets.map(item=>item.id))
 rows.value=rows.value.filter(row=>allowed.has(row.id))
 try{
  for(let i=0;i<targets.length;i+=2){
   const results=await Promise.allSettled(targets.slice(i,i+2).map(async item=>{
    const data=await adminApi<Row[]>(`/underpasses/${encodeURIComponent(item.id)}/events`,{signal:controller.signal})
    if(!Array.isArray(data))throw new Error('응답 형식 확인 필요')
    return {item,data}
   }))
   if(disposed||seq!==version)return
   for(const result of results){
    if(result.status==='fulfilled'){
     const {item,data}=result.value
     rows.value=[...rows.value.filter(row=>row.id!==item.id),...data.map(row=>({...row,id:item.id,facility:item.name}))]
    }else errors.value++
   }
   cursor.value+=results.length
  }
 }finally{
  if(!disposed&&seq===version)loading.value=false
 }
}
watch(()=>props.items.map(x=>x.id).join(','),()=>{void load(true)},{immediate:true})

defineExpose({reload:()=>load(true)})
onBeforeUnmount(()=>{disposed=true;version++;requestController?.abort();clearInterval(clock)})
</script>
<template><section class="regional-panel regional-timeline"><div class="regional-panel-heading"><h2>통합 타임라인</h2><button :disabled="loading" @click="load(true)">갱신</button></div><p class="regional-caption">현재 시각 <time>{{ new Date(now).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}) }}</time></p><div class="regional-timeline-filters" role="group" aria-label="타임라인 유형"><button v-for="item in [['ALL','전체'],['EVENT','제어·위험 알림'],['DISPLAY','전광판']]" :key="item[0]" :aria-pressed="filter===item[0]" @click="filter=item[0]">{{ item[1] }}</button></div><p v-if="errors" role="alert">{{ errors }}개 시설 조회 실패 · 해당 시설의 기존 기록이 있다면 이전 수신 자료입니다.</p><div class="regional-timeline-scroll"><ol><li v-for="(r,i) in visible" :key="`${r.id}-${r.createdAt}-${i}`"><button @click="emit('select',r.id)"><span class="regional-event-heading"><span class="regional-event-type" :data-type="r.kind==='DISPLAY'?'DISPLAY':r.eventType">{{ label(r) }}</span><strong>{{ r.facility }}</strong></span><time>{{ new Date(r.createdAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) }}</time></button></li></ol><p v-if="!visible.length" class="regional-empty">{{ loading ? '기록 조회 중' : errors ? '연결 확인 필요' : '조회된 기록 없음' }}</p></div><button v-if="errors" :disabled="loading" @click="load(true)">전체 기록 다시 조회</button><p class="regional-caption">기록을 선택하면 지도에서 해당 시설을 확인할 수 있습니다.</p></section></template>

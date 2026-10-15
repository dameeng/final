<script setup lang="ts">
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {adminApi} from '../services/admin-api'
const props=defineProps<{id:string}>()
type Row={id?:number;carNum?:string;status?:string;entryAt?:string;exitAt?:string;sentAt?:string;createdAt?:string;alertTypeLabel?:string;alertType?:string;messageText?:string;eventType?:string;messageType?:string;kind?:string}
const groups=ref<{type:string;rows:Row[]}[]>([]),busy=ref(false),error=ref(''),filter=ref('전체')
let version=0,disposed=false,controller:AbortController|undefined
const stamp=(r:Row)=>r.sentAt||r.createdAt||r.exitAt||r.entryAt||''
const rows=computed(()=>groups.value.flatMap(g=>g.rows.map(row=>({...row,type:g.type}))).filter(r=>filter.value==='전체'||r.type===filter.value).sort((a,b)=>(Date.parse(stamp(b))||0)-(Date.parse(stamp(a))||0)))
async function load(reset=false){
 if(busy.value&&!reset)return
 controller?.abort();controller=new AbortController();const signal=controller.signal
 const id=props.id,seq=++version;busy.value=true;error.value='';if(reset)groups.value=[]
 if(!id){busy.value=false;return}
 const paths=[['통과',`/underpasses/${encodeURIComponent(id)}/transits`],['알림',`/alert-logs?page=1&size=30&underpassId=${encodeURIComponent(id)}`],['제어·전광판',`/underpasses/${encodeURIComponent(id)}/events`]]
 const results=await Promise.allSettled(paths.map(async([type,path])=>{const data=await adminApi<Row[]|{items:Row[]}>(path,{signal});return {type,rows:Array.isArray(data)?data:data.items}}))
 if(disposed||seq!==version)return
 const failed:string[]=[]
 results.forEach((result,i)=>{if(result.status==='fulfilled'&&Array.isArray(result.value.rows)){groups.value=groups.value.filter(g=>g.type!==result.value.type);groups.value.push(result.value)}else failed.push(paths[i][0])})
 error.value=failed.length?`${failed.join(', ')} 조회 실패 · 남아 있는 기록은 이전 수신 자료입니다.`:'';busy.value=false
}
watch(()=>props.id,()=>void load(true),{immediate:true})
const timer=setInterval(()=>void load(),30000)
onBeforeUnmount(()=>{disposed=true;version++;controller?.abort();clearInterval(timer)})
</script>
<template><aside class="cctv-log-panel" aria-label="선택 시설 기록"><div class="cctv-log-heading"><h2>CCTV 관련 기록</h2><button :disabled="busy" @click="load()">갱신</button></div><div class="cctv-log-filters"><button v-for="kind in ['전체','통과','알림','제어·전광판']" :key="kind" :aria-pressed="filter===kind" @click="filter=kind">{{ kind }}</button></div><p v-if="error" role="alert">{{ error }}</p><p v-if="busy" role="status">기록 확인 중…</p><div class="cctv-log-scroll"><article v-for="(row,i) in rows" :key="`${row.type}-${row.id}-${i}`"><small>{{ row.type }} · {{ stamp(row) || '—' }}</small><strong>{{ row.carNum || row.alertTypeLabel || row.eventType || row.messageType || '시설 기록' }}</strong><p>{{ row.messageText || row.status || row.alertTypeLabel || row.alertType || row.eventType || row.messageType }}</p></article><p v-if="!busy&&!error&&!rows.length">조회된 기록 없음</p></div></aside></template>

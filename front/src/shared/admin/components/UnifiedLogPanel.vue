<script setup lang="ts">
import { formatDecimal } from '../../utils/format-number'

import {computed,inject,nextTick,onBeforeUnmount,reactive,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {adminKey} from '../main'
import {alertLogs,eventLogs,transitLogs,categoryNames,dateLabel,type UnifiedLog} from '../services/unified-logs'
const props=defineProps<{facilityId?:string;compact?:boolean}>()
const {state}=inject(adminKey)!
const regional=computed(()=>state.profile?.role==='REGIONAL_ADMIN')
const base=computed(()=>regional.value?'/regional/facilities/':'/super/facilities/')
const alertCursors=ref<Record<string,{page:number;total:number}>>({})
const hasMore=computed(()=>regional.value?Object.values(alertCursors.value).some(x=>x.page<x.total):alertPage.value<alertPages.value)
const route=useRoute(),router=useRouter()
const filters=reactive({region:'',facility:'',category:'ALL',start:'',end:'',query:''})
const applied=ref({...filters})
const rows=ref<UnifiedLog[]>([]),errors=ref<string[]>([]),loading=ref(false),moreBusy=ref(false),attempted=ref(0),total=ref(0),succeeded=ref(0)
const page=ref(1),alertPage=ref(0),alertPages=ref(0),receivedAt=ref('')
const dialog=ref<HTMLDialogElement|null>(null),selected=ref<UnifiedLog|null>(null)
let controller:AbortController|undefined,version=0,disposed=false,returnFocus:HTMLElement|null=null
const regions=computed(()=>[...new Set(state.underpasses.map(f=>f.region))].sort())
const choices=computed(()=>state.underpasses.filter(f=>!filters.region||f.region===filters.region))
function day(value:string){const time=Date.parse(value);return Number.isFinite(time)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(time):''}
const filtered=computed(()=>rows.value.filter(row=>{
 const f=applied.value,d=day(row.time)
 return (!f.region||row.region===f.region)&&(!f.facility||row.facilityId===f.facility)&&(f.category==='ALL'||row.category===f.category)&&(!f.start||!!d&&d>=f.start)&&(!f.end||!!d&&d<=f.end)&&(!f.query||[row.facilityName,row.carNum,row.text,row.message].join(' ').toLowerCase().includes(f.query.toLowerCase()))
}).sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0)))
const pageCount=computed(()=>Math.max(1,Math.ceil(filtered.value.length/10)))
const visible=computed(()=>props.compact?filtered.value.slice(0,3):filtered.value.slice((page.value-1)*10,page.value*10))
watch(pageCount,n=>{if(page.value>n)page.value=n})
function scope(){return state.underpasses.filter(f=>(!applied.value.region||f.region===applied.value.region)&&(!applied.value.facility||f.id===applied.value.facility))}
async function syncQuery(){
 if(props.facilityId){void load();return}
 const target={path:route.path,query:{...route.query,region:filters.region||undefined,facility:filters.facility||undefined,category:filters.category==='ALL'?undefined:filters.category,start:filters.start||undefined,end:filters.end||undefined,q:filters.query||undefined}}
 if(router.resolve(target).fullPath===route.fullPath)void load()
 else await router.replace(target)
}

async function load(){
 if(disposed||!['SUPER_ADMIN','REGIONAL_ADMIN'].includes(state.profile?.role||''))return
 if(regional.value&&state.profile?.regionId==null){rows.value=[];errors.value=['담당 지역 미지정: 시설 기록을 조회할 수 없습니다.'];return}
 if(filters.start&&filters.end&&filters.start>filters.end){errors.value=['종료일은 시작일 이후로 선택해 주세요.'];return}
 controller?.abort();controller=new AbortController()
 const signal=controller.signal,seq=++version
 applied.value={...filters,facility:props.facilityId||filters.facility}
 loading.value=true;moreBusy.value=false;rows.value=[];errors.value=[];attempted.value=0;succeeded.value=0;page.value=1;alertPage.value=0;alertPages.value=0;receivedAt.value='';alertCursors.value={}
 const items=scope();total.value=items.length
 const needEvents=applied.value.category!=='ALERT'
 try{
  if(needEvents)for(let i=0;i<items.length;i+=2){
   const results=await Promise.allSettled(items.slice(i,i+2).map(f=>eventLogs(f,signal)))
   if(disposed||seq!==version)return
   results.forEach((result,index)=>{attempted.value++;if(result.status==='fulfilled'){succeeded.value++;rows.value.push(...result.value);receivedAt.value=new Date().toISOString()}else errors.value.push(items[i+index].name+' 이벤트 조회 실패')})
  }
  if(['ALL','OTHER'].includes(applied.value.category)){
   for(let i=0;i<items.length;i+=2){
    const batch=await Promise.allSettled(items.slice(i,i+2).map(f=>transitLogs(f,signal)))
    if(disposed||seq!==version)return
    batch.forEach((r,j)=>{if(r.status==='fulfilled'){rows.value.push(...r.value);receivedAt.value=new Date().toISOString()}else errors.value.push(items[i+j].name+' 차량 통과 기록 조회 실패')})
   }
  }
  if(regional.value && ['ALL','ALERT'].includes(applied.value.category)){
   for(let i=0;i<items.length;i+=2){
    const batch=await Promise.allSettled(items.slice(i,i+2).map(f=>alertLogs(items,f.id,1,signal)))
    if(disposed||seq!==version)return
    batch.forEach((r,j)=>{const f=items[i+j];if(r.status==='fulfilled'){rows.value.push(...r.value.rows.filter(row=>row.facilityId===f.id));alertCursors.value[f.id]={page:1,total:r.value.totalPages};receivedAt.value=new Date().toISOString()}else errors.value.push(f.name+' 알림 발송 기록 조회 실패')})
   }
  }else if(['ALL','ALERT'].includes(applied.value.category)){
   try{
    const result=await alertLogs(state.underpasses,applied.value.facility,1,signal)
    if(disposed||seq!==version)return
    rows.value.push(...result.rows);alertPage.value=1;alertPages.value=result.totalPages;receivedAt.value=new Date().toISOString()
   }catch{if(!signal.aborted)errors.value.push('알림 발송 기록 조회 실패')}
  }
 }finally{if(!disposed&&seq===version)loading.value=false}
}
async function more(){
 if(loading.value||moreBusy.value||!controller||!hasMore.value)return
 moreBusy.value=true;const seq=version
 try{
  if(regional.value){
   const pending=Object.entries(alertCursors.value).filter(([,v])=>v.page<v.total)
   for(let i=0;i<pending.length;i+=2){
    const batch=await Promise.allSettled(pending.slice(i,i+2).map(async([id,v])=>({id,data:await alertLogs(scope(),id,v.page+1,controller!.signal)})))
    if(disposed||seq!==version)return
    const keys=new Set(rows.value.map(row=>row.key))
    batch.forEach((r,j)=>{if(r.status==='fulfilled'){const {id,data}=r.value;rows.value.push(...data.rows.filter(row=>row.facilityId===id&&!keys.has(row.key)));alertCursors.value[id].page++;alertCursors.value[id].total=data.totalPages;receivedAt.value=new Date().toISOString()}else errors.value.push('시설 #'+pending[i+j][0]+' 추가 알림 조회 실패')})
   }
   return
  }
  const result=await alertLogs(state.underpasses,applied.value.facility,alertPage.value+1,controller.signal)
  if(disposed||seq!==version)return
  const keys=new Set(rows.value.map(row=>row.key))
  rows.value.push(...result.rows.filter(row=>!keys.has(row.key)));alertPage.value++;alertPages.value=result.totalPages;receivedAt.value=new Date().toISOString()
 }catch{if(!disposed&&seq===version)errors.value.push('추가 알림 조회 실패 · 다시 시도해 주세요.')}
 finally{if(!disposed&&seq===version)moreBusy.value=false}
}
function search(){void syncQuery()}
function reset(){Object.assign(filters,{region:'',facility:props.facilityId||'',category:'ALL',start:'',end:'',query:''});search()}
async function open(row:UnifiedLog,event:Event){returnFocus=event.currentTarget as HTMLElement;selected.value=row;await nextTick();dialog.value?.showModal()}
function closed(){selected.value=null;returnFocus?.focus()}
watch(()=>[route.fullPath,props.facilityId,state.underpasses.map(f=>f.id).join('|')],()=>{
 filters.facility=props.facilityId||String(route.query.facility||'');filters.region=regional.value||props.facilityId?'':String(route.query.region||'')
 filters.category=String(route.query.category||'ALL');if(!categoryNames[filters.category])filters.category='ALL'
 filters.start=String(route.query.start||'');filters.end=String(route.query.end||'');filters.query=String(route.query.q||'')
 void load()
},{immediate:true})
onBeforeUnmount(()=>{disposed=true;version++;controller?.abort()})
</script>
<template>
 <section class="su-card su-logs">
  <template v-if="!compact">
   <div class="su-tabs" aria-label="로그 유형"><button v-for="(label,key) in categoryNames" :key="key" :aria-pressed="filters.category===key" @click="filters.category=String(key);search()">{{ label }}</button></div>
   <form class="su-filters review-log-filters" @submit.prevent="search">
    <label v-if="!facilityId && !regional">지역<select aria-label="지역" v-model="filters.region" @change="filters.facility=''"><option value="">전체 지역</option><option v-for="r in regions" :key="r">{{ r }}</option></select></label>
    <label v-if="!facilityId">시설<select aria-label="시설" v-model="filters.facility"><option value="">전체 시설</option><option v-for="f in choices" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
    <label>시작일<input v-model="filters.start" type="date"></label><label>종료일<input v-model="filters.end" type="date"></label>
    <label class="su-search">검색<input v-model="filters.query" placeholder="시설명, 차량번호 또는 기록 내용"></label>
    <button :disabled="loading">조회</button><button type="button" @click="reset">초기화</button>
   </form>
  </template>
  <div class="su-line"><h2>{{ compact?'최근 시설 기록':'조회 기록' }}</h2><button :disabled="loading" @click="load">새로고침</button></div>
  <p class="su-muted" role="status">{{ loading?'조회 중 · ':'' }}<template v-if="applied.category!=='ALERT'">시설 이벤트 {{ attempted }}/{{ total }}곳 조회 시도 · 성공 {{ succeeded }}곳 · </template>현재 수신·검색 결과 {{ filtered.length }}건</p>
  <p v-if="receivedAt" class="su-muted">마지막 정상 수신 {{ dateLabel(receivedAt) }}</p>
  <p v-for="error in errors" :key="error" class="su-error" role="alert">{{ error }}</p>
  <div class="su-table-wrap" tabindex="0" aria-label="통합 로그 목록"><table class="su-log-table"><colgroup><col class="su-log-col-time"><col class="su-log-col-facility"><col class="su-log-col-car"><col class="su-log-col-type"><col class="su-log-col-text"><col class="su-log-col-result"><col class="su-log-col-detail"></colgroup><thead><tr><th>발생·발송 시각</th><th>시설 · 지역</th><th>차량번호</th><th>유형</th><th>내용</th><th>확인된 결과</th><th>상세</th></tr></thead><tbody>
   <tr v-for="row in visible" :key="row.key"><td>{{ dateLabel(row.time) }}</td><td>{{ row.facilityName }}<small>{{ row.region }}</small></td><td class="su-log-car-num">{{ row.carNum || '—' }}</td><td><span class="su-badge">{{ categoryNames[row.category] }}</span></td><td>{{ row.text }}</td><td>{{ row.result }}</td><td><button @click="open(row,$event)">상세</button></td></tr>
   <tr v-if="!visible.length"><td colspan="7" class="su-empty">{{ loading?'기록을 불러오는 중입니다.':errors.length?'조회 실패 항목을 확인해 주세요.':'현재 수신 범위에 조건과 일치하는 기록이 없습니다.' }}</td></tr>
  </tbody></table></div>
  <nav v-if="!compact&&pageCount>1" class="su-pagination" aria-label="수신 로그 페이지"><button :disabled="page===1" @click="page--">이전</button><span>{{ page }} / {{ pageCount }}</span><button :disabled="page>=pageCount" @click="page++">다음</button></nav>
  <button v-if="hasMore" :disabled="loading||moreBusy" @click="more">{{ moreBusy?'불러오는 중…':'알림 기록 더 불러오기' }} <span v-if="!regional">({{ alertPage }}/{{ alertPages }}페이지)</span></button>
  <p v-if="applied.category==='OTHER'" class="su-muted">차량 통과 기록과 기타 시설 이벤트를 함께 표시합니다.</p>
  <p class="su-muted">기간·검색은 수신 기록에 적용됩니다. 시설 이벤트·차량 통과 기록은 서버 반환 범위, 알림은 불러온 페이지 기준입니다. 조회된 기록을 전체 기간의 총건수로 표시하지 않습니다.</p>
  <p class="su-muted">이벤트 기록·발송 기록·전광판 기록 저장은 실제 장치 동작 완료나 문자 전달 성공을 의미하지 않습니다.</p>
  <dialog ref="dialog" class="su-dialog" @close="closed" @click.self="dialog?.close()">
   <template v-if="selected"><div class="su-line"><h2>기록 상세</h2><button autofocus @click="dialog?.close()">닫기</button></div>
   <dl><dt>기록 ID</dt><dd>{{ selected.sourceId }}</dd><dt>{{ selected.category==='ALERT'?'발송 시각':'발생 시각' }}</dt><dd>{{ dateLabel(selected.time) }}</dd><dt>시설</dt><dd>{{ selected.facilityName }} · {{ selected.region }}</dd><dt>유형</dt><dd>{{ categoryNames[selected.category] }}</dd><dt>내용</dt><dd>{{ selected.message||selected.text }}</dd><dt>확인된 결과</dt><dd>{{ selected.result }}</dd><dt>담당자</dt><dd>{{ selected.operator }}</dd><template v-if="selected.carNum"><dt>차량번호</dt><dd>{{ selected.carNum }}</dd></template><template v-if="selected.phone"><dt>수신 연락처</dt><dd>{{ selected.phone }}</dd></template><template v-if="selected.score!=null"><dt>기록 당시 위험 점수</dt><dd>{{ formatDecimal(selected.score) }}점</dd></template></dl>
   <router-link v-if="state.underpasses.some(f=>f.id===selected?.facilityId)" :to="base+selected.facilityId" @click="dialog?.close()">이 시설 상세 보기</router-link></template>
  </dialog>
 </section>
</template>

<script setup lang="ts">
import { buildRiskTrend } from '../utils/risk-trend'
import { formatDecimal } from '../../shared/utils/format-number'

import {computed,inject,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {adminKey} from '../../shared/admin/main'
import {adminApi,type FacilityDetail} from '../../shared/admin/services/admin-api'
import {belongsToRegion} from '../../shared/admin/services/regional-access'
import {dateLabel} from '../../shared/admin/services/unified-logs'
import RegionalOperationsPanel from '../components/RegionalOperationsPanel.vue'
import CctvView from '../../shared/admin/views/CctvView.vue'
import UnifiedLogPanel from '../../shared/admin/components/UnifiedLogPanel.vue'
const {state,control,refresh}=inject(adminKey)!
const route=useRoute(),router=useRouter()
const id=computed(()=>String(route.params.id||''))
const facilities=computed(()=>state.underpasses.filter(f=>belongsToRegion(f,state.profile)))
const facility=computed(()=>facilities.value.find(f=>f.id===id.value))
const search=ref(String(route.query.q||'')),filter=ref(String(route.query.filter||'all'))
const filteredList=computed(()=>facilities.value.filter(f=>f.name.toLowerCase().includes(search.value.trim().toLowerCase())&&(filter.value==='all'||filter.value==='blocked'&&f.controlState==='BLOCKED'||filter.value==='risk'&&['WARNING','DANGER'].includes(f.observedRiskLevel||''))))
const sort=ref('priority')
const list=computed(()=>[...filteredList.value].sort((a,b)=>sort.value==='name'?a.name.localeCompare(b.name,'ko'):sort.value==='risk'?(b.riskScore??-1)-(a.riskScore??-1):(Number(b.controlState==='BLOCKED')-Number(a.controlState==='BLOCKED')||(b.riskScore??-1)-(a.riskScore??-1))))

const tabs=[['overview','개요'],['live','실시간 관제'],['cameras','카메라 설정'],['thresholds','임계치'],['logs','로그']]
const tab=computed(()=>tabs.some(t=>t[0]===route.query.tab)?String(route.query.tab):'overview')
const detail=ref<FacilityDetail|null>(null),detailError=ref(''),busy=ref(false),feedback=ref(''),loading=ref(false),revision=ref(0)
type Point={riskScore:number|null;predictedAt:string}
type Threshold={level:string;riskScoreMin:number;updatedAt:string|null}
const edits=ref<Record<string,string>>({}),thresholdBusy=ref(false),thresholdMessage=ref('')
const points=ref<Point[]>([]),thresholds=ref<Threshold[]>([]),riskError=ref(''),thresholdError=ref('')
const halfHourTrend=computed(()=>buildRiskTrend(points.value,30))
const risk=(level?:string)=>({SAFE:'정상',WARNING:'주의',DANGER:'위험'}[level||'']||'—')
const ctl=(value?:string)=>value==='BLOCKED'?'통제 중':value==='OPEN'?'미통제':'확인 필요'
const label=(level:string)=>({SAFE:'정상',WARNING:'주의',DANGER:'위험'}[level]||level)
let controller:AbortController|undefined,version=0,disposed=false
async function load(){
 controller?.abort();const seq=++version
 detail.value=null;points.value=[];thresholds.value=[];detailError.value='';riskError.value='';thresholdError.value='';feedback.value=''
 if(!facility.value){loading.value=false;return}
 controller=new AbortController();const signal=controller.signal;loading.value=true
 const base='/underpasses/'+encodeURIComponent(id.value)
 const results=await Promise.allSettled([adminApi<FacilityDetail>(base,{signal}),adminApi<Point[]>(base+'/risk-scores?hours=24',{signal}),adminApi<Threshold[]>(base+'/thresholds',{signal})])
 if(disposed||seq!==version)return
 const [d,r,t]=results
 if(d.status==='fulfilled'&&d.value?.id!=null)detail.value=d.value;else detailError.value='시설 상세 조회 실패'
 if(r.status==='fulfilled'&&Array.isArray(r.value))points.value=r.value;else riskError.value='위험도 기록 조회 실패'
 if(t.status==='fulfilled'&&Array.isArray(t.value)){thresholds.value=t.value;edits.value=Object.fromEntries(t.value.map(row=>[row.level,String(row.riskScoreMin)]))}else thresholdError.value='임계치 조회 실패'
 loading.value=false
}
watch(()=>[id.value,!!facility.value],()=>void load(),{immediate:true})
async function saveThreshold(row:Threshold){
 if(thresholdBusy.value||!facility.value||!belongsToRegion(facility.value,state.profile))return
 const value=Number(edits.value[row.level]);thresholdMessage.value=''
 if(!String(edits.value[row.level]??'').trim()||!Number.isFinite(value)||value<0||value>100){thresholdMessage.value='0~100 사이 점수를 입력해 주세요.';return}
 const ordered=['SAFE','WARNING','DANGER'].map(level=>level===row.level?value:thresholds.value.find(t=>t.level===level)?.riskScoreMin)
 if(ordered.every(v=>v!=null)&&!(ordered[0]!<ordered[1]!&&ordered[1]!<ordered[2]!)){thresholdMessage.value='정상 < 주의 < 위험 순서로 설정해 주세요.';return}
 if(!confirm(`${facility.value.name} · ${label(row.level)} 임계치를 ${row.riskScoreMin}점에서 ${value}점으로 변경할까요?`))return
 thresholdBusy.value=true
 try{await adminApi(`/underpasses/${encodeURIComponent(id.value)}/thresholds/${row.level}`,{method:'PUT',body:JSON.stringify({riskScoreMin:value})});await load();thresholdMessage.value='임계치를 저장했습니다.'}
 catch(e){thresholdMessage.value=e instanceof Error?e.message:'임계치 저장 실패'}finally{thresholdBusy.value=false}
}
function remember(){void router.replace({path:route.path,query:{q:search.value||undefined,filter:filter.value==='all'?undefined:filter.value}})}
function listLink(){return {path:'/regional/facilities',query:{q:search.value||undefined,filter:filter.value==='all'?undefined:filter.value}}}
function detailLink(value:string){return {path:'/regional/facilities/'+value,query:{q:search.value||undefined,filter:filter.value==='all'?undefined:filter.value}}}
async function change(){
 const f=facility.value
 if(!f||busy.value||state.controlBusy||state.error||state.loading||!['OPEN','BLOCKED'].includes(f.controlState||''))return
 const action=f.controlState==='BLOCKED'?'통제 해제':'통제'
 if(!confirm(`${f.name}\n현재 상태: ${ctl(f.controlState)}\n실행할 작업: ${action}\n진행하시겠습니까?`))return
 busy.value=true;feedback.value=''
 try{await control(f.id,action==='통제'?'통제':'정상');revision.value++;await load();feedback.value=`${f.name} ${action} 요청 처리 후 상태를 갱신했습니다. 실제 장치 동작 여부는 현장 정보를 확인해 주세요.`}
 catch(e){feedback.value=e instanceof Error?e.message:'요청 실패'}finally{busy.value=false}
}
async function refreshAll(){if(loading.value)return;await refresh();await load();revision.value++}
onBeforeUnmount(()=>{disposed=true;version++;controller?.abort()})
</script>
<template><div v-if="state.profile?.role==='REGIONAL_ADMIN'" class="regional-workspace">
 <template v-if="!id">
  <div class="su-heading su-line"><div><h1>지하차도 관리</h1><p>{{ state.profile.regionName || '담당 지역 미지정' }} · 시설별 현황과 관제 업무</p></div><button :disabled="state.loading" @click="refresh">{{ state.loading?'조회 중…':'새로고침' }}</button></div>
  <div class="rw-summary"><section class="su-card"><span>담당 시설</span><strong>{{ state.error || !state.loaded ? '—' : facilities.length }}<small>개</small></strong><small>담당 지역 기준</small></section><section class="su-card"><span>주의·위험 시설</span><strong>{{ state.error || !state.loaded ? '—' : facilities.filter(f=>['WARNING','DANGER'].includes(f.observedRiskLevel||'')).length }}<small>개</small></strong><small>위험 정보 없음 {{ facilities.filter(f=>!f.observedRiskLevel||f.observedRiskLevel==='UNKNOWN').length }}개</small></section><section class="su-card"><span>통제 중</span><strong>{{ state.error || !state.loaded ? '—' : facilities.filter(f=>f.controlState==='BLOCKED').length }}<small>개</small></strong><small>위험 등급과 별도 집계</small></section></div>
  <section class="su-card"><form class="su-filters" @submit.prevent="remember"><label>정렬<select v-model="sort"><option value="priority">통제 우선</option><option value="risk">위험 점수 높은 순</option><option value="name">시설명 순</option></select></label><label class="su-search">시설명 검색<input v-model="search" type="search" placeholder="시설명으로 검색"></label><button>검색</button><div class="su-tabs rw-filter"><button v-for="f in [['all','전체'],['blocked','통제 중'],['risk','주의·위험']]" :key="f[0]" type="button" :aria-pressed="filter===f[0]" @click="filter=f[0];remember()">{{ f[1] }}</button></div></form>
   <p class="su-muted">{{ state.loading?'조회 중':state.error?'이전 수신 자료 · 연결 확인 필요':list.length+'개 시설' }} · 담당 시설 전체 목록</p>
   <div class="su-table-wrap"><table><thead><tr><th>시설명</th><th>담당 지역</th><th>위험 등급</th><th>위험 점수</th><th>통제 여부</th><th>상세</th></tr></thead><tbody><tr v-for="f in list" :key="f.id"><td><router-link :to="detailLink(f.id)">{{ f.name }}</router-link></td><td>{{ f.region }}</td><td><span class="su-badge" :data-tone="f.observedRiskLevel">{{ risk(f.observedRiskLevel) }}</span></td><td>{{ f.riskScore==null?'—':formatDecimal(f.riskScore)+'점' }}</td><td><span class="su-badge" :data-tone="f.controlState">{{ ctl(f.controlState) }}</span></td><td><router-link class="su-button" :to="detailLink(f.id)">상세 보기</router-link></td></tr><tr v-if="!list.length"><td colspan="6" class="su-empty">{{ state.loading?'불러오는 중':state.error?'시설 조회 상태를 확인해 주세요.':!state.profile.regionId?'담당 지역이 지정되지 않았습니다.':'조건에 맞는 시설이 없습니다.' }}</td></tr></tbody></table></div>
  </section>
 </template>
 <template v-else-if="facility">
  <router-link :to="listLink()">← 시설 목록</router-link>
  <header class="rw-facility-header">
  <div class="su-heading su-line rw-detail-heading"><div><h1>{{ facility.name }}</h1><p>{{ detail?.roadAddress || facility.region }}</p></div><button :disabled="loading||state.loading||busy" @click="refreshAll">새로고침</button></div>
  <div class="su-status"><span class="su-badge" :data-tone="facility.observedRiskLevel">{{ risk(facility.observedRiskLevel) }}</span><span class="su-badge" :data-tone="facility.controlState">{{ ctl(facility.controlState) }}</span></div>
  <nav class="su-tabs" aria-label="시설 상세 업무"><router-link v-for="t in tabs" :key="t[0]" :to="{path:route.path,query:{...route.query,tab:t[0]}}" :aria-current="tab===t[0]?'page':undefined">{{ t[1] }}</router-link></nav>
  </header>
  <template v-if="tab==='overview'"><section class="su-card rw-control"><div><h2>시설 통제</h2><p>{{ facility.name }} · 현재 {{ ctl(facility.controlState) }}</p></div><button class="su-primary" :disabled="busy||state.controlBusy||state.loading||!!state.error||!['OPEN','BLOCKED'].includes(facility.controlState||'')" @click="change">{{ busy?'처리 중…':facility.controlState==='BLOCKED'?'통제 해제':'통제' }}</button><p v-if="feedback" role="status">{{ feedback }}</p></section>
   <div class="su-two rw-section"><section class="su-card"><h2>현재 관측 정보</h2><p v-if="loading">조회 중…</p><p v-if="detailError" class="su-error">{{ detailError }}</p><dl><dt>위험 점수</dt><dd>{{ facility.riskScore==null?'—':formatDecimal(facility.riskScore)+'점' }}</dd><dt>주소</dt><dd>{{ detail?.roadAddress||'—' }}</dd><dt>시설 높이 / 길이</dt><dd>{{ detail?.heightM==null?'—':detail.heightM+'m' }} / {{ detail?.lengthM==null?'—':detail.lengthM+'m' }}</dd></dl></section>
   <section class="su-card"><h2>선택 시설 위험도 추이 · 최근 12시간</h2><p v-if="riskError" class="su-error">{{ riskError }}</p><p v-else-if="!halfHourTrend.points.length" class="su-empty">{{ loading?'조회 중':'자료 없음' }}</p><template v-else><div class="rw-halfhour-scroll" tabindex="0" aria-label="최근 12시간 위험 점수 추이"><svg class="rw-halfhour-chart" :viewBox="`0 0 ${halfHourTrend.width} 170`" :width="halfHourTrend.width" height="170" role="img" :aria-label="facility.name+' 위험 점수 추이, 30분 간격'"><g v-for="n in [0,25,50,75,100]" :key="n"><line x1="40" :x2="halfHourTrend.width-20" :y1="130-n" :y2="130-n"/><text x="4" :y="134-n">{{ n }}</text></g><path v-for="(path,i) in halfHourTrend.paths" :key="i" :d="path"/><circle v-for="point in halfHourTrend.points" :key="point.time" :cx="point.x" :cy="point.y" r="3"><title>{{ dateLabel(point.time) }} · {{ formatDecimal(point.score) }}점</title></circle><text v-for="tick in halfHourTrend.ticks" :key="tick.time" :x="tick.x" y="155" text-anchor="middle">{{ tick.label }}</text></svg></div><p class="su-muted">{{ dateLabel(halfHourTrend.points[0]?.time||'') }} ~ {{ dateLabel(halfHourTrend.points.at(-1)?.time||'') }}</p></template></section></div>
   <div class="rw-section"><UnifiedLogPanel :key="id+revision" :facility-id="id" compact/></div>
   <router-link class="su-button rw-section" :to="{path:route.path,query:{...route.query,tab:'live'}}">차량 현황·전광판·판별 대기 확인 →</router-link>
  </template>
  <RegionalOperationsPanel v-else-if="tab==='live'" :key="id" :id="id" :updated="state.lastUpdated" single-camera @changed="revision++"/>
  <section v-else-if="tab==='cameras'" class="su-card su-embedded"><CctvView :key="id" :locked-facility="id" settings-only/></section>
  <section v-else-if="tab==='thresholds'" class="su-card"><div class="su-line"><h2>시설 임계치</h2><span class="su-badge">담당 시설 설정</span></div><p v-if="thresholdError" class="su-error">{{ thresholdError }}</p><div class="su-table-wrap"><table><thead><tr><th>등급</th><th>시작 점수</th><th>갱신 시각</th><th>변경</th></tr></thead><tbody><tr v-for="t in thresholds" :key="t.level"><td>{{ label(t.level) }}</td><td>{{ formatDecimal(t.riskScoreMin) }}점</td><td>{{ dateLabel(t.updatedAt||'') }}</td><td><div class="threshold-edit"><input v-model="edits[t.level]" type="number" min="0" max="100" step="0.01" :aria-label="label(t.level)+' 임계치'"><button :disabled="thresholdBusy||loading" @click="saveThreshold(t)">저장</button></div></td></tr><tr v-if="!thresholds.length"><td colspan="4">{{ loading?'조회 중':thresholdError?'임계치 조회 실패':'자료 없음' }}</td></tr></tbody></table></div><p role="status">{{ thresholdMessage }}</p></section>
  <template v-else><div class="su-line rw-section"><p>선택 시설 기준 기록</p><router-link class="su-button" :to="{path:'/regional/logs',query:{facility:id}}">통합 로그에서 보기</router-link></div><UnifiedLogPanel :key="id+revision" :facility-id="id"/></template>
 </template>
 <section v-else class="su-card"><h1>시설 확인</h1><p>{{ state.loading?'시설 확인 중…':'담당 시설을 찾을 수 없습니다. 목록을 다시 확인해 주세요.' }}</p><router-link to="/regional/facilities">시설 목록</router-link></section>
</div></template>

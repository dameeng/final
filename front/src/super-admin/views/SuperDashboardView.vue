<script setup lang="ts">
import { formatDecimal } from '../../shared/utils/format-number'

import { computed, inject, ref, watch, onMounted } from 'vue'
import { adminKey } from '../../shared/admin/main'
import { adminApi } from '../../shared/admin/services/admin-api'
import { normalizeRegion, regionNames } from '../../shared/admin/utils/region-risk'
import { useSuperData, superDashboardStatus, eventLabels, regionOf, unassigned, timeLabel } from '../services/super-dashboard'
import SuperNationPanel from '../components/SuperNationPanel.vue'
import SuperManagementPanels from '../components/SuperManagementPanels.vue'
const {state,refresh}=inject(adminKey)!
const data=useSuperData()
const {regions,managers,pending,alerts,errors,ready,complete,loading,sampling,samples,updated,pendingCount,activeCount}=data
const region=ref('ALL'),period=ref('24'),eventFilter=ref('ALL'),metric=ref('avg'),tableMode=ref(false),sort=ref('margin')
const eventHours=ref('24'),statsPeriod=ref('24')
const regionOptions=computed(()=>[...new Set<string>([...regionNames,...state.underpasses.map(regionOf)])])
const facilities=computed(()=>state.underpasses.filter(i=>region.value==='ALL'||regionOf(i)===region.value))
const countsReady=computed(()=>state.loaded&&!state.error)
const end=computed(()=>Date.parse(state.lastUpdated||'')||Date.now())
const start=computed(()=>end.value-Number(period.value)*3600000)
const inPeriod=(value:string)=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=end.value-Number(statsPeriod.value)*3600000&&Date.parse(value)<=end.value
const covered=computed(()=>facilities.value.filter(i=>samples.value[i.id]))
const coverage=computed(()=>`${covered.value.length} / ${facilities.value.length}개 시설 조회`)
const eventCoverage=computed(()=>facilities.value.filter(i=>samples.value[i.id]?.events!=null).length)
const recordUpdated=computed(()=>covered.value.map(f=>samples.value[f.id]?.updatedAt).filter(Boolean).sort().at(-1))
const scope=computed(()=>`${region.value==='ALL'?'전국':region.value} · ${coverage.value} · 위험 기록 요청 범위 최근 24시간`)
const loadedEvents=computed(()=>facilities.value.flatMap(f=>(samples.value[f.id]?.events||[]).filter(e=>e.kind==='EVENT'&&inPeriod(e.createdAt)).map((e,index)=>({...e,facility:f,key:`${f.id}-${e.createdAt}-${index}`}))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)))
const visibleEvents=computed(()=>facilities.value.flatMap(f=>(samples.value[f.id]?.events||[]).filter(e=>e.kind==='EVENT'&&Date.parse(e.createdAt)>=end.value-Number(eventHours.value)*3600000&&Date.parse(e.createdAt)<=end.value).map((e,index)=>({...e,facility:f,key:`${f.id}-${e.createdAt}-${index}`}))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).filter(e=>eventFilter.value==='ALL'||(eventFilter.value==='CONTROL'?['BLOCK','RELEASE'].includes(e.eventType||''):e.eventType?.startsWith('RISK_LEVEL'))))
const nearRows=computed(()=>facilities.value.flatMap(f=>{
 const sample=samples.value[f.id];const threshold=sample?.thresholds?.find(t=>t.level==='DANGER')?.riskScoreMin
 const latest=sample?.risks?.filter(r=>r.riskScore!=null&&Number.isFinite(Number(r.riskScore))).sort((a,b)=>Date.parse(b.predictedAt)-Date.parse(a.predictedAt))[0]
 const score=latest?.riskScore??f.riskScore
 if(threshold==null||!Number.isFinite(threshold)||threshold<=0||score==null||!Number.isFinite(score))return []
 return [{f,score,threshold,margin:threshold-score,sample,at:latest?.predictedAt||f.observedUpdatedAt}]
}).sort((a,b)=>a.margin-b.margin))
const thresholdRows=computed(()=>facilities.value.filter(f=>samples.value[f.id]).map(f=>{
 const s=samples.value[f.id];const near=nearRows.value.find(x=>x.f.id===f.id)
 return {f,s,warning:s.thresholds?.find(t=>t.level==='WARNING'),danger:s.thresholds?.find(t=>t.level==='DANGER'),score:near?.score,margin:near?.margin}
}).sort((a,b)=>sort.value==='name'?a.f.name.localeCompare(b.f.name,'ko'):sort.value==='score'?(b.score??-Infinity)-(a.score??-Infinity):(a.margin??Infinity)-(b.margin??Infinity)))

// 카드/통제·알림·관리자 통계는 프론트 샘플링(시설당 최대 24건 조회) 대신 백엔드 집계 엔드포인트를 쓴다.
// region 필터는 지역명 문자열이라 regions(id/name) 목록에서 선택된 지역의 id를 찾아 넘긴다. 못 찾으면 전체(null)로 조회.
type FacilityKpi = { facilityCount:number; blockedCount:number; pendingReviewCount:number; remainingCount:number; alertsToday:number; dangerLevelCount:number; nearDangerCount:number }
type RegionRiskLevel = { regionId:number; regionName:string; safeCount:number; warningCount:number; dangerCount:number; totalCount:number }
type ControlStats = { blockCount:number; releaseCount:number; totalDurationMinutes:number|null; avgDurationMinutes:number|null }
type AlertStats = { totalCount:number; predictiveCount:number; roiFinalCount:number }
type ManagerActivity = { managerId:number; managerName:string; blockCount:number; releaseCount:number; displayLogCount:number; totalCount:number }
const selectedRegionId=computed<number|null>(()=>{
  if(region.value==='ALL') return null
  const match=(regions.value as {id:number;name:string}[]).find(r=>normalizeRegion(r.name)===region.value)
  return match?match.id:null
})
const statsDays=computed(()=>statsPeriod.value==='24'?1:statsPeriod.value==='168'?7:30)
const kpi=ref<FacilityKpi|null>(null)
const riskLevelRows=ref<RegionRiskLevel[]>([])
const controlStats=ref<ControlStats|null>(null)
const alertStats=ref<AlertStats|null>(null)
const managerActivity=ref<ManagerActivity[]>([])
const dangerCount=computed(()=>riskLevelRows.value.reduce((sum,r)=>sum+r.dangerCount,0))
async function loadSummary(){
  const regionId=selectedRegionId.value
  const days=statsDays.value
  const rq=regionId!=null?`regionId=${regionId}`:''
  const join=(...parts:string[])=>{const qs=parts.filter(Boolean).join('&');return qs?`?${qs}`:''}
  const results=await Promise.allSettled([
    adminApi<FacilityKpi>(`/dashboard/facility-kpi${join(rq)}`),
    adminApi<RegionRiskLevel[]>(`/dashboard/region-risk-level${join(rq)}`),
    adminApi<ControlStats>(`/dashboard/control-stats${join(rq,`days=${days}`)}`),
    adminApi<AlertStats>(`/dashboard/alert-stats${join(rq,`days=${days}`)}`),
    adminApi<ManagerActivity[]>(`/dashboard/manager-activity${join(rq,`days=${days}`)}`),
  ])
  const [kpiResult,riskResult,controlResult,alertResult,managerResult]=results
  if(kpiResult.status==='fulfilled'&&kpiResult.value) kpi.value=kpiResult.value
  if(riskResult.status==='fulfilled'&&Array.isArray(riskResult.value)) riskLevelRows.value=riskResult.value
  if(controlResult.status==='fulfilled'&&controlResult.value) controlStats.value=controlResult.value
  if(alertResult.status==='fulfilled'&&alertResult.value) alertStats.value=alertResult.value
  if(managerResult.status==='fulfilled'&&Array.isArray(managerResult.value)) managerActivity.value=managerResult.value
}
watch([selectedRegionId,statsDays,()=>state.lastUpdated],()=>void loadSummary(),{immediate:true})
function managerStat(managerId:number,field:'blockCount'|'releaseCount'){
  const row=managerActivity.value.find(m=>m.managerId===managerId)
  return row?row[field]:null
}

// "지역별 위험도 추이" 차트: risk-trend는 일 단위로만 집계해주므로(시간별 집계는 없음),
// 24시간 보기는 기존처럼 시설 표본에서 직접 계산하고, 7일/30일 보기만 지역별로 risk-trend를
// 병렬 조회해서 그린다. regionId를 못 찾는 그룹(예: 미배정)은 그 지역만 표본 계산으로 폴백.
type RiskTrendPoint = { trendDate:string; avgRiskScore:number; maxRiskScore:number }
const trendDays=computed(()=>period.value==='24'?null:period.value==='168'?7:30)
const regionTrend=ref<Record<string,RiskTrendPoint[]>>({})
async function loadRegionTrends(){
  const days=trendDays.value
  if(days==null){ regionTrend.value={}; return }
  const groupNames=[...new Set(facilities.value.map(regionOf))]
  const settled=await Promise.allSettled(groupNames.map(async name=>{
    const match=(regions.value as {id:number;name:string}[]).find(r=>normalizeRegion(r.name)===name)
    if(!match) throw new Error('지역 id 없음')
    return [name,await adminApi<RiskTrendPoint[]>(`/dashboard/risk-trend?regionId=${match.id}&days=${days}`)] as const
  }))
  const next:Record<string,RiskTrendPoint[]>={}
  settled.forEach(r=>{ if(r.status==='fulfilled') next[r.value[0]]=r.value[1] })
  regionTrend.value=next
}
watch([trendDays,()=>facilities.value.map(regionOf).join('|'),()=>state.lastUpdated],()=>void loadRegionTrends(),{immediate:true})
function regionTrendValues(rows:RiskTrendPoint[]|undefined,n:number,step:number){
  if(!rows) return null
  return Array.from({length:n},(_,bucket)=>{
    const row=rows.find(r=>{const t=Date.parse(r.trendDate);return Number.isFinite(t)&&t>=start.value+bucket*step&&t<start.value+(bucket+1)*step})
    return row?Number(metric.value==='max'?row.maxRiskScore:row.avgRiskScore):null
  })
}

const cards=computed(()=>[
 {label:'관리 시설',value:countsReady.value?(kpi.value?.facilityCount??facilities.value.length):null,note:'현재 · 선택 지역',tone:'neutral'},
 {label:'통제 중',value:countsReady.value?(kpi.value?.blockedCount??facilities.value.filter(i=>i.controlState==='BLOCKED').length):null,note:'현재 · 통제 여부 별도',tone:'blocked'},
 {label:'위험 단계',value:countsReady.value?(riskLevelRows.value.length?dangerCount.value:facilities.value.filter(i=>i.observedRiskLevel==='DANGER').length):null,note:'현재 · 수신 위험 등급',tone:'danger'},
 {label:'위험 임박',value:kpi.value?kpi.value.nearDangerCount:null,note:'DANGER 임계치 근접(초과 제외)',tone:'warning'},
 {label:'가입 승인 대기',value:pendingCount.value,note:'현재 · 전국',tone:'neutral'},
 {label:'활성 관리자',value:activeCount.value,note:'현재 · 전국 ACTIVE 계정',tone:'neutral'},
 {label:'미배정 시설',value:countsReady.value?state.underpasses.filter(unassigned).length:null,note:'현재 · 전국',tone:'neutral'},
])
const blockStats=computed(()=>{
 const blocks=loadedEvents.value.filter(e=>e.eventType==='BLOCK');let duration=0,finished=0
 for(const f of facilities.value){let opened:string|null=null
 const records=[...(samples.value[f.id]?.events||[])].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
 for(const e of records){if(e.eventType==='BLOCK'){if(!opened)opened=e.createdAt}else if(e.eventType==='RELEASE'&&opened){if(inPeriod(opened)&&Date.parse(e.createdAt)<=end.value){duration+=Math.max(0,Date.parse(e.createdAt)-Date.parse(opened));finished++}opened=null}}
 }
 return {count:blocks.length,finished,average:finished?duration/finished/60000:null}
})
const filteredAlerts=computed(()=>alerts.value.filter(a=>inPeriod(a.sentAt)&&(region.value==='ALL'||facilities.value.some(f=>f.id===String(a.underpassId)))))
const activity=computed(()=>managers.value.filter(m=>region.value==='ALL'||normalizeRegion(m.regionName||'미배정')===region.value).map(m=>({m,block:loadedEvents.value.filter(e=>e.operatorId===m.id&&e.eventType==='BLOCK').length,release:loadedEvents.value.filter(e=>e.operatorId===m.id&&e.eventType==='RELEASE').length})))
const chart=computed(()=>{
 const n=period.value==='24'?24:period.value==='168'?7:30
 const step=(end.value-start.value)/n
 const groupNames=[...new Set(facilities.value.map(regionOf))]
 return {n,series:groupNames.map((name,index)=>{
  const backendRows=regionTrend.value[name]
  const values=backendRows?regionTrendValues(backendRows,n,step)!:Array.from({length:n},(_,bucket)=>{
   const fs=facilities.value.filter(f=>regionOf(f)===name)
   const vals=fs.flatMap(f=>{const p=(samples.value[f.id]?.risks||[]).filter(r=>r.riskScore!=null&&Number.isFinite(Number(r.riskScore))&&Date.parse(r.predictedAt)>=start.value+bucket*step&&Date.parse(r.predictedAt)<start.value+(bucket+1)*step).sort((a,b)=>Date.parse(b.predictedAt)-Date.parse(a.predictedAt))[0];return p?[Number(p.riskScore)]:[]})
   return vals.length?metric.value==='max'?Math.max(...vals):vals.reduce((a,b)=>a+b,0)/vals.length:null
  })
  const segments:string[]=[];let segment:string[]=[]
  values.forEach((v,i)=>{if(v==null){if(segment.length)segments.push(segment.join(' '));segment=[]}else segment.push(`${36+i*520/(n-1)},${170-Math.min(100,Math.max(0,v))*1.5}`)})
  if(segment.length)segments.push(segment.join(' '))
  return {name,values,segments,color:['#729db5','#b390ad','#94ad83','#c5a26e','#9a9fc6','#77aaa2'][index%6],fromServer:!!backendRows}
 })}
})
const chartHasData=computed(()=>chart.value.series.some(s=>s.values.some(v=>v!=null)))
const alertTotal=computed(()=>filteredAlerts.value.length)
const alertStatsTotal=computed(()=>alertStats.value?alertStats.value.totalCount:alertTotal.value)
function alertStatCount(type:string){
  if(alertStats.value) return type==='PREDICTIVE'?alertStats.value.predictiveCount:alertStats.value.roiFinalCount
  return filteredAlerts.value.filter(a=>a.alertType===type).length
}
function alertStatPercent(type:string){
  const total=alertStatsTotal.value
  return total?alertStatCount(type)/total*100:0
}
async function refreshPanels(){await data.load();await data.loadSamples(facilities.value,true);await loadSummary()}
async function afterMutation(){await refresh();await data.load();await loadSummary()}
watch(()=>superDashboardStatus.refreshVersion,()=>void refreshPanels())
onMounted(()=>{void data.load()})
watch(()=>facilities.value.map(item=>item.id).join('|'),()=>{void data.loadSamples(facilities.value)},{immediate:true})
function selectFacility(id:string){state.selectedId=id}
</script>
<template>
<div class="super-dashboard">
 <div class="super-heading"><div><p>전국 시설 및 관리자 운영 현황</p><h1>종합 현황</h1></div><div class="super-filters"><label>지역<select v-model="region"><option value="ALL">전체 지역</option><option v-for="r in regionOptions" :key="r" :value="r">{{ r }}</option></select></label></div></div>
 
 <div class="super-kpis"><section v-for="c in cards" :key="c.label" class="super-kpi" :data-tone="c.tone"><h2>{{ c.label }}</h2><strong>{{ c.value??'—' }}</strong><small>{{ c.note }}</small></section></div>
 <p v-if="state.error&&state.lastUpdated" class="super-error">이전 수신 자료 · {{ timeLabel(state.lastUpdated) }}. 현재 시설 수와 위험 비율은 갱신 성공 후 표시합니다.</p>
 <div class="super-main-grid">
  <aside class="super-stack super-left-column">
   <section class="super-panel"><div class="super-panel-head"><h2>전국 이벤트 타임라인</h2><div class="super-timeline-actions"><router-link to="/logs">이력 조회</router-link><button :disabled="sampling" @click="data.loadSamples(facilities,true)">새로고침</button></div></div><div class="review-period" role="group" aria-label="이벤트 기간"><button v-for="h in [24,168,720]" :key="h" :aria-pressed="eventHours===String(h)" @click="eventHours=String(h)">{{ h===24?'24시간':h===168?'7일':'30일' }}</button></div><div class="super-tabs" role="group" aria-label="이벤트 유형"><button v-for="f in [['ALL','전체'],['CONTROL','통제·해제'],['RISK','위험도 변화']]" :key="f[0]" :aria-pressed="eventFilter===f[0]" @click="eventFilter=f[0]">{{ f[1] }}</button></div>
    <div class="super-timeline super-scroll"><article v-for="e in visibleEvents" :key="e.key"><router-link :to="`/facilities/${e.facility.id}`" @click="selectFacility(e.facility.id)"><span class="super-event-type" :data-type="e.eventType">{{ eventLabels[e.eventType||'']||e.eventType }}</span><strong>{{ e.facility.name }}</strong></router-link><p>{{ regionOf(e.facility) }}<template v-if="e.riskScoreAtEvent!=null"> · {{ formatDecimal(e.riskScoreAtEvent) }}점</template><template v-if="e.operatorId!=null"> · 관리자 #{{ e.operatorId }}</template></p><time>{{ timeLabel(e.createdAt) }}</time></article><p v-if="!visibleEvents.length" class="super-empty">{{ sampling?'기록 조회 중':!eventCoverage&&facilities.length?'이벤트 연결 확인 필요':'조회 범위 내 기간 기록 없음' }}</p></div></section>
   <section class="super-panel"><h2>통제 통계</h2><label class="review-local-period">집계 기간<select v-model="statsPeriod"><option value="24">24시간</option><option value="168">7일</option><option value="720">30일</option></select></label><p class="super-note">{{ controlStats?'선택 지역 전체 집계':`조회된 ${eventCoverage}개 시설 기준` }}</p><div class="super-stat-pair"><div><strong>{{ controlStats?controlStats.blockCount:(eventCoverage?blockStats.count:'—') }}</strong><span>통제 기록</span></div><div><strong>{{ controlStats?(controlStats.avgDurationMinutes==null?'—':controlStats.avgDurationMinutes.toFixed(1)):(blockStats.average==null?'—':blockStats.average.toFixed(1)) }}</strong><span>평균 지속(분)</span></div></div></section>
   <section class="super-panel"><div class="super-panel-head"><h2>알림 발송 통계 · {{ statsDays }}일</h2><router-link to="/push-logs">기록 조회</router-link></div><p class="super-note">{{ alertStats?'서버 집계(선택 기간·지역)':(complete.alerts?'전체 수신 기록':'최근 최대 100건 표본') }} 중 선택 기간·지역 · {{ timeLabel(updated.alerts) }}</p><p v-if="errors.alerts&&!alertStats" class="super-error" role="alert">조회 실패 · {{ errors.alerts }}</p><template v-else-if="alertStats||ready.alerts"><div v-for="a in [['PREDICTIVE','접근 예측'],['ROI_FINAL','진입 직전 최종']]" :key="a[0]" class="super-alert-stat"><span>{{ a[1] }}</span><strong>{{ alertStatCount(a[0]) }}건</strong><div class="super-mini-track"><i :style="{width:`${alertStatPercent(a[0])}%`}"></i></div></div><p v-if="!alertStatsTotal" class="super-empty">조회 범위 내 알림 없음</p></template><p v-else class="super-empty">{{ loading?'알림 조회 중':'자료 없음' }}</p></section>
  </aside>
  <div class="super-stack super-analysis-column">
   <SuperNationPanel :items="state.underpasses" :selected="region" :ready="state.loaded" :error="state.error" @select="region=$event" />
   <div class="super-analysis-row">
    <section class="super-panel"><div class="super-panel-head"><h2>지역별 위험도 추이</h2><button :aria-pressed="tableMode" @click="tableMode=!tableMode">{{ tableMode?'그래프로 보기':'표로 보기' }}</button></div><div class="review-period" role="group" aria-label="위험도 추이 기간"><button v-for="h in [24,168,720]" :key="h" :aria-pressed="period===String(h)" @click="period=String(h)">{{ h===24?'24시간':h===168?'7일':'30일' }}</button></div><div class="super-tabs" role="group" aria-label="이벤트 유형"><button :aria-pressed="metric==='avg'" @click="metric='avg'">평균</button><button :aria-pressed="metric==='max'" @click="metric='max'">최대</button></div><div class="super-legend"><span v-for="s in chart.series" :key="s.name"><i :style="{background:s.color}"></i>{{ s.name }}</span></div>
     <div v-if="tableMode" class="super-table-scroll" tabindex="0" aria-label="지역별 위험도 표"><table><thead><tr><th>구간</th><th v-for="s in chart.series" :key="s.name">{{ s.name }}</th></tr></thead><tbody><tr v-for="n in chart.n" :key="n"><td>{{ timeLabel(new Date(start+(n-1)*(end-start)/chart.n).toISOString()) }}</td><td v-for="s in chart.series" :key="s.name">{{ formatDecimal(s.values[n-1]) }}</td></tr></tbody></table></div>
     <svg v-else-if="chartHasData" class="super-trend" viewBox="0 0 600 205" role="img" aria-label="조회된 시설 기준 지역 위험 점수 추이, 0에서 100점"><g v-for="n in [0,25,50,75,100]" :key="n"><line x1="36" x2="556" :y1="170-n*1.5" :y2="170-n*1.5"/><text x="3" :y="174-n*1.5">{{ n }}</text></g><g v-for="s in chart.series" :key="s.name"><polyline v-for="(points,i) in s.segments" :key="i" :points="points" :stroke="s.color"/><template v-for="(v,i) in s.values" :key="i"><circle v-if="v!=null" :cx="36+i*520/(chart.n-1)" :cy="170-Math.min(100,Math.max(0,v))*1.5" r="3" :fill="s.color"><title>{{ s.name }} · {{ timeLabel(new Date(start+i*(end-start)/chart.n).toISOString()) }} · {{ formatDecimal(v) }}점</title></circle></template></g><text x="36" y="197">기간 시작</text><text x="516" y="197">마지막 수신</text></svg>
     <p v-else class="super-empty">{{ sampling?'관측 기록 조회 중':'조회된 기간의 유효한 위험도 기록 없음' }}</p><p class="super-note">{{ timeLabel(new Date(start).toISOString()) }} ~ {{ timeLabel(new Date(end).toISOString()) }}</p>
    </section>
    <section class="super-panel"><div class="super-panel-head"><h2>지역 현황</h2><router-link to="/facility-manage">관리</router-link></div><p class="super-note">선택 지역 현재 기준 · {{ timeLabel(state.lastUpdated) }}</p><div class="super-region-summary"><div><span>시설</span><strong>{{ countsReady?facilities.length:'—' }}곳</strong></div><div><span>통제 정보 없음</span><strong>{{ countsReady?facilities.filter(f=>f.controlState==='UNKNOWN').length:'—' }}곳</strong></div><div><span>위험 정보 없음</span><strong>{{ countsReady?facilities.filter(f=>f.observedRiskLevel==='UNKNOWN').length:'—' }}곳</strong></div></div><div class="super-scroll super-facility-links"><router-link v-for="f in facilities" :key="f.id" :to="`/facilities/${f.id}`" @click="selectFacility(f.id)">{{ f.name }}<small><span class="review-status">{{ regionOf(f) }}</span><span class="review-status" :data-status="f.controlState">{{ f.controlState==='BLOCKED'?'통제 중':f.controlState==='OPEN'?'통행 가능':'—' }}</span></small></router-link></div></section>
   </div>
   <div class="super-threshold-row">
    <section class="super-panel"><h2>위험 임박 TOP</h2><div class="super-top-list"><article v-for="r in nearRows.slice(0,8)" :key="r.f.id"><router-link :to="`/facilities/${r.f.id}`">{{ r.f.name }}</router-link><p>{{ formatDecimal(r.score) }} / {{ formatDecimal(r.threshold) }}점 · <strong>{{ r.margin<=0?`도달·초과 ${formatDecimal(-r.margin)}`:`여유 ${formatDecimal(r.margin)}` }}점</strong></p><div class="super-mini-track"><i :style="{width:`${Math.max(0,Math.min(100,r.score/r.threshold*100))}%`}"></i></div><small>{{ timeLabel(r.at) }}</small></article><p v-if="!nearRows.length" class="super-empty">{{ sampling?'조회 중':'점수·자료 없음 또는 조회 결과 없음' }}</p></div></section>
    <section class="super-panel"><div class="super-panel-head"><h2>임계치 현황</h2><router-link to="/thresholds">임계치 설정</router-link></div><label class="super-sort">정렬<select v-model="sort"><option value="margin">위험까지 여유</option><option value="score">현재 점수</option><option value="name">시설명</option></select></label><div class="super-table-scroll" tabindex="0" aria-label="시설 임계치 표"><table><thead><tr><th>시설·지역</th><th>주의</th><th>위험</th><th>현재</th><th>위험까지</th><th>최근 변경</th></tr></thead><tbody><tr v-for="r in thresholdRows" :key="r.f.id"><td>{{ r.f.name }}<small>{{ regionOf(r.f) }}</small><small v-if="r.s.errors.length">조회 실패: {{ r.s.errors.join(', ') }}</small></td><td>{{ formatDecimal(r.warning?.riskScoreMin) }}</td><td>{{ formatDecimal(r.danger?.riskScoreMin) }}</td><td>{{ formatDecimal(r.score) }}</td><td>{{ r.margin==null?'—':r.margin<=0?`도달·초과 ${formatDecimal(-r.margin)}`:formatDecimal(r.margin) }}</td><td>{{ timeLabel([r.warning?.updatedAt,r.danger?.updatedAt].filter(Boolean).sort().at(-1)) }}</td></tr><tr v-if="!thresholdRows.length"><td colspan="6">{{ sampling?'조회 중':'시설 기록을 조회해 주세요.' }}</td></tr></tbody></table></div></section>
   </div>
 <div class="super-bottom-grid">
  <SuperManagementPanels :facilities="state.underpasses" :managers="managers" :pending="pending" :regions="regions" :errors="errors" :ready="ready" :complete="complete" :facility-error="state.error" :loading="loading" @changed="afterMutation" />
  <section class="super-panel"><div class="super-panel-head"><h2>관리자 활동 · {{ statsDays }}일</h2><router-link to="/permissions">관리자 권한</router-link></div><p v-if="errors.managers" class="super-error" role="alert">{{ errors.managers }}</p><div class="super-table-scroll" tabindex="0" aria-label="관리자 활동 표"><table><thead><tr><th>담당자</th><th>지역</th><th>통제</th><th>해제</th></tr></thead><tbody><tr v-for="r in activity" :key="r.m.id"><td>{{ r.m.name }}</td><td>{{ r.m.regionName||'미배정' }}</td><td>{{ managerActivity.length?(managerStat(r.m.id,'blockCount')??0):(eventCoverage&&!errors.managers?r.block:'—') }}</td><td>{{ managerActivity.length?(managerStat(r.m.id,'releaseCount')??0):(eventCoverage&&!errors.managers?r.release:'—') }}</td></tr><tr v-if="!activity.length"><td colspan="4">{{ loading?'조회 중':errors.managers?'조회 실패':'조회된 관리자 없음' }}</td></tr></tbody></table></div></section>
 </div>
  </div>
 </div>
</div>
</template>

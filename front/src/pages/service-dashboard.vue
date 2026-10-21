<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue'
import {useRoute} from 'vue-router'
import {useBackendEvents} from '../composables/useBackendEvents'
import {useApp} from '../stores/app'
import BackendLayout from '../components/BackendLayout.vue'
import PmTop5Widget from '../components/PmTop5Widget.vue'
import LiveMap from './c-live-map.vue'
import {backend} from '../services/backend'
import {valueLabels} from '../data/backendResources'
import {displayDate} from '../utils/display-date'
import '../styles/admin-dashboard.css'
import '../styles/dashboard-fixed.css'
const route=useRoute(),app=useApp()
const appLink=(web:string,mobile:string)=>route.path.startsWith('/admin-app/')?mobile:web
const region=computed(()=>app.account?.regions?.map(item=>item.name).join(' · ')||'담당 지역')
const summary=ref<Record<string,number>|null>(null),events=ref<any[]>([]),margins=ref<any[]>([]),error=ref(''),loading=ref(false),controller=new AbortController()
const dashboardPaths=['facility-kpi','timeline?limit=30','risk-margin?limit=5']
const pendingLoads=new Set<number>();let liveTimer:ReturnType<typeof setTimeout>|undefined
function scrollEvents(event:WheelEvent){
 if(event.ctrlKey||event.metaKey||!event.deltaY)return
 const root=event.currentTarget as HTMLElement,list=root.querySelector<HTMLElement>('.tl')
 let remaining=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1)
 const scroll=(element:Element)=>{const before=element.scrollTop;element.scrollTop+=remaining;remaining-=element.scrollTop-before}
 if(list&&event.target instanceof Node&&list.contains(event.target))scroll(list)
 let ancestor=root.parentElement
 while(ancestor&&Math.abs(remaining)>.5){if(/auto|scroll/.test(getComputedStyle(ancestor).overflowY))scroll(ancestor);ancestor=ancestor.parentElement}
 if(Math.abs(remaining)>.5&&document.scrollingElement)scroll(document.scrollingElement)
 event.preventDefault()
}
async function load(requested?:unknown){const parts=Array.isArray(requested)?requested:[0,1,2];if(loading.value){parts.forEach(key=>pendingLoads.add(key));return}loading.value=true;error.value='';const results=await Promise.allSettled(parts.map(key=>backend('/api/dashboard/'+dashboardPaths[key],{signal:controller.signal})));if(controller.signal.aborted)return;results.forEach((result,index)=>{const key=parts[index];if(result.status==='fulfilled'){if(key===0)summary.value=result.value;else if(key===1)events.value=Array.isArray(result.value)?result.value:[];else margins.value=Array.isArray(result.value)?result.value:[]}else error.value=result.reason.message});loading.value=false;if(pendingLoads.size){const next=[...pendingLoads];pendingLoads.clear();void load(next)}}
function queueDashboard(parts:number[]){parts.forEach(key=>pendingLoads.add(key));clearTimeout(liveTimer);liveTimer=setTimeout(()=>{const keys=[...pendingLoads];pendingLoads.clear();if(!controller.signal.aborted)void load(keys)},200)}
useBackendEvents(({name,data})=>{
 if(name==='risk-update'){margins.value=margins.value.map(row=>{if(String(row.underpassId)!==String(data.underpassId)||typeof data.riskScore!=='number')return row;const delta=data.riskScore-Number(row.riskScore);return {...row,riskScore:data.riskScore,margin:typeof row.margin==='number'?row.margin-delta:row.margin}});return}
 if(name==='connected'||name==='control-change')queueDashboard([0,1,2])
 else if(name==='risk-level-change')queueDashboard([0,2])
 else if(name==='transit-update'||name.startsWith('plate-queue-'))queueDashboard([0])
 else if(name==='data-changed'&&['underpass','threshold'].includes(data.resource))queueDashboard([0,2])
})
onMounted(load);onBeforeUnmount(()=>{clearTimeout(liveTimer);controller.abort()})
</script>
<template><BackendLayout class="page-admin-dashboard"><section class="restored-dashboard service-workspace"><div class="crumb">종합 현황</div><div class="page-head service-heading"><h1>종합 현황</h1><button class="btn sm" :disabled="loading" @click="load">새로고침</button></div><p v-if="error" class="service-error" role="alert">{{error}}</p><div id="grid" class="dashboard-fixed-layout">
<div class="dashboard-fixed-item fixed-summary"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" aria-label="지하차도 현황"><div class="wg-head"><h2>지하차도 현황</h2><RouterLink :to="appLink('/fac-list','/admin-app/screen-4')">전체 보기 →</RouterLink></div><div class="tiles5"><div class="tile" v-for="[key,label] in [['facilityCount','담당 시설'],['blockedCount','통제 중'],['dangerLevelCount','위험'],['pendingReviewCount','판별 대기'],['remainingCount','잔류 차량']]" :key="key"><small>{{label}}</small><strong class="big">{{summary?.[key!]??'—'}}</strong></div></div></section></div></div>
<div class="dashboard-fixed-item fixed-map"><div class="dashboard-fixed-content"><section class="card map-w widget-original-content" aria-label="지하차도 지도"><div class="map-top"><h2>{{region}} 지하차도 지도</h2></div><LiveMap manager @control-changed="load"/></section></div></div>
<div class="dashboard-fixed-item fixed-events" @wheel="scrollEvents"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" aria-label="최근 이벤트"><div class="wg-head"><h2>최근 이벤트</h2><RouterLink to="/admin-reports?report=timeline">로그 전체 보기</RouterLink></div><p v-if="!events.length">표시할 이벤트가 없습니다.</p><ol class="tl" tabindex="0" aria-label="최근 이벤트 목록"><li v-for="(event,index) in events" :key="index"><time :datetime="event.createdAt">{{displayDate(event.createdAt)}}</time><div><span class="cat">{{valueLabels[event.eventType]||event.eventType||'이벤트'}}</span><strong>{{event.underpassName}}</strong><small>{{event.reason||valueLabels[event.riskLevel]||event.riskLevel}}</small></div></li></ol></section></div></div>
<div class="dashboard-bottom"><div class="dashboard-fixed-item fixed-top5"><div class="dashboard-fixed-content"><section class="card wg widget-original-content" aria-label="위험 임박 Top5"><div class="wg-head"><h2>위험 임박 Top5</h2><RouterLink to="/admin-reports?report=margin">전체 보기</RouterLink></div><p v-if="!margins.length">위험 임박 시설이 없습니다.</p><ol class="rank"><li v-for="(facility,index) in margins" :key="facility.underpassId"><span class="n">{{index+1}}</span><RouterLink class="t" :to="'/fac-detail?id='+facility.underpassId">{{facility.underpassName}}<small>위험 임계치까지 {{facility.margin}}점</small></RouterLink><span class="sc">{{facility.riskScore}}</span></li></ol></section></div></div>
<div class="dashboard-fixed-item fixed-todo"><div class="dashboard-fixed-content"><PmTop5Widget/></div></div>
<div class="dashboard-fixed-item fixed-verify"><div class="dashboard-fixed-content"><section class="card wg widget-original-content"><div class="wg-head"><h2>수동 판별 대기</h2><RouterLink :to="appLink('/verify','/admin-app/screen-4')">판별하러 가기</RouterLink></div><div class="fill"><div><strong class="big">{{summary?.pendingReviewCount??'—'}}</strong> 건 대기 중</div></div></section></div></div>
<div class="dashboard-fixed-item fixed-health"><div class="dashboard-fixed-content"><section class="card wg widget-original-content"><div class="wg-head"><h2>오늘 알림</h2><RouterLink to="/notifications">알림 내역</RouterLink></div><div class="fill"><div><strong class="big">{{summary?.alertsToday??'—'}}</strong> 건 발송</div></div></section></div></div></div>
</div></section></BackendLayout></template>

<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue'
import LiveMap from './c-live-map.vue'
import {backend} from '../services/backend'
const summary=ref<any>(),levels=ref<any[]|null>(null),error=ref(''),loading=ref(false),controller=new AbortController()
const count=(key:string)=>levels.value?levels.value.reduce((sum,row)=>sum+Number(row[key]||0),0):'—'
const blocked=computed(()=>summary.value?.blockedCount??'—')
async function load(){loading.value=true;error.value='';const results=await Promise.allSettled([backend('/api/dashboard/facility-kpi',{signal:controller.signal}),backend('/api/dashboard/region-risk-level',{signal:controller.signal})]);if(controller.signal.aborted)return;results.forEach((r,i)=>{if(r.status==='fulfilled'){if(i===0)summary.value=r.value;else levels.value=Array.isArray(r.value)?r.value:[]}else error.value=r.reason.message});loading.value=false}
onMounted(load);onBeforeUnmount(()=>controller.abort())
</script>
<template><section class="app-overview"><p v-if="error" role="alert">{{error}}</p><div v-if="summary?.blockedCount>0" class="ban">{{summary.blockedCount}}곳 통제 중 · 현황을 확인하세요.</div><div class="kv"><div><small>안전</small><b>{{count('safeCount')}}</b></div><div><small>주의</small><b>{{count('warningCount')}}</b></div><div><small>위험</small><b>{{count('dangerCount')}}</b></div><div><small>통제 중</small><b>{{blocked}}</b></div></div><LiveMap manager map-only/><RouterLink class="card" to="/admin-app/screen-4"><b>담당 시설 {{summary?.facilityCount??'—'}}곳</b><small>통제 상태 확인 ›</small></RouterLink><RouterLink class="card" to="/admin-app/screen-9"><b>예지보전</b><small>설비·점검 대상 확인 ›</small></RouterLink><RouterLink class="card" to="/admin-app/screen-13"><b>오늘 알림 {{summary?.alertsToday??'—'}}건</b><small>알림 내역 ›</small></RouterLink><button type="button" :disabled="loading" @click="load">새로고침</button></section></template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { asPage, backend, queryString } from '../services/backend'
import { displayDate } from '../utils/display-date'
import RiskLevelBadge from './RiskLevelBadge.vue'
const props=defineProps<{ mode:'detail'|'risk' }>()
const facilities=ref<any[]>([]), selected=ref(''), detail=ref<any>(), scores=ref<any[]>([]), page=ref(1), more=ref(false), error=ref(''), loading=ref(false)
const controller=new AbortController()
let request:AbortController|undefined
async function loadFacilities() {
  if(loading.value)return
  loading.value=true;error.value=''
  try {
    const result=asPage<any>(await backend('/api/underpasses'+queryString({page:page.value,size:10}),{signal:controller.signal}),page.value,10)
    facilities.value.push(...result.items);more.value=page.value<result.totalPages;page.value++
  } catch(cause) {if(!controller.signal.aborted)error.value=(cause as Error).message}
  finally {loading.value=false}
}
watch(selected,async id=>{
  request?.abort();detail.value=undefined;scores.value=[];error.value=''
  if(!id)return
  const current=new AbortController();request=current
  try {
    const path=`/api/underpasses/${encodeURIComponent(id)}`
    const result=await backend(props.mode==='risk'?path+'/risk-scores?hours=6&limit=100':path,{signal:current.signal})
    if(current.signal.aborted)return
    if(props.mode==='detail')detail.value=result
    else scores.value=asPage<any>(result).items.filter(row=>row.riskScore!=null&&Number.isFinite(Number(row.riskScore))&&Number.isFinite(Date.parse(row.predictedAt))).sort((a,b)=>Date.parse(a.predictedAt)-Date.parse(b.predictedAt))
  } catch(cause) {if(!current.signal.aborted)error.value=(cause as Error).message}
})
const line=computed(()=>{
  const rows=scores.value;if(!rows.length)return ''
  const first=Date.parse(rows[0].predictedAt), last=Date.parse(rows.at(-1).predictedAt)
  const max=Math.max(100,...rows.map(row=>Number(row.riskScore))), min=Math.min(0,...rows.map(row=>Number(row.riskScore)))
  return rows.map(row=>`${10+((Date.parse(row.predictedAt)-first)/(last-first||1))*280},${150-(Number(row.riskScore)-min)/(max-min)*140}`).join(' ')
})
onMounted(loadFacilities)
onBeforeUnmount(()=>{controller.abort();request?.abort()})
</script>
<template>
  <label>시설 선택<select v-model="selected" :aria-label="mode==='risk'?'위험 추이 시설':'상세 위젯 시설'"><option value="">시설 선택</option><option v-for="facility in facilities" :key="facility.id" :value="String(facility.id)">{{facility.name}}</option></select></label>
  <button v-if="more" :disabled="loading" @click="loadFacilities">시설 더 보기</button>
  <p v-if="error" role="alert">{{error}}</p>
  <template v-else-if="mode==='risk'&&scores.length"><svg viewBox="0 0 300 160" role="img" aria-label="최근 6시간 위험 점수 추이"><polyline :points="line" fill="none" stroke="#225f9b" stroke-width="2"/><circle v-for="(point,index) in line.split(' ')" :key="index" :cx="point.split(',')[0]" :cy="point.split(',')[1]" r="2" fill="#225f9b" /></svg><p>{{displayDate(scores[0].predictedAt)}} ~ {{displayDate(scores.at(-1).predictedAt)}}</p><p>최근 위험 점수 {{scores.at(-1).riskScore}}점</p></template>
  <dl v-else-if="detail"><dt>시설</dt><dd>{{detail.name}}</dd><dt>위험 단계</dt><dd><RiskLevelBadge :value="detail.currentRiskLevel" /></dd><dt>위험 점수</dt><dd>{{detail.riskScore??detail.currentRiskScore??'—'}}</dd><dt>현재 수위</dt><dd>{{detail.currentWaterCm??'—'}} cm</dd><dt>강우량</dt><dd>{{detail.rainfallMm??'—'}} mm</dd></dl>
  <p v-else>{{selected?'표시할 관측 정보가 없습니다.':'시설을 선택해 주세요.'}}</p>
  <RouterLink v-if="selected" :to="{path:'/fac-detail',query:{id:selected}}">선택 시설 상세 →</RouterLink>
</template>

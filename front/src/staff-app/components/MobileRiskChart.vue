<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {adminApi} from '../../shared/admin/services/admin-api'
import {buildRiskTrend} from '../../regional-admin/utils/risk-trend'
const props=defineProps<{id:string;updated:string|null}>()
const points=ref<{predictedAt?:string;riskScore?:number|null}[]>([]),error=ref(''),loading=ref(false)
let request:AbortController|undefined
const chart=computed(()=>buildRiskTrend(points.value,5,640))
async function load(){request?.abort();const current=new AbortController();request=current;loading.value=true;error.value=''
 try{const data=await adminApi<{predictedAt?:string;riskScore?:number|null}[]>(`/underpasses/${encodeURIComponent(props.id)}/risk-scores`,{signal:current.signal});if(current.signal.aborted)return;if(!Array.isArray(data))throw new Error('관측 기록을 확인하지 못했습니다.');points.value=data}
 catch(e){if(!current.signal.aborted)error.value=e instanceof Error?e.message:'관측 조회 실패'}finally{if(request===current)loading.value=false}}
watch(()=>props.id,()=>{points.value=[];void load()},{immediate:true})
watch(()=>props.updated,()=>void load())
onBeforeUnmount(()=>request?.abort())
</script>
<template><section class="rm-card"><div class="rm-section-heading"><h2>위험 점수 추이</h2><span>최근 12시간</span></div><p v-if="error" role="alert">{{ error }} <button :disabled="loading" @click="load">재시도</button></p><div v-else-if="chart.points.length" class="rm-trend-scroll" tabindex="0" aria-label="시간별 위험 점수 그래프"><svg :viewBox="`0 0 ${chart.width} 170`" :width="chart.width" height="170" role="img" aria-label="실제 관측 위험 점수 추이"><g v-for="n in [0,50,100]" :key="n"><line x1="40" :x2="chart.width-20" :y1="130-n" :y2="130-n"/><text x="4" :y="134-n">{{ n }}</text></g><path v-for="(p,i) in chart.paths" :key="i" :d="p"/><circle v-for="p in chart.points" :key="p.time" :cx="p.x" :cy="p.y" r="3"><title>{{ p.time }} · {{ p.score }}점</title></circle><text v-for="t in chart.ticks" :key="t.time" :x="t.x" y="155" text-anchor="middle">{{ t.label }}</text></svg></div><p v-else class="rm-empty">{{ loading?'관측 기록 조회 중…':'관측 기록이 없습니다.' }}</p></section></template>

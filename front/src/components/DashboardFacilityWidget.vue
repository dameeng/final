<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { asPage, backend, queryString } from '../services/backend'
import { displayDate } from '../utils/display-date'
import { riskChartSeries, riskTimestamp } from '../utils/risk-chart'
import RiskLevelBadge from './RiskLevelBadge.vue'
import '../styles/dashboard-chart.css'
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
    else scores.value=asPage<any>(result).items.filter(row=>row.riskScore!=null&&String(row.riskScore).trim()!==''&&Number.isFinite(Number(row.riskScore))&&Number.isFinite(riskTimestamp(row.predictedAt))).sort((a,b)=>riskTimestamp(a.predictedAt)-riskTimestamp(b.predictedAt))
  } catch(cause) {if(!current.signal.aborted)error.value=(cause as Error).message}
})
const chartSurface=ref<HTMLElement>(), chartWidth=ref(360), chartViewportHeight=ref(160)
const chartId='water-risk-'+useId().replace(/[^a-zA-Z0-9_-]/g,'')
const chartBottom=computed(()=>chartViewportHeight.value-28), chartHeight=computed(()=>chartBottom.value-22)
const chartLeft=35, observationGap=30*60000
let chartResize:ResizeObserver|undefined
watch(chartSurface,element=>{
  chartResize?.disconnect()
  if(!element)return
  const card=element.closest<HTMLElement>('.board-extra')
  const resize=()=>{
    chartWidth.value=Math.max(180,Math.round(element.clientWidth))
    // A customized widget has an explicit height. Use its remaining room without
    // changing the card size; an auto-sized card gets the compact default instead.
    if(card?.style.height&&card.style.height!=='auto') {
      const inset=element.getBoundingClientRect().top-card.getBoundingClientRect().top+card.scrollTop-card.clientTop
      const bottomPadding=parseFloat(getComputedStyle(card).paddingBottom)||0
      const footerRoom=card.clientHeight>=420?64:0
      chartViewportHeight.value=Math.max(150,Math.min(330,Math.floor(card.clientHeight-inset-bottomPadding-footerRoom)))
    } else chartViewportHeight.value=160
  }
  resize()
  chartResize=new ResizeObserver(resize)
  chartResize.observe(element)
  if(card)chartResize.observe(card)
})
const chart=computed(()=>riskChartSeries(scores.value,[],chartLeft,Math.max(120,chartWidth.value-chartLeft-16),chartBottom.value,chartHeight.value,{extendToNow:false,maxGapMs:observationGap}))
const chartTicks=[0,25,50,75,100]
const hoveredTime=ref<string|null>(null), focusedTime=ref<string|null>(null)
const tabStopTime=ref<string|null>(null)
const chartTabStop=computed(()=>chart.value.samples.some(sample=>sample.time===tabStopTime.value)?tabStopTime.value:chart.value.samples.at(-1)?.time)
const activeSample=computed(()=>chart.value.samples.find(sample=>sample.time===(hoveredTime.value??focusedTime.value)))
const tooltipPosition=computed(()=>activeSample.value?{x:Math.max(3,Math.min(chartWidth.value-143,activeSample.value.x-70)),y:Math.max(5,activeSample.value.y-52)}:null)
// The key follows observations, not widget dimensions or unrelated reactive updates.
const chartDataKey=computed(()=>selected.value+':'+scores.value.map(row=>riskTimestamp(row.predictedAt)+','+Number(row.riskScore)).join(';'))
watch(chartDataKey,()=>{hoveredTime.value=null;focusedTime.value=null;tabStopTime.value=null})
function focusSample(time:string) { focusedTime.value=time;tabStopTime.value=time }
function navigateSample(event:KeyboardEvent,index:number) {
  const last=chart.value.samples.length-1
  const target=event.key==='ArrowLeft'?Math.max(0,index-1):event.key==='ArrowRight'?Math.min(last,index+1):event.key==='Home'?0:event.key==='End'?last:null
  if(target===null)return
  event.preventDefault()
  chartSurface.value?.querySelectorAll<SVGElement>('.water-risk-sample')[target]?.focus()
}
const chartAreas=computed(()=>{
  const groups:typeof chart.value.samples[]=[]
  for(const sample of chart.value.samples) {
    const previous=groups.at(-1)?.at(-1)
    if(!previous||Date.parse(sample.time)-Date.parse(previous.time)>observationGap)groups.push([sample])
    else groups.at(-1)!.push(sample)
  }
  // Close each observed segment separately; an outage never becomes a filled bridge.
  return groups.filter(group=>group.length>1).map(group=>`M${group[0]!.x},${chartBottom.value} ${group.map(point=>`L${point.x},${point.y}`).join(' ')} L${group.at(-1)!.x},${chartBottom.value} Z`)
})
const latestScore=computed(()=>{
  const value=Number(scores.value.at(-1)?.riskScore)
  return Number.isFinite(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value):'—'
})
onMounted(loadFacilities)
onBeforeUnmount(()=>{controller.abort();request?.abort();chartResize?.disconnect()})
</script>
<template>
  <div class="water-facility-widget" :class="{'water-facility-widget-risk':mode==='risk'}">
    <div class="water-widget-controls">
      <label>시설 선택<select v-model="selected" :aria-label="mode==='risk'?'위험 추이 시설':'상세 위젯 시설'"><option value="">시설 선택</option><option v-for="facility in facilities" :key="facility.id" :value="String(facility.id)">{{facility.name}}</option></select></label>
      <button v-if="more" type="button" :disabled="loading" @click="loadFacilities">시설 더 보기</button>
    </div>
    <p v-if="error" class="water-widget-error" role="alert">{{error}}</p>
    <figure v-else-if="mode==='risk'&&scores.length" class="water-risk-figure">
      <figcaption class="water-risk-summary">
        <div><span>최근 위험 점수</span><strong>{{latestScore}}<small>점</small></strong></div>
        <span class="water-risk-legend"><i aria-hidden="true"></i>관측 {{chart.samples.length}}건</span>
      </figcaption>
      <div ref="chartSurface" class="water-risk-chart-surface">
        <svg class="water-risk-chart" :viewBox="`0 0 ${chartWidth} ${chartViewportHeight}`" :style="{height:chartViewportHeight+'px'}" role="img" :aria-labelledby="chartId+'-title '+chartId+'-description'">
          <title :id="chartId+'-title'">최근 6시간 위험 점수 추이</title>
          <desc :id="chartId+'-description'">{{displayDate(scores[0].predictedAt)}}부터 {{displayDate(scores.at(-1).predictedAt)}}까지 관측 {{chart.samples.length}}건. 최근 위험 점수 {{latestScore}}점. 30분을 넘는 관측 공백은 연결하지 않습니다. 관측점에서 좌우 화살표 키로 이동하고, Home·End 키로 처음·마지막 관측을 확인할 수 있습니다.</desc>
          <defs><linearGradient :id="chartId+'-fill'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="water-risk-fill-top" /><stop offset="100%" class="water-risk-fill-bottom" /></linearGradient></defs>
          <text class="water-risk-axis-unit" x="3" y="15">점수</text>
          <g v-for="tick in chartTicks" :key="tick" class="water-risk-grid">
            <line :x1="chartLeft" :x2="chartWidth-16" :y1="chartBottom-tick/100*chartHeight" :y2="chartBottom-tick/100*chartHeight" :class="{'water-risk-baseline':tick===0}" />
            <text x="25" :y="chartBottom-tick/100*chartHeight+4" text-anchor="end">{{tick}}</text>
          </g>
          <g v-for="(tick,index) in chart.ticks" :key="tick.x" class="water-risk-time-tick">
            <line :x1="tick.x" :x2="tick.x" :y1="chartBottom" :y2="chartBottom+4" />
            <text :x="tick.x" :y="chartBottom+19" :text-anchor="chart.ticks.length===1?'middle':index===0?'start':index===chart.ticks.length-1?'end':'middle'">{{tick.label}}</text>
          </g>
          <g :key="chartDataKey" class="water-risk-series">
            <path v-for="(area,index) in chartAreas" :key="index" class="water-risk-area" :d="area" :fill="`url(#${chartId}-fill)`" />
            <path class="water-risk-line" :d="chart.observedPath" fill="none" pathLength="1" />
            <circle v-for="(sample,index) in chart.samples" :key="sample.time" class="water-risk-sample" :class="{'is-active':activeSample?.time===sample.time}" :cx="sample.x" :cy="sample.y" r="2.5" :tabindex="sample.time===chartTabStop?0:-1" role="img" :aria-label="`${displayDate(sample.time)} · ${sample.score}점`" @mouseenter="hoveredTime=sample.time" @mouseleave="hoveredTime=null" @focus="focusSample(sample.time)" @blur="focusedTime=null" @keydown="navigateSample($event,index)"><title>{{displayDate(sample.time)}} · {{sample.score}}점</title></circle>
            <circle v-for="sample in chart.samples" :key="'hit-'+sample.time" class="water-risk-hit" :cx="sample.x" :cy="sample.y" r="8" aria-hidden="true" @mouseenter="hoveredTime=sample.time" @mouseleave="hoveredTime=null" />
            <g v-if="chart.lastObserved" class="water-risk-latest">
              <circle class="water-risk-latest-halo" :cx="chart.lastObserved.x" :cy="chart.lastObserved.y" r="8" />
              <circle class="water-risk-latest-dot" :cx="chart.lastObserved.x" :cy="chart.lastObserved.y" r="4"><title>마지막 관측 {{chart.lastObserved.label}} · {{latestScore}}점</title></circle>
            </g>
          </g>
          <g v-if="activeSample&&tooltipPosition" class="water-risk-tooltip" :transform="`translate(${tooltipPosition.x},${tooltipPosition.y})`" aria-hidden="true">
            <rect width="140" height="43" rx="7" />
            <text x="10" y="15">{{displayDate(activeSample.time)}}</text>
            <text x="10" y="32" class="water-risk-tooltip-value">{{activeSample.score}}점</text>
          </g>
        </svg>
      </div>
      <p class="water-risk-period">{{displayDate(scores[0].predictedAt)}}<span aria-hidden="true">—</span>{{displayDate(scores.at(-1).predictedAt)}}</p>
    </figure>
    <dl v-else-if="detail" class="water-widget-detail"><dt>시설</dt><dd>{{detail.name}}</dd><dt>위험 단계</dt><dd><RiskLevelBadge :value="detail.currentRiskLevel" /></dd><dt>위험 점수</dt><dd>{{detail.riskScore??detail.currentRiskScore??'—'}}</dd><dt>현재 수위</dt><dd>{{detail.currentWaterCm??'—'}} cm</dd><dt>강우량</dt><dd>{{detail.rainfallMm??'—'}} mm</dd></dl>
    <div v-else class="water-widget-empty"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M8 8v24h26M12 25l7-7 6 4 8-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg><p>{{selected?'표시할 관측 정보가 없습니다.':'시설을 선택해 주세요.'}}</p></div>
    <RouterLink v-if="selected" class="water-widget-detail-link" :to="{path:'/fac-detail',query:{id:selected}}">선택 시설 상세 <span aria-hidden="true">→</span></RouterLink>
  </div>
</template>

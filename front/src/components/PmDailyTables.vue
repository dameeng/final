<script setup lang="ts">
import ListResultCount from './ListResultCount.vue'
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { PM_TYPES, PM_TRIGGERS, PM_EVENT_STATUS, PM_LEVELS } from '../utils/pm-labels'
import { displayDate } from '../utils/display-date'
const props=defineProps<{summary:Record<string,any>}>()
const statuses=[['safe','안전'],['caution','주의'],['danger','위험'],['noData','미수신']] as const
const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,value):0
const distribution=computed(()=>(props.summary.byType||[]).map((row:Record<string,any>)=>({...row,total:count(row.total),segments:statuses.map(([key,label])=>({key,label,value:count(row[key])}))})))
const chartMax=computed(()=>Math.max(1,...distribution.value.map((row:any)=>Math.max(row.total,row.segments.reduce((sum:number,item:any)=>sum+item.value,0)))))
const groups=[['recommended','점검 권장 설비'],['newEvents','신규 점검 대기'],['openEvents','처리 중인 점검'],['actions','점검 기록'],['stale','미수신 설비']] as const
const activeGroup=ref('recommended')
const recordPage=ref(1)
const recordPages=computed(()=>Math.max(1,Math.ceil((props.summary[activeGroup.value]?.length||0)/5)))
const visibleRecords=computed(()=>(props.summary[activeGroup.value]||[]).slice((recordPage.value-1)*5,recordPage.value*5))
watch([activeGroup,()=>props.summary],()=>{recordPage.value=1})
function groupCount(key:string) {
  return key==='newEvents'?props.summary.newEventCount??0:key==='openEvents'?props.summary.openEventCount??0:key==='actions'?props.summary.actionCount??0:props.summary[key]?.length??0
}
</script>
<template>
  <section class="daily-web-section"><header><h2>종류별 현황</h2><span>최초 수신 대기 {{summary.neverReceived??0}}개</span></header>
    <div class="daily-distribution-layout">
      <figure class="daily-distribution-chart" aria-label="설비 종류별 상태 분포 그래프">
        <figcaption>설비 상태 분포 <span>설비 수 기준</span></figcaption>
        <div class="daily-chart-legend"><span v-for="[key,label] in statuses" :key="key"><i :class="'is-'+key"></i>{{label}}</span></div>
        <div v-for="row in distribution" :key="row.type" class="daily-distribution-row">
          <div class="daily-chart-label"><strong>{{PM_TYPES[row.type]||row.type}}</strong><span>{{row.total}}개</span></div>
          <div class="daily-distribution-track" role="img" :aria-label="`${PM_TYPES[row.type]||row.type}: ${row.segments.map((item:any)=>item.label+' '+item.value+'개').join(', ')}`">
            <span v-for="item in row.segments" :key="item.key" :class="'is-'+item.key" :style="{width:(item.value/chartMax*100)+'%'}" :title="item.label+' '+item.value+'개'"></span>
          </div>
        </div>
        <p v-if="!distribution.length" class="daily-chart-empty">집계된 설비가 없습니다.</p>
      </figure>
    <div class="daily-type-results"><ListResultCount :count="distribution.length" /><div class="service-table-wrap"><table class="service-table daily-type-table"><thead><tr><th>종류</th><th>전체</th><th>안전</th><th>주의</th><th>위험</th><th>미수신</th></tr></thead><tbody><tr v-for="row in summary.byType||[]" :key="row.type"><td>{{PM_TYPES[row.type]||row.type}}</td><td v-for="key in ['total','safe','caution','danger','noData']" :key="key" :data-count="row[key]">{{row[key]}}</td></tr><tr v-if="!summary.byType?.length"><td colspan="6" class="pm-table-empty">집계된 설비가 없습니다.</td></tr></tbody></table></div></div>
    </div>
  </section>
  <nav class="daily-record-tabs" aria-label="리포트 기록 구분"><button v-for="[key,label] in groups" :key="key" type="button" :aria-pressed="activeGroup===key" @click="activeGroup=key">{{label}}<span>{{groupCount(key)}}</span></button></nav>
  <div class="daily-web-grid"><section v-for="[key,label] in groups.filter(([key])=>key===activeGroup)" :key="key" class="daily-web-section"><header><h2>{{label}}</h2></header><ListResultCount :count="groupCount(key)" />
    <div class="service-table-wrap"><table class="service-table"><thead><tr><th>설비</th><th>지하차도</th><th>상태·내용</th><th>시각</th></tr></thead><tbody><tr v-for="(row,index) in visibleRecords" :key="row.eventId||row.actionId||row.equipId||index"><td><RouterLink v-if="row.equipId" :to="{path:'/pm-equipment-detail',query:{id:String(row.equipId)}}">{{row.name||row.code||'설비 '+row.equipId}}</RouterLink><span v-else>{{row.name||'기록'}}</span></td><td>{{row.underpassName||'—'}}</td><td>{{PM_TRIGGERS[row.triggerType]||PM_EVENT_STATUS[row.status]||PM_LEVELS[row.level]||row.content||'—'}}</td><td>{{displayDate(row.createdAt||row.lastReceivedAt||row.predictedAt)}}</td></tr><tr v-if="!summary[key]?.length"><td colspan="4" class="pm-table-empty">해당 기록이 없습니다.</td></tr></tbody></table></div>
    <nav v-if="recordPages>1" class="service-pagination" aria-label="리포트 기록 페이지"><button type="button" :disabled="recordPage<=1" @click="recordPage--">이전</button><span>{{recordPage}} / {{recordPages}}</span><button type="button" :disabled="recordPage>=recordPages" @click="recordPage++">다음</button></nav>
  </section></div>
</template>

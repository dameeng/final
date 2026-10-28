<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { PM_TYPES, PM_TRIGGERS, PM_EVENT_STATUS, PM_LEVELS } from '../utils/pm-labels'
import { displayDate } from '../utils/display-date'
defineProps<{summary:Record<string,any>}>()
const groups=[['recommended','점검 권장 설비'],['newEvents','신규 점검 대기'],['openEvents','처리 중인 점검'],['actions','점검 기록'],['stale','미수신 설비']] as const
</script>
<template>
  <section class="daily-web-section"><header><h2>종류별 현황</h2><span>최초 수신 대기 {{summary.neverReceived??0}}개</span></header>
    <div class="service-table-wrap"><table class="service-table"><thead><tr><th>종류</th><th>전체</th><th>안전</th><th>주의</th><th>위험</th><th>미수신</th></tr></thead><tbody><tr v-for="row in summary.byType||[]" :key="row.type"><td>{{PM_TYPES[row.type]||row.type}}</td><td>{{row.total}}</td><td>{{row.safe}}</td><td>{{row.caution}}</td><td>{{row.danger}}</td><td>{{row.noData}}</td></tr><tr v-if="!summary.byType?.length"><td colspan="6" class="pm-table-empty">집계된 설비가 없습니다.</td></tr></tbody></table></div>
  </section>
  <div class="daily-web-grid"><section v-for="[key,label] in groups" :key="key" class="daily-web-section"><header><h2>{{label}}</h2><span>총 {{key==='newEvents'?summary.newEventCount??0:key==='openEvents'?summary.openEventCount??0:key==='actions'?summary.actionCount??0:summary[key]?.length??0}}건</span></header>
    <div class="service-table-wrap"><table class="service-table"><thead><tr><th>설비</th><th>지하차도</th><th>상태·내용</th><th>시각</th></tr></thead><tbody><tr v-for="(row,index) in summary[key]||[]" :key="row.eventId||row.actionId||row.equipId||index"><td><RouterLink v-if="row.equipId" :to="{path:'/pm-equipment-detail',query:{id:String(row.equipId)}}">{{row.name||row.code||'설비 '+row.equipId}}</RouterLink><span v-else>{{row.name||'기록'}}</span></td><td>{{row.underpassName||'—'}}</td><td>{{PM_TRIGGERS[row.triggerType]||PM_EVENT_STATUS[row.status]||PM_LEVELS[row.level]||row.content||'—'}}</td><td>{{displayDate(row.createdAt||row.lastReceivedAt||row.predictedAt)}}</td></tr><tr v-if="!summary[key]?.length"><td colspan="4" class="pm-table-empty">해당 기록이 없습니다.</td></tr></tbody></table></div>
  </section></div>
</template>

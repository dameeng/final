<script setup lang="ts">
import { computed } from 'vue'
import { displayDate } from '../utils/display-date'
import type { Handover } from '../services/handover'
const props = defineProps<{ report: Handover }>()
const summary = computed(() => props.report.summary || {})
const counts = computed(() => summary.value.counts || {})
</script>
<template>
  <div class="handover-live-summary">
    <header><h3>{{report.shiftName||'직전 근무조'}} · {{report.authorName||'작성자 미지정'}}</h3><p>{{displayDate(report.windowStart)}} ~ {{displayDate(report.windowEnd)}}</p><p v-if="report.authorPhone">연락처 · {{report.authorPhone}}</p></header>
    <p v-if="summary.demo" class="handover-demo-note">시연용 업무 요약입니다. 미처리 점검은 실제 조회 현황입니다.</p>
    <dl class="handover-live-counts"><div v-for="[key,label] in [['block','통제'],['riskUp','위험 상승'],['pmChecked','점검'],['pmPending','미처리 점검']]" :key="key"><dt>{{label}}</dt><dd>{{counts[key!]??0}}건</dd></div></dl>
    <section v-if="summary.pm"><h3>예지보전 현황</h3><p>신규 {{summary.pm.newEventCount??0}}건 · 점검 기록 {{summary.pm.actionCount??0}}건 · 처리 중 {{summary.pm.openEventCount??0}}건</p><p>미수신 {{summary.pm.stale?.length??0}}개 · 최초 수신 대기 {{summary.pm.neverReceived??0}}개</p></section>
    <section v-if="summary.blockedNow?.length||summary.elevatedNow?.length"><h3>다음 근무조 확인 시설</h3><p v-for="facility in summary.blockedNow" :key="'blocked'+facility.underpassId">통제 중 · {{facility.name}}</p><p v-for="facility in summary.elevatedNow" :key="facility.underpassId">주의 확인 · {{facility.name}}</p></section>
    <section><h3>직원별 업무</h3><ul v-if="summary.staff?.length"><li v-for="person in summary.staff" :key="person.managerId"><strong>{{person.name}} · {{person.total}}건</strong><p>통제 {{person.block}} · 해제 {{person.release}} · 차량 판별 {{person.plateReview}} · 점검 {{person.pmAction}} · 전광판 {{person.displayEdit}} · 이관 {{person.transfer}} · 문의 답변 {{person.inquiryAnswer}}</p></li></ul><p v-else>기록된 직원별 업무가 없습니다.</p></section>
    <section><h3>업무 기록</h3><ul v-if="summary.activities?.length"><li v-for="(activity,i) in summary.activities" :key="i"><small>{{displayDate(activity.at)}} · {{activity.category}} · {{activity.actor||'자동 처리'}}</small><p>{{activity.content}}</p></li></ul><p v-else>기록된 업무가 없습니다.</p></section>
    <section v-if="report.memo"><h3>인수인계 메모</h3><p class="handover-memo">{{report.memo}}</p></section>
  </div>
</template>
<style scoped>
.handover-live-summary { color:var(--r-ink,#172d48); font-size:13px; line-height:1.7; } h3 { margin:0 0 8px; font-size:14px; } p { margin:5px 0; overflow-wrap:anywhere; } header,section { padding:14px 0; } section+section { border-top:1px solid var(--r-line,#dbe3ed); } .handover-live-counts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:12px 0; } .handover-live-counts>div { padding:12px; border:1px solid var(--r-line,#dbe3ed); border-radius:9px; background:var(--r-soft,#eaf0f7); } dt { font-size:12px; color:var(--r-muted,#586b82); } dd { margin:4px 0 0; font-size:21px; font-weight:700; } ul { list-style:none; padding:0; margin:0; } li { padding:10px 0; } li+li { border-top:1px solid var(--r-line,#dbe3ed); } small { color:var(--r-muted,#586b82); } .handover-memo { white-space:pre-wrap; } .handover-demo-note { padding:10px; border-radius:8px; background:var(--status-caution-bg,#fff1d6); color:var(--status-caution-ink,#865000); }
</style>

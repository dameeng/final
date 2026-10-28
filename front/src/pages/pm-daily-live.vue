<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import AppPagination from '../components/AppPagination.vue'
import PmDailyTables from '../components/PmDailyTables.vue'
import PmDailyMobileChart from '../components/PmDailyMobileChart.vue'
import { RouterLink, useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import { backend, downloadPdf, queryString } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { managerAppPath } from '../utils/manager-app-path'
import { PM_TYPES, PM_TRIGGERS, PM_EVENT_STATUS, PM_LEVELS } from '../utils/pm-labels'
const route = useRoute()
const appView = computed(() => route.path.startsWith('/admin-app/'))
const groupPages = reactive<Record<string, number>>({})
function groupRows(key: string) {
  const rows = summary.value[key] || []
  if (!appView.value) return rows
  const page = Math.min(groupPages[key] || 1, Math.max(1, Math.ceil(rows.length / 5)))
  return rows.slice((page - 1) * 5, page * 5)
}
function groupPage(key: string) { return Math.min(groupPages[key] || 1, Math.max(1, Math.ceil((summary.value[key]?.length || 0) / 5))) }
const date = ref(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()))
const report = ref<Record<string,any>>(), loading = ref(false), downloading = ref(false), error = ref('')
const summary = computed(() => report.value?.summary || {})
const levelSummaries = [['safe','안전'],['caution','주의'],['danger','위험'],['noData','미수신']] as const
let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  controller?.abort(); const current = new AbortController(); controller = current
  loading.value = true; error.value = ''; report.value = undefined
  try { const result = await backend('/api/pm/reports/daily'+queryString({ date:date.value }), { signal:current.signal }); if (!current.signal.aborted) report.value = result }
  catch (e) { if (!current.signal.aborted) error.value = (e as Error).message }
  finally { if (!current.signal.aborted) loading.value = false }
}
async function pdf() {
  if (downloading.value) return
  downloading.value = true; error.value = ''
  try { downloadPdf(await backend<Blob>('/api/pm/reports/daily/pdf'+queryString({ date:date.value }), { pdf:true }), `예지보전_${date.value}.pdf`) }
  catch (e) { error.value = (e as Error).message }
  finally { downloading.value = false }
}
const groups = [['recommended','점검 권장 설비'],['newEvents','신규 점검 대기'],['openEvents','처리 중인 점검'],['actions','점검 기록'],['stale','미수신 설비']] as const
useBackendEvents(({name,data}) => {
  if (name==='connected'||name==='pm-update'||name==='data-changed'&&['pm-report','pm-event','pm-action','pm-equipment','pm-threshold'].includes(data.resource)) {
    clearTimeout(timer); timer=setTimeout(()=>void load(),250)
  }
})
watch(date,load,{immediate:true})
onBeforeUnmount(()=>{controller?.abort();clearTimeout(timer)})
</script>
<template>
  <BackendLayout><main class="service-workspace pm-admin-tools pm-daily-live"><div class="service-heading"><h1><AdminPageIcon />예지보전 데일리 리포트</h1><div class="service-actions"><button type="button" :disabled="loading||downloading||!report" @click="pdf">{{downloading?'PDF 생성 중…':'PDF 다운로드'}}</button></div></div>
    <form class="service-filters" @submit.prevent="load"><label>조회 날짜<input v-model="date" type="date" required /></label><button :disabled="loading">조회</button><small v-if="report&&!appView" class="daily-generated-at">집계 {{displayDate(report.generatedAt)}}</small></form>
    <p v-if="loading" role="status">리포트를 불러오는 중입니다.</p><p v-if="error" role="alert">{{error}}</p>
    <template v-if="report"><p v-if="appView">집계 시각 · {{displayDate(report.generatedAt)}}</p><div class="daily-levels"><section v-for="[key,label] in levelSummaries" :key="key" :class="'daily-level-'+key"><h2>{{label}}</h2><strong>{{summary.levelCounts?.[key!]??0}}</strong><small>이전 {{summary.previousLevelCounts?.[key!]??0}}개</small></section></div>
    <PmDailyTables v-if="!appView" :summary="summary" /><template v-else><PmDailyMobileChart :summary="summary" />
    <section v-for="[key,label] in groups" :key="key" class="daily-section"><h2>{{label}} <small>{{key==='newEvents'?summary.newEventCount:key==='openEvents'?summary.openEventCount:key==='actions'?summary.actionCount:summary[key]?.length??0}}건</small></h2><ul><li v-for="(row,index) in groupRows(key)" :key="row.eventId||row.actionId||row.equipId||index"><RouterLink v-if="row.equipId" :to="{path:managerAppPath('/pm-equipment-detail',route.path),query:{id:String(row.equipId)}}">{{row.name||row.code||'설비 '+row.equipId}}</RouterLink><strong v-else>{{row.name||'기록'}}</strong><span>{{row.underpassName}} · {{PM_TRIGGERS[row.triggerType]||PM_EVENT_STATUS[row.status]||PM_LEVELS[row.level]||row.content||''}}</span></li></ul><AppPagination v-if="appView&&(summary[key]?.length||0)>5" :page="groupPage(key)" :pages="Math.ceil(summary[key].length/5)" @change="groupPages[key]=$event" /><p v-if="!summary[key]?.length">해당 기록이 없습니다.</p></section></template></template>
  </main></BackendLayout>
</template>
<style scoped>
.pm-daily-live { max-width:1100px; margin:auto; } .daily-levels { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:20px 0; } .daily-levels section,.daily-section { padding:18px; border:1px solid var(--r-line); border-radius:12px; background:var(--r-surface); } .daily-section { margin:14px 0; } h2 { font-size:15px; margin:0 0 12px; } strong { display:block; font-size:24px; } small { display:block; color:var(--r-muted); font-size:12px; } ul { padding:0; list-style:none; } li { padding:12px 0; border-bottom:1px solid var(--r-line); } li strong { font-size:14px; } li span { display:block; margin-top:6px; font-size:12px; } p { font-size:13px; line-height:1.8; } @media(max-width:600px) { .daily-levels { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import PmActionModal from '../components/PmActionModal.vue'
import { backend, downloadPdf, queryString } from '../services/backend'
import { displayDate } from '../utils/display-date'
import { PM_EVENT_STATUS, PM_TRIGGERS, PM_TYPES, pmLabel } from '../utils/pm-labels'

type Report = { date: string; generatedAt?: string; summary: { newEventCount: number; openEventCount: number; actionCount: number; openEvents?: Record<string, any>[] } }
const route = useRoute()
const id = computed(() => String(route.query.id || ''))
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const date = ref(today), equipment = ref<Record<string, any>>(), report = ref<Report>()
const loading = ref(false), pdfBusy = ref(false), shareBusy = ref(false)
const error = ref(''), pdfError = ref(''), message = ref('')
const pdfUrl = ref(''), pdfFile = ref<File>(), shareSupported = ref(false)
const modal = ref<InstanceType<typeof PmActionModal>>()
let controller: AbortController | undefined, pdfController: AbortController | undefined
const event = computed(() => report.value?.summary?.openEvents?.find(row => String(row.eventId) === String(route.query.eventId || equipment.value?.openEventId)))
const filename = computed(() => `예지보전_${String(equipment.value?.underpassName || '일일보고서').replace(/[\\/:*?"<>|]/g, '_')}_${date.value}.pdf`)

function clearPdf() {
  pdfController?.abort()
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''; pdfFile.value = undefined; shareSupported.value = false
  pdfBusy.value = false; pdfError.value = ''; message.value = ''
}
async function load() {
  controller?.abort(); clearPdf()
  report.value = undefined; error.value = ''; loading.value = false
  if (!id.value) { equipment.value = undefined; return }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value) || date.value > today) { error.value = '오늘 또는 이전 날짜를 선택해 주세요.'; return }
  if (String(equipment.value?.equipId) !== id.value) equipment.value = undefined
  const request = new AbortController(); controller = request; loading.value = true
  try {
    const detail = await backend<{ equipment: Record<string, any> }>(`/api/pm/equipments/${encodeURIComponent(id.value)}`, { signal: request.signal })
    if (request.signal.aborted) return
    equipment.value = detail.equipment
    if (!equipment.value?.underpassId) throw new Error('이 설비의 지하차도 정보를 확인할 수 없습니다.')
    const result = await backend<Report>('/api/pm/reports/daily' + queryString({ date: date.value, underpassId: equipment.value.underpassId, scope: 'MINE' }), { signal: request.signal })
    if (!request.signal.aborted) report.value = result
  } catch (cause) { if (!request.signal.aborted) error.value = (cause as Error).message }
  finally { if (!request.signal.aborted) loading.value = false }
}
async function preparePdf() {
  if (!equipment.value?.underpassId || !report.value || loading.value || error.value || pdfBusy.value) return
  clearPdf()
  const request = new AbortController(); pdfController = request; pdfBusy.value = true
  try {
    const blob = await backend<Blob>('/api/pm/reports/daily/pdf' + queryString({ date: date.value, underpassId: equipment.value.underpassId, scope: 'MINE' }), { pdf: true, signal: request.signal })
    if (request.signal.aborted) return
    const file = new File([blob], filename.value, { type: 'application/pdf' })
    pdfFile.value = file; pdfUrl.value = URL.createObjectURL(file)
    try { shareSupported.value = !!navigator.canShare?.({ files: [file] }) } catch { shareSupported.value = false }
  } catch (cause) { if (!request.signal.aborted) pdfError.value = (cause as Error).message }
  finally { if (!request.signal.aborted) pdfBusy.value = false }
}
function savePdf() {
  if (!pdfFile.value) return
  downloadPdf(pdfFile.value, pdfFile.value.name)
  message.value = 'PDF를 저장했습니다. 메일이나 메신저에 첨부해 전달할 수 있습니다.'
}
async function sharePdf() {
  if (!pdfFile.value || !shareSupported.value || shareBusy.value) return
  shareBusy.value = true; pdfError.value = ''; message.value = ''
  try {
    await navigator.share({ files: [pdfFile.value], title: '예지보전 일일 보고서' })
    message.value = '공유 창에 PDF를 전달했습니다.'
  } catch (cause) { if ((cause as Error).name !== 'AbortError') pdfError.value = '공유 창을 열지 못했습니다. PDF 저장 후 전달해 주세요.' }
  finally { shareBusy.value = false }
}
function inspect() {
  const row = equipment.value
  if (!row?.openEventId) return
  modal.value?.open({ eventId: row.openEventId, name: row.name, underpassName: row.underpassName, status: event.value?.status || row.openEventStatus })
}
watch([id, date], load, { immediate: true })
onBeforeUnmount(() => { controller?.abort(); clearPdf() })
</script>
<template>
  <BackendLayout>
    <section class="service-workspace pm-inspection-page">
      <div class="service-heading"><h1>점검 확인</h1></div>
      <p v-if="!id" role="status">확인할 설비를 선택해 주세요.</p>
      <p v-if="error" class="service-error" role="alert">{{error}}</p>
      <p v-if="loading&&!equipment" role="status">점검 정보를 불러오는 중입니다.</p>
      <template v-if="equipment">
        <section class="inspection-target">
          <div><small>{{equipment.underpassName}}</small><h2>{{equipment.name}} <span>· {{pmLabel(PM_TYPES,equipment.type)}}</span></h2></div>
          <span class="inspection-state">{{equipment.openEventId?pmLabel(PM_EVENT_STATUS,event?.status||equipment.openEventStatus):'열린 점검 없음'}}</span>
          <dl v-if="event"><div><dt>확인 사유</dt><dd>{{pmLabel(PM_TRIGGERS,event.triggerType)}}</dd></div><div><dt>발생 시각</dt><dd>{{displayDate(event.createdAt)}}</dd></div></dl>
          <button v-if="equipment.openEventId" class="btn" type="button" @click="inspect">점검 처리</button>
        </section>
        <section class="inspection-report">
          <h2>PDF 보고서</h2>
          <p class="inspection-description">{{equipment.underpassName}}의 일일 점검·조치 내용을 정리한 보고서입니다.</p>
          <label class="inspection-date">보고서 날짜<input v-model="date" type="date" :max="today" :disabled="pdfBusy||shareBusy" /></label>
          <div v-if="report" class="inspection-counts"><div><small>신규 점검</small><strong>{{report.summary.newEventCount}}<span>건</span></strong></div><div><small>처리 중</small><strong>{{report.summary.openEventCount}}<span>건</span></strong></div><div><small>조치 기록</small><strong>{{report.summary.actionCount}}<span>건</span></strong></div></div>
          <p v-if="report?.generatedAt" class="inspection-generated">집계 시각 {{displayDate(report.generatedAt)}}</p>
          <button v-if="!pdfFile" class="btn primary inspection-prepare" type="button" :disabled="loading||pdfBusy||!report||!!error||!equipment.underpassId||!date" @click="preparePdf">{{pdfBusy?'PDF 준비 중…':'PDF 만들기'}}</button>
          <div v-else class="inspection-pdf-ready">
            <strong>{{pdfFile.name}}</strong><small>PDF · {{Math.max(1,Math.ceil(pdfFile.size/1024))}} KB</small>
            <a class="btn" :href="pdfUrl" target="_blank" rel="noopener">PDF 열기</a>
            <div class="inspection-pdf-actions"><button class="btn" type="button" @click="savePdf">PDF 저장</button><button class="btn primary" type="button" :disabled="!shareSupported||shareBusy" @click="sharePdf">{{shareBusy?'공유 중…':'PDF 공유'}}</button></div>
            <p v-if="!shareSupported">이 브라우저에서는 파일 공유를 지원하지 않습니다. PDF를 저장한 뒤 메일이나 메신저로 보내세요.</p>
          </div>
          <p v-if="pdfError" class="service-error" role="alert">{{pdfError}}</p>
          <p v-if="message" class="inspection-message" role="status">{{message}}</p>
        </section>
      </template>
    </section>
    <PmActionModal ref="modal" @done="load" />
  </BackendLayout>
</template>
<style scoped>
.pm-inspection-page { max-width:900px; margin-inline:auto; }
.inspection-target,.inspection-report { padding:18px; border:1px solid var(--r-line,#dce7f2); border-radius:12px; background:var(--r-surface,#fff); margin-bottom:16px; }
.inspection-target { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; }
.inspection-target small,.inspection-description,.inspection-generated { color:var(--r-muted,#5c738b); font-size:13px; line-height:20px; }
.inspection-target h2,.inspection-report h2 { margin:4px 0 0; font-size:17px; line-height:26px; }
.inspection-target h2 span { font-size:13px; font-weight:400; }
.inspection-state { padding:4px 8px; background:var(--r-selected,#eaf3ff); color:var(--r-accent,#2375d6); border-radius:6px; font-size:12px; }
.inspection-target dl { flex:0 0 100%; display:grid; gap:8px; margin:0; }
.inspection-target dl>div { display:flex; justify-content:space-between; gap:12px; font-size:13px; line-height:20px; }
.inspection-target dt { color:var(--r-muted,#5c738b); }
.inspection-target dd { margin:0; text-align:right; }
.inspection-target>.btn { width:100%; }
.inspection-description { margin:10px 0 16px; }
.inspection-date { display:grid; gap:8px; font-size:14px; }
.inspection-date input { width:100%; min-width:0; min-height:44px; padding:8px 10px; box-sizing:border-box; border:1px solid var(--r-line,#dce7f2); border-radius:8px; color:inherit; background:var(--r-surface,#fff); font:inherit; }
.inspection-counts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:16px 0; }
.inspection-counts>div { display:grid; gap:6px; padding:12px 8px; border-radius:8px; text-align:center; background:var(--r-soft,#f5f8fc); }
.inspection-counts small { color:var(--r-muted,#5c738b); font-size:12px; }
.inspection-counts strong { font-size:22px; line-height:28px; font-variant-numeric:tabular-nums; }
.inspection-counts strong span { margin-left:3px; font-size:12px; font-weight:400; }
.inspection-generated { font-size:11px; }
.inspection-prepare { width:100%; min-height:46px; }
.inspection-pdf-ready { display:grid; gap:10px; margin-top:16px; padding:14px; border:1px solid var(--r-line,#dce7f2); border-radius:8px; }
.inspection-pdf-ready>strong { overflow-wrap:anywhere; font-size:14px; line-height:22px; }
.inspection-pdf-ready>small,.inspection-pdf-ready>p { color:var(--r-muted,#5c738b); font-size:12px; line-height:20px; margin:0; }
.inspection-pdf-ready>a { text-align:center; text-decoration:none; }
.inspection-pdf-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.inspection-pdf-actions button { min-width:0; min-height:44px; }
.inspection-message { margin:14px 0 0; color:var(--r-accent,#2375d6); font-size:13px; line-height:20px; }
</style>

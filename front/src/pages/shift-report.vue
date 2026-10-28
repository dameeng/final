<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useApp } from '../stores/app'
import { asPage, backend, queryString } from '../services/backend'
import type { Handover } from '../services/handover'
import { displayDate } from '../utils/display-date'
import BackendLayout from '../components/BackendLayout.vue'
import HandoverSummary from '../components/HandoverSummary.vue'
import AppPagination from '../components/AppPagination.vue'
const app = useApp(), route = useRoute(), report = ref<Handover | null>(null), rows = ref<Record<string, any>[]>([])
type Mode = 'previous'|'preview'|'history'
const mode = ref<Mode>('previous'), page = ref(1), pages = ref(1), memo = ref('')
const busy = ref(false), error = ref(''), message = ref('')
let controller: AbortController | undefined
async function load(id?: number) {
  controller?.abort(); const current = new AbortController(); controller = current
  busy.value = true; error.value = ''; message.value = ''; report.value = null
  try {
    if (mode.value === 'history' && !id) {
      const result = asPage<Record<string, any>>(await backend('/api/shift-handovers' + queryString({ page: page.value, size: 10 }), { signal: current.signal }))
      if (!current.signal.aborted) { rows.value = result.items; pages.value = Math.max(1, result.totalPages) }
    } else {
      const result = await backend<Handover | null>(`/api/shift-handovers/${id || mode.value}`, { signal: current.signal })
      if (!current.signal.aborted) { report.value = result; memo.value = result?.memo || '' }
    }
  } catch (e) { if (!current.signal.aborted) error.value = (e as Error).message }
  finally { if (!current.signal.aborted) busy.value = false }
}
function choose(value: Mode) { if (busy.value) return; mode.value = value; page.value = 1; void load() }
async function save() {
  if (busy.value || !report.value) return
  busy.value = true; error.value = ''; message.value = ''
  const current = report.value
  try {
    report.value = current.written && current.id
      ? await backend<Handover>(`/api/shift-handovers/${current.id}/memo`, { method: 'PUT', body: { memo: memo.value } })
      : await backend<Handover>('/api/shift-handovers', { method: 'POST', body: { memo: memo.value, shiftId: current.shiftId, shiftDate: current.shiftDate } })
    message.value = '인수인계를 저장했습니다.'
  } catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
function print() { window.print() }
void load(Number(route.query.id) || undefined)
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <BackendLayout><main class="service-workspace shift-live-report">
    <div class="service-heading"><h1>근무 인수인계</h1><button type="button" :disabled="!report||busy" @click="print">인쇄 · PDF 저장</button></div>
    <nav class="service-tabs" aria-label="인수인계 조회"><button v-for="[value,label] in [['previous','직전 근무'],['preview','인수인계 작성'],['history','저장 목록']]" :key="value" type="button" :disabled="busy" :aria-pressed="mode===value" @click="choose(value as Mode)">{{label}}</button><RouterLink to="/pm-daily">예지보전 데일리 리포트 →</RouterLink></nav>
    <p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p><p v-if="busy" role="status">처리 중입니다.</p>
    <HandoverSummary v-if="report" :report="report" />
    <form v-if="report&&(mode==='preview'||report.written&&String(report.managerId)===String(app.account?.id))" @submit.prevent="save"><label>인수인계 메모<textarea v-model="memo" maxlength="2000" rows="5" :disabled="busy"></textarea></label><button type="submit" :disabled="busy">{{report.written?'메모 수정':'인수인계 저장'}}</button></form>
    <template v-if="mode==='history'&&!report"><ul class="handover-history"><li v-for="row in rows" :key="row.id"><button type="button" :disabled="busy" @click="load(row.id)">{{row.shiftDate}} · {{row.shiftName}} · {{row.authorName}}<small>{{displayDate(row.createdAt)}}</small></button></li></ul><p v-if="!busy&&!rows.length">저장된 인수인계가 없습니다.</p><AppPagination :page="page" :pages="pages" :disabled="busy" @change="page=$event;load()" /></template>
    <p v-if="!busy&&!error&&!report&&mode!=='history'">해당 근무 기록이 없습니다.</p>
  </main></BackendLayout>
</template>
<style scoped>
.shift-live-report { max-width:1000px; margin:auto; } .service-tabs { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0; } button { min-height:38px; padding:8px 12px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:inherit; } button[aria-pressed=true] { background:var(--r-selected); color:var(--r-accent); } textarea { display:block; width:100%; box-sizing:border-box; margin:8px 0; padding:12px; border:1px solid var(--r-line); border-radius:8px; background:var(--r-surface); color:inherit; font:inherit; } .handover-history { list-style:none; padding:0; } .handover-history button { width:100%; text-align:left; margin-bottom:8px; } small { display:block; margin-top:6px; color:var(--r-muted); }
@media print { .service-heading button,.service-tabs,form,.app-number-pagination { display:none!important; } }
</style>

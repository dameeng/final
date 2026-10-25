<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import VmsLedDisplay from './VmsLedDisplay.vue'
import { asPage, backend, queryString } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
type Page = { id?: number; vmsId?: number; pageNo: number; underpassId?: number | null; underpassName?: string | null; content: string; color?: string; manual: boolean; defaultPage: boolean; updatedAt?: string | null }
type Vms = { id: number; name: string; spec?: string; dummy?: boolean; dist?: number | null; zone?: 'NEAR' | 'FAR' | null; pages?: Page[] }
type Preset = { id: number; category: string; content: string }
const props = defineProps<{ underpassId: string; underpassName?: string; manageable?: boolean }>()
const categoryLabels: Record<string, string> = { SAFE: '안전', WATCH: '관심', CAUTION: '주의', BLOCK: '차단', RELEASE: '해제' }
const vmsList = ref<Vms[]>([]), selectedId = ref<number>(), pages = ref<Page[]>([]), presets = ref<Preset[]>([]), history = ref<Record<string, any>[]>([])
const listError = ref(''), pageError = ref(''), historyError = ref(''), loading = ref(false), pagesLoading = ref(false), notice = ref('')
const historySource = ref(''), confirmDelete = ref<number>()
const editor = ref<{ pageNo?: number; content: string; presetId?: number; saving: boolean; error: string }>()
const selected = computed(() => vmsList.value.find((v) => v.id === selectedId.value))
const nearCount = computed(() => vmsList.value.filter((v) => v.zone === 'NEAR').length)
const contentLength = computed(() => editor.value?.content.trim().length ?? 0)
let listController: AbortController | undefined, pageController: AbortController | undefined, refreshTimer: ReturnType<typeof setTimeout> | undefined, noticeTimer: ReturnType<typeof setTimeout> | undefined
function zoneLabel(v?: Vms) { return v?.zone === 'NEAR' ? '근접' : v?.zone === 'FAR' ? '원거리' : '거리 미상' }
function pageKind(p: Page) { return p.defaultPage ? '기본 문구' : p.manual ? '수동' : '자동' }
function isOther(p: Page) { return p.underpassId != null && String(p.underpassId) !== props.underpassId }
function lockReason(p: Page) {
  if (p.defaultPage) return '저장된 페이지 아님'
  if (!p.manual) return '자동 표출 · 상태가 바뀌면 자동 변경'
  if (isOther(p)) return '다른 지하차도 페이지'
  if (!props.manageable) return '담당 외 시설'
  return ''
}
function toast(message: string) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => (notice.value = ''), 2200) }
async function loadList() {
  listController?.abort()
  const request = new AbortController(); listController = request
  if (!props.underpassId) return
  loading.value = true; listError.value = ''
  try {
    const result = await backend<Vms[]>('/api/its-vms' + queryString({ underpassId: props.underpassId }), { signal: request.signal })
    if (request.signal.aborted) return
    vmsList.value = Array.isArray(result) ? result : []
    if (!vmsList.value.some((v) => v.id === selectedId.value)) selectedId.value = vmsList.value[0]?.id
  } catch (e) { if (!request.signal.aborted) listError.value = (e as Error).message }
  finally { if (!request.signal.aborted) loading.value = false }
}
async function loadPages() {
  pageController?.abort()
  const request = new AbortController(); pageController = request
  const id = selectedId.value
  if (id == null) { pages.value = []; return }
  pagesLoading.value = true; pageError.value = ''
  try {
    const result = await backend<Page[]>('/api/display/vms/' + id + '/pages', { signal: request.signal })
    if (!request.signal.aborted) pages.value = Array.isArray(result) ? result : []
  } catch (e) {
    if (request.signal.aborted) return
    pages.value = selected.value?.pages || []
    pageError.value = (e as Error).message
  } finally { if (!request.signal.aborted) pagesLoading.value = false }
}
async function loadHistory() {
  if (selectedId.value == null) { history.value = []; return }
  historyError.value = ''
  try {
    const result = await backend('/api/display/history' + queryString({ underpassId: props.underpassId, vmsId: selectedId.value, source: historySource.value, page: 1, size: 10 }))
    history.value = asPage<Record<string, any>>(result).items
  } catch (e) { historyError.value = (e as Error).message }
}
async function loadPresets() {
  try { presets.value = (await backend<Preset[]>('/api/display/presets')) || [] } catch { presets.value = [] }
}
function openEditor(page?: Page) { confirmDelete.value = undefined; editor.value = { pageNo: page?.pageNo, content: page?.content || '', saving: false, error: '' } }
function usePreset(preset: Preset) {
  if (!editor.value) return
  editor.value.content = preset.content.split(' — ')[1] || preset.content
  editor.value.presetId = preset.id
}
async function save() {
  const form = editor.value, id = selectedId.value
  if (!form || id == null || !contentLength.value || contentLength.value > 100) return
  form.saving = true; form.error = ''
  try {
    if (form.pageNo == null) await backend('/api/display/vms/' + id + '/pages', { method: 'POST', body: { underpassId: Number(props.underpassId), presetId: form.presetId, content: form.content.trim() } })
    else await backend('/api/display/vms/' + id + '/pages/' + form.pageNo, { method: 'PUT', body: { content: form.content.trim() } })
    toast(form.pageNo == null ? '수동 페이지를 추가했습니다.' : '페이지를 수정했습니다.')
    editor.value = undefined
    void Promise.all([loadPages(), loadList(), loadHistory()])
  } catch (e) { form.error = (e as Error).message; form.saving = false }
}
async function remove(page: Page) {
  if (confirmDelete.value !== page.pageNo) { confirmDelete.value = page.pageNo; return }
  confirmDelete.value = undefined
  try {
    await backend('/api/display/vms/' + selectedId.value + '/pages/' + page.pageNo, { method: 'DELETE' })
    toast('페이지를 삭제했습니다.')
    void Promise.all([loadPages(), loadList()])
  } catch (e) { pageError.value = (e as Error).message }
}
function refresh() { void Promise.all([loadList(), loadPages(), loadHistory()]) }
watch(() => props.underpassId, () => { vmsList.value = []; selectedId.value = undefined; void loadList(); void loadPresets() }, { immediate: true })
watch(selectedId, () => { confirmDelete.value = undefined; void loadPages(); void loadHistory() })
watch(historySource, () => void loadHistory())
useBackendEvents(({ name, data }) => {
  const forList = name === 'connected' || (name === 'data-changed' && data.resource === 'its-vms')
  const forPage = name === 'display-change' && (data.vmsId == null || Number(data.vmsId) === selectedId.value)
  if (!forList && name !== 'display-change') return
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { void loadList(); if (forPage || forList) { void loadPages(); void loadHistory() } }, 200)
})
onBeforeUnmount(() => { listController?.abort(); pageController?.abort(); clearTimeout(refreshTimer); clearTimeout(noticeTimer) })
</script>
<template>
  <section class="underpass-vms" aria-label="연결된 전광판 관리">
    <aside class="vms-side">
      <header><h2>연결된 전광판 {{vmsList.length}}대</h2><p v-if="vmsList.length">근접 {{nearCount}} · 원거리 {{vmsList.length-nearCount}} (가까운 순)</p></header>
      <p v-if="listError" class="vms-error" role="alert">{{listError}}</p>
      <p v-else-if="loading&&!vmsList.length" class="vms-empty" role="status">전광판 목록을 불러오는 중입니다.</p>
      <p v-else-if="!vmsList.length" class="vms-empty">1km 안에 연결된 전광판이 없습니다.</p>
      <div class="vms-options">
        <button v-for="v in vmsList" :key="v.id" type="button" class="vms-option" :aria-pressed="v.id===selectedId" @click="selectedId=v.id">
          <span class="vms-option-row"><strong>{{v.name}}</strong><span class="vms-chip" :class="v.zone==='NEAR'?'is-near':''">{{v.zone==='NEAR'?'근접 · 차단 정보':'원거리 · 차단+우회'}}</span></span>
          <small>{{v.dist??'—'}}m · {{v.spec||'규격 미상'}} · 페이지 {{v.pages?.length??0}}장<template v-if="v.pages?.some(p=>p.manual)"> (수동 {{v.pages.filter(p=>p.manual).length}})</template><template v-if="v.dummy"> · 더미</template></small>
        </button>
      </div>
      <p class="vms-note">{{underpassName||'이 지하차도'}}가 차단되면 근접 전광판엔 차단 정보, 원거리 전광판엔 차단+우회 정보가 자동으로 표출됩니다.</p>
    </aside>
    <div v-if="selected" class="vms-main">
      <header class="vms-main-head">
        <div><h2>{{selected.name}} <span class="vms-chip" :class="selected.zone==='NEAR'?'is-near':''">{{zoneLabel(selected)}} {{selected.dist??'—'}}m</span></h2><p>{{selected.spec||'규격 미상'}} · 전광판 번호 {{selected.id}}</p></div>
        <div class="vms-actions"><button type="button" :disabled="pagesLoading" @click="refresh">{{pagesLoading?'조회 중…':'새로고침'}}</button><button type="button" class="is-primary" :disabled="!manageable" :title="manageable?'':'담당 외 시설은 문구를 추가할 수 없습니다.'" @click="openEditor()">수동 페이지 추가</button></div>
      </header>
      <div class="vms-now">
        <div><h3>지금 표출 중</h3><VmsLedDisplay :messages="pages.map(p=>p.content)" /></div>
        <p class="vms-note">페이지가 여러 장이면 순서대로 돌아가며 표출됩니다. 자동 페이지는 단계에 따라 색이 바뀌고, 수동 페이지는 노랑입니다.</p>
      </div>
      <p v-if="pageError" class="vms-error" role="alert">{{pageError}}</p>
      <div>
        <h3>페이지 목록 · 총 {{pages.length}}건</h3>
        <div class="vms-table"><table>
          <thead><tr><th>번호</th><th>구분</th><th>표시 문구</th><th>원인 지하차도</th><th>수정 시각</th><th>처리</th></tr></thead>
          <tbody>
            <tr v-for="p in pages" :key="p.pageNo">
              <td class="num">{{p.pageNo}}</td>
              <td><span class="vms-chip" :class="p.defaultPage?'is-dummy':p.manual?'is-manual':''">{{pageKind(p)}}</span> <span v-if="isOther(p)" class="vms-chip is-other">다른 지하차도</span></td>
              <td class="content">{{p.content}}</td>
              <td>{{p.underpassName||'—'}}</td>
              <td class="num">{{p.updatedAt?displayDate(p.updatedAt):'—'}}</td>
              <td class="act">
                <span v-if="lockReason(p)" class="vms-lock">{{lockReason(p)}}</span>
                <span v-else class="vms-actions"><button type="button" @click="openEditor(p)">수정</button><button type="button" :class="{'is-danger':confirmDelete===p.pageNo}" @click="remove(p)">{{confirmDelete===p.pageNo?'정말 삭제':'삭제'}}</button></span>
              </td>
            </tr>
          </tbody>
        </table></div>
      </div>
      <div>
        <div class="vms-history-head"><h3>변경 이력</h3><select v-model="historySource" aria-label="변경 구분"><option value="">전체</option><option value="AUTO">자동</option><option value="MANUAL">수동</option></select></div>
        <p v-if="historyError" class="vms-error" role="alert">{{historyError}}</p>
        <p v-else-if="!history.length" class="vms-empty">변경 이력이 없습니다.</p>
        <div v-else class="vms-table"><table>
          <thead><tr><th>시각</th><th>구분</th><th>문구 변경</th><th>변경한 사람</th></tr></thead>
          <tbody>
            <tr v-for="h in history" :key="h.historyId">
              <td class="num">{{displayDate(h.changedAt)}}</td>
              <td><span class="vms-chip" :class="h.source==='MANUAL'?'is-manual':''">{{h.changeLabel||(h.source==='MANUAL'?'수동':'자동')}}</span></td>
              <td class="content"><span v-if="h.oldContent" class="vms-old">{{h.oldContent}}</span><span v-if="h.oldContent" aria-hidden="true"> → </span>{{h.newContent}}</td>
              <td>{{h.source==='AUTO'?'시스템':h.changedByName||'—'}}</td>
            </tr>
          </tbody>
        </table></div>
      </div>
    </div>
    <div v-if="editor" class="vms-modal-back" @click.self="editor=undefined" @keydown.esc="editor=undefined">
      <div class="vms-modal" role="dialog" aria-modal="true" aria-labelledby="vms-modal-title">
        <h3 id="vms-modal-title">{{editor.pageNo==null?'수동 페이지 추가':`${editor.pageNo}번 페이지 수정`}}</h3>
        <div class="vms-field"><span>전광판</span><div class="vms-fixed">{{selected?.name}} · {{selected?.spec}}<small>{{selected?.dist??'—'}}m · {{zoneLabel(selected)}} (고정)</small></div></div>
        <div class="vms-field"><span>원인 지하차도</span><div class="vms-fixed">{{underpassName||'현재 지하차도'}}<small>지금 보고 있는 지하차도로 자동 입력됩니다.</small></div></div>
        <div v-if="presets.length" class="vms-field"><span>기본 문구</span><div class="vms-presets"><button v-for="preset in presets" :key="preset.id" type="button" :aria-pressed="editor.presetId===preset.id" @click="usePreset(preset)"><b>{{categoryLabels[preset.category]||preset.category}}</b>{{preset.content.split(' — ')[1]||preset.content}}</button></div></div>
        <label class="vms-field"><span>표시 문구</span><textarea v-model="editor.content" rows="3" placeholder="줄바꿈으로 줄을 나눕니다" @input="editor.presetId=undefined"></textarea><small class="vms-counter" :class="{'is-over':contentLength>100}">{{contentLength}} / 100</small></label>
        <div class="vms-field"><span>미리보기</span><VmsLedDisplay :content="editor.content.trim()||'(문구를 입력하세요)'" /></div>
        <p v-if="editor.error" class="vms-error" role="alert">{{editor.error}}</p>
        <div class="vms-actions is-end"><button type="button" @click="editor=undefined">취소</button><button type="button" class="is-primary" :disabled="editor.saving||!contentLength||contentLength>100" @click="save">{{editor.saving?'저장 중…':editor.pageNo==null?'추가':'저장'}}</button></div>
      </div>
    </div>
    <p v-if="notice" class="vms-toast" role="status">{{notice}}</p>
  </section>
</template>
<style scoped src="../styles/components/underpass-vms-panel.css"></style>

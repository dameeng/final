<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { backend } from '../services/backend'
import { displayDate } from '../utils/display-date'

type Result = {
  id: number; eventId: number | null; cameraId: number | null; detected: boolean; confidence: number | null
  detectionCount: number; frameSeconds: number | null; analyzedAt: string; modelVersion: string
  reviewStatus: string; imageUrl: string | null; eventStatus: string | null
}
type Detail = { equipId: number; name: string; underpassName: string; state: string; current: Result | null; history: Result[] }
const props = defineProps<{ equipId: number; refreshKey?: number }>()
const emit = defineEmits<{ updated: [] }>()
const detail = ref<Detail>(), selected = ref<Result | null>(null), loading = ref(false), busy = ref(false)
const error = ref(''), content = ref(''), comment = ref<HTMLTextAreaElement>()
let controller: AbortController | undefined
const current = computed(() => detail.value?.current)
const canReview = computed(() => current.value?.eventId != null && ['CHECK_NEEDED', 'IN_PROGRESS'].includes(current.value.eventStatus || ''))
const labels: Record<string, string> = { PENDING: '확인 필요', CONFIRMED: '싱크홀 확인', FALSE_POSITIVE: '오탐 확인', RESOLVED: '조치 완료' }
const confidence = (value: number | null | undefined) => value == null ? '—' : (Number(value) * 100).toFixed(1) + '%'
const verdict = (item: Result) => item.detected ? labels[item.reviewStatus] || item.reviewStatus : '이상 미탐지'
function focusReview() { comment.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }); comment.value?.focus({ preventScroll: true }) }
defineExpose({ focusReview })
async function load() {
  controller?.abort()
  const c = new AbortController(); controller = c; loading.value = true; error.value = ''
  const previous = selected.value?.id !== current.value?.id ? selected.value?.id : undefined
  try {
    const data = await backend<Detail>(`/api/pm/equipments/${props.equipId}/road`, { signal: c.signal })
    if (c.signal.aborted) return
    detail.value = data; selected.value = data.history.find(item => item.id === previous) || data.current
  } catch (e) { if (!c.signal.aborted) error.value = (e as Error).message }
  finally { if (!c.signal.aborted) loading.value = false }
}
watch(() => props.equipId, () => { detail.value = undefined; selected.value = null; content.value = ''; void load() }, { immediate: true })
watch(() => props.refreshKey, () => void load())
onBeforeUnmount(() => controller?.abort())
async function review(verdict: string) {
  if (!current.value?.eventId || busy.value) return
  const equipmentId = props.equipId
  busy.value = true; error.value = ''
  try {
    const data = await backend<Detail>(`/api/pm/equipments/${equipmentId}/road/review`, {
      method: 'PATCH', body: { eventId: current.value.eventId, verdict, content: content.value },
    })
    if (props.equipId !== equipmentId) return
    detail.value = data; selected.value = data.current; content.value = ''; emit('updated')
  } catch (e) { if (props.equipId === equipmentId) error.value = (e as Error).message }
  finally { busy.value = false }
}
</script>
<template>
  <div class="road-panel">
    <p v-if="loading&&!detail" role="status">노면 분석 결과를 불러오는 중입니다.</p>
    <p v-if="error" role="alert" class="service-error">{{error}} <button class="btn sm" type="button" @click="load">다시 조회</button></p>
    <template v-if="detail">
      <div class="pm-grid road-summary">
        <section class="card">
          <h2>노면 상태</h2>
          <strong class="road-state" :class="{'needs-review':canReview}">{{detail.state}}</strong>
          <dl class="service-detail">
            <dt>관리 대상</dt><dd>{{detail.name}} · 노면</dd>
            <dt>지하차도</dt><dd>{{detail.underpassName}}</dd>
            <dt>분석 완료</dt><dd>{{current?displayDate(current.analyzedAt):'미분석'}}</dd>
            <dt>연결 CCTV</dt><dd>{{current?.cameraId?`카메라 #${current.cameraId}`:'카메라 미지정'}}</dd>
            <dt>모델</dt><dd>{{current?.modelVersion||'—'}}</dd>
          </dl>
        </section>
        <section class="card road-review" aria-label="탐지 확인·조치">
          <h2>확인·조치</h2>
          <p class="road-review-state">{{canReview?labels[current?.reviewStatus||'PENDING']:detail.state==='미분석'?'아직 분석 결과가 없습니다.':'처리 중인 탐지 건이 없습니다.'}}</p>
          <template v-if="canReview">
            <label class="road-comment">확인·조치 내용<textarea ref="comment" v-model="content" rows="3" maxlength="2000" :disabled="busy" placeholder="확인한 내용이나 현장 조치 내용을 입력하세요." /></label>
            <div class="road-actions">
              <button class="btn primary" type="button" :disabled="busy||current?.reviewStatus==='CONFIRMED'" @click="review('CONFIRMED')">싱크홀 확인</button>
              <button class="btn" type="button" :disabled="busy" @click="review('FALSE_POSITIVE')">오탐 처리</button>
              <button class="btn" type="button" :disabled="busy" @click="review('RESOLVED')">조치 완료</button>
            </div>
            <p class="road-note">현재 미처리 탐지 건에 적용되며, 처리 내용은 점검 이력에 기록됩니다.</p>
          </template>
        </section>
      </div>
      <section class="card road-evidence-card" aria-label="탐지 사진과 판단 근거">
        <h2>탐지 사진 · 판단 근거</h2>
        <div class="road-grid">
          <div class="road-evidence">
            <img v-if="selected?.imageUrl" :key="selected.id" :src="selected.imageUrl" :alt="`${detail.underpassName} 노면 싱크홀 의심 탐지 사진`" />
            <p v-else class="road-no-image">{{selected?'이 분석에서 싱크홀 의심이 탐지되지 않았습니다.':'아직 분석 결과가 없습니다.'}}</p>
          </div>
          <div>
            <dl class="service-detail">
              <dt>모델 신뢰도</dt><dd class="road-confidence">{{confidence(selected?.confidence)}}</dd>
              <dt>탐지 항목</dt><dd>{{selected?.detected?'싱크홀 의심':selected?'이상 미탐지':'미분석'}}</dd>
              <dt>분석 완료</dt><dd>{{selected?displayDate(selected.analyzedAt):'—'}}</dd>
              <dt>영상 내 위치</dt><dd>{{selected?.frameSeconds==null?'—':selected.frameSeconds.toFixed(2)+'초'}}</dd>
              <dt>판정</dt><dd>{{selected?verdict(selected):'미분석'}}</dd>
              <dt>모델</dt><dd>{{selected?.modelVersion||'—'}}</dd>
            </dl>
            <p class="road-note">모델 신뢰도는 설비 고장 위험 점수와 구분해 표시합니다.</p>
            <p v-if="selected&&selected.id!==current?.id" class="road-note">과거 분석 사진을 보고 있습니다. 확인·조치 버튼은 현재 미처리 건에 적용됩니다.</p>
          </div>
        </div>
      </section>
      <section class="card road-history">
        <h2>분석 이력 <small>최근 20건</small></h2>
        <p v-if="!detail.history.length" class="road-note">아직 분석 이력이 없습니다.</p>
        <div v-else class="service-table-wrap">
          <table class="service-table">
            <thead><tr><th>분석 완료</th><th>탐지 결과</th><th>모델 신뢰도</th><th>판정</th><th>사진</th></tr></thead>
            <tbody><tr v-for="item in detail.history" :key="item.id" :class="{'is-selected':selected?.id===item.id}">
              <td>{{displayDate(item.analyzedAt)}}</td><td>{{item.detected?'싱크홀 의심':'이상 미탐지'}}</td>
              <td>{{confidence(item.confidence)}}</td><td>{{verdict(item)}}</td>
              <td><button class="btn sm" type="button" :aria-pressed="selected?.id===item.id" @click="selected=item">{{selected?.id===item.id?'선택됨':'보기'}}</button></td>
            </tr></tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
<style scoped>
.road-panel{display:grid;gap:14px;min-width:0}.pm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.road-panel h2{margin:0 0 10px;font-size:16px}.road-state{display:block;font-size:30px;font-weight:700;margin-bottom:15px;overflow-wrap:anywhere}.road-state.needs-review{color:var(--warn,#b7791f)}.road-review-state{margin:0 0 12px;color:var(--ink-sub,#5b6573)}.road-comment{display:grid;gap:7px;font-size:14px}.road-comment textarea{width:100%;font:inherit;background:var(--surface,var(--background,#fff));color:var(--ink,#223349);border:1px solid var(--line,#d8e1ec);border-radius:6px;padding:9px;resize:vertical}.road-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.road-note{font-size:13px;color:var(--ink-sub,#66778b);margin:12px 0 0}.road-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px}.road-evidence{min-width:0}.road-evidence img{display:block;width:100%;height:auto;border-radius:8px}.road-no-image{padding:44px 18px;text-align:center;background:var(--line-soft,#f2f5f9);border-radius:8px}.road-confidence{font-size:24px;font-weight:600}.service-detail{display:grid;grid-template-columns:90px minmax(0,1fr);gap:9px;margin:0;font-size:14px}.service-detail dt{color:var(--ink-sub,#66778b)}.service-detail dd{margin:0;overflow-wrap:anywhere}.road-history small{font-size:12px;font-weight:400;color:var(--ink-sub,#66778b);margin-left:8px}.road-history .is-selected{background:var(--line-soft,#f2f5f9)}.road-history button[aria-pressed=true]{outline:2px solid var(--primary,#2b5c8a)}@media(max-width:850px){.pm-grid,.road-grid{grid-template-columns:minmax(0,1fr)}}
</style>

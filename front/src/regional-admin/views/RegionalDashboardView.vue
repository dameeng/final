<script setup lang="ts">
import { formatDecimal } from '../../shared/utils/format-number'

import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { adminKey } from '../../shared/admin/main'
import { adminApi, facilityDetailApi, type FacilityDetail } from '../../shared/admin/services/admin-api'
import { belongsToRegion } from '../../shared/admin/services/regional-access'
import type { Status, Underpass } from '../../shared/admin/services/underpasses'
import { buildRiskTrend } from '../utils/risk-trend'
import RegionalTimeline from '../components/RegionalTimeline.vue'
import RegionalMapPanel from '../components/RegionalMapPanel.vue'
const observationDialog = ref<HTMLDialogElement | null>(null)
const trendViewport = ref<HTMLDivElement | null>(null)
const trendWidth = ref(640)
let trendObserver: ResizeObserver | undefined
watch(trendViewport, el => {
  trendObserver?.disconnect()
  if (!el) return
  trendObserver = new ResizeObserver(([entry]) => { if(entry) trendWidth.value = Math.max(640, entry.contentRect.width) })
  trendObserver.observe(el)
})
onBeforeUnmount(() => trendObserver?.disconnect())
const followLatest = ref(true)
const currentTime = ref(new Date().toISOString())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { clock = setInterval(() => { currentTime.value = new Date().toISOString() }, 1000) })
async function goToLatest() {
  followLatest.value = true
  await nextTick()
  if (!disposed && observationDialog.value?.open && trendViewport.value) {
    trendViewport.value.scrollLeft = trendViewport.value.scrollWidth
  }
}
function openObservations() {
  currentTime.value = new Date().toISOString()
  observationDialog.value?.showModal()
  void goToLatest()
}
function trackTrendScroll() {
  const viewport = trendViewport.value
  if (viewport) followLatest.value = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft <= 8
}
const { state, control } = inject(adminKey)!
const facilities = computed(() => state.underpasses.filter(item => belongsToRegion(item, state.profile)))
const selected = computed(() => facilities.value.find(item => item.id === state.selectedId))
const regionName = computed(() => state.profile?.regionName || '담당 지역 미지정')
const timeline = ref<{reload:()=>void}|null>(null)
const listOpen = ref(true), detailOpen = ref(true)
function selectFacility(id: string) { state.selectedId = id; detailOpen.value = true }
const query = ref('')
const filter = ref('ALL')
const riskText = (item: Underpass) => ({ SAFE: '정상', WARNING: '주의', DANGER: '위험', UNKNOWN: '—' }[item.observedRiskLevel || 'UNKNOWN'])
const controlText = (item: Underpass) => item.controlState === 'BLOCKED' ? '통제 중' : item.controlState === 'OPEN' ? '통행 가능' : '—'
const filtered = computed(() => facilities.value.filter(item => item.name.toLowerCase().includes(query.value.trim().toLowerCase()) &&
  (filter.value === 'ALL' || (filter.value === 'BLOCKED' ? item.controlState === 'BLOCKED' : (item.observedRiskLevel || 'UNKNOWN') === filter.value))))
watch(facilities, rows => {
  if (!rows.some(item => item.id === state.selectedId)) state.selectedId = rows[0]?.id ?? null
}, { immediate: true })
const countsReady = computed(() => state.loaded && !state.error && state.profile?.regionId != null)

// 대시보드 요약 통계(담당 시설 수 / 정상·주의·위험 / 통제 중)는 프론트에서 직접 세지 않고
// 백엔드 집계 엔드포인트를 쓴다. REGIONAL_ADMIN이면 서버가 loginUser.regionId()로 자동 고정하므로
// regionId 파라미터는 넘기지 않는다. 아직 응답이 없으면(최초 로딩 중 등) 기존 클라이언트 집계로 폴백한다.
type FacilityKpi = { facilityCount:number; blockedCount:number; pendingReviewCount:number; remainingCount:number; alertsToday:number; dangerLevelCount:number; nearDangerCount:number }
type RegionRiskLevel = { regionId:number; regionName:string; safeCount:number; warningCount:number; dangerCount:number; totalCount:number }
const kpi = ref<FacilityKpi | null>(null)
const riskLevel = ref<RegionRiskLevel | null>(null)
async function loadSummary() {
  const results = await Promise.allSettled([
    adminApi<FacilityKpi>('/dashboard/facility-kpi'),
    adminApi<RegionRiskLevel[]>('/dashboard/region-risk-level'),
  ])
  const [kpiResult, riskResult] = results
  if (kpiResult.status === 'fulfilled' && kpiResult.value) kpi.value = kpiResult.value
  if (riskResult.status === 'fulfilled' && Array.isArray(riskResult.value)) riskLevel.value = riskResult.value[0] ?? null
}
watch(() => state.lastUpdated, () => { void loadSummary() }, { immediate: true })

const cards = computed(() => [
  { label: '담당 시설', value: kpi.value?.facilityCount ?? facilities.value.length, tone: 'total', hint: '담당 지역 전체' },
  { label: '정상', value: riskLevel.value?.safeCount ?? facilities.value.filter(item => item.observedRiskLevel === 'SAFE').length, tone: 'SAFE', hint: '위험 등급 기준' },
  { label: '주의', value: riskLevel.value?.warningCount ?? facilities.value.filter(item => item.observedRiskLevel === 'WARNING').length, tone: 'WARNING', hint: '위험 등급 기준' },
  { label: '위험', value: riskLevel.value?.dangerCount ?? facilities.value.filter(item => item.observedRiskLevel === 'DANGER').length, tone: 'DANGER', hint: '위험 등급 기준' },
  { label: '통제 중', value: kpi.value?.blockedCount ?? facilities.value.filter(item => item.controlState === 'BLOCKED').length, tone: 'BLOCKED', hint: '통제 여부 별도 집계' },
])
function timeLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function numberLabel(value: unknown, unit: string) {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toLocaleString('ko-KR')} ${unit}`
}
type RiskPoint = { riskScore?: number | null; predictedAt?: string; rainfallMm?: number | null; rainfall1hMm?: number | null; rainfall3hMm?: number | null; rainfall6hMm?: number | null; rainfall12hMm?: number | null; rainfall24hMm?: number | null }
type Weather = { temperature?:number|null; humidity?:number|null; rainfall?:number|null; condition?:string; observedAt?:string }
const weather = ref<Weather|null>(null), weatherError = ref('')
const thresholds = ref<{level:string;riskScoreMin:number}[]>([])
const detail = ref<FacilityDetail | null>(null)
const risks = ref<RiskPoint[]>([])
const detailError = ref(''), riskError = ref('')
const detailLoading = ref(false)
const feedback = ref('')
const actionFailed = ref(false)
let requestVersion = 0
let disposed = false
let loadingId: string | undefined
async function loadSelected() {
  const id = selected.value?.id
  if (loadingId === id && detailLoading.value) return
  const facilityChanged = loadingId !== id
  loadingId = id
  const version = ++requestVersion
  weather.value=null; weatherError.value=''; thresholds.value=[]
  detail.value = null
  if (facilityChanged || !id) { risks.value = []; followLatest.value = true }
  detailError.value = ''; riskError.value = ''
  if (!id) { detailLoading.value = false; return }
  detailLoading.value = true
  const results = await Promise.allSettled([
    facilityDetailApi(id),
    adminApi<RiskPoint[]>(`/underpasses/${encodeURIComponent(id)}/risk-scores?hours=24`),
    adminApi<{level:string;riskScoreMin:number}[]>(`/underpasses/${encodeURIComponent(id)}/thresholds`),
    selected.value?.latitude != null && selected.value?.longitude != null ? adminApi<Weather>(`/weather?lat=${selected.value.latitude}&lng=${selected.value.longitude}`) : Promise.reject(new Error('위치 미수신')),
  ])
  if (disposed || version !== requestVersion || selected.value?.id !== id) return
  const [detailResult, riskResult, thresholdResult, weatherResult] = results
  if(thresholdResult.status === 'fulfilled' && Array.isArray(thresholdResult.value)) thresholds.value=thresholdResult.value
  if(weatherResult.status === 'fulfilled' && weatherResult.value) weather.value=weatherResult.value
  else weatherError.value='날씨 연결 확인 필요'
  if (detailResult.status === 'fulfilled' && detailResult.value) detail.value = detailResult.value
  else detailError.value = '시설 상세 정보를 불러오지 못했습니다.'
  if (riskResult.status === 'fulfilled' && Array.isArray(riskResult.value)) {
    risks.value = [...riskResult.value].sort((a, b) => Date.parse(a.predictedAt || '') - Date.parse(b.predictedAt || ''))
  } else riskError.value = '관측 기록 연결 확인 필요'
  detailLoading.value = false
}
watch(() => [selected.value?.id, state.lastUpdated], () => { void loadSelected() }, { immediate: true })
watch(() => selected.value?.id, () => { feedback.value = '' })
onBeforeUnmount(() => { disposed = true; requestVersion++; clearInterval(clock) })
const score = computed(() => latest.value?.riskScore ?? selected.value?.riskScore)
// 기존 임계치 설정 화면에서 정의한 위험 점수 범위(0~100점)를 재사용한다.
const gaugeMax = 100
const latest = computed(() => risks.value.at(-1))
const trend = computed(() => buildRiskTrend(risks.value, 5, trendWidth.value))
watch(trend, () => {
  if (followLatest.value && observationDialog.value?.open) void goToLatest()
}, { flush: 'post' })
const rainColumns = computed(() => [
  ['현재', latest.value?.rainfallMm], ['1시간', latest.value?.rainfall1hMm], ['3시간', latest.value?.rainfall3hMm],
  ['6시간', latest.value?.rainfall6hMm], ['12시간', latest.value?.rainfall12hMm], ['24시간', latest.value?.rainfall24hMm],
])
async function submitControl(status: Status) {
  const item = selected.value
  if (!item || state.controlBusy || state.loading || state.error) return
  const action = status === '통제' ? '통제' : '통제 해제'
  if (!window.confirm(`${item.name}\n현재 상태: ${controlText(item)}\n이 시설을 ${action}하시겠습니까?`)) return
  feedback.value = ''; actionFailed.value = false
  try {
    await control(item.id, status)
    if (selected.value?.id === item.id) feedback.value = `${item.name}: ${action} 요청이 처리되었습니다. 아래 현재 상태를 확인해 주세요.`
  } catch (error) { actionFailed.value = true; feedback.value = error instanceof Error ? error.message : '제어에 실패했습니다.' }
  finally { await loadSelected(); timeline.value?.reload() }
}
</script>
<template>
  <div class="regional-dashboard">
    <div class="regional-page-heading">
      <div><p class="regional-eyebrow">{{ regionName }} · 지역 관리자</p><h1>종합 현황</h1></div>
      <div class="regional-heading-actions"><div><span>선택 시설</span><strong>{{ selected?.name || '시설 미선택' }}</strong></div><button type="button" :disabled="!selected" @click="openObservations">관측 기록</button></div>
    </div>
    <p v-if="!state.loaded || state.loading" class="regional-notice" role="status">시설 정보를 불러오는 중입니다.</p>
    <p v-if="state.error && state.lastUpdated" class="regional-notice">현재 목록은 마지막 수신 자료입니다. 새로고침 전까지 제어할 수 없습니다.</p>
    <div class="regional-stats" aria-label="담당 지역 요약">
      <section v-for="card in cards" :key="card.label" class="regional-stat" :data-tone="card.tone"><h2>{{ card.label }}</h2><p><strong>{{ countsReady ? card.value : '—' }}</strong><span>곳</span></p><small>{{ card.hint }}</small></section>
    </div>
    
    <div class="regional-top-grid">
      <RegionalTimeline ref="timeline" :items="facilities" :updated="state.lastUpdated" @select="selectFacility" :key="state.profile?.regionId ?? 'none'" />
      <section class="regional-map-stage">
        <RegionalMapPanel :items="facilities" @select="selectFacility" />
        <section class="regional-panel regional-map-list" @click.stop @pointerdown.stop>
          <div class="regional-panel-heading"><h2>시설 통제 현황</h2><button :aria-expanded="listOpen" aria-controls="regional-facility-list" @click="listOpen=!listOpen">{{ listOpen ? '접기' : '펼치기' }}</button></div>
          <p class="regional-caption">담당 시설 {{ countsReady ? facilities.length : '—' }}곳</p>
          <div v-if="listOpen" id="regional-facility-list"><input v-model="query" aria-label="시설 검색" placeholder="시설명 검색"/><div class="regional-facility-scroll"><button v-for="item in filtered" :key="item.id" :aria-pressed="item.id===state.selectedId" @click="selectFacility(item.id)"><strong>{{ item.name }}</strong><span>{{ riskText(item) }} · {{ controlText(item) }}</span></button><p v-if="!filtered.length">{{ state.loading ? '조회 중' : state.error ? '연결 확인 필요' : '시설 없음' }}</p></div></div>
        </section>
        <button v-if="selected && !detailOpen" class="regional-reopen-detail" @click="detailOpen=true">{{ selected.name }} 상세 열기</button>
      <section v-if="detailOpen" class="regional-panel regional-facility-detail" @click.stop @pointerdown.stop aria-label="선택 시설 상세" :aria-busy="detailLoading">
        <div class="regional-panel-heading"><h2>선택 시설</h2><button @click="detailOpen=false" aria-label="시설 상세 닫기">닫기</button></div>
        <template v-if="selected">
          <h3>{{ selected.name }}</h3><p class="regional-caption">{{ detail?.roadAddress || selected.region }}</p>
          <div class="regional-badges"><span class="regional-badge" :data-tone="selected.observedRiskLevel || 'UNKNOWN'">위험 등급 · {{ riskText(selected) }}</span><span class="regional-badge" :data-tone="selected.controlState === 'BLOCKED' ? 'BLOCKED' : selected.controlState === 'OPEN' ? 'SAFE' : 'UNKNOWN'">{{ controlText(selected) }}</span></div>
          <p v-if="detailLoading" role="status">상세 정보를 불러오는 중입니다.</p>
          <p v-if="detailError || riskError" role="alert">{{ detailError || riskError }} <button type="button" :disabled="detailLoading" @click="loadSelected">다시 시도</button></p>
          <div class="regional-gauge"><strong>{{ formatDecimal(score) + (score == null ? '' : '점') }}</strong><meter v-if="score != null && thresholds.length" :value="Number(score)" min="0" :max="gaugeMax" :low="thresholds.find(t=>t.level==='WARNING')?.riskScoreMin" :high="thresholds.find(t=>t.level==='DANGER')?.riskScoreMin" :optimum="0" aria-label="위험 점수, 서버 임계치 기준"></meter><p class="regional-caption">{{ thresholds.length ? thresholds.map(t=>`${t.level}: ${formatDecimal(t.riskScoreMin)}점 이상`).join(' · ') : '—' }}</p></div>
          <div class="regional-weather"><h3>시설 위치 날씨</h3><p v-if="weatherError" class="regional-caption">{{ weatherError }}</p><p v-else>{{ weather?.condition || '—' }} · {{ numberLabel(weather?.temperature, '°C') }} · 습도 {{ numberLabel(weather?.humidity, '%') }}</p><p class="regional-caption">현재 관측 강수량 {{ numberLabel(weather?.rainfall, 'mm') }} · {{ timeLabel(weather?.observedAt) }}</p></div>
          <dl class="regional-detail-list">
            <dt>시설 ID</dt><dd>{{ selected.id }}</dd>
            
            <dt>강우량</dt><dd>{{ numberLabel(latest?.rainfallMm ?? selected.rainfall, 'mm') }}</dd>
            <dt>위험 점수</dt><dd>{{ formatDecimal(latest?.riskScore ?? selected.riskScore) }}</dd>
            <dt>위험도 관측</dt><dd>{{ timeLabel(latest?.predictedAt) }}</dd>
          </dl>
          <div class="regional-detail-links"><router-link :to="`/facilities/${selected.id}`">시설 상세</router-link><router-link :to="`/facilities/${selected.id}/cctv`"></router-link><router-link :to="`/facilities/${selected.id}/operations`"></router-link><router-link to="/regional/facilities"></router-link></div>
          <div class="regional-control-actions"><button type="button" class="regional-block-button" :disabled="state.controlBusy || state.loading || !!state.error || selected.controlState !== 'OPEN'" @click="submitControl('통제')">{{ state.controlBusy ? '처리 중…' : '통제' }}</button><button type="button" :disabled="state.controlBusy || state.loading || !!state.error || selected.controlState !== 'BLOCKED'" @click="submitControl('정상')">통제 해제</button></div>
          <p v-if="selected.controlState === 'UNKNOWN'" class="regional-caption">현재 통제 상태를 확인한 후 제어할 수 있습니다.</p>
          <p v-if="feedback" :role="actionFailed ? 'alert' : 'status'">{{ feedback }}</p>
        </template>
        <p v-else class="regional-empty">{{ state.loading ? '시설 정보를 불러오는 중입니다.' : state.error ? '시설 연결 상태를 확인해 주세요.' : '표시할 담당 시설이 없습니다.' }}</p>
      </section>
      </section>
    </div>
    <dialog ref="observationDialog" class="regional-observation-dialog" aria-labelledby="regional-observation-title" @click="event => { if (event.target === observationDialog) observationDialog?.close() }">
    <section class="regional-panel regional-observations">
      <div class="regional-panel-heading"><h2 id="regional-observation-title">선택 시설 관측 기록</h2><span>{{ selected?.name || '시설 미선택' }}</span></div>
      <p v-if="riskError" role="alert">{{ riskError }}</p>
      <div class="regional-observation-grid">
        <div><div class="regional-trend-heading"><h3>위험 점수 추이</h3></div><div class="regional-observation-times"><p>현재 시각 <time :datetime="currentTime">{{ timeLabel(currentTime) }}</time></p><p>최신 관측 <time v-if="trend.points.length" :datetime="trend.points.at(-1)?.time">{{ timeLabel(trend.points.at(-1)?.time) }}</time><span v-else>—</span></p></div><div ref="trendViewport" class="regional-trend-scroll" v-if="trend.points.length" @scroll.passive="trackTrendScroll" tabindex="0" aria-label="위험 점수 추이 시간축 스크롤"><svg class="regional-trend" :viewBox="`0 0 ${trend.width} 170`" :width="trend.width" height="170" role="img" aria-label="선택 시설 위험 점수 추이, 5분 간격, 세로축 0에서 100점"><g v-for="n in [0,50,100]" :key="n"><line x1="40" :x2="trend.width - 20" :y1="130-n" :y2="130-n"/><text x="4" :y="134-n">{{ n }}</text></g><path v-for="(path,i) in trend.paths" :key="i" :d="path"/><g v-for="point in trend.points" :key="point.time"><circle :cx="point.x" :cy="point.y" r="3"><title>{{ timeLabel(point.time) }} · {{ point.score }}점</title></circle></g><text v-for="tick in trend.ticks" :key="tick.time" :x="tick.x" y="155" text-anchor="middle">{{ tick.label }}</text></svg></div><p v-else class="regional-empty">{{ detailLoading ? '불러오는 중입니다.' : '유효한 관측 기록이 없습니다.' }}</p></div>
        <div><h3>강수량 기록</h3><div class="regional-rain-grid"><div v-for="column in rainColumns" :key="String(column[0])"><span>{{ column[0] }}</span><strong>{{ numberLabel(column[1], 'mm') }}</strong></div></div></div>
      </div>
      <div class="regional-observation-actions"><button type="button" @click="observationDialog?.close()">닫기</button></div>
    </section>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { managerAppPath } from '../utils/manager-app-path'
const appPath = (path: string) => managerAppPath(path, route.path)
// 예지보전 설비 상세 (/pm-equipment-detail?id=). 예전 목업(pm-equipment-detail.vue + data/pm-equipment-detail.json)을 대신한다.
//  GET /api/pm/equipments/{id}                 기본 정보 + 판단 근거(detail.features, extra) + 기준 + 상위 원인 + 최근 점검 5건
//  GET /api/pm/equipments/{id}/scores?days=7   7일 위험 점수 (1시간 구간 평균·최고)
//  GET /api/pm/equipments/{id}/sensor-trend    원인 센서 1시간 평균 + 평소 범위(처음 28일 평균 ± 2σ)
//  GET /api/pm/equipments/{id}/thresholds      기준 수정자 + 변경 이력
//  GET /api/pm/events, /api/pm/equipments      열린 점검의 발생 이유, 이전/다음 설비 순서
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import PmRiskGauge from '../components/PmRiskGauge.vue'
import PmActionModal from '../components/PmActionModal.vue'
import RoadEquipmentPanel from '../components/RoadEquipmentPanel.vue'
import { backend, type PageData } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { riskTimestamp } from '../utils/risk-chart'
import {
  PM_TYPES, PM_EVENT_STATUS, PM_TRIGGERS, PM_CAUSES, PM_SENSOR_COLUMNS, PM_FEATURE_COLUMN, PM_SENSOR_UNITS,
  pmLabel, isPmChange,
} from '../utils/pm-labels'

type Feature = {
  key: string; label: string; kind: string; value: number; unit?: string
  normal?: { median: number; low: number; high: number }; contribution: number; direction: string
}
type Cause = { key: string; label: string; value: number; unit?: string; median: number; contribution: number; points: number }
type Detail = {
  equipment: Record<string, any>
  currentSensors?: { recordedAt: string | null; values: Record<string, number | null> } | null
  detail: { features?: Feature[]; extra?: Record<string, any> } | null
  cautionMin: number; dangerMin: number
  lastCheckedAt: string | null; recentActions: Record<string, any>[]
  modelVersion: string | null; scoredAt: string | null; anomalyStartedAt: string | null
  topCauses: Cause[]
}
type Point = { at: string; value: number }
type Trend = { column: string; points: Point[]; band: { low: number; high: number; mean: number } | null }

const roadPanel = ref<InstanceType<typeof RoadEquipmentPanel>>()
const roadRefresh = ref(0)
const detailRoot=ref<HTMLElement>()
let cardObserver:IntersectionObserver|undefined
watch(detailRoot,root=>{
  cardObserver?.disconnect()
  if(!root||matchMedia('(prefers-reduced-motion: reduce)').matches)return
  cardObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('pm-card-visible');cardObserver?.unobserve(entry.target)}
  },{threshold:.08})
})
const route = useRoute(),
  router = useRouter(),
  id = computed(() => String(route.query.id || '')),
  data = ref<Detail>(),
  scores = ref<{ at: string; score: number; maxScore: number }[]>([]),
  threshold = ref<{ threshold?: Record<string, any>; history?: Record<string, any>[] }>(),
  openEvent = ref<Record<string, any>>(),
  order = ref<number[]>([]),
  column = ref(''),
  trends = ref<Trend[]>([]),
  trendError = ref(''),
  trendLoading = ref(false),
  loading = ref(false),
  error = ref(''),
  modal = ref<InstanceType<typeof PmActionModal>>()
let controller: AbortController | undefined, trendController: AbortController | undefined

const eq = computed(() => data.value?.equipment || {})
const extra = computed(() => data.value?.detail?.extra || {})
const sensorColumns = computed(() => PM_SENSOR_COLUMNS[eq.value.type] || [])
const sensorSnapshot = computed(() => data.value?.currentSensors)
const sensorCurrentRows = computed(() => sensorColumns.value.map(([key, label]) => ({
  key, label, unit: PM_SENSOR_UNITS[key] || '', value: sensorSnapshot.value?.values[key] ?? null,
})))
const features = computed(() =>
  [...(data.value?.detail?.features || [])].sort((a, b) => b.contribution - a.contribution),
)
// 전광판은 본체 온도만 그리면 하루 온도 변화에 묻혀서, 본체·외기 온도를 한 그래프에 겹쳐 보여준다
const tabs = computed<[string, string][]>(() => {
  const cols = PM_SENSOR_COLUMNS[eq.value.type] || []
  if (eq.value.type === 'CCTV') return cols.map(([key, label]) => [key, key === 'video_receive_rate' ? '수신율' : key === 'packet_loss_rate' ? '손실률' : label])
  if (eq.value.type !== 'DISPLAY') return cols
  return [['temperature_c', '온도 비교'], ...cols.filter(([c]) => c !== 'temperature_c' && c !== 'ambient_c')]
})
const position = computed(() => order.value.indexOf(Number(id.value)))
const scoreValue = computed(() => (eq.value.score == null ? null : Number(eq.value.score)))

// withTrend: 실시간 이벤트로 다시 읽을 때 센서 추이도 같이 갱신 (처음 열 때는 항상 갱신)
async function load(withTrend = false) {
  controller?.abort()
  if (!id.value) return
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  const get = <T,>(path: string) => backend<T>(path, { signal: current.signal })
  const base = '/api/pm/equipments/' + encodeURIComponent(id.value)
  try {
    const detail = await get<Detail>(base)
    if (current.signal.aborted) return
    const firstLoad = String(data.value?.equipment?.equipId ?? '') !== id.value
    data.value = detail
    if (detail.equipment.type === 'ROAD') {
      scores.value = []; threshold.value = undefined; openEvent.value = undefined
      trends.value = []; column.value = ''
      if (withTrend) roadRefresh.value++
      const rows = await get<PageData<{ equipId: number }>>('/api/pm/equipments?size=100').catch(() => null)
      if (!current.signal.aborted && rows) order.value = rows.items.map((row) => row.equipId)
      return
    }
    if (firstLoad) {
      const cols = PM_SENSOR_COLUMNS[detail.equipment.type] || []
      const fromCause = PM_FEATURE_COLUMN[detail.topCauses?.[0]?.key || ''] || causeColumn(detail)
      column.value = cols.some(([c]) => c === fromCause) ? fromCause : cols[0]?.[0] || ''
    }
    const [sc, th, ev, list] = await Promise.allSettled([
      get<typeof scores.value>(base + '/scores?days=7'),
      get<typeof threshold.value>(base + '/thresholds'),
      detail.equipment.openEventId ? get<PageData<Record<string, any>>>('/api/pm/events?size=100') : Promise.resolve(null),
      get<PageData<{ equipId: number }>>('/api/pm/equipments?size=100'),
    ])
    if (current.signal.aborted) return
    scores.value = sc.status === 'fulfilled' && Array.isArray(sc.value) ? sc.value : []
    threshold.value = th.status === 'fulfilled' ? th.value : undefined
    openEvent.value =
      ev.status === 'fulfilled' && ev.value
        ? ev.value.items.find((e) => e.eventId === detail.equipment.openEventId)
        : undefined
    if (list.status === 'fulfilled') order.value = list.value.items.map((r) => r.equipId)
    if (firstLoad || withTrend) void loadTrend()
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
// 펌프의 "평소 범위를 벗어난 센서 비율"처럼 특정 센서가 없는 특징이면 의심 원인 센서로 연다
function causeColumn(detail: Detail) {
  return String(detail.detail?.extra?.suspectedCause || '')
}

async function loadTrend() {
  trendController?.abort()
  if (!column.value || !id.value) return
  const current = new AbortController()
  trendController = current
  trendError.value = ''
  trendLoading.value = true
  trends.value = []
  const cols = eq.value.type === 'DISPLAY' && column.value === 'temperature_c' ? ['temperature_c', 'ambient_c'] : [column.value]
  try {
    const got = await Promise.all(
      cols.map((c) =>
        backend<Trend>(
          '/api/pm/equipments/' + encodeURIComponent(id.value) + '/sensor-trend?days=7&column=' + encodeURIComponent(c),
          { signal: current.signal },
        ),
      ),
    )
    if (!current.signal.aborted) trends.value = got
  } catch (e) {
    if (!current.signal.aborted) {
      trends.value = []
      trendError.value = (e as Error).message
    }
  } finally { if(!current.signal.aborted)trendLoading.value=false }
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined
useBackendEvents(({ name, data: payload }) => {
  if (name === 'pm-update' && !(payload?.items || []).some((i: any) => String(i.equipId) === id.value)) return
  if (name === 'connected' || isPmChange(name, payload, ['pm-equipment', 'pm-event', 'pm-action', 'pm-threshold'])) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void load(true), 300)
  }
})
watch(id, () => {
  data.value = undefined
  trends.value = []
  void load()
}, { immediate: true })
watch(column, (next, prev) => {
  if (prev) void loadTrend()
})
onBeforeUnmount(() => {
  cardObserver?.disconnect()
  clearTimeout(refreshTimer)
  controller?.abort()
  trendController?.abort()
})

function go(step: number) {
  const next = order.value[position.value + step]
  if (next != null) void router.push({ path: appPath('/pm-equipment-detail'), query: { id: String(next) } })
}
function act() {
  if (eq.value.openEventId)
    modal.value?.open({ eventId: eq.value.openEventId, name: eq.value.name, status: eq.value.openEventStatus, underpassName: eq.value.underpassName })
}
const num = (v: unknown, digits = 3) => (v == null || !Number.isFinite(Number(v)) ? '—' : String(+Number(v).toFixed(digits)))

// ---- 특징값 막대: 정상 범위 띠 + 평소 값 눈금 + 지금 값 점 ----
function featureBar(f: Feature) {
  const lo = f.normal?.low ?? f.value, hi = f.normal?.high ?? f.value
  const span = hi - lo || Math.abs(f.value) || 1
  const min = Math.min(lo - span, f.value - span * 0.3), max = Math.max(hi + span, f.value + span * 0.3)
  const pos = (v: number) => ((v - min) / (max - min)) * 100
  const out = f.normal ? f.value > f.normal.high || (f.kind === '변화량' && f.value < f.normal.low) : false
  return { lo: pos(lo), width: pos(hi) - pos(lo), median: f.normal ? pos(f.normal.median) : null, value: pos(f.value), out }
}

// ---- 7일 위험 점수 그래프 (0~100, 기준 구간 배경) ----
const scoreChart = computed(() => {
  const rows = scores.value.map((r) => ({ t: riskTimestamp(r.at), s: Number(r.score), m: Number(r.maxScore) }))
    .filter((r) => Number.isFinite(r.t))
  const y = (v: number) => PT + PH - (Math.max(0, Math.min(100, v)) / 100) * PH
  const yTicks = [0, 50, 100].map((v) => ({ y: y(v), label: String(v) }))
  if (rows.length < 2) return { rows, y, yTicks, path: '', max: '', xTicks: [] as { x: number; label: string }[], last: null }
  const t0 = rows[0]!.t, t1 = rows[rows.length - 1]!.t
  const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * PW
  const line = (key: 's' | 'm') => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.t).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ')
  const end = rows[rows.length - 1]!
  return {
    rows, y, yTicks, path: line('s'), max: line('m'),
    xTicks: timeTicks(t0, t1).map((t) => ({ x: x(t.at), label: t.label })),
    last: { x: x(end.t), y: y(end.s), label: end.s.toFixed(1) + '점' },
  }
})

// ---- 원인 센서 그래프 (자동 눈금, 평소 범위 띠) ----
const trendChart = computed(() => {
  const series = trends.value.map((tr) => tr.points.map((p) => ({ t: riskTimestamp(p.at), v: Number(p.value) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)))
  const all = series.flat()
  if (!all.length) return null
  const band = trends.value.length === 1 ? trends.value[0]!.band : null
  const vals = all.map((p) => p.v).concat(band ? [band.low, band.high] : [])
  const axis = niceAxis(Math.min(...vals), Math.max(...vals))
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t))
  const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * TPW
  const y = (v: number) => PT + TPH - ((v - axis.min) / (axis.max - axis.min)) * TPH
  const main = series[0]!
  if(!main?.length)return null
  const last = main[main.length - 1]!
  return {
    paths: series.map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')),
    band: band
      ? {
          y: y(Math.min(band.high, axis.max)),
          h: y(Math.max(band.low, axis.min)) - y(Math.min(band.high, axis.max)),
          label: `${axis.format(band.low, 1)}~${axis.format(band.high, 1)}${unit.value}`,
        }
      : null,
    yTicks: axis.ticks.map((v) => ({ y: y(v), label: axis.format(v) })),
    xTicks: timeTicks(t0, t1).map((t) => ({ x: x(t.at), label: t.label })),
    last: { x: x(last.t), y: y(last.v), label: axis.format(last.v, 1) + unit.value, at:new Date(last.t).toISOString() },
    count:main.length,
    outside:band?last.v<band.low||last.v>band.high:null,
  }
})
const unit = computed(() => PM_SENSOR_UNITS[column.value] || '')

// ---- 그래프 공통: 보기 좋은 눈금 ----
const CW = 640, CH = 220, PL = 52, PR = 14, PT = 26, PB = 30, PW = CW - PL - PR, PH = CH - PT - PB
// 원인 센서 그래프는 카드 폭이 넓어서 가로로 긴 비율로 그려 높이를 낮춘다
const TCW = 1000, TCH = 220, TPW = TCW - PL - PR, TPH = TCH - PT - PB
// 값 범위를 1·2·2.5·5 단위로 반올림한 눈금 4~6개로 (예: 6.24~39.71 -> 0, 10, 20, 30, 40)
function niceAxis(lo: number, hi: number) {
  if (hi === lo) { lo -= 1; hi += 1 }
  const raw = (hi - lo) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(+v.toFixed(10))
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + (String(step / mag).includes('.') ? 1 : 0))
  const format = (v: number, extra = 0) =>
    Number(v.toFixed(digits + extra)).toLocaleString('ko-KR', { maximumFractionDigits: digits + extra })
  return { min, max, ticks, format }
}
// 시간 눈금: 이틀 넘게면 날짜마다 "10/18 토", 짧으면 6시간마다 "06시"
const WEEK = '일월화수목금토'
function timeTicks(t0: number, t1: number) {
  const out: { at: number; label: string }[] = []
  const day = 86400000, hours = 6 * 3600000
  if (t1 - t0 > 2 * day) {
    const d = new Date(t0)
    d.setHours(24, 0, 0, 0)
    for (; d.getTime() <= t1; d.setDate(d.getDate() + 1))
      out.push({ at: d.getTime(), label: `${d.getMonth() + 1}/${d.getDate()} ${WEEK[d.getDay()]}` })
  } else {
    let t = Math.ceil(t0 / hours) * hours
    for (; t <= t1; t += hours) {
      const d = new Date(t)
      out.push({ at: t, label: String(d.getHours()).padStart(2, '0') + '시' })
    }
  }
  return out
}
const tabLabel = computed(() => tabs.value.find(([c]) => c === column.value)?.[1] || column.value)
const sensorChartScroll = ref<HTMLElement>()
watch([sensorChartScroll, id, column], async () => {
  await nextTick()
  const chart = sensorChartScroll.value
  if (chart) chart.scrollLeft = chart.scrollWidth - chart.clientWidth
}, { flush: 'post' })
watch([data,trends],async()=>{
  await nextTick()
  detailRoot.value?.querySelectorAll('.card:not([data-pm-observed])').forEach(card=>{
    card.setAttribute('data-pm-observed','true');cardObserver?.observe(card)
  })
},{flush:'post'})
</script>
<template>
  <BackendLayout class="page-pm-equipment-detail">
    <section ref="detailRoot" class="service-workspace pm-detail">
      
      <div class="page-head service-heading">
        <div>
          
          <h1>{{eq.name||'설비 상세'}} <RiskLevelBadge v-if="eq.level" :value="eq.level" /></h1>
          <div class="sub">{{pmLabel(PM_TYPES,eq.type,'')}}<template v-if="eq.underpassName"> · {{eq.underpassName}}</template></div>
        </div>
        <div class="pm-detail-actions">
          <button class="btn" type="button" :disabled="position<=0" @click="go(-1)">‹ 이전 설비</button>
          <button class="btn" type="button" :disabled="position<0||position>=order.length-1" @click="go(1)">다음 설비 ›</button>
          <RouterLink class="btn pm-back-to-list" :to="appPath('/pm-equipment')">목록으로 가기</RouterLink>
        </div>
      </div>
      <p v-if="!id">설비 목록에서 설비를 선택해 주세요.</p>
      <p v-if="error" role="alert" class="service-error">{{error}} <button @click="load(true)">다시 시도</button></p>
      <p v-if="loading&&!data" role="status">설비 정보를 불러오는 중입니다.</p>

      <template v-if="data">
        <template v-if="eq.type==='ROAD'">
          <section v-if="eq.openEventId" class="card pm-road-inspection-entry"><h2>점검 확인</h2><div class="pm-buttons"><button class="btn" type="button" @click="roadPanel?.focusReview()">탐지 확인·조치</button><RouterLink class="btn primary" :to="{path:appPath('/pm-inspection'),query:{id:String(eq.equipId),eventId:String(eq.openEventId)}}">확인 필요</RouterLink></div></section>
          <RoadEquipmentPanel ref="roadPanel" :equip-id="Number(eq.equipId)" :refresh-key="roadRefresh" @updated="load()" />
          <section class="card">
            <h2>최근 점검 이력</h2>
            <p v-if="!data.recentActions?.length" class="pm-muted">아직 점검 기록이 없어요. 탐지 확인·조치에서 등록한 내용이 여기에 표시됩니다.</p>
            <ul v-else class="pm-list">
              <li v-for="a in data.recentActions" :key="a.actionId">
                <small>{{displayDate(a.createdAt)}} · {{a.managerName||'—'}}</small><span>{{a.content}}</span>
              </li>
            </ul>
            <RouterLink v-if="data.recentActions?.length" :to="{path:appPath('/pm-history'),query:{equipId:String(eq.equipId)}}">점검 이력 전체 →</RouterLink>
          </section>
        </template>
        <template v-else>
        <div class="pm-grid pm-overview-grid">
          <section class="card pm-risk-card">
            <div class="pm-section-heading"><h2>설비 위험도</h2><RiskLevelBadge v-if="eq.level" :value="eq.level" /></div>
            <PmRiskGauge :value="scoreValue" :level="eq.level" :caution="data.cautionMin" :danger="data.dangerMin" />
          </section>
          <section class="card pm-facts-card">
            <div class="pm-section-heading"><h2>설비 상태</h2><span class="pm-period">최근 관측</span></div>
            <dl class="service-detail pm-facts">
              <dt>이상 시작</dt><dd>{{data.anomalyStartedAt?displayDate(data.anomalyStartedAt):'이상 없음'}}</dd>
              <dt>최근 점수</dt><dd>{{data.scoredAt?displayDate(data.scoredAt):'아직 없음'}}</dd>
              <template v-if="extra.suspectedCause"><dt>의심 원인</dt><dd>{{pmLabel(PM_CAUSES,extra.suspectedCause)}}</dd></template>
              <template v-if="extra.anomalyType"><dt>이상 유형</dt><dd>{{extra.anomalyType}}</dd></template>
              <dt>모델</dt><dd class="pm-mono">{{data.modelVersion||'—'}}</dd>
            </dl>
          </section>
          <section class="card pm-inspection-card">
            <div class="pm-section-heading"><h2>점검 현황</h2><div class="pm-inspection-link-slot"><RouterLink v-if="eq.openEventId" class="btn primary" :to="{path:appPath('/pm-inspection'),query:{id:String(eq.equipId),eventId:String(eq.openEventId)}}">확인 필요</RouterLink><span v-else class="pm-period">점검 관리</span></div></div>
            <p v-if="eq.openEventId" class="pm-open-event">
              <span class="pm-chip pm-chip--open">{{pmLabel(PM_EVENT_STATUS,eq.openEventStatus)}}</span>
              <template v-if="openEvent">{{pmLabel(PM_TRIGGERS,openEvent.triggerType)}} · {{displayDate(openEvent.createdAt)}}</template>
            </p>
            <p v-else class="pm-inspection-empty">진행 중인 점검 없음</p>
            <dl class="service-detail pm-facts">
              <dt>최근 점검일</dt><dd>{{data.lastCheckedAt?displayDate(data.lastCheckedAt):'점검 기록 없음'}}</dd>
              <dt>단계 기준</dt><dd>주의 {{data.cautionMin}} · 위험 {{data.dangerMin}}</dd>
              <template v-if="threshold?.threshold?.updatedAt">
                <dt>기준 수정</dt><dd>{{threshold.threshold.updatedByName||'—'}} · {{displayDate(threshold.threshold.updatedAt)}}</dd>
              </template>
              <dt>마지막 수신</dt><dd>{{eq.lastReceivedAt?displayDate(eq.lastReceivedAt):'미수신'}}</dd>
            </dl>
            <div v-if="eq.openEventId" class="pm-buttons">
              <button v-if="eq.openEventStatus==='CHECK_NEEDED'" class="btn primary sm" type="button" @click="modal?.open({eventId:eq.openEventId,name:eq.name,status:eq.openEventStatus,underpassName:eq.underpassName},'start')">점검 시작</button>
              <button class="btn sm" type="button" @click="modal?.open({eventId:eq.openEventId,name:eq.name,status:eq.openEventStatus,underpassName:eq.underpassName},'note')">기록 추가</button>
              <button class="btn sm" type="button" @click="modal?.open({eventId:eq.openEventId,name:eq.name,status:eq.openEventStatus,underpassName:eq.underpassName},'resolve')">점검 종료</button>
            </div>
          </section>
        </div>

        <div class="pm-grid pm-analysis-grid">
          <section class="card pm-causes-card">
            <div class="pm-section-heading"><h2>주요 위험 원인</h2><span class="pm-period">상위 {{Math.min(data.topCauses?.length||0,3)}}개</span></div>
            <p v-if="!data.topCauses?.length" class="pm-muted">눈에 띄는 원인이 없어요.</p>
            <ol class="pm-causes">
              <li v-for="(c,i) in data.topCauses" :key="c.key">
                <span class="pm-cause-rank">{{String(i+1).padStart(2,'0')}}</span>
                <div>
                  <div class="pm-cause-title"><span>{{c.label}}</span><b>{{num(c.value)}}{{c.unit}}</b></div><small>평소 {{num(c.median)}}{{c.unit}}</small>
                  <span class="pm-meter"><b :style="{width:c.contribution+'%'}" :class="{first:i===0}"></b></span>
                </div>
                <strong :class="{first:i===0}">+{{num(c.points,1)}}점</strong>
              </li>
            </ol>
            <p v-if="data.topCauses?.length" class="pm-muted small">점수 {{scoreValue?.toFixed(1)}} 중 각 원인이 끌어올린 몫</p>
          </section>
          <section class="card pm-score-history">
            <div class="pm-section-heading"><h2>위험 점수 추이</h2><span class="pm-period">최근 7일</span></div>
            <svg v-if="scoreChart.path" class="pm-chart" :viewBox="`0 0 ${CW} ${CH}`" role="img" aria-label="최근 7일 위험 점수 추이">
              <rect :x="PL" :y="PT" :width="PW" :height="scoreChart.y(data.dangerMin)-PT" class="zone-danger" />
              <rect :x="PL" :y="scoreChart.y(data.dangerMin)" :width="PW" :height="scoreChart.y(data.cautionMin)-scoreChart.y(data.dangerMin)" class="zone-caution" />
              <g v-for="t in scoreChart.xTicks" :key="'x'+t.x">
                <line :x1="t.x" :x2="t.x" :y1="PT" :y2="PT+PH" class="grid-v" />
                <text :x="t.x" :y="CH-8" text-anchor="middle" class="tick">{{t.label}}</text>
              </g>
              <g v-for="t in scoreChart.yTicks" :key="'y'+t.y">
                <text :x="PL-8" :y="t.y+4" text-anchor="end" class="tick">{{t.label}}</text>
              </g>
              <line :x1="PL" :x2="PL+PW" :y1="PT+PH" :y2="PT+PH" class="axis" />
              <path :d="scoreChart.max" class="line-max" />
              <path :d="scoreChart.path" class="line-main" />
              <text :x="PL+PW-4" :y="PT+14" text-anchor="end" class="lbl-danger">위험 {{data.dangerMin}}</text>
              <text :x="PL+PW-4" :y="scoreChart.y(data.dangerMin)+14" text-anchor="end" class="lbl-caution">주의 {{data.cautionMin}}</text>
              <template v-if="scoreChart.last">
                <circle :cx="scoreChart.last.x" :cy="scoreChart.last.y" r="4" class="dot-main" />
              </template>
            </svg>
            <p v-else class="pm-muted">
              점수 기록이 {{scoreChart.rows.length}}건뿐이라 아직 추이를 그릴 수 없어요.
              예지보전 서버의 지난 7일 채우기(백필)가 끝나면 그래프가 나와요.
            </p>
            <p v-if="scoreChart.path" class="pm-muted small">선 = 1시간 평균 · 옅은 선 = 구간 최고점 · 배경 = 이 설비의 기준</p>
          </section>
        </div>

        <section class="card">
          <h2>판단 근거 · 특징값 {{features.length}}개</h2>
          <p class="pm-muted small">파란 띠 = 정상 범위 · 회색 눈금 = 평소 값 · 점 = 지금 값 (범위를 벗어나면 빨강)</p>
          <p v-if="!features.length" class="pm-muted">아직 판단 근거가 없어요.</p>
          <div v-for="f in features" :key="f.key" class="pm-feature">
            <span>{{f.label}} <small v-if="f.kind==='변화량'">(변화량)</small></span>
            <div class="pm-feature-bar" :title="f.normal?`정상 ${num(f.normal.low)}~${num(f.normal.high)}${f.unit||''}`:''">
              <template v-for="b in [featureBar(f)]" :key="f.key+'b'">
                <i class="range" :style="{left:b.lo+'%',width:b.width+'%'}"></i>
                <i v-if="b.median!==null" class="median" :style="{left:b.median+'%'}"></i>
                <i class="dot" :class="{out:b.out}" :style="{left:b.value+'%'}"></i>
              </template>
            </div>
            <span><b :class="{'pm-out':featureBar(f).out}">{{num(f.value)}}{{f.unit}}</b>
              <small v-if="f.normal"> 정상 {{num(f.normal.low)}}~{{num(f.normal.high)}}</small></span>
            <small>영향 {{f.contribution}}%</small>
          </div>
        </section>

        <section v-if="sensorColumns.length" class="card pm-current-sensors" aria-label="센서 현재값">
          <div class="pm-section-heading"><h2>센서 현재값</h2><span class="pm-period">{{sensorColumns.length}}개 센서</span></div>
          <p class="pm-muted small" v-if="sensorSnapshot?.recordedAt">최근 측정 · {{displayDate(sensorSnapshot.recordedAt)}}</p>
          <p class="pm-muted small" v-else>아직 수신된 센서 측정값이 없습니다.</p>
          <dl class="pm-current-sensor-grid">
            <div v-for="sensor in sensorCurrentRows" :key="sensor.key" class="pm-current-sensor" :data-sensor="sensor.key">
              <dt>{{sensor.label}}</dt>
              <dd><strong>{{num(sensor.value)}}</strong><span v-if="sensor.value!==null&&sensor.unit">{{sensor.unit}}</span><small v-if="sensor.value===null">미수신</small></dd>
            </div>
          </dl>
        </section>

        <section v-if="extra.sensors?.length" class="card pm-sensor-table-card">
          <div class="pm-section-heading"><h2>최근 분석 센서 비교</h2><span class="pm-period">{{extra.sensors.length}}개 센서</span></div>
          <p class="pm-muted small">{{displayDate(data?.scoredAt)}} 분석 기준 · 최신 측정값은 위의 센서 현재값에서 확인하세요.</p>
          <div class="service-table-wrap">
            <table class="service-table">
              <thead><tr><th>센서</th><th>지금</th><th>평소</th><th>벗어난 정도</th><th>상태</th></tr></thead>
              <tbody>
                <tr v-for="s in extra.sensors" :key="s['항목']">
                  <td data-label="센서">{{s['센서']}}</td><td data-label="분석 시 값">{{num(s['현재'])}}</td><td data-label="평소">{{num(s['평소'])}}</td>
                  <td data-label="벗어난 정도">{{num(s['벗어난정도'],2)}}</td>
                  <td data-label="상태"><span class="pm-chip" :class="{'pm-chip--open':s['상태']!=='정상'}">{{s['상태']}}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card pm-sensor-card" :aria-busy="trendLoading">
          <div class="pm-section-heading"><div><p class="pm-eyebrow">SENSOR TREND</p><h2>원인 센서 추이</h2><p class="pm-muted small">최근 7일 · 1시간 평균값과 평소 범위 비교</p></div><span class="pm-period">최근 7일</span></div>
          <nav class="tabs pm-sensor-tabs" aria-label="센서">
            <button v-for="[value,label] in tabs" :key="value" type="button" :class="{'is-current':column===value}" :aria-pressed="column===value" @click="column=value">{{label}}</button>
          </nav>
          <p v-if="trendError" role="alert" class="service-error">{{trendError}}</p>
          <div v-if="trendLoading" class="pm-trend-loading" role="status">센서 추이를 불러오고 있습니다.</div>
          <div v-if="trendChart" class="pm-sensor-layout">
          <div class="pm-sensor-plot">
          <div v-if="trendChart" class="pm-legend">
            <span><i class="sw sw-sensor"></i>{{trends.length>1?'본체 온도':tabLabel}}</span>
            <span v-if="trends.length>1"><i class="sw sw-second"></i>외기 온도</span>
            <span v-if="trendChart.band"><i class="sw sw-band"></i>평소 범위 {{trendChart.band.label}}</span>
          </div>
          <div ref="sensorChartScroll" class="pm-chart-scroll" tabindex="0" role="region" aria-label="센서 추이 그래프. 좁은 화면에서는 가로로 스크롤할 수 있습니다.">
          <svg v-if="trendChart" :key="column" class="pm-chart pm-chart--wide" :viewBox="`0 0 ${TCW} ${TCH}`" role="img" :aria-label="tabLabel+' 최근 7일 추이'">
            <rect v-if="trendChart.band" :x="PL" :y="trendChart.band.y" :width="TPW" :height="trendChart.band.h" class="zone-normal" />
            <g v-for="t in trendChart.yTicks" :key="'y'+t.y">
              <line :x1="PL" :x2="PL+TPW" :y1="t.y" :y2="t.y" class="grid-h" />
              <text :x="PL-8" :y="t.y+4" text-anchor="end" class="tick">{{t.label}}</text>
            </g>
            <g v-for="t in trendChart.xTicks" :key="'x'+t.x">
              <line :x1="t.x" :x2="t.x" :y1="PT" :y2="PT+TPH" class="grid-v" />
              <text :x="t.x" :y="TCH-8" text-anchor="middle" class="tick">{{t.label}}</text>
            </g>
            <text v-if="unit" :x="PL-8" y="12" text-anchor="end" class="tick unit">({{unit}})</text>
            <path v-for="(d,i) in trendChart.paths" :key="i" :d="d" pathLength="1" :class="i?'line-second':'line-sensor'" />
            <circle :cx="trendChart.last.x" :cy="trendChart.last.y" r="5" class="dot-sensor"><title>{{displayDate(trendChart.last.at)}} · {{trendChart.last.label}}</title></circle>
          </svg>
          </div>
          </div>
          <aside class="pm-sensor-summary" aria-label="선택한 센서 요약">
            <span class="pm-muted small">{{tabLabel}} · 최근 관측값</span><strong class="pm-reading">{{trendChart.last.label}}</strong>
            <span class="pm-sensor-state" :class="{'is-outside':trendChart.outside,'is-unknown':trendChart.outside===null}">{{trendChart.outside===null?'기준 데이터 없음':trendChart.outside?'평소 범위 벗어남':'평소 범위 이내'}}</span>
            <dl><template v-if="trendChart.band"><dt>평소 범위</dt><dd>{{trendChart.band.label}}</dd></template><dt>관측 시각</dt><dd>{{displayDate(trendChart.last.at)}}</dd><dt>관측 구간</dt><dd>{{trendChart.count}}개</dd></dl>
          </aside>
          </div>
          <p v-if="!trendChart&&!trendLoading&&!trendError" class="pm-muted">아직 센서 기록이 없어요.</p>
          <p v-if="trendChart" class="pm-muted small">
            <template v-if="trends.length>1">1시간 평균 · 두 선 사이가 벌어질수록 본체가 평소보다 뜨거워요</template>
            <template v-else-if="trendChart.band">1시간 평균 · 평소 범위는 이 설비의 처음 28일 평균 ± 2σ</template>
            <template v-else>1시간 평균 · 평소 범위를 만들 기준 데이터가 아직 모자라요</template>
          </p>
        </section>

        <div class="pm-grid pm-history-grid">
          <section class="card pm-history-card">
            <div class="pm-section-heading"><h2>최근 점검 이력</h2><span class="pm-period">{{data.recentActions?.length||0}}건</span></div>
            <p v-if="!data.recentActions?.length" class="pm-muted">아직 점검 기록이 없어요. 점검 처리에서 등록하면 최근 5건이 여기에 보여요.</p>
            <ul v-else class="pm-list pm-timeline">
              <li v-for="a in data.recentActions" :key="a.actionId">
                <small>{{displayDate(a.createdAt)}} · {{a.managerName||'—'}}</small>
                <span>{{a.content}}</span>
              </li>
            </ul>
            <RouterLink v-if="data.recentActions?.length" :to="{path:appPath('/pm-history'),query:{equipId:String(eq.equipId)}}">점검 이력 전체 →</RouterLink>
          </section>
          <section class="card pm-history-card">
            <div class="pm-section-heading"><h2>단계 기준 변경 이력</h2><span class="pm-period">{{threshold?.history?.length||0}}건</span></div>
            <div class="pm-current-thresholds"><span>현재 적용 기준</span><b>주의 <strong>{{data.cautionMin}}</strong></b><b>위험 <strong>{{data.dangerMin}}</strong></b></div>
            <RouterLink :to="{path:appPath('/pm-settings'),query:{equipId:String(eq.equipId),underpassId:String(eq.underpassId)}}">이 설비 기준 변경 →</RouterLink>
            <p v-if="!threshold?.history?.length" class="pm-muted pm-history-empty">기준 변경 기록이 없습니다.</p>
            <ul v-else class="pm-list pm-timeline">
              <li v-for="(h,i) in threshold.history" :key="i">
                <small>{{displayDate(h.changedAt)}} · {{h.changedByName||'—'}}</small>
                <span>{{h.level}} {{h.oldMin??'—'}} → {{h.newMin}}</span>
              </li>
            </ul>
          </section>
        </div>
        </template>
      </template>
    </section>
    <PmActionModal ref="modal" @done="load" />
  </BackendLayout>
</template>
<style scoped>
.pm-detail { display: grid; gap: 14px; }
.pm-detail-actions, .pm-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
:global(#app .manager-app-shell) .pm-detail-actions>.pm-back-to-list { flex:0 0 100%; width:100%; }
.pm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
.pm-detail h2 { margin: 0 0 10px; font-size: 16px; }
.pm-big { display: block; font-size: 34px; font-weight: 700; }
.pm-big small { font-size: 14px; font-weight: 400; color: var(--ink-sub, #5b6573); }
.pm-big--danger { color: var(--danger, #c0392b); }
.pm-big--caution { color: var(--warn, #b7791f); }
.pm-gauge { position: relative; height: 10px; border-radius: 5px; background: var(--line-soft, #eef0f3); margin: 10px 0 2px; }
.pm-gauge b { display: block; height: 100%; border-radius: 5px; background: #3b8c3e; }
.pm-gauge b.pm-gauge--danger { background: var(--danger, #c0392b); }
.pm-gauge b.pm-gauge--caution { background: var(--warn, #d97706); }
.pm-gauge i { position: absolute; top: -3px; width: 2px; height: 16px; background: var(--warn, #d97706); }
.pm-gauge i.danger { background: var(--danger, #c0392b); }
.pm-gauge-labels { position: relative; height: 16px; font-size: 12px; color: var(--ink-sub, #5b6573); margin-bottom: 6px; }
.pm-gauge-labels span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.pm-mono { font-family: ui-monospace, Consolas, monospace; }
.pm-muted { color: var(--ink-sub, #5b6573); margin: 0; }
.pm-muted.small, .small { font-size: 12px; }
.pm-open-event { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }
.pm-chip { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 12px; background: #eaf3de; color: #27500a; }
.pm-chip--open { background: #fcebeb; color: #791f1f; }
.pm-causes { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.pm-causes li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
.pm-causes small { color: var(--ink-sub, #5b6573); }
.pm-causes strong.first { color: var(--danger, #c0392b); }
.pm-meter { display: block; height: 6px; border-radius: 3px; background: var(--line-soft, #eef0f3); margin-top: 4px; }
.pm-meter b { display: block; height: 100%; border-radius: 3px; background: #b4b2a9; }
.pm-meter b.first { background: var(--danger, #c0392b); }
.pm-feature { display: grid; grid-template-columns: 170px minmax(0, 1fr) 200px 64px; gap: 12px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line-soft, #eef0f3); }
.pm-feature small { color: var(--ink-sub, #5b6573); }
.pm-feature-bar { position:relative; height:16px; border-radius:4px; background:var(--r-soft,#f5f8fc); }
.pm-feature-bar i { position: absolute; display: block; }
.pm-feature-bar .range { top:4px; height:8px; border-radius:3px; background:color-mix(in srgb,var(--r-accent,#2375d6) 30%,var(--r-surface,#fff)); }
.pm-feature-bar .median { top: 2px; width: 2px; height: 12px; background: #5f5e5a; }
.pm-feature-bar .dot { top: 2px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--primary, #2b5c8a); }
.pm-feature-bar .dot.out { background: var(--danger, #c0392b); }
.pm-out { color: var(--danger, #c0392b); }
.pm-chart { width: 100%; height: auto; display: block; margin: 6px 0; }
.pm-chart .zone-danger { fill: #fcebeb; }
.pm-chart .zone-caution { fill: #faeeda; }
.pm-chart .zone-normal { fill:var(--pm-band-fill,#eaf3ff); }
.pm-chart .line-main { fill: none; stroke: var(--primary, #2b5c8a); stroke-width: 2.5; }
.pm-chart .line-max { fill: none; stroke: var(--primary, #2b5c8a); stroke-opacity: .3; stroke-width: 1.5; }
.pm-chart .line-sensor { fill: none; stroke: #d85a30; stroke-width: 2; }
.pm-chart .line-second { fill: none; stroke: #888780; stroke-width: 1.5; }
.pm-chart text { font-size: 12px; fill: var(--ink-sub, #5b6573); }
.pm-chart .tick { font-size: 11.5px; }
.pm-chart--wide { max-height: 240px; }
.pm-chart--wide .tick { font-size: 14px; }
.pm-chart .grid-h { stroke: var(--line-soft, #e8ebef); stroke-width: 1; }
.pm-chart .grid-v { stroke: var(--line-soft, #e8ebef); stroke-width: 1; stroke-dasharray: 2 4; }
.pm-chart .axis { stroke: var(--line, #d5dae1); }
.pm-chart .dot-main { fill: var(--primary, #2b5c8a); stroke: #fff; stroke-width: 2; }
.pm-chart .dot-sensor { fill: #d85a30; stroke: #fff; stroke-width: 2; }
.pm-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin: 10px 0 0; font-size: 13px; color: var(--ink-sub, #5b6573); }
.pm-legend span { display: inline-flex; align-items: center; gap: 6px; }
.pm-legend .sw { display: inline-block; width: 16px; height: 3px; border-radius: 2px; }
.pm-legend .sw-sensor { background: #d85a30; }
.pm-legend .sw-second { background: #888780; }
.pm-legend .sw-band { height:10px; background:var(--pm-band-fill,#eaf3ff); border:1px solid color-mix(in srgb,var(--r-accent,#2375d6) 35%,var(--r-line,#dce7f2)); }
.pm-legend-now { margin-left: auto; }
.pm-legend-now b { color: var(--ink, #1f2630); }
.pm-chart .lbl-danger { fill: #a32d2d; }
.pm-chart .lbl-caution { fill: #854f0b; }
.pm-detail .tabs button { font: inherit; }
.pm-list { list-style: none; padding: 0; margin: 0 0 8px; display: grid; gap: 8px; }
.pm-list li { display: grid; gap: 2px; }
.pm-list small { color: var(--ink-sub, #5b6573); }
@media (max-width: 760px) {
  .pm-feature { grid-template-columns: 1fr; gap: 4px; }
}
</style>
<style scoped src="../styles/pm-detail-polish.css"></style>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { adminApi } from '../services/admin-api'
import { adminKey } from '../main'
import MapPanel from '../components/MapPanel.vue'
import RegionRiskPanel from '../components/RegionRiskPanel.vue'
import '../styles/dashboard-risk.css'

const { state, refresh } = inject(adminKey)!
// MapPanel의 마커 클릭이 ctx.state.selectedId를 바꾸므로, 여기서도 로컬 ref가 아니라
// 전역 state.selectedId를 그대로 써야 마커 클릭이 이 화면(위험도 추이/강수량)에 반영된다.
const selectedId = computed({
  get: () => state.selectedId ?? '',
  set: (value: string) => { state.selectedId = value || null },
})
const facilities = computed(() => state.profile?.role === 'REGIONAL_ADMIN' ? state.underpasses.filter(item => item.region === state.profile?.regionName) : state.underpasses)
const dashboardTitle = computed(() => state.profile?.role === 'REGIONAL_ADMIN' ? `${state.profile.regionName || '담당 지역'} 시설통제 대시보드` : '시설통제 대시보드')
type RiskPoint = { riskScore: number; predictedAt: string; rainfallMm?: number | null; rainfall1hMm?: number | null; rainfall3hMm?: number | null; rainfall6hMm?: number | null; rainfall12hMm?: number | null; rainfall24hMm?: number | null }
const riskPoints = ref<RiskPoint[]>([])
const rainfall = computed(() => riskPoints.value.at(-1))
const rainValue = (value: number | null | undefined) => value == null ? '—' : `${value} mm`
let riskTimer: ReturnType<typeof setInterval> | undefined
async function loadRisk() {
  if (!selectedId.value) { riskPoints.value = []; return }
  try {
    const response = await fetch(`/api/underpasses/${encodeURIComponent(selectedId.value)}/risk-scores?limit=24`, { credentials: 'include', cache: 'no-store' })
    const json = await response.json()
    if (!response.ok || !Array.isArray(json.data)) throw new Error('조회 실패')
    riskPoints.value = json.data.filter((item: { riskScore: number }) => Number.isFinite(Number(item.riskScore)))
  } catch { riskPoints.value = [] }
}
watch(selectedId, () => { void loadRisk() }, { immediate: true })

// 종합 현황 집계는 /api/dashboard/*로 서버에서 받는다(지역담당자는 담당 지역만).
type RegionStatus = { regionId: number; regionName: string; normalCount: number; blockedCount: number; totalCount: number }
type StatusSummary = { normalCount: number; blockedCount: number; totalCount: number }
const summary = ref<StatusSummary | null>(null)
const regionStatus = ref<RegionStatus[]>([])
const dashboardError = ref('')
async function loadDashboard() {
  try {
    const regionId = state.profile?.role === 'REGIONAL_ADMIN' ? state.profile.regionId : null
    const query = regionId != null ? `?regionId=${regionId}` : ''
    const [rows, all] = await Promise.all([
      adminApi<RegionStatus[]>(`/dashboard/region-status${query}`),
      regionId != null ? Promise.resolve(null) : adminApi<StatusSummary>('/dashboard/status-summary'),
    ])
    regionStatus.value = rows ?? []
    summary.value = all ?? {
      normalCount: regionStatus.value.reduce((sum, row) => sum + row.normalCount, 0),
      blockedCount: regionStatus.value.reduce((sum, row) => sum + row.blockedCount, 0),
      totalCount: regionStatus.value.reduce((sum, row) => sum + row.totalCount, 0),
    }
    dashboardError.value = ''
  } catch (e) { dashboardError.value = (e as Error).message }
}
watch(() => [state.profile?.role, state.profile?.regionId, state.underpasses], () => void loadDashboard(), { immediate: true })
watch(facilities, (rows) => { if (!rows.some(item => item.id === selectedId.value)) selectedId.value = rows[0]?.id || '' }, { immediate: true })
riskTimer = setInterval(() => void loadRisk(), 30000)
onBeforeUnmount(() => clearInterval(riskTimer))
const statuses = ['정상', '주의', '통제'] as const
const count = (status: string) => facilities.value.filter((item) => item.status === status).length
const colors = { 정상: '#3b8c70', 주의: '#d89a36', 통제: '#c45555' }
const regions = computed(() => {
  const facility = (region: string) => facilities.value.filter((item) => item.region === region)
  const names = regionStatus.value.length
    ? regionStatus.value.map((row) => ({ name: row.regionName, total: row.totalCount, controlled: row.blockedCount }))
    : [...new Set(facilities.value.map((item) => item.region))].map((name) => ({ name, total: facility(name).length, controlled: facility(name).filter((item) => item.status === '통제').length }))
  return names.map((region) => ({
    ...region,
    safe: facility(region.name).filter(item => item.riskLevel === 'SAFE' || (!item.riskLevel && item.status === '정상')).length,
    warning: facility(region.name).filter(item => item.riskLevel === 'WARNING' || (!item.riskLevel && item.status === '주의')).length,
    danger: facility(region.name).filter(item => item.riskLevel === 'DANGER' || (!item.riskLevel && item.status === '통제')).length,
  }))
})
const circumference = 2 * Math.PI * 42
const segments = computed(() => {
  let progress = 0
  const total = Math.max(1, facilities.value.length)
  return statuses.map((status) => {
    const segment = { status, length: count(status) / total * circumference, offset: -progress }
    progress += segment.length
    return segment
  })
})
const trend = computed(() => riskPoints.value.map((item, index, rows) => {
  const score = Math.max(0, Math.min(100, Number(item.riskScore)))
  return `${20 + index * 460 / Math.max(rows.length - 1, 1)},${120 - score}`
}).join(' '))
</script>

<template>
<div class="routel-admin-page">
  <h1>{{ dashboardTitle }}</h1>
  <p><button type="button" @click="refresh">새로고침</button></p>
  <p v-if="dashboardError" role="alert">집계를 불러오지 못했습니다. ({{ dashboardError }})</p>
  <p>전체 {{ summary?.totalCount ?? facilities.length }}곳 · 통제 {{ summary?.blockedCount ?? count('통제') }}곳 · 운영 중 {{ summary?.normalCount ?? facilities.length - count('통제') }}곳 (그중 주의 {{ count('주의') }}곳)</p>

  <div class="routel-admin-split">
      
        <section class="routel-admin-panel">
          <h2>담당 지하차도 지도</h2>
          <MapPanel :items="facilities" />
          <p><router-link to="/facilities">시설 현황·통제/해제</router-link></p>
        </section>
        <section class="routel-admin-panel">
          <h2>시설 통제현황</h2>
          <svg v-if="facilities.length" viewBox="0 0 120 120" width="200" height="200" role="img" aria-label="전국 지하차도 상태 비율 원형 그래프">
            <circle v-for="part in segments" :key="part.status" cx="60" cy="60" r="42" fill="none"
              :stroke="colors[part.status]" stroke-width="18"
              :stroke-dasharray="`${part.length} ${circumference - part.length}`"
              :stroke-dashoffset="part.offset" transform="rotate(-90 60 60)" />
            <text x="60" y="65" text-anchor="middle" font-size="14">{{ facilities.length }}곳</text>
          </svg>
          <p v-else>표시할 시설이 없습니다.</p>
          <p v-for="status in statuses" :key="status">{{ status }} {{ count(status) }}곳</p>
        </section>
  </div>

  <RegionRiskPanel :items="facilities" :demo="false" />
  <details class="manager-region-details">
    <summary>지역별 상세 집계</summary>
    <div class="manager-region-details-scroll">
  <p>안전 · 주의 · 위험·통제</p>
  <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
    <tbody>
      <tr><th>지역</th><th>위험도별 시설</th><th>현황</th></tr>
      <tr v-for="region in regions" :key="region.name">
        <td>{{ region.name }}</td>
        <td><div class="region-risk-bars" :aria-label="`${region.name} 안전 ${region.safe}, 주의 ${region.warning}, 위험 ${region.danger}`" role="img">
          <span class="risk-safe" :style="{ flex: region.safe }"></span><span class="risk-warning" :style="{ flex: region.warning }"></span><span class="risk-danger" :style="{ flex: region.danger }"></span>
        </div></td>
        <td>안전 {{ region.safe }} · 주의 {{ region.warning }} · 위험·통제 {{ region.danger }} / {{ region.total }}곳</td>
      </tr>
    </tbody>
  </table></div>

    </div>
  </details>

  <h2>지하차도 위험도 추이</h2>
  <p><label>시설 <select v-model="selectedId"><option v-for="item in facilities" :key="item.id" :value="item.id">{{ item.name }}</option></select></label> · 위험점수 (30초마다 갱신, 지도 마커를 클릭해도 선택됩니다)</p>
  <svg v-if="riskPoints.length > 1" viewBox="0 0 500 140" width="100%" height="180" role="img" aria-label="지하차도 위험점수 추이 꺾은선 그래프">
    <line x1="20" y1="120" x2="480" y2="120" stroke="currentColor" />
    <polyline :points="trend" fill="none" stroke="#c45555" stroke-width="3" />
    <text x="20" y="136" font-size="11">{{ new Date(riskPoints[0].predictedAt).toLocaleString('ko-KR') }}</text>
    <text x="370" y="136" font-size="11">{{ new Date(riskPoints[riskPoints.length - 1].predictedAt).toLocaleString('ko-KR') }}</text>
  </svg>
  <p v-else>선택한 시설의 위험점수 기록이 두 건 이상이면 추이를 표시합니다.</p>

  <h2>선택한 시설 강수량 기록</h2>
  <p>위험도 기록에 저장된 값이며 지역 전체 기상예보는 아닙니다.</p>
  <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table"><thead><tr><th>현재</th><th>1시간</th><th>3시간</th><th>6시간</th><th>12시간</th><th>24시간</th></tr></thead>
    <tbody><tr><td>{{ rainValue(rainfall?.rainfallMm) }}</td><td>{{ rainValue(rainfall?.rainfall1hMm) }}</td><td>{{ rainValue(rainfall?.rainfall3hMm) }}</td><td>{{ rainValue(rainfall?.rainfall6hMm) }}</td><td>{{ rainValue(rainfall?.rainfall12hMm) }}</td><td>{{ rainValue(rainfall?.rainfall24hMm) }}</td></tr></tbody>
  </table></div>
</div>
</template>
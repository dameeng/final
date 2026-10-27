<script setup lang="ts">
import { useNewItemGlow } from '../composables/useNewItemGlow'
import { dashboardEventTarget } from '../utils/dashboard-event-target'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBackendEvents } from '../composables/useBackendEvents'
import { useApp } from '../stores/app'
import BackendLayout from '../components/BackendLayout.vue'
import LiveMap from './c-live-map.vue'
import DashboardEditor from '../components/DashboardEditor.vue'
import DashboardShortcuts from '../components/DashboardShortcuts.vue'
import { PM_TYPES, PM_LEVELS, isPmChange } from '../utils/pm-labels'
import { backend } from '../services/backend'
import { valueLabels } from '../data/backendResources'
import { displayDate } from '../utils/display-date'
import '../styles/admin-dashboard.css'
import '../styles/dashboard-fixed.css'
const route = useRoute(),
  app = useApp()
const dashboardGrid = ref<HTMLElement>()
const kpiIcons: Record<string, string> = {
  facilityCount: 'M4 21V5h16v16M2 21h20M8 9h2m4 0h2M8 13h2m4 0h2M10 21v-4h4v4',
  blockedCount: 'M5 3h14l3 5v8l-3 5H5l-3-5V8l3-5ZM8 12h8',
  dangerLevelCount: 'M12 3 2 21h20L12 3ZM12 9v5m0 3v1',
  pendingReviewCount: 'M9 3h6v4H9ZM7 5H4v16h16V5h-3M8 12h8m-8 4h5',
  remainingCount: 'M5 10 7 4h10l2 6M3 11h18v8H3ZM6 19v2m12-2v2M6 14h2m8 0h2',
}
function riskFill(value: unknown) {
  return value != null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) + '%' : '0%'
}
const appLink = (web: string, mobile: string) =>
  route.path.startsWith('/admin-app/') ? mobile : web
const region = computed(
  () => app.account?.regions?.map((item) => item.name).join(' · ') || '담당 지역',
)
const summary = ref<Record<string, number> | null>(null),
  events = ref<any[]>([]),
  margins = ref<any[]>([]),
  error = ref(''),
  loading = ref(false),
  controller = new AbortController()
type MaintenanceRow = { equipId:number; name:string; underpassName:string; type:string; score:number|null; level:string|null; roadStatus?:string|null }
const maintenanceTop = ref<MaintenanceRow[]>([])
const eventKey = (event: Record<string, any>) => String(event.id ?? JSON.stringify([event.createdAt, event.underpassId, event.underpassName, event.eventType, event.reason]))
const isNewEvent = useNewItemGlow(() => events.value, eventKey)
const eventPage = ref(1)
const eventPageCount = computed(() => Math.max(1, Math.ceil(events.value.length / 10)))
const pageEvents = computed(() => events.value.slice((eventPage.value - 1) * 10, eventPage.value * 10))
watch(eventPageCount, count => { eventPage.value = Math.min(eventPage.value, count) })
watch(eventPage, async () => {
  await nextTick()
  const list = dashboardGrid.value?.querySelector('.fixed-events .tl')
  if (list) list.scrollTop = 0
})
const dashboardPaths = ['facility-kpi', 'timeline?limit=30', 'risk-margin?limit=5']
const pendingLoads = new Set<number>()
let liveTimer: ReturnType<typeof setTimeout> | undefined
function scrollEvents(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey || !event.deltaY) return
  const root = event.currentTarget as HTMLElement,
    list = root.querySelector<HTMLElement>('.tl')
  let remaining =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
  const scroll = (element: Element) => {
    const before = element.scrollTop
    element.scrollTop += remaining
    remaining -= element.scrollTop - before
  }
  if (list && event.target instanceof Node && list.contains(event.target)) scroll(list)
  let ancestor = root.parentElement
  while (ancestor && Math.abs(remaining) > 0.5) {
    if (/auto|scroll/.test(getComputedStyle(ancestor).overflowY)) scroll(ancestor)
    ancestor = ancestor.parentElement
  }
  if (Math.abs(remaining) > 0.5 && document.scrollingElement) scroll(document.scrollingElement)
  event.preventDefault()
}
async function load(requested?: unknown) {
  const parts = Array.isArray(requested) ? requested : [0, 1, 2, 3]
  if (loading.value) {
    parts.forEach((key) => pendingLoads.add(key))
    return
  }
  loading.value = true
  error.value = ''
  const results = await Promise.allSettled(
    parts.map((key) =>
      backend(key === 3 ? '/api/pm/equipments?page=1&size=5' : '/api/dashboard/' + dashboardPaths[key], { signal: controller.signal }),
    ),
  )
  if (controller.signal.aborted) return
  results.forEach((result, index) => {
    const key = parts[index]
    if (result.status === 'fulfilled') {
      if (key === 0) summary.value = result.value
      else if (key === 1) events.value = Array.isArray(result.value) ? result.value : []
      else if (key === 2) margins.value = Array.isArray(result.value) ? result.value : []
      else maintenanceTop.value = (result.value?.items || []).slice(0,5)
    } else error.value = result.reason.message
  })
  loading.value = false
  if (pendingLoads.size) {
    const next = [...pendingLoads]
    pendingLoads.clear()
    void load(next)
  }
}
function queueDashboard(parts: number[]) {
  parts.forEach((key) => pendingLoads.add(key))
  clearTimeout(liveTimer)
  liveTimer = setTimeout(() => {
    const keys = [...pendingLoads]
    pendingLoads.clear()
    if (!controller.signal.aborted) void load(keys)
  }, 200)
}
useBackendEvents(({ name, data }) => {
  if (isPmChange(name, data, ['pm-equipment','pm-event','pm-action','pm-threshold'])) queueDashboard([3])
  if (name === 'risk-update') {
    margins.value = margins.value.map((row) => {
      if (
        String(row.underpassId) !== String(data.underpassId) ||
        typeof data.riskScore !== 'number'
      )
        return row
      const delta = data.riskScore - Number(row.riskScore)
      return {
        ...row,
        riskScore: data.riskScore,
        margin: typeof row.margin === 'number' ? row.margin - delta : row.margin,
      }
    })
    return
  }
  if (name === 'connected' || name === 'control-change') queueDashboard([0, 1, 2, 3])
  else if (name === 'risk-level-change') queueDashboard([0, 2])
  else if (name === 'transit-update' || name.startsWith('plate-queue-')) queueDashboard([0])
  else if (name === 'data-changed' && ['underpass', 'threshold'].includes(data.resource))
    queueDashboard([0, 2])
})
onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(liveTimer)
  controller.abort()
})
</script>
<template>
  <BackendLayout class="page-admin-dashboard" :class="{'water-dashboard':!route.path.startsWith('/admin-app/')}"
    ><section class="restored-dashboard service-workspace"
      ><div class="page-head service-heading"
        ><h1>종합 현황</h1
        ><div class="dashboard-head-actions"
          ><DashboardEditor :grid="dashboardGrid" :margins="margins"
          /><button class="btn sm" :disabled="loading" @click="load">새로고침</button></div
        ></div
      ><DashboardShortcuts />
      <p v-if="error" class="service-error" role="alert">{{error}}</p
      ><div id="grid" ref="dashboardGrid" class="dashboard-fixed-layout">
        <div class="dashboard-fixed-item fixed-summary"
          ><div class="dashboard-fixed-content"
            ><section class="card wg widget-original-content" aria-label="지하차도 현황"
              ><div class="wg-head"
                ><h2>지하차도 현황</h2
                ><RouterLink :to="appLink('/fac-list','/admin-app/screen-4')"
                  >전체 보기 →</RouterLink
                ></div
              ><div class="tiles5"
                ><div
                  class="tile"
                  v-for="[key,label] in [['facilityCount','담당 시설'],['blockedCount','통제 중'],['dangerLevelCount','위험'],['pendingReviewCount','판별 대기'],['remainingCount','잔류 차량']]"
                  :key="key"
                  :data-kpi="key"
                  ><span v-if="!route.path.startsWith('/admin-app/')" class="dashboard-kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="kpiIcons[key!]" /></svg></span><small>{{label}}</small
                  ><strong :key="String(summary?.[key!]??'empty')" class="big dashboard-value">{{summary?.[key!]??'—'}}</strong></div
                ></div
              ></section
            ></div
          ></div
        >
<div class="dashboard-fixed-item fixed-map"
          ><div class="dashboard-fixed-content"
            ><section class="card map-w widget-original-content" aria-label="지하차도 지도"
              ><div class="map-top"
                ><h2>{{region}} 지하차도 지도</h2></div
              ><LiveMap manager :dashboard-visual="!route.path.startsWith('/admin-app/')" @control-changed="load" /></section></div
        ></div>
<div class="dashboard-fixed-item fixed-events" @wheel="scrollEvents"
          ><div class="dashboard-fixed-content"
            ><section class="card wg widget-original-content" aria-label="최근 이벤트"
              ><div class="wg-head"
                ><h2>최근 이벤트</h2
                ><RouterLink to="/admin-reports?report=timeline">로그 전체 보기</RouterLink></div
              ><p v-if="!events.length">표시할 이벤트가 없습니다.</p
              ><ol class="tl" tabindex="0" aria-label="최근 이벤트 목록"
                ><li v-for="event in pageEvents" :key="eventKey(event)" :data-event="event.eventType" :data-risk="event.riskLevel"
                  ><RouterLink :to="dashboardEventTarget(event)" data-button class="timeline-event-card" :class="{'notification-arrival-glow':isNewEvent(event)}"
                  ><time :datetime="event.createdAt">{{displayDate(event.createdAt)}}</time
                  ><div class="timeline-event-body"
                    ><span
                      class="cat"
                      >{{valueLabels[event.eventType]||event.eventType||'이벤트'}}</span
                    ><strong>{{event.underpassName}}</strong
                    ><small
                      >{{event.reason||valueLabels[event.riskLevel]||event.riskLevel}}</small
                    ></div></RouterLink
                  ></li
                ></ol
              ><nav v-if="events.length" class="event-pagination" aria-label="최근 이벤트 페이지"
                ><button type="button" :disabled="eventPage === 1" aria-label="최근 이벤트 이전 페이지" @click="eventPage--">이전</button
                ><span aria-live="polite">{{eventPage}} / {{eventPageCount}}</span
                ><button type="button" :disabled="eventPage === eventPageCount" aria-label="최근 이벤트 다음 페이지" @click="eventPage++">다음</button
              ></nav></section
            ></div
          ></div
        >
<div class="dashboard-bottom"
          ><div class="dashboard-fixed-item fixed-top5"
            ><div class="dashboard-fixed-content"
              ><section class="card wg widget-original-content" aria-label="예지보전 Top5"
                ><div class="wg-head"
                  ><h2>예지보전 Top5</h2
                  ><RouterLink to="/pm-equipment">전체 보기</RouterLink></div
                ><p v-if="!maintenanceTop.length">표시할 예지보전 설비가 없습니다.</p
                ><ol class="rank"
                  ><li v-for="(equipment,index) in maintenanceTop" :key="equipment.equipId" :style="{'--risk-fill':riskFill(equipment.score)}"
                    ><span class="n">{{index+1}}</span
                    ><RouterLink class="t" :to="{path:'/pm-equipment-detail',query:{id:equipment.equipId}}"
                      >{{equipment.name
                      }}<small>{{equipment.underpassName}} · {{PM_TYPES[equipment.type] || equipment.type}} · {{equipment.type==='ROAD'?(equipment.roadStatus || '미분석'):(PM_LEVELS[equipment.level || ''] || '수신 대기')}}</small></RouterLink
                    ><span class="sc">{{equipment.score==null?'—':Number(equipment.score).toFixed(1)}}<small v-if="equipment.score!=null"> / 100</small></span><span v-if="equipment.score!=null&&!route.path.startsWith('/admin-app/')" class="dashboard-score-track" role="meter" aria-label="설비 위험 점수" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="parseFloat(riskFill(equipment.score))"><i aria-hidden="true"></i></span></li
                  ></ol
                ></section
              ></div
            ></div
          >
<div class="dashboard-fixed-item fixed-todo"
            ><div class="dashboard-fixed-content"
              ><section class="card wg widget-original-content"
                ><div class="wg-head"><h2>예지보전</h2></div
                ><div class="fill"
                  ><RouterLink class="btn sm" to="/pm-equipment"
                    >설비·점검 대상 보기 →</RouterLink
                  ></div
                ></section
              ></div
            ></div
          >
<div class="dashboard-fixed-item fixed-verify"
            ><div class="dashboard-fixed-content"
              ><section class="card wg widget-original-content"
                ><div class="wg-head"
                  ><h2>수동 판별 대기</h2
                  ><RouterLink :to="appLink('/verify','/admin-app/screen-4')"
                    >판별하러 가기</RouterLink
                  ></div
                ><div class="fill"
                  ><div
                    ><strong class="big">{{summary?.pendingReviewCount??'—'}}</strong> 건 대기 중</div
                  ></div
                ></section
              ></div
            ></div
          >
<div class="dashboard-fixed-item fixed-health"
            ><div class="dashboard-fixed-content"
              ><section class="card wg widget-original-content"
                ><div class="wg-head"
                  ><h2>오늘 알림</h2><RouterLink to="/notifications">알림 내역</RouterLink></div
                ><div class="fill"
                  ><div
                    ><strong class="big">{{summary?.alertsToday??'—'}}</strong> 건 발송</div
                  ></div
                ></section
              ></div
            ></div
          ></div
        >
      </div></section
    ></BackendLayout
  >
</template>

<script setup lang="ts">
import ListResultCount from '../components/ListResultCount.vue'
import AppPagination from '../components/AppPagination.vue'
import { adminPageTitle } from '../data/adminTitles'
import { managerAppPath } from '../utils/manager-app-path'
const appPath = (path: string) => managerAppPath(path, route.path)
// 예지보전 설비 목록 (/pm-equipment). 예전 목업(pm-equipment.vue + data/pm-equipment.json)을 대신한다.
//  GET /api/pm/equipments        설비 목록 (점수 높은 순, 담당 지역만)
//  GET /api/pm/engine-status     예지보전 서버가 점수를 잘 보내는지
//  GET /api/pm/events            점검 대기 건수
// SSE pm-update / sinkhole-update / pm-engine-status / data-changed(pm-equipment·pm-event·pm-action·pm-threshold) 가 오면
// 바뀐 부분만 다시 조회한다. 필터·페이지를 바꿀 때는 목록 1번만 조회한다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import PmEquipmentCards from '../components/PmEquipmentCards.vue'
import PmSparkline from '../components/PmSparkline.vue'
import PmActionModal from '../components/PmActionModal.vue'
import { backend, queryString, type PageData } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { PM_TYPES, PM_LEVELS, PM_EVENT_STATUS, PM_ENGINE, pmLabel } from '../utils/pm-labels'

type Equipment = {
  roadStatus?: string | null
  detectionConfidence?: number | null
  equipId: number
  name: string
  type: string
  underpassName: string
  score: number | null
  level: string | null
  scoreChange7d: number | null
  lastReceivedAt: string | null
  reasons: string[]
  openEventId: number | null
  openEventStatus: string | null
  sparkline: number[]
}
type Engine = { status: string; lastReceivedAt: string | null; equipmentTotal: number; sensorStale: number; openNoDataEvents?: number }

const route = useRoute()
const PAGE_SIZE = useRoute().path.startsWith('/admin-app/') ? 5 : 10
const router = useRouter(),
  level = ref(''),
  type = ref(route.query.type === 'ROAD' ? 'ROAD' : ''),
  page = ref(1),
  list = ref<PageData<Equipment>>(),
  counts = ref<Record<string, number>>({}),
  equipmentTotal = ref<number | null>(null),
  openEvents = ref<number | null>(null),
  engine = ref<Engine>(),
  loading = ref(false),
  error = ref(''),
  modal = ref<InstanceType<typeof PmActionModal>>()
let controller: AbortController | undefined
// Keep saved links from the previous inline view working.
watch(() => route.query.road, (value) => {
  const id = Number(value)
  if (Number.isSafeInteger(id) && id > 0)
    void router.replace({ path: appPath('/pm-equipment-detail'), query: { id: String(id) } })
}, { immediate: true })

const engineLabel = computed(() => PM_ENGINE[engine.value?.status || ''] || ['확인 중', 'idle'])
const levelTabs = [['', '전체'], ['DANGER', '위험'], ['CAUTION', '주의'], ['SAFE', '안전']] as const
const typeTabs = [['', '전체 종류'], ...Object.entries(PM_TYPES)] as const

// 목록(필터·페이지에 따라 달라짐)과 위쪽 집계(필터와 무관)를 따로 불러온다.
let alive = true
async function loadList() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  try {
    const rows = await backend<PageData<Equipment>>(
      '/api/pm/equipments' +
        queryString({ level: level.value, type: type.value, page: page.value, size: PAGE_SIZE }),
      { signal: current.signal },
    )
    if (!current.signal.aborted) list.value = rows
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

type Summary = { levels?: boolean; total?: boolean; events?: boolean; engine?: boolean }
const summaryVersion = { levels: 0, total: 0, events: 0, engine: 0 }
// 집계 한 덩어리를 불러온다. 응답이 뒤늦게 와도 가장 최근 요청의 결과만 반영하고,
// 실패하면 이전 값을 그대로 둔다(0건으로 바꾸지 않는다).
async function summaryPart<T>(key: keyof typeof summaryVersion, run: () => Promise<T>, apply: (value: T) => void) {
  const version = ++summaryVersion[key]
  try {
    const value = await run()
    if (alive && version === summaryVersion[key]) apply(value)
  } catch { /* 집계 조회 실패는 화면의 이전 값을 유지한다 */ }
}
function loadSummary(parts: Summary = { levels: true, total: true, events: true, engine: true }) {
  const tasks: Promise<void>[] = []
  if (parts.levels)
    tasks.push(summaryPart('levels',
      () => Promise.all(['DANGER', 'CAUTION', 'SAFE'].map((lv) =>
        backend<PageData<Equipment>>('/api/pm/equipments' + queryString({ level: lv, size: 1 })).then((r) => [lv, r.totalItems] as const))),
      (rows) => { counts.value = { ...counts.value, ...Object.fromEntries(rows) } }))
  if (parts.events)
    tasks.push(summaryPart('events', () => backend<PageData<unknown>>('/api/pm/events?size=1'),
      (r) => { openEvents.value = r.totalItems }))
  if (parts.engine)
    tasks.push(summaryPart('engine', () => backend<Engine>('/api/pm/engine-status'),
      (r) => { engine.value = r }))
  if (parts.total)
    tasks.push(summaryPart('total', () => backend<PageData<Equipment>>('/api/pm/equipments?size=1'),
      (r) => { equipmentTotal.value = r.totalItems }))
  return Promise.all(tasks)
}
// 새로고침 버튼·점검 처리 후에는 전부 다시 부른다
function load() {
  void loadSummary()
  return loadList()
}

// 점수 묶음은 지역당 1번이지만 여러 이벤트가 몰려도 한 번만 다시 부른다.
// 이벤트마다 바뀐 부분만 모아서(300ms) 조회한다.
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let wanted: Summary & { list?: boolean } = {}
function refreshSoon(parts: Summary & { list?: boolean }) {
  wanted = {
    list: wanted.list || parts.list,
    levels: wanted.levels || parts.levels,
    total: wanted.total || parts.total,
    events: wanted.events || parts.events,
    engine: wanted.engine || parts.engine,
  }
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    const next = wanted
    wanted = {}
    if (next.list) void loadList()
    void loadSummary(next)
  }, 300)
}
useBackendEvents(({ name, data }) => {
  if (name === 'connected')
    refreshSoon({ list: true, levels: true, total: true, events: true, engine: true })
  else if (name === 'pm-engine-status') {
    // 단계가 바뀌면 헤더에 바로 보이게 하고, 센서 끊김 건수 같은 집계는 다시 조회한다
    if (engine.value)
      engine.value = {
        ...engine.value,
        status: String(data.status ?? engine.value.status),
        lastReceivedAt: data.lastReceivedAt ?? engine.value.lastReceivedAt,
      }
    refreshSoon({ engine: true })
  } else if (name === 'sinkhole-update') refreshSoon({ list: true, events: true })
  else if (name === 'pm-update') refreshSoon({ list: true, levels: true, events: true, engine: true })
  else if (name === 'data-changed') {
    const resource = String(data?.resource)
    if (resource === 'pm-equipment') refreshSoon({ list: true, levels: true, total: true, events: true })
    else if (resource === 'pm-event' || resource === 'pm-action') refreshSoon({ list: true, events: true })
    else if (resource === 'pm-threshold') refreshSoon({ list: true, levels: true })
  }
})
// 필터를 바꾸면 1쪽으로 돌아간다. 이미 1쪽이면 직접 조회하고, 아니면 page 감시가 조회한다 (중복 조회 방지)
watch([level, type], () => {
  if (page.value !== 1) page.value = 1
  else void loadList()
})
watch(page, () => void loadList(), { immediate: true })
void loadSummary()
onBeforeUnmount(() => {
  alive = false
  clearTimeout(refreshTimer)
  controller?.abort()
})

function change(v: number | null) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const n = Math.round(Number(v) * 10) / 10
  return (n > 0 ? '+' : '') + n.toFixed(1)
}
function openDetail(row: Equipment) {
  void router.push({ path: appPath('/pm-equipment-detail'), query: { id: String(row.equipId) } })
}
function act(row: Equipment) {
  if (row.type==='ROAD') { openDetail(row); return }
  if (row.openEventId)
    modal.value?.open({ eventId: row.openEventId, name: row.name, status: row.openEventStatus || undefined, underpassName: row.underpassName })
}
</script>
<template>
  <BackendLayout class="page-pm-equipment">
    <section class="service-workspace pm-equipment-live">
      
      <div class="page-head service-heading">
        <div>
          <h1><AdminPageIcon />{{adminPageTitle('/pm-equipment')}}</h1>
        </div>
        <div class="pm-head-actions">
          <span class="pm-engine" :class="'pm-engine--'+engineLabel[1]" role="status">
            예지보전 엔진 {{engineLabel[0]}}
            <template v-if="engine?.lastReceivedAt"> · 마지막 수신 {{displayDate(engine.lastReceivedAt)}}</template>
          </span>
          <RouterLink class="btn pm-navigation-link" :to="appPath('/pm-queue')"><span>점검 대기</span><span aria-hidden="true">→</span></RouterLink>
          <RouterLink class="btn pm-navigation-link" :to="appPath('/pm-settings')"><span>설비·기준 설정</span><span aria-hidden="true">→</span></RouterLink>
          <RouterLink class="btn pm-navigation-link" :to="appPath('/pm-daily')"><span>데일리 리포트</span><span aria-hidden="true">→</span></RouterLink>
          <button v-if="!route.path.startsWith('/admin-app/')" class="btn" type="button" :disabled="loading" @click="load">새로고침</button>
        </div>
      </div>

      <div class="pm-kpis">
        <button v-if="!route.path.startsWith('/admin-app/')" type="button" class="card pm-kpi pm-kpi--all" :class="{'is-current':!level&&!type}" :aria-pressed="!level&&!type" @click="level='';type=''">
          <span>전체 장비</span><strong>{{equipmentTotal??'—'}}</strong>
        </button>
        <button
          v-for="[value,label] in levelTabs.slice(1)"
          :key="value"
          type="button"
          class="card pm-kpi"
          :class="['pm-kpi--'+value.toLowerCase(),{'is-current':level===value}]"
          :aria-pressed="level===value"
          @click="level=level===value?'':value"
        >
          <span>{{label}}</span><strong>{{counts[value]??'—'}}</strong>
        </button>
        <RouterLink class="card pm-kpi" :to="appPath('/pm-queue')">
          <span>점검 대기</span><strong>{{openEvents??'—'}}</strong>
        </RouterLink>
      </div>

      <div v-if="route.path.startsWith('/admin-app/')" class="pm-filters">
        <label class="pm-type">
          <select v-model="type" aria-label="종류">
            <option v-for="[value,label] in typeTabs" :key="value" :value="value">{{label}}</option>
          </select>
        </label>
      </div>
      <div class="pm-results-viewport" :aria-busy="loading">
      <p v-if="error" role="alert" class="service-error">{{error}} <button @click="load">다시 시도</button></p>
      <p v-if="loading&&!list" role="status">설비 목록을 불러오는 중입니다.</p>
      <ListResultCount v-if="list" :count="list.totalItems" />
      <p v-if="list&&!list.items.length" class="pm-empty">조건에 맞는 설비가 없어요.</p>

      <PmEquipmentCards v-if="route.path.startsWith('/admin-app/')&&list?.items.length" :items="list.items" />
      <div v-else-if="list?.items.length" class="service-table-wrap">
        <table class="service-table pm-table">
          <colgroup><col style="width:120px" /><col style="width:100px" /><col style="width:180px" /><col style="width:172px" /><col style="width:100px" /><col style="width:120px" /><col /><col style="width:172px" /><col style="width:120px" /></colgroup>
          <thead>
            <tr>
              <th>설비</th><th>종류</th><th>지하차도</th><th>위험 점수 / 상태</th><th>7일 변화</th>
              <th>최근 24시간</th><th>주요 사유</th><th>마지막 수신</th><th>점검 상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list.items" :key="row.equipId" tabindex="0" @click="openDetail(row)" @keydown.enter="openDetail(row)">
              <td data-label="설비" class="pm-name"><div class="pm-cell-content">{{row.name}}</div></td>
              <td data-label="종류"><div class="pm-cell-content">{{pmLabel(PM_TYPES,row.type)}}</div></td>
              <td data-label="지하차도"><div class="pm-cell-content">{{row.underpassName}}</div></td>
              <td data-label="위험 점수 / 상태"><div class="pm-cell-content">
                <span v-if="row.type==='ROAD'" class="road-state">{{row.roadStatus||'미분석'}}</span>
                <RiskLevelBadge v-else-if="row.level" :value="row.level" />
                <b v-if="row.type!=='ROAD'" class="pm-score">{{row.score==null?'—':Number(row.score).toFixed(1)}}</b>
              </div></td>
              <td data-label="7일 변화" :class="{'pm-up':Number(row.scoreChange7d)>0}"><div class="pm-cell-content">{{change(row.scoreChange7d)}}</div></td>
              <td data-label="최근 24시간"><div class="pm-cell-content"><PmSparkline :values="row.sparkline" :level="row.level||''" /></div></td>
              <td data-label="주요 사유" class="pm-reason" :title="row.reasons?.join('\n')"><div class="pm-cell-content">
                <div class="pm-cell-summary">
                {{row.type==='ROAD'?(row.roadStatus||'미분석'):(row.reasons?.[0]||'이상 없음')}}
                <small v-if="row.reasons?.length>1">외 {{row.reasons.length-1}}건</small>
                </div>
              </div></td>
              <td data-label="마지막 수신"><div class="pm-cell-content">{{row.lastReceivedAt?displayDate(row.lastReceivedAt):(row.type==='ROAD'?'미분석':'미수신')}}</div></td>
              <td data-label="점검 상태" @click.stop><div class="pm-cell-content">
                <button
                  v-if="row.openEventId"
                  type="button"
                  class="btn sm"
                  :class="{'pm-open':row.openEventStatus==='CHECK_NEEDED'}"
                  @click="act(row)"
                >
                  {{pmLabel(PM_EVENT_STATUS,row.openEventStatus)}}
                </button>
                <button v-else-if="row.type==='ROAD'" class="btn sm" type="button" @click="openDetail(row)">결과 보기</button>
                <span v-else class="pm-none">—</span>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>

      </div>
      <AppPagination v-if="route.path.startsWith('/admin-app/')" :page="page" :pages="list?.totalPages||1" :disabled="loading" @change="page=$event" />
      <div v-else class="pm-pager">
        <button class="btn sm" type="button" :disabled="loading||page<=1" @click="page--">이전</button>
        <span>{{page}} / {{Math.max(1,list?.totalPages||1)}}</span>
        <button class="btn sm" type="button" :disabled="loading||page>=Math.max(1,list?.totalPages||1)" @click="page++">다음</button>
      </div>
      <p class="pm-note">
        전체 {{list?.totalItems??0}}개 · 확인 대상 노면 우선 / 설비 점수 높은 순<template v-if="engine?.sensorStale"> · 센서 수신 끊김 {{engine.sensorStale}}대</template>
      </p>
    </section>
    <PmActionModal ref="modal" @done="load" />
  </BackendLayout>
</template>
<style scoped>
.pm-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pm-engine { font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line, #d5dae1); }
.pm-engine--ok { color: #27500a; background: #eaf3de; border-color: #c0dd97; }
.pm-engine--warn { color: #633806; background: #faeeda; border-color: #fac775; }
.pm-engine--bad { color: #791f1f; background: #fcebeb; border-color: #f7c1c1; }
.pm-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 12px 0; }
.pm-kpi { display: grid; gap: 4px; text-align: left; cursor: pointer; font: inherit; color: inherit; text-decoration: none; }
.pm-kpi span { font-size: 13px; color: var(--ink-sub, #5b6573); }
.pm-kpi strong { font-size: 26px; font-weight: 600; }
.pm-kpi.is-current { outline: 2px solid var(--primary, #2b5c8a); }
.pm-kpi--danger strong { color: var(--danger, #c0392b); }
.pm-kpi--caution strong { color: var(--warn, #b7791f); }
.pm-filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 10px; }
.pm-filters .tabs button { font: inherit; }
.pm-type { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.pm-table tbody tr { cursor: pointer; }
.pm-table tbody tr:hover, .pm-table tbody tr:focus-visible { background: var(--line-soft, rgba(0,0,0,.04)); }
.pm-name { font-family: ui-monospace, Consolas, monospace; white-space: nowrap; }
.pm-table td:nth-child(4), .pm-table td:last-child, .pm-table td:nth-child(8) { white-space: nowrap; }
.pm-table td:last-child .btn { white-space: nowrap; }
/* 필터를 바꿔도 칸 너비가 내용에 따라 바뀌지 않게 고정 (주요 사유 칸이 남는 폭을 가져간다) */
.pm-table { table-layout: fixed; width: 100%; }
.pm-table td { vertical-align: middle; }
.pm-table th:nth-child(1) { width: 80px; }
.pm-table th:nth-child(2) { width: 80px; }
.pm-table th:nth-child(3) { width: 140px; }
.pm-table th:nth-child(4) { width: 120px; }
.pm-table th:nth-child(5) { width: 80px; }
.pm-table th:nth-child(6) { width: 110px; }
.pm-table th:nth-child(8) { width: 150px; }
.pm-table th:nth-child(9) { width: 110px; }
.pm-score { margin-left: 6px; }
.pm-up { color: var(--danger, #c0392b); }
.pm-reason { max-width: 320px; }
.pm-reason small, .pm-none, .pm-note, .pm-empty { color: var(--ink-sub, #5b6573); }
.pm-open { color: #791f1f; border-color: #f09595; }
.pm-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px 0; }
.pm-note { font-size: 13px; margin: 10px 0 0; }
</style>

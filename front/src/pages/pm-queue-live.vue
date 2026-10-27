<script setup lang="ts">
import { adminPageTitle } from '../data/adminTitles'
import { managerAppPath } from '../utils/manager-app-path'
const appPath = (path: string) => managerAppPath(path, route.path)
// 예지보전 점검 대기 (/pm-queue). 예전 목업(pm-queue.vue + data/pm-queue.json)을 대신한다.
//  GET /api/pm/events?status=&type=   점검 대상 (status 를 빼면 확인 필요·점검 중만)
//  GET /api/pm/actions?startDate=오늘  오늘 점검 기록 수
// 처리(점검 시작·기록 추가·점검 종료)는 PmActionModal 이 한다.
// SSE pm-update(지금 점수) / data-changed(pm-event·pm-action) 가 오면 다시 조회한다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import PmEquipmentCards from '../components/PmEquipmentCards.vue'
import PmActionModal from '../components/PmActionModal.vue'
import { backend, queryString, type PageData } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { PM_TYPES, PM_EVENT_STATUS, PM_TRIGGERS, PM_CLOSED_STATUS, pmLabel, isPmChange } from '../utils/pm-labels'

type PmEvent = {
  eventId: number
  equipId: number
  name: string
  type: string
  underpassName: string
  triggerType: string
  level: string | null
  score: number | null
  status: string
  createdAt: string
  currentScore: number | null
  currentLevel: string | null
}

const PAGE_SIZE = 20
const route = useRoute()
const router = useRouter(),
  status = ref(''),
  type = ref(''),
  page = ref(1),
  list = ref<PageData<PmEvent>>(),
  counts = ref<Record<string, number | null>>({}),
  loading = ref(false),
  error = ref(''),
  modal = ref<InstanceType<typeof PmActionModal>>()
let controller: AbortController | undefined

// status '' = 처리 중(확인 필요 + 점검 중). 서버가 status 를 빼면 이 둘만 준다
const tabs = [
  ['', '처리 중'],
  ['RESOLVED', '조치 완료'],
  ['ETC', '기타 종료'],
] as const
const typeOptions = [['', '전체 종류'], ...Object.entries(PM_TYPES)] as const

function today() {
  const d = new Date(), pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function load() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  const get = <T,>(path: string) => backend<T>(path, { signal: current.signal })
  const total = (r: PromiseSettledResult<PageData<unknown>>) => (r.status === 'fulfilled' ? r.value.totalItems : null)
  try {
    const [rows, needed, working, actions, open] = await Promise.allSettled([
      get<PageData<PmEvent>>('/api/pm/events' + queryString({ status: status.value, type: type.value, page: page.value, size: PAGE_SIZE })),
      get<PageData<unknown>>('/api/pm/events?size=1&status=CHECK_NEEDED'),
      get<PageData<unknown>>('/api/pm/events?size=1&status=IN_PROGRESS'),
      get<PageData<unknown>>('/api/pm/actions' + queryString({ startDate: today(), endDate: today(), size: 1 })),
      get<PageData<PmEvent>>('/api/pm/events?size=100'),
    ])
    if (current.signal.aborted) return
    if (rows.status === 'rejected') throw rows.reason
    list.value = rows.value
    counts.value = {
      CHECK_NEEDED: total(needed),
      IN_PROGRESS: total(working),
      todayActions: total(actions),
      noData: open.status === 'fulfilled' ? open.value.items.filter((e) => e.triggerType === 'NO_DATA').length : null,
    }
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined
useBackendEvents(({ name, data }) => {
  if (name === 'connected' || isPmChange(name, data, ['pm-event', 'pm-action', 'pm-equipment'])) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void load(), 300)
  }
})
watch([status, type], () => {
  page.value = 1
  void load()
})
watch(page, () => void load(), { immediate: true })
onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  controller?.abort()
})

const openCount = computed(() => {
  const a = counts.value.CHECK_NEEDED, b = counts.value.IN_PROGRESS
  return a == null || b == null ? null : a + b
})
function tabCount(value: string) {
  if (value === '') return openCount.value
  return value in counts.value ? counts.value[value] : null
}
const fmt = (v: number | null) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1))
function scoreTrend(row: PmEvent) {
  if (row.score == null || row.currentScore == null) return ''
  const d = Number(row.currentScore) - Number(row.score)
  return Math.abs(d) < 0.05 ? 'same' : d < 0 ? 'down' : 'up'
}
function openDetail(row: PmEvent) {
  void router.push({ path: appPath('/pm-equipment-detail'), query: { id: String(row.equipId) } })
}
function act(row: PmEvent, mode: 'start' | 'note' | 'resolve') {
  if(row.type==='ROAD'){openDetail(row);return}
  modal.value?.open({ eventId: row.eventId, name: row.name, status: row.status, underpassName: row.underpassName }, mode)
}
</script>
<template>
  <BackendLayout class="page-pm-queue">
    <section class="service-workspace pm-queue-live">
      
      <div class="page-head service-heading">
        <div>
          <h1>{{adminPageTitle('/pm-queue')}}</h1>
          <div class="sub">위험진입 · 급상승 · 미수신으로 생긴 점검 대상</div>
        </div>
        <div class="pm-head-actions">
          <RouterLink class="btn" :to="appPath('/pm-equipment')">{{adminPageTitle('/pm-equipment')}} →</RouterLink>
          <RouterLink class="btn" :to="appPath('/pm-history')">점검 이력 →</RouterLink>
          <button v-if="!route.path.startsWith('/admin-app/')" class="btn" type="button" :disabled="loading" @click="load">새로고침</button>
        </div>
      </div>

      <div class="pm-kpis">
        <button type="button" class="card pm-kpi pm-kpi--danger" :class="{'is-current':status==='CHECK_NEEDED'}" :aria-pressed="status==='CHECK_NEEDED'" @click="status=status==='CHECK_NEEDED'?'':'CHECK_NEEDED'">
          <span>확인 필요</span><strong>{{counts.CHECK_NEEDED??'—'}}</strong>
        </button>
        <button type="button" class="card pm-kpi" :class="{'is-current':status==='IN_PROGRESS'}" :aria-pressed="status==='IN_PROGRESS'" @click="status=status==='IN_PROGRESS'?'':'IN_PROGRESS'">
          <span>점검 중</span><strong>{{counts.IN_PROGRESS??'—'}}</strong>
        </button>
        <RouterLink class="card pm-kpi" :to="{path:appPath('/pm-history')}">
          <span>오늘 점검</span><strong>{{counts.todayActions??'—'}}</strong>
        </RouterLink>
        <div class="card pm-kpi pm-kpi--static">
          <span title="센서 정보 미수신">미수신</span><strong>{{counts.noData??'—'}}</strong>
        </div>
      </div>

      <div class="pm-filters">
        <nav class="tabs" aria-label="점검 상태">
          <button v-for="[value,label] in tabs" :key="value" type="button" :class="{'is-current':status===value,on:status===value}" :aria-pressed="status===value" @click="status=value">
            {{label+(tabCount(value)!=null?' '+tabCount(value):'')}}
          </button>
        </nav>
        <label class="pm-type">
          종류
          <select v-model="type">
            <option v-for="[value,label] in typeOptions" :key="value" :value="value">{{label}}</option>
          </select>
        </label>
      </div>

      <div class="pm-results-viewport" :aria-busy="loading">
      <p v-if="error" role="alert" class="service-error">{{error}} <button @click="load">다시 시도</button></p>
      <p v-if="loading&&!list" role="status">점검 대상을 불러오는 중입니다.</p>
      <p v-if="list&&!list.items.length" class="pm-empty">
        {{status===''||status==='CHECK_NEEDED'?'지금 처리할 점검 대상이 없어요.':'해당하는 점검 기록이 없어요.'}}
      </p>

      <PmEquipmentCards v-if="route.path.startsWith('/admin-app/')&&list?.items.length" :items="list.items" inspection />
      <div v-else-if="list?.items.length" class="service-table-wrap">
        <table class="service-table pm-table">
          <thead>
            <tr><th>발생</th><th>설비</th><th>종류</th><th>지하차도</th><th>이유</th><th>발생 때 → 지금 점수</th><th>상태</th><th>처리</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in list.items" :key="row.eventId" tabindex="0" @click="openDetail(row)" @keydown.enter="openDetail(row)">
              <td data-label="발생"><div class="pm-cell-content">{{displayDate(row.createdAt)}}</div></td>
              <td data-label="설비" class="pm-name"><div class="pm-cell-content">{{row.name}}</div></td>
              <td data-label="종류"><div class="pm-cell-content">{{pmLabel(PM_TYPES,row.type)}}</div></td>
              <td data-label="지하차도"><div class="pm-cell-content">{{row.underpassName}}</div></td>
              <td data-label="이유"><div class="pm-cell-content"><span class="pm-chip" :class="'pm-chip--'+String(row.triggerType).toLowerCase()">{{pmLabel(PM_TRIGGERS,row.triggerType)}}</span></div></td>
              <td data-label="발생 때 → 지금 점수"><div class="pm-cell-content">
                <span v-if="row.triggerType==='NO_DATA'" class="pm-muted">센서 수신 끊김</span>
                <span v-else class="pm-scores">
                  <span class="pm-muted">{{fmt(row.score)}} →</span>
                  <b :class="'pm-now--'+scoreTrend(row)">{{fmt(row.currentScore)}}</b>
                  <RiskLevelBadge v-if="row.currentLevel" :value="row.currentLevel" />
                </span>
              </div></td>
              <td data-label="상태"><div class="pm-cell-content"><span class="pm-chip" :class="'pm-status--'+row.status.toLowerCase()">{{pmLabel(PM_EVENT_STATUS,row.status)}}</span></div></td>
              <td data-label="처리" @click.stop><div class="pm-cell-content">
                <span v-if="!PM_CLOSED_STATUS.includes(row.status)" class="pm-actions">
                  <button v-if="row.status==='CHECK_NEEDED'" class="btn sm primary" type="button" @click="act(row,'start')">점검 시작</button>
                  <button class="btn sm" type="button" @click="act(row,'note')">기록 추가</button>
                  <button v-if="row.status==='IN_PROGRESS'" class="btn sm" type="button" @click="act(row,'resolve')">점검 종료</button>
                </span>
                <RouterLink v-else class="btn sm" :to="{path:appPath('/pm-history'),query:{equipId:String(row.equipId)}}" @click.stop>이력 보기</RouterLink>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>

      </div>
      <div class="pm-pager">
        <button class="btn sm" type="button" :disabled="loading||page<=1" @click="page--">이전</button>
        <span>{{page}} / {{Math.max(1,list?.totalPages||1)}} · 전체 {{list?.totalItems??0}}건</span>
        <button class="btn sm" type="button" :disabled="loading||page>=Math.max(1,list?.totalPages||1)" @click="page++">다음</button>
      </div>
      <p class="pm-note">행을 누르면 설비 상세로 가요 · 점검 시작 → 기록 추가 → 점검 종료(조치 완료 또는 기타, 조치 내용 필수). 끝난 점검은 다시 열 수 없어요.</p>
    </section>
    <PmActionModal ref="modal" @done="load" />
  </BackendLayout>
</template>
<style scoped>
.pm-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pm-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 12px 0; }
.pm-kpi { display: grid; gap: 4px; text-align: left; cursor: pointer; font: inherit; color: inherit; text-decoration: none; }
.pm-kpi--static { cursor: default; }
.pm-kpi span { font-size: 13px; color: var(--ink-sub, #5b6573); }
.pm-kpi strong { font-size: 26px; font-weight: 600; }
.pm-kpi.is-current { outline: 2px solid var(--primary, #2b5c8a); }
.pm-kpi--danger strong { color: var(--danger, #c0392b); }
.pm-filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 10px; }
.pm-filters .tabs button { font: inherit; }
.pm-type { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.pm-table tbody tr { cursor: pointer; }
.pm-table tbody tr:hover, .pm-table tbody tr:focus-visible { background: var(--line-soft, rgba(0,0,0,.04)); }
.pm-table td { white-space: nowrap; vertical-align: middle; }
.pm-name { font-family: ui-monospace, Consolas, monospace; }
.pm-scores { display: inline-flex; align-items: center; gap: 6px; }
.pm-now--down { color: #3b8c3e; }
.pm-now--up, .pm-now--same { color: var(--danger, #c0392b); }
.pm-chip { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 12px; background: var(--line-soft, #eef0f3); }
.pm-chip--danger_entry { background: #fcebeb; color: #791f1f; }
.pm-chip--surge { background: #faeeda; color: #633806; }
.pm-chip--no_data { background: #eef0f3; color: #444441; }
.pm-status--check_needed { background: #fcebeb; color: #791f1f; }
.pm-status--in_progress { background: #e6f1fb; color: #0c447c; }
.pm-status--resolved { background: #eaf3de; color: #27500a; }
.pm-actions { display: inline-flex; gap: 4px; }
.pm-muted, .pm-note, .pm-empty { color: var(--ink-sub, #5b6573); }
.pm-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px 0; }
.pm-note { font-size: 13px; margin: 10px 0 0; }
</style>

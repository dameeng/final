<script setup lang="ts">
// 예지보전 설비 목록 (/pm-equipment). 예전 목업(pm-equipment.vue + data/pm-equipment.json)을 대신한다.
//  GET /api/pm/equipments        설비 목록 (점수 높은 순, 담당 지역만)
//  GET /api/pm/engine-status     예지보전 서버가 점수를 잘 보내는지
//  GET /api/pm/events            점검 대기 건수
// SSE pm-update / data-changed(pm-equipment·pm-event·pm-action·pm-threshold) 가 오면 다시 조회한다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import PmSparkline from '../components/PmSparkline.vue'
import PmActionModal from '../components/PmActionModal.vue'
import { backend, queryString, type PageData } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { PM_TYPES, PM_LEVELS, PM_EVENT_STATUS, PM_ENGINE, pmLabel, isPmChange } from '../utils/pm-labels'

type Equipment = {
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
type Engine = { status: string; lastReceivedAt: string | null; equipmentTotal: number; sensorStale: number }

const PAGE_SIZE = 10
const router = useRouter(),
  level = ref(''),
  type = ref(''),
  page = ref(1),
  list = ref<PageData<Equipment>>(),
  counts = ref<Record<string, number>>({}),
  openEvents = ref<number | null>(null),
  engine = ref<Engine>(),
  loading = ref(false),
  error = ref(''),
  modal = ref<InstanceType<typeof PmActionModal>>()
let controller: AbortController | undefined

const engineLabel = computed(() => PM_ENGINE[engine.value?.status || ''] || ['확인 중', 'idle'])
const levelTabs = [['', '전체'], ['DANGER', '위험'], ['CAUTION', '주의'], ['SAFE', '안전']] as const
const typeTabs = [['', '전체 종류'], ...Object.entries(PM_TYPES)] as const

async function load() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  const get = <T,>(path: string) => backend<T>(path, { signal: current.signal })
  try {
    const [rows, ...rest] = await Promise.allSettled([
      get<PageData<Equipment>>(
        '/api/pm/equipments' +
          queryString({ level: level.value, type: type.value, page: page.value, size: PAGE_SIZE }),
      ),
      ...['DANGER', 'CAUTION', 'SAFE'].map((lv) =>
        get<PageData<Equipment>>('/api/pm/equipments' + queryString({ level: lv, size: 1 })),
      ),
      get<PageData<unknown>>('/api/pm/events?size=1'),
      get<Engine>('/api/pm/engine-status'),
    ])
    if (current.signal.aborted) return
    if (rows.status === 'rejected') throw rows.reason
    list.value = rows.value
    const next: Record<string, number> = {}
    ;['DANGER', 'CAUTION', 'SAFE'].forEach((lv, i) => {
      const r = rest[i]
      if (r?.status === 'fulfilled') next[lv] = (r.value as PageData<unknown>).totalItems
    })
    counts.value = next
    const ev = rest[3], en = rest[4]
    openEvents.value = ev?.status === 'fulfilled' ? (ev.value as PageData<unknown>).totalItems : null
    if (en?.status === 'fulfilled') engine.value = en.value as Engine
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

// 점수 묶음은 지역당 1번이지만 여러 이벤트가 몰려도 한 번만 다시 부른다
let refreshTimer: ReturnType<typeof setTimeout> | undefined
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => void load(), 300)
}
useBackendEvents(({ name, data }) => {
  if (name === 'connected' || isPmChange(name, data, ['pm-equipment', 'pm-event', 'pm-action', 'pm-threshold']))
    refreshSoon()
})
watch([level, type], () => {
  page.value = 1
  void load()
})
watch(page, () => void load(), { immediate: true })
onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  controller?.abort()
})

function change(v: number | null) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const n = Math.round(Number(v) * 10) / 10
  return (n > 0 ? '+' : '') + n.toFixed(1)
}
function openDetail(row: Equipment) {
  void router.push({ path: '/pm-equipment-detail', query: { id: String(row.equipId) } })
}
function act(row: Equipment) {
  if (row.openEventId)
    modal.value?.open({ eventId: row.openEventId, name: row.name, status: row.openEventStatus || undefined, underpassName: row.underpassName })
}
</script>
<template>
  <BackendLayout class="page-pm-equipment">
    <section class="service-workspace pm-equipment-live">
      <div class="crumb">예지보전 &gt; 설비</div>
      <div class="page-head service-heading">
        <div>
          <h1>예지보전 설비</h1>
          <div class="sub">담당 지역 설비의 고장 위험 점수 (0~100, 높을수록 점검 필요)</div>
        </div>
        <div class="pm-head-actions">
          <span class="pm-engine" :class="'pm-engine--'+engineLabel[1]" role="status">
            예지보전 엔진 {{engineLabel[0]}}
            <template v-if="engine?.lastReceivedAt"> · 마지막 수신 {{displayDate(engine.lastReceivedAt)}}</template>
          </span>
          <RouterLink class="btn" to="/pm-queue">점검 대기 →</RouterLink>
          <button class="btn" type="button" :disabled="loading" @click="load">새로고침</button>
        </div>
      </div>

      <div class="pm-kpis">
        <button
          v-for="[value,label] in levelTabs.slice(1)"
          :key="value"
          type="button"
          class="card pm-kpi"
          :class="['pm-kpi--'+value.toLowerCase(),{'is-current':level===value}]"
          @click="level=level===value?'':value"
        >
          <span>{{label}}</span><strong>{{counts[value]??'—'}}</strong>
        </button>
        <RouterLink class="card pm-kpi" to="/pm-queue">
          <span>점검 대기</span><strong>{{openEvents??'—'}}</strong>
        </RouterLink>
      </div>

      <div class="pm-filters">
        <nav class="tabs" aria-label="단계">
          <button
            v-for="[value,label] in levelTabs"
            :key="value"
            type="button"
            :class="{'is-current':level===value,on:level===value}" :aria-pressed="level===value"
            @click="level=value"
          >
            {{label}}
          </button>
        </nav>
        <label class="pm-type">
          종류
          <select v-model="type">
            <option v-for="[value,label] in typeTabs" :key="value" :value="value">{{label}}</option>
          </select>
        </label>
      </div>

      <p v-if="error" role="alert" class="service-error">{{error}} <button @click="load">다시 시도</button></p>
      <p v-if="loading&&!list" role="status">설비 목록을 불러오는 중입니다.</p>
      <p v-if="list&&!list.items.length" class="pm-empty">조건에 맞는 설비가 없어요.</p>

      <div v-if="list?.items.length" class="service-table-wrap">
        <table class="service-table pm-table">
          <thead>
            <tr>
              <th>설비</th><th>종류</th><th>지하차도</th><th>위험 점수</th><th>7일 변화</th>
              <th>최근 24시간</th><th>주요 사유</th><th>마지막 수신</th><th>점검 상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list.items" :key="row.equipId" tabindex="0" @click="openDetail(row)" @keydown.enter="openDetail(row)">
              <td class="pm-name">{{row.name}}</td>
              <td>{{pmLabel(PM_TYPES,row.type)}}</td>
              <td>{{row.underpassName}}</td>
              <td>
                <RiskLevelBadge v-if="row.level" :value="row.level" />
                <b class="pm-score">{{row.score==null?'—':Number(row.score).toFixed(1)}}</b>
              </td>
              <td :class="{'pm-up':Number(row.scoreChange7d)>0}">{{change(row.scoreChange7d)}}</td>
              <td><PmSparkline :values="row.sparkline" :level="row.level||''" /></td>
              <td class="pm-reason" :title="row.reasons?.join('\n')">
                {{row.reasons?.[0]||'이상 없음'}}
                <small v-if="row.reasons?.length>1">외 {{row.reasons.length-1}}건</small>
              </td>
              <td>{{row.lastReceivedAt?displayDate(row.lastReceivedAt):'미수신'}}</td>
              <td @click.stop>
                <button
                  v-if="row.openEventId"
                  type="button"
                  class="btn sm"
                  :class="{'pm-open':row.openEventStatus==='CHECK_NEEDED'}"
                  @click="act(row)"
                >
                  {{pmLabel(PM_EVENT_STATUS,row.openEventStatus)}}
                </button>
                <span v-else class="pm-none">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="list&&list.totalPages>1" class="pm-pager">
        <button class="btn sm" type="button" :disabled="page<=1" @click="page--">이전</button>
        <span>{{page}} / {{list.totalPages}} · 전체 {{list.totalItems}}대</span>
        <button class="btn sm" type="button" :disabled="page>=list.totalPages" @click="page++">다음</button>
      </div>
      <p v-else-if="list" class="pm-note">
        전체 {{list.totalItems}}대 · 점수 높은 순<template v-if="engine?.sensorStale"> · 센서 수신 끊김 {{engine.sensorStale}}대</template>
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

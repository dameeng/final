<script setup lang="ts">
import AppPagination from '../components/AppPagination.vue'
import { adminPageTitle } from '../data/adminTitles'
import { managerAppPath } from '../utils/manager-app-path'
const appPath = (path: string) => managerAppPath(path, route.path)
// 예지보전 점검 이력 (/pm-history). 예전 목업(pm-history.vue + data/pm-history.json)을 대신한다.
//  GET /api/pm/actions?startDate=&endDate=&type=&equipId=   조치 기록 최근 순 (기간은 조치 기록일 기준, endDate 당일 포함)
//  GET /api/pm/equipments?size=100                          설비 고르기 목록
// 조치 기록은 점검 대기(이벤트)에만 붙는다. 이벤트 없이 "직접 등록"하는 API 는 없어서 등록 버튼은 두지 않는다.
// 설비 상세의 "점검 이력 전체 →" 는 ?equipId= 로 들어온다.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackendLayout from '../components/BackendLayout.vue'
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import PmEquipmentCards from '../components/PmEquipmentCards.vue'
import { backend, queryString, type PageData } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
import { displayDate } from '../utils/display-date'
import { PM_TYPES, pmLabel, isPmChange } from '../utils/pm-labels'

type Action = {
  actionId: number
  eventId: number
  equipId: number
  name: string
  type: string
  underpassName: string
  content: string
  managerName: string | null
  createdAt: string
  eventLevel: string | null
  scoreBefore: number | null
  scoreAfter: number | null
}
type Equipment = { equipId: number; name: string; type: string; underpassName: string }

const PAGE_SIZE = 20
const route = useRoute(),
  router = useRouter(),
  startDate = ref(dayOffset(-6)),
  endDate = ref(dayOffset(0)),
  type = ref(''),
  equipId = ref(String(route.query.equipId || '')),
  page = ref(1),
  list = ref<PageData<Action>>(),
  equipments = ref<Equipment[]>([]),
  loading = ref(false),
  error = ref(''),
  dateError = ref('')
let controller: AbortController | undefined

function dayOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// 설비 상세에서 들어오면 기간을 비워 그 설비의 기록 전체를 보여준다
if (equipId.value) {
  startDate.value = ''
  endDate.value = ''
}
const ranges = [
  ['오늘', 0],
  ['최근 7일', -6],
  ['최근 30일', -29],
  ['전체', null],
] as const
const currentRange = computed(() => {
  if (!startDate.value && !endDate.value) return null
  if (endDate.value !== dayOffset(0)) return 'custom'
  const hit = ranges.find(([, d]) => d !== null && startDate.value === dayOffset(d))
  return hit ? hit[1] : 'custom'
})
function setRange(days: number | null) {
  startDate.value = days === null ? '' : dayOffset(days)
  endDate.value = days === null ? '' : dayOffset(0)
}
const equipmentOptions = computed(() =>
  equipments.value.filter((e) => !type.value || e.type === type.value).sort((a, b) => a.name.localeCompare(b.name)),
)
const selectedEquipment = computed(() => equipments.value.find((e) => String(e.equipId) === equipId.value))

async function load() {
  if (startDate.value && endDate.value && startDate.value > endDate.value) {
    dateError.value = '시작일이 종료일보다 늦어요. 기간을 다시 골라 주세요.'
    return
  }
  dateError.value = ''
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  try {
    const rows = await backend<PageData<Action>>(
      '/api/pm/actions' +
        queryString({
          startDate: startDate.value,
          endDate: endDate.value,
          type: type.value,
          equipId: equipId.value,
          page: page.value,
          size: PAGE_SIZE,
        }),
      { signal: current.signal },
    )
    if (!current.signal.aborted) list.value = rows
  } catch (e) {
    if (!current.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
async function loadEquipments() {
  try {
    const page = await backend<PageData<Equipment>>('/api/pm/equipments?size=100')
    equipments.value = page.items
  } catch {
    equipments.value = []
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined
useBackendEvents(({ name, data }) => {
  if (name === 'pm-update') return   // 점수만 바뀐 것은 이력과 상관없다 (점검 후 점수는 다음 조회 때 반영)
  if (name === 'connected' || isPmChange(name, data, ['pm-action', 'pm-equipment'])) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      void load()
      if (name !== 'connected' && data?.resource === 'pm-equipment') void loadEquipments()
    }, 300)
  }
})
watch(type, () => {
  if (selectedEquipment.value && type.value && selectedEquipment.value.type !== type.value) equipId.value = ''
})
watch([startDate, endDate, type, equipId], () => {
  page.value = 1
  void load()
})
watch(equipId, (v) => {
  void router.replace({ query: { ...route.query, equipId: v || undefined } })
})
watch(page, () => void load(), { immediate: true })
void loadEquipments()
onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  controller?.abort()
})

const fmt = (v: number | null) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1))
function change(row: Action) {
  if (row.scoreBefore == null || row.scoreAfter == null) return null
  return Number(row.scoreAfter) - Number(row.scoreBefore)
}
function resetFilters() {
  setRange(-6)
  type.value = ''
  equipId.value = ''
}
</script>
<template>
  <BackendLayout class="page-pm-history">
    <section class="service-workspace pm-history-live">
      
      <div class="page-head service-heading">
        <div>
          <h1>{{adminPageTitle('/pm-history')}}</h1>
          <div class="sub">점검 대기에서 남긴 조치 기록 · 점검 전 점수와 점검 뒤 첫 점수를 비교해요</div>
        </div>
        <div class="pm-head-actions">
          <RouterLink class="btn" :to="appPath('/pm-queue')">점검 대기 →</RouterLink>
          <RouterLink class="btn" :to="appPath('/pm-equipment')">{{adminPageTitle('/pm-equipment')}} →</RouterLink>
          <button v-if="!route.path.startsWith('/admin-app/')" class="btn" type="button" :disabled="loading" @click="load">새로고침</button>
        </div>
      </div>

      <section class="card pm-filter-card" aria-label="조회 조건">
        <div class="pm-filter-row">
          <span class="pm-filter-label">기간</span>
          <div class="pm-range">
            <button
              v-for="[label,days] in ranges"
              :key="label"
              type="button"
              class="btn sm"
              :class="{'is-current':currentRange===days}"
              @click="setRange(days)"
            >
              {{label}}
            </button>
          </div>
          <input v-model="startDate" class="pm-date" type="date" aria-label="시작일" :max="endDate||undefined" />
          <span aria-hidden="true">~</span>
          <input v-model="endDate" class="pm-date" type="date" aria-label="종료일" :min="startDate||undefined" />
        </div>
        <div class="pm-filter-row">
          <label class="pm-select">
            <span class="pm-filter-label">종류</span>
            <select v-model="type">
              <option value="">전체 종류</option>
              <option v-for="(label,value) in PM_TYPES" :key="value" :value="value">{{label}}</option>
            </select>
          </label>
          <label class="pm-select">
            <span class="pm-filter-label">설비</span>
            <select v-model="equipId">
              <option value="">전체 설비</option>
              <option v-for="e in equipmentOptions" :key="e.equipId" :value="String(e.equipId)">
                {{e.name}} · {{pmLabel(PM_TYPES,e.type)}} · {{e.underpassName}}
              </option>
            </select>
          </label>
          <button class="btn sm" type="button" @click="resetFilters">조건 초기화</button>
        </div>
        <p v-if="dateError" class="pm-date-error" role="alert">{{dateError}}</p>
      </section>

      <div class="pm-results-viewport" :aria-busy="loading">
      <p v-if="error" role="alert" class="service-error">{{error}} <button @click="load">다시 시도</button></p>
      <p v-if="loading&&!list" role="status">점검 이력을 불러오는 중입니다.</p>

      <p v-if="list" class="pm-summary">
        <template v-if="selectedEquipment">{{selectedEquipment.name}} · </template>
        {{startDate||endDate?`${startDate||'처음'} ~ ${endDate||'오늘'}`:'전체 기간'}} · <b>{{list?.totalItems??0}}건</b>
      </p>

      <div v-if="list&&!list.items.length" class="card pm-empty">
        <b>이 조건에 맞는 점검 기록이 없어요.</b>
        <span>점검 대기에서 점검을 시작하거나 기록을 추가하면 여기에 쌓여요.</span>
        <RouterLink class="btn sm" :to="appPath('/pm-queue')">점검 대기로 가기</RouterLink>
      </div>

      <PmEquipmentCards v-if="route.path.startsWith('/admin-app/')&&list?.items.length" :items="list.items" />
      <div v-else-if="list?.items.length" class="service-table-wrap">
        <table class="service-table pm-table">
          <thead>
            <tr><th>일시</th><th>설비</th><th>지하차도</th><th>조치 내용</th><th>등록자</th><th>점검 전 → 후</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in list.items" :key="row.actionId">
              <td data-label="일시" class="pm-nowrap"><div class="pm-cell-content">{{displayDate(row.createdAt)}}</div></td>
              <td data-label="설비" class="pm-nowrap"><div class="pm-cell-content">
                <RouterLink class="pm-name" :to="{path:appPath('/pm-equipment-detail'),query:{id:String(row.equipId)}}">{{row.name}}</RouterLink>
                <small class="pm-type-tag">{{pmLabel(PM_TYPES,row.type)}}</small>
              </div></td>
              <td data-label="지하차도" class="pm-nowrap"><div class="pm-cell-content">{{row.underpassName}}</div></td>
              <td data-label="조치 내용" class="pm-content" :title="row.content"><div class="pm-cell-content"><div class="pm-cell-summary">{{row.content}}</div></div></td>
              <td data-label="등록자" class="pm-nowrap"><div class="pm-cell-content">{{row.managerName||'—'}}</div></td>
              <td data-label="점검 전 → 후" class="pm-nowrap"><div class="pm-cell-content">
                <span class="pm-scores">
                  <RiskLevelBadge v-if="row.eventLevel" :value="row.eventLevel" />
                  <span>{{fmt(row.scoreBefore)}} →</span>
                  <b v-if="row.scoreAfter!=null" :class="{'pm-down':(change(row)??0)<0,'pm-up':(change(row)??0)>0}">{{fmt(row.scoreAfter)}}</b>
                  <small v-else>점검 뒤 점수 대기</small>
                  <small v-if="change(row)!=null" :class="{'pm-down':change(row)!<0,'pm-up':change(row)!>0}">
                    ({{change(row)!>0?'+':''}}{{change(row)!.toFixed(1)}})
                  </small>
                </span>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>

      </div>
      <AppPagination v-if="route.path.startsWith('/admin-app/')" :page="page" :pages="list?.totalPages||1" :disabled="loading" @change="page=$event" />
      <div v-else class="pm-pager">
        <button class="btn sm" type="button" :disabled="loading||page<=1" @click="page--">이전</button>
        <span>{{page}} / {{Math.max(1,list?.totalPages||1)}} · 전체 {{list?.totalItems??0}}건</span>
        <button class="btn sm" type="button" :disabled="loading||page>=Math.max(1,list?.totalPages||1)" @click="page++">다음</button>
      </div>
      <p class="pm-note">조치 기록은 점검 대기에서만 남길 수 있어요 · 등록자는 기록한 관리자로 자동 저장돼요 · 점검 뒤 점수는 조치 기록 뒤 처음 들어온 점수예요</p>
    </section>
  </BackendLayout>
</template>
<style scoped>
.pm-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pm-filter-card { display: grid; gap: 10px; margin: 12px 0; }
.pm-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.pm-filter-label { font-size: 13px; color: var(--ink-sub, #5b6573); }
.pm-range { display: flex; flex-wrap: wrap; gap: 6px; }
.pm-range .is-current { outline: 2px solid var(--primary, #2b5c8a); }
.pm-select { display: flex; align-items: center; gap: 8px; }
.pm-select select { max-width: 320px; }
.pm-date-error { margin: 0; font-size: 13px; color: var(--danger, #c0392b); }
.pm-summary { margin: 0 0 8px; font-size: 14px; color: var(--ink-sub, #5b6573); }
.pm-summary b { color: var(--ink, #1f2630); }
.pm-empty { display: grid; justify-items: start; gap: 6px; }
.pm-empty span { color: var(--ink-sub, #5b6573); font-size: 14px; }
.pm-nowrap { white-space: nowrap; }
.pm-name { font-family: ui-monospace, Consolas, monospace; }
.pm-table small { color: var(--ink-sub, #5b6573); }
.pm-type-tag { margin-left: 6px; }
.pm-content { min-width: 240px; max-width: 460px; white-space: pre-line; }
.pm-scores { display: inline-flex; align-items: center; gap: 6px; }
.pm-table .pm-down { color: #3b8c3e; }
.pm-table .pm-up { color: var(--danger, #c0392b); }
.pm-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px 0; }
.pm-note { font-size: 13px; margin: 10px 0 0; color: var(--ink-sub, #5b6573); }
</style>

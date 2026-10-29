<script setup lang="ts">
import AppPagination from '../components/AppPagination.vue'
import FacilityConfiguration from '../components/FacilityConfiguration.vue'
import NotificationDetailView from '../components/NotificationDetailView.vue'
import { matchesKoreanSearch } from '../utils/korean-search'
import TunnelCctvDialog from '../components/TunnelCctvDialog.vue'
import RemainingVehicleTransfer from '../components/RemainingVehicleTransfer.vue'
const remainingTransfer=ref<InstanceType<typeof RemainingVehicleTransfer>>()
import { useNotificationGlow } from '../stores/notificationGlow'
import { notificationTarget } from '../utils/notification-target'
const notificationGlow = useNotificationGlow()
import RiskLevelBadge from '../components/RiskLevelBadge.vue'
import { formatPhone } from '../utils/phone'
import { dateParts, displayDate } from '../utils/display-date'
import { riskGroup, matchesRisk, boardCategoryLabel } from '../services/backendCatalog'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import MyUnderpassList from '../components/MyUnderpassList.vue'
import { adminResourceTitles } from '../data/adminTitles'
import { compareFacilityPriority } from '../utils/facility-priority'
import UnderpassVmsPanel from '../components/UnderpassVmsPanel.vue'
import AdminFacilityList from '../components/AdminFacilityList.vue'
import AdminAppFacilityRows from '../components/AdminAppFacilityRows.vue'
import OcrRecordDetail from '../components/OcrRecordDetail.vue'
import AdminReviewCards from '../components/AdminReviewCards.vue'
import TrafficVideo from '../components/TrafficVideo.vue'
import DeadlineTimer from '../components/DeadlineTimer.vue'
import FaqAccordion from '../components/FaqAccordion.vue'
import BackendLayout from '../components/BackendLayout.vue'
import ServiceFields from '../components/ServiceFields.vue'
import {
  backendResources,
  resourceRoutes,
  valueLabels,
  type Field,
  type Action,
} from '../data/backendResources'
import { backend, asPage, queryString, downloadPdf, type PageData } from '../services/backend'
import { useApp } from '../stores/app'
import { ownsFacility } from '../services/facilityAccess'
import { patchFacility, facilityEvents, plateQueueRow } from '../services/streamUpdates'
import type { BackendEvent } from '../composables/useBackendEvents'
import { useManagerNotifications } from '../stores/managerNotifications'
import { cachedGet, clearLookupCache } from '../services/lookupCache'
import { useBackendEvents } from '../composables/useBackendEvents'
import { resourceTabs, resourceShortcuts } from '../data/resourceNavigation'
import { alertLogReturn } from '../services/resourceNavigation'
const props = defineProps<{ resourceKey?: string; embedded?: boolean; operationsOnly?: boolean }>()
const emit = defineEmits<{
  saved: [result?: { id: string; status: 'NORMAL' | 'BLOCKED' }]
}>()
const route = useRoute(),
  app = useApp(),
  resourceId = computed(() =>
    String(
      props.resourceKey || route.params.resource || resourceRoutes[route.path] || 'facilities',
    ),
  ),
  resource = computed(() => backendResources[resourceId.value]),
  customer = computed(
    () =>
      resource.value?.owner ||
      ['/c-notice', '/info/faq', '/customer-app/notices', '/customer-app/faq'].includes(route.path),
  )
const restored = computed(() => !customer.value && !route.path.startsWith('/admin-app/'))
const appPage = computed(() => /^\/(admin|customer)-app\//.test(route.path))
const facilityList = computed(() => restored.value && resourceId.value === 'facilities')
// 카메라·임계치·전광판 관리: 왼쪽 내 지하차도 목록 + 오른쪽 선택한 지하차도의 화면
const splitTargets: Record<string, string> = Object.fromEntries(
  ['cameras', 'thresholds', 'display'].map(key => [key, adminResourceTitles[key]!]),
)
const underpassSplit = computed(
  () => restored.value && !props.embedded && Object.hasOwn(splitTargets, resourceId.value),
)
// 전광판은 부모 키가 vmsId라서, 지하차도 선택을 따로 두고 범용 표 대신 지하차도별 전광판 패널을 쓴다
const vmsSplit = computed(() => underpassSplit.value && resourceId.value === 'display')
const splitUnderpassFields: Field[] = [
  { key: 'underpassId', label: '지하차도', type: 'select', source: 'underpasses', required: true },
]
const router = useRouter()
const splitUnderpassName = computed(
  () => choices.underpassId?.find((option) => option.value === String(parents.underpassId || ''))?.label,
)
function selectUnderpass(id: string) {
  void router.replace({ query: { ...route.query, underpassId: id, id: undefined } })
}
const appFacilityList = computed(
  () => route.path === '/admin-app/screen-4' && resourceId.value === 'facilities',
)
const customerService = computed(
  () =>
    restored.value &&
    ['customers', 'inquiries', 'notices', 'faqs', 'alerts', 'manager-notifications'].includes(
      resourceId.value,
    ),
)
const managerNotifications = useManagerNotifications()
async function readAllManagerNotifications() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await backend(
      '/api/managers/me/notifications/read-all' + queryString({ category: filters.category }),
      { method: 'PUT' },
    )
    await Promise.all([load(), managerNotifications.refresh()])
    message.value = '알림을 모두 읽음 처리했습니다.'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
const riskFilter = ref('')
const facilityRows = computed(() =>
  data.value.items.filter((row) => matchesRisk(row.currentRiskLevel, riskFilter.value)),
)
async function moveFaq(row: Record<string, any>, direction: number) {
  if (saving.value || !canWrite.value) return
  const ids = data.value.items.map((item) => Number(item.id)),
    index = ids.indexOf(Number(row.id)),
    next = index + direction
  if (index < 0 || next < 0 || next >= ids.length) return
  ;[ids[index], ids[next]] = [ids[next]!, ids[index]!]
  saving.value = true
  error.value = ''
  try {
    await backend('/api/faqs/order', { method: 'PUT', body: { ids } })
    await load()
    message.value = 'FAQ 표시 순서를 저장했습니다.'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
function reviewTab(status: string) {
  filters.reviewStatus = status
  search()
}
async function review(row: Record<string, any>, number: string) {
  await open('action', row, resource.value.actions?.[0])
  values.correctedNum = number
}
const publicNotices = computed(() => customer.value && resourceId.value === 'notices')
const managerNotificationList = computed(() => resourceId.value === 'manager-notifications')
const pageSize = computed(() => route.path.startsWith('/admin-app/') ? 5 : route.path.startsWith('/customer-app/') ? 20 : 10)
async function markManagerNotificationRead(row: Record<string, any>) {
  if (saving.value || row.read) return
  saving.value = true
  error.value = ''
  try {
    await managerNotifications.read(Number(row.id))
    row.read = true
    if (filters.unreadOnly) await load()
  } catch (e) { error.value = (e as Error).message }
  finally { saving.value = false }
}
function managerNotificationTarget(row:Record<string,any>) {
  if (appPage.value) return { path: route.path, query: { ...route.query, notification: String(row.id) } }
  return notificationTarget({id:Number(row.id),refType:row.refType,refId:row.refId,regionId:row.regionId},true,route.path,route.path)
}
async function openManagerNotification(event:MouseEvent,row:Record<string,any>) {
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return
  event.preventDefault()
  if(saving.value)return
  if(!row.read)await markManagerNotificationRead(row)
  if(row.read)await router.push(managerNotificationTarget(row))
}
const readNotices = ref<Record<string, string>>({})
const noticeReadKey = computed(
  () => `routel-read-notices:${app.account?.role || 'guest'}:${app.account?.id || 'guest'}`,
)
watch(
  noticeReadKey,
  (key) => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}')
      readNotices.value =
        stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
    } catch {
      readNotices.value = {}
    }
  },
  { immediate: true },
)
function noticeVersion(row: Record<string, any>) {
  return String(row.updatedAt || row.createdAt || 'read')
}
function noticeUnread(row: Record<string, any>) {
  return publicNotices.value && readNotices.value[String(row.id)] !== noticeVersion(row)
}
function markNoticeRead(row: Record<string, any>) {
  readNotices.value = { ...readNotices.value, [String(row.id)]: noticeVersion(row) }
  try {
    localStorage.setItem(noticeReadKey.value, JSON.stringify(readNotices.value))
  } catch {
    /* Reading still works when browser storage is unavailable. */
  }
}
async function loadCollection(signal: AbortSignal) {
  // 관리자 시설 목록은 담당 지역만 (서버 기본값은 전체 ALL)
  const scope =
    (facilityList.value || appFacilityList.value) && app.account?.role === 'REGIONAL_ADMIN' ? 'MINE' : ''
  const collectionFilters = { ...filters }
  if (facilityList.value || appFacilityList.value) delete collectionFilters.keyword
  const fetchPage = async (current: number) =>
    asPage<Record<string, any>>(
      await backend(
        path(resource.value.path) + queryString({ ...collectionFilters, scope, page: current, size: 100 }),
        { signal },
      ),
      current,
      100,
    )
  const first = await fetchPage(1),
    items = [...first.items]
  for (let current = 2; current <= first.totalPages; current++)
    items.push(...(await fetchPage(current)).items)
  if(resourceId.value==='cars') return {items,page:1,size:items.length,totalItems:items.length,totalPages:1}
  if(!signal.aborted&&(facilityList.value||appFacilityList.value)) facilitySearchRows.value=[...items]
  if ((facilityList.value || appFacilityList.value) && filters.keyword) {
    const matched = items.filter(row => matchesKoreanSearch([row.name,row.regionName,row.roadAddress].filter(Boolean).join(' '),filters.keyword))
    items.splice(0,items.length,...matched)
  }
  if (['notices', 'faqs'].includes(resourceId.value)) {
    const views = (row: Record<string, any>) => {
      const count = Number(row.viewCount)
      return Number.isFinite(count) ? Math.max(0, count) : 0
    }
    const important = (row: Record<string, any>) =>
      row.important === true || row.important === 'true' || row.important === 1
    items.sort((a, b) =>
      (resourceId.value === 'notices' ? Number(important(b)) - Number(important(a)) : 0) ||
      views(b) - views(a),
    )
  }
  if ((facilityList.value || appFacilityList.value) && riskFilter.value) {
    const selected = items.filter((row) => matchesRisk(row.currentRiskLevel, riskFilter.value))
    items.splice(0, items.length, ...selected)
  }
  if (appFacilityList.value) items.sort(compareFacilityPriority)
  const size = pageSize.value
  const totalPages = Math.ceil(items.length / size)
  page.value = Math.min(page.value, Math.max(1, totalPages))
  return {
    items: items.slice((page.value - 1) * size, page.value * size),
    page: page.value,
    size,
    totalItems: items.length,
    totalPages,
  }
}
const visibleColumns = computed(() =>
  publicNotices.value
    ? resource.value.columns.filter(([key]) => key !== 'important')
    : resource.value.columns,
)
const pageTitle = computed(() =>
  customer.value && resourceId.value === 'notices'
    ? '공지사항'
    : customer.value && resourceId.value === 'faqs'
      ? '자주 묻는 질문 (FAQ)'
      : resource.value.title,
)
function presetMessage(row: Record<string, any>) {
  const content = String(row.content ?? '')
  const label = resource.value.filters?.[0]?.options?.find(([value]) => value === row.category)?.[1]
  if (!label || !content.startsWith(label)) return content
  const remainder = content.slice(label.length)
  return /^\s*[—–\-:：|·]\s*/.test(remainder)
    ? remainder.replace(/^\s*[—–\-:：|·]\s*/, '') || content
    : content
}
function displayField(key: string, value: any) {
  if (key === 'earlyBlock' && typeof value === 'boolean') return value ? '대상' : '대상 아님'
  if (['phone', 'emergency'].includes(key)) return formatPhone(value) || '—'
  return resourceId.value === 'notices' && key === 'important'
    ? value
      ? '중요 공지'
      : '일반 공지'
    : display(value)
}
const relatedIds = computed(() => resourceTabs(resourceId.value)),
  shortcuts = computed(() => resourceShortcuts[resourceId.value] || [])
function resourceLink(id: string) {
  const appPaths: Record<string, string> = {
    ocr: '/admin-app/ocr',
    reviews: '/admin-app/reviews',
    transits: '/admin-app/transits',
    transfers: '/admin-app/transfers',
    facilities: '/admin-app/screen-4',
    alerts: '/admin-app/screen-13',
    'manager-notifications': '/admin-app/notifications',
  }
  const paths: Record<string, string> = {
    facilities: '/fac-list',
    reviews: '/verify',
    events: '/logs',
    alerts: '/notifications',
  }
  const destination =
    route.path.startsWith('/admin-app/') && appPaths[id]
      ? appPaths[id]
      : paths[id] || '/admin-data/' + id
  const supported = new Set(
    [...(backendResources[id]?.filters || []), ...(backendResources[id]?.parents || [])].map(
      (field) => field.key,
    ),
  )
  const query: Record<string, string> = {}
  for (const key of ['underpassId', 'regionId', 'carNum']) {
    if (key === 'regionId' && (parents.underpassId || filters.underpassId)) continue
    const value = parents[key] || filters[key]
    if (supported.has(key) && value !== undefined && value !== null && value !== '')
      query[key] = String(value)
  }
  return { path: destination, query }
}

const canWrite = computed(() =>
  resource.value?.owner
    ? app.account?.role === 'customer'
    : !customer.value && app.account?.role === 'REGIONAL_ADMIN',
)
const hasRowActions = computed(
  () =>
    !publicNotices.value &&
    !!(
      resource.value.detail ||
      (canWrite.value &&
        (resource.value.edit || resource.value.remove || resource.value.actions?.length)) ||
      ['facilities', 'cameras'].includes(resourceId.value)
    ),
)
const filters = reactive<Record<string, any>>({}),
  parents = reactive<Record<string, any>>({}),
  choices = reactive<Record<string, { value: string; label: string }[]>>({}),
  values = reactive<Record<string, any>>({})
const facilitySearchRows = ref<Record<string, any>[]>([])
function facilityCount(level:string){
  const rows=facilitySearchRows.value.filter(row=>!filters.keyword||matchesKoreanSearch([row.name,row.regionName,row.roadAddress].filter(Boolean).join(' '),filters.keyword))
  return rows.filter(row=>!level||matchesRisk(row.currentRiskLevel,level)).length
}
const facilitySearchOpen = ref(false), facilitySearchIndex = ref(-1)
const facilitySuggestions = computed(() => !String(filters.keyword||'').trim() ? [] : facilitySearchRows.value.filter(row =>
  (!riskFilter.value || matchesRisk(row.currentRiskLevel,riskFilter.value)) &&
  matchesKoreanSearch([row.name,row.regionName,row.roadAddress].filter(Boolean).join(' '),filters.keyword)
).slice(0,6))
function chooseFacilitySuggestion(row: Record<string, any>) {
  filters.keyword=row.name
  facilitySearchOpen.value=false; facilitySearchIndex.value=-1
  search()
}
function facilitySearchKey(event: KeyboardEvent) {
  if(event.isComposing) return
  if(event.key==='Escape') { event.preventDefault(); facilitySearchOpen.value=false; facilitySearchIndex.value=-1 }
  else if((event.key==='ArrowDown'||event.key==='ArrowUp')&&facilitySuggestions.value.length) {
    event.preventDefault(); facilitySearchOpen.value=true
    const count=facilitySuggestions.value.length
    facilitySearchIndex.value=facilitySearchIndex.value<0
      ? event.key==='ArrowDown'?0:count-1
      : (facilitySearchIndex.value+(event.key==='ArrowDown'?1:-1)+count)%count
  } else if(event.key==='Enter'&&facilitySearchOpen.value&&facilitySearchIndex.value>=0) {
    const row=facilitySuggestions.value[facilitySearchIndex.value]
    if(row) { event.preventDefault(); chooseFacilitySuggestion(row) }
  }
}
const acknowledge = ref(false)
const data = ref<PageData<Record<string, any>>>({
    items: [],
    page: 1,
    size: pageSize.value,
    totalItems: 0,
    totalPages: 0,
  }),
  page = ref(1),
  loading = ref(false),
  error = ref(''),
  message = ref(''),
  saving = ref(false),
  modal = ref<HTMLDialogElement>(),
  selected = ref<Record<string, any> | null>(null),
  mode = ref(''),
  formFields = ref<Field[]>([]),
  action = ref<Action>(),
  detail = ref<Record<string, any>>({})
let abort: AbortController | undefined,
  request = 0,
  alive = true
function path(template: string, row = selected.value) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    encodeURIComponent(
      String(
        key === 'id' ? row?.[resource.value.rowKey || 'id'] : (parents[key] ?? row?.[key] ?? ''),
      ),
    ),
  )
}
const missingParent = computed(() =>
  resource.value?.parents?.some((field) => field.required && !parents[field.key]),
)
const recordFacilityRegions = reactive<Record<string, string>>({})
function syncRecordRegion() {
  if (['ocr', 'reviews', 'transits'].includes(resourceId.value) && filters.underpassId)
    filters.regionId = recordFacilityRegions[String(filters.underpassId)] || ''
}
// 선택 목록 조회 실패는 빈 선택지만 남기지 않고 안내와 다시 시도 버튼을 보여 준다
const lookupError = ref('')
let lastLookup: { fields: Field[]; row?: Record<string, any> } | undefined
function runLookup(fields: Field[], row?: Record<string, any>) {
  lookupError.value = ''
  lastLookup = { fields, row }
  void lookup(fields, row)
}
function retryLookup() {
  if (lastLookup) runLookup(lastLookup.fields, lastLookup.row)
}
async function lookup(fields: Field[], row?: Record<string, any>) {
  const scope = resourceId.value
  const lookupRoute = resourceRouteKey()
  const myTransfers = scope === 'transfers' && app.account?.role === 'REGIONAL_ADMIN'
  const myRecords = ['ocr', 'reviews', 'transits'].includes(scope) && app.account?.role === 'REGIONAL_ADMIN'
  for (const field of fields) {
    if (!field.source) continue
    let url =
      field.source === 'underpasses'
        ? '/api/underpasses?size=500' + (underpassSplit.value || app.account?.role === 'REGIONAL_ADMIN' ? '&scope=MINE&sort=NAME' : '')
        : field.source === 'regions'
          ? '/api/regions'
          : field.source === 'shifts'
            ? '/api/shifts'
            : field.source === 'presets'
              ? '/api/display/presets'
              : field.source === 'vms'
                ? '/api/its-vms'
              : field.source === 'reasons'
                ? '/api/control/reason-presets' +
                  (action.value?.path.endsWith('/release')
                    ? '?type=RELEASE'
                    : action.value?.path.endsWith('/block')
                      ? '?type=BLOCK'
                      : '')
                : `/api/underpasses/${row?.id || parents.underpassId}/cameras`
    if (field.source === 'cameras' && !row?.id && !parents.underpassId) continue
    try {
      const result = await cachedGet(url)
      // 관리자 시설 목록의 지역 필터는 담당 지역만 (목록 자체가 scope=MINE 이라 다른 지역은 0건)
      const mine =
        field.source === 'regions' &&
        (facilityList.value || appFacilityList.value || myRecords) &&
        resource.value.filters?.includes(field) &&
        app.account?.role === 'REGIONAL_ADMIN'
          ? new Set((app.account.regions || []).map((region) => String(region.id)))
          : undefined
      if (alive && scope === resourceId.value && lookupRoute === resourceRouteKey() && (!row || selected.value?.id === row.id)) {
        const items = asPage<any>(result).items.filter((item) =>
          (!mine || mine.has(String(item.id))) &&
          !(app.account?.role === 'REGIONAL_ADMIN' && field.source === 'underpasses' && !ownsFacility(item)))
        if (myRecords && field.source === 'underpasses' && !row) {
          for (const key of Object.keys(recordFacilityRegions)) delete recordFacilityRegions[key]
          for (const item of items) {
            const region = item.assignedRegionId ?? item.regionId ?? item.region?.id
            if (region != null) recordFacilityRegions[String(item.id)] = String(region)
          }
          syncRecordRegion()
        }
        choices[field.key] = items.map((item) => ({
          value: String(item.id),
          label:
            field.source === 'vms'
              ? `${item.name}${item.dummy ? ' (시연용)' : ''} · ${item.id}`
              : item.name || item.content || `${item.cameraRole} · ${item.id}`,
        }))
        // 이관 문서는 담당 지하차도로 바로 진입하되, 문서 링크의 시설 선택은 유지한다.
        if (myTransfers && !row && field.key === 'underpassId' &&
            resource.value.parents?.includes(field) && !parents.underpassId &&
            !route.query.underpassId && choices[field.key]?.length) {
          selectUnderpass(choices[field.key]![0]!.value)
        }
      }
    } catch (e) {
      // 목록 자체의 오류는 목록이 따로 보여 주고, 여기서는 선택 목록 실패만 안내한다
      if (alive && scope === resourceId.value)
        lookupError.value = '선택 목록을 불러오지 못했습니다. ' + ((e as Error)?.message || '')
    }
  }
}
async function load() {
  if (props.operationsOnly) return
  if (!resource.value || missingParent.value) return
  syncRecordRegion()
  abort?.abort()
  abort = new AbortController()
  const seq = ++request
  loading.value = true
  error.value = ''
  try {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate)
      throw new Error('시작일은 종료일보다 늦을 수 없습니다.')
    const result =
      ['notices', 'faqs', 'cars'].includes(resourceId.value) || managerNotificationList.value || facilityList.value || appFacilityList.value
        ? await loadCollection(abort.signal)
        : await backend(
            path(resource.value.path) + queryString({ ...filters, page: page.value, size: pageSize.value }),
            { signal: abort.signal },
          )
    if (seq === request) {
      if (Array.isArray(result)) {
        const size=pageSize.value, totalPages=Math.ceil(result.length/size)
        page.value=Math.min(page.value,Math.max(1,totalPages))
        data.value={items:result.slice((page.value-1)*size,page.value*size),page:page.value,size,totalItems:result.length,totalPages}
      } else data.value = asPage(result, page.value, pageSize.value)
    }
  } catch (e) {
    if (seq === request && !abort.signal.aborted) error.value = (e as Error).message
  } finally {
    if (seq === request) loading.value = false
  }
}
function imageUrl(value: string) {
  if (!value) return ''
  const parts = value.replace(/^\/api\/uploads\//, '').split(/[\\/]/)
  if (parts.some((part) => part === '..' || part === '.') || value.includes(':')) return ''
  return '/api/uploads/' + parts.filter(Boolean).map(encodeURIComponent).join('/')
}
function display(value: any) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  if (Array.isArray(value))
    return value.map((item) => (typeof item === 'object' ? item.name || item.id : item)).join(', ')
  if (typeof value === 'object') return value.name || '—'
  const timestamp = dateParts(value)
  if (timestamp) return `${timestamp.date}${timestamp.time ? ' ' + timestamp.time : ''}`
  return valueLabels[String(value)] || String(value).replace('T', ' ')
}
function canEditRow(row: Record<string, any>) {
  return (
    resource.value.edit &&
    canWrite.value &&
    (resourceId.value !== 'my-inquiries' || row.status === 'PENDING') &&
    (resourceId.value !== 'facilities' || ownsFacility(row))
  )
}
function actionEnabled(row: Record<string, any>) {
  return resourceId.value === 'facilities'
    ? ownsFacility(row)
    : resourceId.value === 'manager-notifications'
      ? !row.read
      : resourceId.value === 'transits'
        ? row.status !== 'EXITED'
        : true
}
function openDialog() {
  if (modal.value && !modal.value.open) modal.value.showModal()
}
let summaryBackdropDown = false
function isSummaryBackdrop(event: MouseEvent | PointerEvent) {
  const dialog = modal.value
  if (!dialog || event.target !== dialog || mode.value !== 'detail' || saving.value) return false
  const rect = dialog.getBoundingClientRect()
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
}
function closeSummaryBackdrop(event: MouseEvent) {
  if (summaryBackdropDown && isSummaryBackdrop(event)) modal.value?.close()
  summaryBackdropDown = false
}
async function open(kind: string, row?: Record<string, any>, itemAction?: Action) {
  if (resource.value.detailFromRow && row) {
    const record = data.value.items.find((item) => String(item.id) === String(row?.id))
    if (!record && Object.keys(row).every(key => key === 'id')) {
      error.value = '선택한 기록을 현재 조회 목록에서 찾을 수 없습니다. 담당 지역·지하차도·조회 기간을 확인한 뒤 목록에서 기록을 선택해 주세요.'
      return
    }
    row = record || row
  }
  if (!['detail', 'video'].includes(kind) && !canWrite.value) {
    error.value = '이 작업을 수행할 권한이 없습니다.'
    return
  }
  acknowledge.value = false
  selected.value = row || null
  mode.value = kind
  action.value = itemAction
  error.value = ''
  message.value = ''
  Object.keys(values).forEach((key) => delete values[key])
  detail.value = row || {}
  formFields.value = (
    kind === 'remove' || kind === 'detail' || kind === 'video'
      ? []
      : kind === 'action'
        ? itemAction?.fields || []
        : resource.value.fields || []
  ).filter((field) => kind !== 'edit' || resourceId.value !== 'notices' || field.key !== 'sendPush')
  try {
    if (row && resource.value.detail && !resource.value.detailFromRow) {
      detail.value = await backend(`${path(resource.value.path)}/${encodeURIComponent(row.id)}`)
    }
    // 전광판: 기본 문구(defaultPage)와 자동 표출 페이지(manual=false)는 서버가 만들고 수정·삭제를 막는다
    if (resourceId.value === 'display' && ['edit', 'remove'].includes(kind) && row && (row.defaultPage || row.manual === false))
      throw new Error(
        row.defaultPage
          ? '기본 문구는 수정·삭제할 수 없어요. 새 페이지를 등록하면 기본 문구 대신 표출돼요.'
          : '자동 표출 페이지는 수정·삭제할 수 없어요. 지하차도 상태가 바뀌면 자동으로 바뀌어요.',
      )
    if (resourceId.value === 'my-inquiries' && kind === 'edit' && detail.value.status !== 'PENDING')
      throw new Error('답변이 등록된 문의는 수정할 수 없습니다.')
    if (
      resourceId.value === 'facilities' &&
      ['action', 'edit', 'remove'].includes(kind) &&
      !ownsFacility(detail.value)
    )
      throw new Error('담당 외 시설은 통제할 수 없습니다.')
    for (const field of formFields.value) {
      const value =
        field.key === 'category' && detail.value[field.key] == null
          ? resourceId.value === 'notices'
            ? 'INFO'
            : resourceId.value === 'faqs'
              ? 'ETC'
              : ''
          : field.key === 'eventId'
            ? detail.value.currentBlockEventId
            : field.key === 'content' && resourceId.value === 'inquiries' && kind === 'action'
              ? itemAction?.method === 'POST'
                ? ''
                : detail.value.replyContent
              : field.key === 'correctedNum'
                ? detail.value.correctedNum || detail.value.detectedNum
                : detail.value[field.key]
      values[field.key] =
        field.type === 'multi'
          ? Array.isArray(value)
            ? value.map((v) => String(v.id || v))
            : []
          : field.type === 'checkbox'
            ? Boolean(value)
            : Array.isArray(value)
              ? value.join('\n')
              : value == null
                ? ''
                : String(value)
    }
    if (kind === 'create' && !values.regionId && formFields.value.some(field => field.key === 'regionId') &&
        app.account?.role === 'REGIONAL_ADMIN' && app.account.regions?.length)
      values.regionId = String(app.account.regions[0]!.id)
    // 전광판 새 페이지: 지하차도 상세 탭에서 열었으면 그 지하차도를 원인 지하차도로 미리 고른다
    if (kind === 'create' && resourceId.value === 'display' && !values.underpassId && route.query.underpassId)
      values.underpassId = String(route.query.underpassId)
    runLookup(formFields.value, row)
    openDialog()
    if (publicNotices.value && kind === 'detail' && row) {
      markNoticeRead(row)
      if (typeof detail.value.viewCount === 'number') row.viewCount = detail.value.viewCount
    }
  } catch (e) {
    error.value = (e as Error).message
  }
}
function body() {
  const result: Record<string, unknown> = {}
  for (const field of formFields.value) {
    const value = values[field.key]
    if (field.type === 'multi') result[field.key] = (value || []).map(Number)
    else if (field.type === 'lines')
      result[field.key] = String(value || '')
        .split(/\n/)
        .map((v) => v.trim())
        .filter(Boolean)
    else if (field.type === 'checkbox') result[field.key] = Boolean(value)
    else if (field.type === 'number' || field.source)
      result[field.key] = value === '' ? null : Number(value)
    else result[field.key] = value === '' ? null : value
  }
  return result
}
async function submit() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (
      resourceId.value === 'my-inquiries' &&
      mode.value === 'edit' &&
      detail.value.status !== 'PENDING'
    )
      throw new Error('답변이 등록된 문의는 수정할 수 없습니다.')
    if (!canWrite.value) throw new Error('이 작업을 수행할 권한이 없습니다.')
    if (
      resourceId.value === 'facilities' &&
      ['action', 'edit', 'remove'].includes(mode.value) &&
      !ownsFacility(detail.value)
    )
      throw new Error('담당 외 시설은 통제할 수 없습니다.')
    if (
      resourceId.value === 'display' &&
      mode.value !== 'remove' &&
      !values.presetId &&
      !String(values.content || '').trim()
    )
      throw new Error('문구를 선택하거나 입력해 주세요.')
    if (resourceId.value === 'display' && mode.value === 'create' && !values.underpassId)
      throw new Error('원인 지하차도를 선택해 주세요.')
    if (resourceId.value === 'customers' && mode.value === 'edit' && !acknowledge.value)
      throw new Error('주소·비상 연락처 교체 내용을 확인해 주세요.')
    let url = path(resource.value.path),
      method = 'POST',
      pdf = false,
      payload: unknown = body()
    if (mode.value === 'edit') {
      url += `/${encodeURIComponent(selected.value?.[resource.value.rowKey || 'id'])}`
      method = 'PUT'
    }
    if (mode.value === 'remove') {
      url += `/${encodeURIComponent(selected.value?.[resource.value.rowKey || 'id'])}`
      method = 'DELETE'
      payload = undefined
    }
    if (mode.value === 'action' && action.value) {
      url = path(action.value.path)
      method = action.value.method || 'POST'
      pdf = !!action.value.pdf
      if (!formFields.value.length) payload = undefined
    }
    if (resourceId.value === 'facilities' && mode.value === 'action' &&
        /\/(block|release)$/.test(url)) {
      const control = payload as Record<string, unknown>
      const reason = String(control.reason || '').trim()
      if (!reason && !control.presetId) throw new Error('사유를 선택하거나 직접 입력해 주세요.')
      // The server prioritizes presetId; clear it when a manual reason was supplied.
      payload = { ...control, reason: reason || null, presetId: reason ? null : control.presetId }
    }
    const result = await backend(url, { method, body: payload, pdf })
    const controlStatus =
      resourceId.value === 'facilities' && mode.value === 'action'
        ? action.value?.path.endsWith('/block')
          ? 'BLOCKED'
          : action.value?.path.endsWith('/release')
            ? 'NORMAL'
            : undefined
        : undefined
    if (controlStatus) {
      const confirmed: { id: string; status: 'NORMAL' | 'BLOCKED' } = {
        id: String(selected.value?.id),
        status: controlStatus,
      }
      // A successful control response is authoritative; do not wait for another SSE or GET.
      window.dispatchEvent(
        new CustomEvent<BackendEvent>('routel-backend-event', {
          detail: {
            name: 'control-change',
            data: {
              underpassId: confirmed.id,
              status: controlStatus,
              changedAt: new Date().toISOString(),
            },
          },
        }),
      )
      emit('saved', confirmed)
    }
    if (pdf) downloadPdf(result, `이관문서-${selected.value?.id || '시설'}.pdf`)
    if (resourceId.value === 'my-inquiries' && mode.value === 'create')
      sessionStorage.removeItem('routel-inquiry-draft')
    modal.value?.close()
    message.value = controlStatus
      ? '경찰·소방 통제 안내 기록이 함께 생성되었습니다. 경찰 PDF가 내려받아지며, 소방 PDF는 이관 문서에서 확인할 수 있습니다.'
      : '요청이 처리되었습니다.'
    await load()
    if (resourceId.value === 'manager-notifications') await managerNotifications.refresh()
    if (
      resourceId.value === 'managers' &&
      String(selected.value?.id) === app.account?.id &&
      action.value?.path.endsWith('/regions') &&
      Array.isArray(result?.regions)
    )
      app.account = { ...app.account, regions: result.regions }
    if (!controlStatus) emit('saved')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
function recordFilterChanged(event: Event) {
  if (['ocr', 'reviews', 'transits'].includes(resourceId.value)) {
    const label = (event.target as HTMLElement).getAttribute('aria-label')
    if (label === '담당 지역') filters.underpassId = ''
    if (label === '지하차도') syncRecordRegion()
  }
  if (customer.value) search()
}
// OCR 상세 API는 별도로 없으므로 알림의 기록을 목록 페이지에서 찾는다.
// 현재 화면 첫 페이지에 없다는 이유만으로 빈 상세를 열지 않는다.
async function openLinkedOcrRecord(id: string) {
  const seq = request, signal = abort?.signal
  let record = data.value.items.find(item => String(item.id) === id)
  loading.value = true
  try {
    if (!record) {
      let current = 1, total = 1
      do {
        const result = asPage<any>(await backend('/api/plate-logs' + queryString({
          ...filters, page: current, size: 100,
        }), { signal }), current, 100)
        if (!alive || seq !== request || signal?.aborted) return
        record = result.items.find(item => String(item.id) === id)
        total = result.totalPages
        current++
      } while (!record && current <= total)
    }
    if (!alive || seq !== request || signal?.aborted) return
    if (!record) {
      await open('detail', { id: Number(id) })
      return
    }
    if (record.underpassId != null && String(filters.underpassId) !== String(record.underpassId)) {
      filters.underpassId = String(record.underpassId)
      syncRecordRegion()
      page.value = 1
      await load()
      if (!alive || error.value || String(route.query.id) !== id) return
    }
    await open('detail', record)
  } catch (e) {
    if (seq === request && !signal?.aborted) error.value = (e as Error).message
  } finally {
    if (seq === request) loading.value = false
  }
}
function search() {
  facilitySearchOpen.value=false; facilitySearchIndex.value=-1
  page.value = 1
  void load()
}
function navigatePage(next: number) {
  page.value = next
  void load()
}
function resetRecordFilters() {
  for(const field of resource.value.filters||[]) {
    if(field.key==='reviewStatus'&&resourceId.value==='reviews')continue
    filters[field.key]=field.type==='checkbox'?false:''
  }
  search()
}
const labels = computed(() =>
  Object.fromEntries([
    ...resource.value.columns,
    ...(resource.value.fields || []).map((field) => [field.key, field.label]),
    ['content', '내용'],
    ['answer', '답변'],
    ['replyContent', '답변 내용'],
    ['replyAuthorName', '답변자'],
    ['repliedAt', '답변일'],
    ['roadAddress', '주소'],
    ['category', '분류'],
    ['viewCount', '조회수'],
    ['currentWaterCm', '현재 수위(cm)'],
    ['currentRiskScore', '현재 위험 점수'],
    ['manageable', '담당 시설'],
    ['sortOrder', '표시 순서'],
  ]),
)
const facilitySummaryGroups = computed(() => {
  const row = detail.value
  const regionName = row.regionName || selected.value?.regionName ||
    choices.regionId?.find(option => option.value === String(row.regionId))?.label
  const groups: { title: string; fields: [string, string, unknown][] }[] = [
    { title: '위치', fields: [
      ['region', '지역', regionName], ['roadAddress', '주소', row.roadAddress],
    ] },
    { title: '시설 제원', fields: [
      ['heightM', '높이', row.heightM], ['lengthM', '길이', row.lengthM],
      ['widthM', '폭', row.widthM], ['lanes', '차로 수', row.lanes],
      ['safetyGrade', '안전등급', row.safetyGrade],
    ] },
    { title: '안전 정보', fields: [
      ['currentWaterCm', '현재 수위', row.currentWaterCm],
      ['earlyBlock', '선제 차단 대상', row.earlyBlock],
      ['riverDistM', '하천 거리', row.riverDistM], ['seaDistM', '바다 거리', row.seaDistM],
      ['floodHistoryCount', '과거 침수 횟수', row.floodHistoryCount],
    ] },
    { title: '차량 현황', fields: [
      ['remainingCount', '잔류 차량', row.remainingCount], ['pendingReviewCount', '판별 대기', row.pendingReviewCount],
    ] },
  ]
  return groups.map(group => ({ ...group, fields: group.fields.filter(([, , value]) => value != null && value !== '') }))
    .filter(group => group.fields.length)
})
const facilityFieldUnits: Record<string, string> = {
  heightM: 'm', lengthM: 'm', widthM: 'm', lanes: '차로', currentWaterCm: 'cm',
  riverDistM: 'm', seaDistM: 'm', floodHistoryCount: '회', remainingCount: '대', pendingReviewCount: '건',
}
function resourceRouteKey() {
  return route.path+JSON.stringify(Object.entries(route.query).filter(([key])=>key!=='__view'))
}
watch(
  resourceRouteKey,
  () => {
    abort?.abort()
    request++
    modal.value?.close()
    for (const obj of [filters, parents, choices, recordFacilityRegions])
      Object.keys(obj).forEach((key) => delete obj[key])
    facilitySearchRows.value=[]; facilitySearchOpen.value=false; facilitySearchIndex.value=-1
    page.value = 1
    data.value = { items: [], page: 1, size: pageSize.value, totalItems: 0, totalPages: 0 }
    error.value = ''
    if (!resource.value) {
      error.value = '페이지를 찾을 수 없습니다.'
      return
    }
    for (const field of resource.value.parents || [])
      parents[field.key] = route.query[field.key] || ''
    // 지하차도 상세 안의 설비·설정 표: 주소에 underpassId 없이 ?id= 만 와도 그 지하차도로 본다
    if (props.embedded && route.path === '/fac-detail' && 'underpassId' in parents && !parents.underpassId)
      parents.underpassId = route.query.id || ''
    if (vmsSplit.value) parents.underpassId = route.query.underpassId || ''
    for (const field of resource.value.filters || [])
      filters[field.key] =
        field.type === 'checkbox' ? route.query[field.key] === 'true' : route.query[field.key] || ''
    // 담당 지역이 하나일 때만 자동 선택한다. 여러 곳이면 담당 지역 전체를 조회한다.
    if (app.account?.role === 'REGIONAL_ADMIN' && app.account.regions?.length &&
        app.account.regions.length === 1 &&
        resource.value.filters?.some(field => field.key === 'regionId') &&
        route.query.regionId == null && route.query.underpassId == null && !(resourceId.value === 'ocr' && route.query.id))
      filters.regionId = String(app.account.regions[0]!.id)
    if (resourceId.value === 'alerts' && alertLogReturn.path) {
      Object.assign(filters, alertLogReturn.filters)
      page.value = alertLogReturn.page
    }
    if (props.operationsOnly) return
    if (resourceId.value === 'reviews' && !filters.reviewStatus) filters.reviewStatus = 'PENDING'
    runLookup([...(vmsSplit.value ? splitUnderpassFields : resource.value.parents || []), ...(resource.value.filters || [])])
    void load().then(() => {
      if (error.value) return
      if (!props.embedded && route.query.id && resourceId.value === 'ocr')
        void openLinkedOcrRecord(String(route.query.id))
      else if (!props.embedded && route.query.id && resource.value.detail && resourceId.value !== 'faqs')
        void open('detail', { id: Number(route.query.id) })
      else if (route.path === '/my-inquiry-new')
        void open('create').then(() => {
          try {
            const draft = JSON.parse(sessionStorage.getItem('routel-inquiry-draft') || 'null')
            if (draft) {
              values.title = draft.title || ''
              values.content = draft.content || ''
            }
          } catch {}
        })
    })
  },
  { immediate: true },
)
// 담당 지역이 바뀌면(manager-assignment-change 후 내 정보가 갱신되면) 목록과 선택 목록을 다시 불러온다
watch(
  () => (app.account?.regions || []).map((region) => region.id).sort().join(','),
  () => {
    if (props.operationsOnly || !resource.value) return
    clearLookupCache()
    runLookup([...(vmsSplit.value ? splitUnderpassFields : resource.value.parents || []), ...(resource.value.filters || [])])
    queueLiveRefresh()
  },
)
let liveRefresh: ReturnType<typeof setTimeout> | undefined,
  liveRefreshPending = false
function queueLiveRefresh() {
  if (props.operationsOnly) return
  if (modal.value?.open && mode.value !== 'detail') {
    liveRefreshPending = true
    return
  }
  clearTimeout(liveRefresh)
  liveRefresh = setTimeout(async () => {
    if (!alive) return
    await load()
    if (resourceId.value === 'ocr' && mode.value === 'detail' && selected.value) {
      const row = data.value.items.find((item) => item.id === selected.value?.id)
      if (row) detail.value = row
    }
    if (
      alive &&
      modal.value?.open &&
      mode.value === 'detail' &&
      resource.value.detail &&
      !resource.value.detailFromRow &&
      selected.value
    ) {
      const id = selected.value.id
      try {
        const result = await backend(`${path(resource.value.path)}/${encodeURIComponent(id)}`)
        if (alive && mode.value === 'detail' && selected.value?.id === id) detail.value = result
      } catch (e) {
        if (alive) error.value = (e as Error).message
      }
    }
  }, 200)
}
watch(mode, (value) => {
  if (!value && liveRefreshPending) {
    liveRefreshPending = false
    queueLiveRefresh()
  }
})
useBackendEvents((event) => {
  const { name, data: payload } = event
  const keys: Record<string, string> = {
    facilities: 'underpass',
    cameras: 'camera',
    thresholds: 'threshold',
    transfers: 'fire-transfer',
    notices: 'notice',
    faqs: 'faq',
    inquiries: 'inquiry',
    'my-inquiries': 'inquiry',
    reviews: 'plate-log',
    ocr: 'plate-log',
  }
  if (props.operationsOnly) return
  if (name === 'connected') {
    queueLiveRefresh()
    return
  }
  if (resourceId.value === 'facilities' && facilityEvents.includes(name)) {
    data.value.items = data.value.items.map((row) => patchFacility(row, event))
    if (appFacilityList.value) data.value.items.sort(compareFacilityPriority)
    if (mode.value === 'detail') detail.value = patchFacility(detail.value, event)
    // 행만 고치면 필터에서 빠져야 할 행·새로 들어올 행·정렬·건수가 안 맞으니, 그 조건에 걸리는 값이 바뀌면 다시 조회
    const levelOrStatus = name === 'control-change' || name === 'risk-level-change'
    if ((levelOrStatus && (filters.status || riskFilter.value)) || filters.sort === 'RISK_SCORE' ||
        (appFacilityList.value && name !== 'water-update'))
      queueLiveRefresh()
    return
  }
  if (resourceId.value === 'ocr' && name.startsWith('plate-queue-')) {
    queueLiveRefresh()
    return
  }
  if (resourceId.value === 'reviews' && name.startsWith('plate-queue-')) {
    const id = payload.plateLogId,
      index = data.value.items.findIndex((row) => row.id === id)
    if (name === 'plate-queue-done') {
      if (filters.reviewStatus === 'PENDING') {
        if (index >= 0) {
          data.value.items.splice(index, 1)
          data.value.totalItems = Math.max(0, data.value.totalItems - 1)
        }
      } else if (index >= 0)
        data.value.items[index] = plateQueueRow(payload, data.value.items[index])
    } else if (
      (!filters.underpassId || String(filters.underpassId) === String(payload.underpassId)) &&
      (!filters.reviewStatus || filters.reviewStatus === 'PENDING')
    ) {
      if (index >= 0) data.value.items[index] = plateQueueRow(payload, data.value.items[index])
      else if (page.value === 1 && !filters.regionId && !filters.recognitionStatus) {
        data.value.items.unshift(plateQueueRow(payload))
        data.value.items = data.value.items.slice(0, pageSize.value)
        data.value.totalItems++
      }
      queueLiveRefresh()
    }
    return
  }
  if (resourceId.value === 'manager-notifications' && name === 'notification-new') {
    if (filters.category && filters.category !== payload.category) return
    if (page.value !== 1) {
      queueLiveRefresh()
      return
    }
    const previous = data.value.items.find((row) => row.id === payload.id)
    if (!previous) data.value.totalItems++
    data.value.items = [
      { ...payload, read: previous?.read ?? false },
      ...data.value.items.filter((row) => row.id !== payload.id),
    ].slice(0, pageSize.value)
    data.value.totalPages = Math.ceil(data.value.totalItems / pageSize.value)
    return
  }
  // 다른 탭·기기에서 읽은 알림을 목록에 반영한다 (새 알림처럼 강조하지 않는다)
  if (name === 'notification-read-change' && resourceId.value === 'manager-notifications') {
    queueLiveRefresh()
    return
  }
  if (name === 'data-changed' && keys[resourceId.value] === payload.resource) {
    queueLiveRefresh()
    return
  }
  if (
    (resourceId.value === 'notices' && name === 'notice-new') ||
    (resourceId.value === 'inquiries' && name === 'inquiry-new') ||
    (resourceId.value === 'transits' && name === 'transit-update') ||
    (resourceId.value === 'events' && name === 'control-change') ||
    (resourceId.value === 'display' &&
      name === 'display-change' &&
      String(parents.vmsId) === String(payload.vmsId)) ||
    (resourceId.value === 'alerts' &&
      ['risk-level-change', 'control-change', 'notification-new'].includes(name))
  )
    queueLiveRefresh()
})
onBeforeRouteLeave(() => {
  if (resourceId.value === 'alerts') {
    alertLogReturn.path = route.fullPath
    alertLogReturn.filters = { ...filters }
    alertLogReturn.page = page.value
  }
})
onBeforeUnmount(() => {
  clearTimeout(liveRefresh)
  alive = false
  abort?.abort()
  modal.value?.close()
})
defineExpose({ open, load })
</script>
<template>
  <component :is="customer||props.embedded?'div':BackendLayout">
    <NotificationDetailView v-if="managerNotificationList&&route.query.notification" manager />
    <section
      v-else-if="resource"
      class="service-workspace"
      :data-resource="resourceId"
      :class="{'restored-admin-workspace':restored,'resource-operations-only':props.operationsOnly,'underpass-workspace':underpassSplit,'camera-config-workspace':underpassSplit&&resourceId==='cameras'}"
    >
      <RouterLink
        v-if="!customer&&resourceId==='faqs'&&alertLogReturn.path"
        :to="alertLogReturn.path"
        class="alert-log-return"
      >← 알림 발송 기록으로 돌아가기</RouterLink>
      <!-- 제목과 같은 글자를 위에 한 번 더 쓰지 않는다 (고객 서비스 묶음 이름만 표시) -->
      
      <div class="service-heading page-head" :class="{'app-resource-heading':appPage&&!props.embedded,'review-page-heading':resourceId==='reviews','record-page-heading':!appPage&&!props.embedded&&['ocr','reviews','transits'].includes(resourceId)}">
        <component :is="props.embedded?'h2':'h1'"><AdminPageIcon v-if="!props.embedded&&!appPage" />{{pageTitle}}</component>
        <div class="service-actions">
          <RouterLink v-if="resourceId==='ocr'&&!appPage" class="btn" :to="resourceLink('reviews')">번호판 판별 대기</RouterLink>
          <nav v-if="!customer&&!appPage&&!props.embedded&&shortcuts.length" class="heading-navigation" aria-label="관련 업무 바로가기">
            <RouterLink v-for="link in shortcuts" :key="link.id" class="btn" :to="resourceLink(link.id)">{{adminResourceTitles[link.id]||link.label}}</RouterLink>
          </nav>
          <span v-if="underpassSplit&&!vmsSplit&&parents.underpassId&&!loading" class="split-result-count" role="status">총 {{data.totalItems}}건</span>
          <button
            v-if="resourceId==='manager-notifications'"
            type="button"
            :disabled="saving"
            @click="readAllManagerNotifications"
          >모두 읽음</button>
          <button v-if="!vmsSplit&&!appPage" class="resource-refresh" type="button" :disabled="loading||missingParent" @click="load">새로고침</button>
          <button v-if="resource.create&&canWrite&&!vmsSplit" type="button" @click="open('create')">
            {{resourceId==='cars'?'차량 등록':resourceId==='my-inquiries'?'문의 등록':facilityList?'+ 지하차도 등록':'새로 등록'}}
          </button>
        </div>
      </div>
      <nav v-if="!customer&&!appPage&&!props.embedded&&relatedIds.length>1" class="service-tabs tabs page-selection-tabs" aria-label="업무 구분">
        <RouterLink v-for="id in relatedIds" :key="id" class="btn" :to="resourceLink(id)" :aria-current="resourceId===id?'page':undefined">{{backendResources[id]?.title}}</RouterLink>
      </nav>
      <nav v-if="publicNotices" class="notice-category-tabs" aria-label="공지사항 분류">
        <button
          v-for="[label,value] in [['전체',''],['중요','true'],['일반','false']]"
          :key="label"
          type="button"
          :aria-pressed="String(filters.important||'')===value"
          @click="filters.important=value;search()"
        >
          {{label}}
        </button>
      </nav>
      <nav v-if="restored&&resourceId==='reviews'" class="tabs review-tabs" aria-label="판별 구분">
        <button
          type="button"
          :aria-pressed="filters.reviewStatus==='PENDING'"
          @click="reviewTab('PENDING')"
        >대기</button>
        <button
          type="button"
          :aria-pressed="filters.reviewStatus!=='PENDING'"
          @click="reviewTab('')"
        >처리 이력</button>
      </nav>
      <div :class="underpassSplit?'underpass-split':'resource-body'">
      <MyUnderpassList v-if="underpassSplit" :selected-id="String(parents.underpassId||'')" @select="selectUnderpass" :target="splitTargets[resourceId]" />
      <div :class="underpassSplit?'underpass-split-main':'resource-body'">
      <form
        v-if="facilityList||appFacilityList"
        class="filters restored-facility-filters"
        role="search"
        @submit.prevent="search"
      >
        <div class="chips" role="group" aria-label="위험 단계">
          <button
            v-for="[value,label] in [['','전체'],['DANGER','위험'],['WARNING','주의'],['SAFE','안전']]"
            :key="value"
            class="chip" :class="{'facility-summary-button':appFacilityList}"
            type="button"
            :aria-pressed="riskFilter===value"
            @click="riskFilter=value;search()"
          >
            <template v-if="appFacilityList"><span>{{label}}</span><strong :data-level="value">{{facilityCount(value)}}</strong></template><template v-else>{{label}}</template>
          </button>
        </div>
        <select v-model="filters.regionId" aria-label="담당 지역" @change="search">
          <option value="">담당 지역 전체</option>
          <option v-for="option in choices.regionId" :key="option.value" :value="option.value">
            {{option.label}}
          </option>
        </select>
        <select v-model="filters.status" aria-label="통제 상태" @change="search">
          <option value="">통제 상태 전체</option>
          <option value="BLOCKED">통제 중</option>
          <option value="NORMAL">정상 운영</option>
        </select>
        <div class="facility-autocomplete">
        <input
          v-model="filters.keyword"
          type="search"
          placeholder="지하차도 이름 검색"
          aria-label="지하차도 이름 검색"
          role="combobox" autocomplete="off" aria-autocomplete="list"
          :aria-expanded="facilitySearchOpen&&facilitySuggestions.length>0"
          aria-controls="facility-search-suggestions"
          :aria-activedescendant="facilitySearchOpen&&facilitySearchIndex>=0?'facility-suggestion-'+facilitySearchIndex:undefined"
          @focus="facilitySearchOpen=true"
          @input="facilitySearchOpen=true;facilitySearchIndex=-1"
          @blur="facilitySearchOpen=false;facilitySearchIndex=-1"
          @keydown="facilitySearchKey"
        />
        <ul v-if="facilitySearchOpen&&facilitySuggestions.length" id="facility-search-suggestions" class="facility-search-suggestions" role="listbox" aria-label="지하차도 검색 추천">
          <li v-for="(row,index) in facilitySuggestions" :key="row.id" role="presentation">
            <button :id="'facility-suggestion-'+index" type="button" role="option" :aria-selected="facilitySearchIndex===index" @pointerdown.prevent @click="chooseFacilitySuggestion(row)"><strong>{{row.name}}</strong><small>{{row.regionName||row.roadAddress}}</small></button>
          </li>
        </ul>
        </div>
        <button class="btn sm" type="submit">조회</button>
      </form>
      <form v-else-if="managerNotificationList" class="manager-notification-filters" @submit.prevent="search">
        <label>분류<select v-model="filters.category" @change="search"><option value="">전체 알림</option><option v-for="[value,label] in resource.filters?.[0]?.options||[]" :key="value" :value="value">{{label}}</option></select></label>
        <label class="manager-unread-filter"><input v-model="filters.unreadOnly" type="checkbox" @change="search" />안 읽은 알림만</label>
      </form>
      <div v-else-if="['presets','reasons'].includes(resourceId)&&!appPage" class="preset-category-filter">
        <span class="preset-filter-title">{{resourceId==='reasons'?'통제 유형':'문구 분류'}}</span>
        <nav :aria-label="resourceId==='reasons'?'통제 사유 유형':'전광판 문구 분류'">
          <button v-for="[value,label] in [['','전체'],...(resource.filters?.[0]?.options||[])]" :key="value" type="button" :aria-pressed="String(filters[resourceId==='reasons'?'type':'category']||'')===value" @click="filters[resourceId==='reasons'?'type':'category']=value;search()">{{label}}</button>
        </nav>
      </div>
      <form
        v-else-if="!underpassSplit&&(resource.parents?.length||resource.filters?.length)"
        class="service-filters filters"
        @submit.prevent="search"
        @change="recordFilterChanged"
      >
        <ServiceFields
          v-if="resource.parents?.length"
          :fields="resource.parents"
          :values="parents"
          :choices="choices"
          hide-guide
        />
        <ServiceFields
          v-if="resource.filters?.length"
          :fields="resource.filters"
          :values="filters"
          :choices="choices"
          empty-label="전체"
        />
        <button v-if="!customer" type="submit" :disabled="loading">
          {{resourceId==='my-inquiries'?'검색':'조회'}}
        </button>
      </form>
      <p v-if="error" class="service-error" role="alert">
        {{error}} <RouterLink v-if="!app.account" :to="customer?'/login':'/admin-login'">로그인</RouterLink>
      </p>
      <p v-if="lookupError" class="service-error" role="alert">{{lookupError}} <button type="button" @click="retryLookup">다시 시도</button></p>
      <p v-if="message" class="service-message" role="status">{{message}} <RouterLink v-if="resourceId==='facilities'&&selected?.id&&mode==='action'&&/\/(block|release)$/.test(action?.path||'')" :to="{path:'/admin-data/transfers',query:{underpassId:String(selected.id)}}">경찰·소방 문서 보기 →</RouterLink></p>
      <div v-if="underpassSplit&&!parents.underpassId" class="configuration-pick-facility"><span aria-hidden="true"><UiIcon name="location" /></span><h2>관리할 지하차도를 선택하세요</h2><p>왼쪽 내 지하차도 목록에서 시설을 선택하면<br />해당 시설의 {{splitTargets[resourceId]}} 등록 현황과 설정을 확인할 수 있습니다.</p></div>
      <UnderpassVmsPanel
        v-else-if="vmsSplit"
        :key="String(parents.underpassId)"
        :underpass-id="String(parents.underpassId)"
        :underpass-name="splitUnderpassName"
        :manageable="!!splitUnderpassName"
      />
      <p v-else-if="missingParent">위에서 {{resource.parents?.map(field=>field.label).join(' · ')}}를 선택하고 조회하세요.</p>
      <p v-else-if="loading" role="status">불러오는 중입니다.</p>
      <template v-else>
        <p v-if="!underpassSplit" class="service-result-count" role="status">총 {{data.totalItems}}건</p>
        <section v-if="!appPage&&!data.items.length&&['ocr','reviews','transits'].includes(resourceId)" class="record-empty-state" role="status">
          <span class="record-empty-icon" aria-hidden="true"><UiIcon :name="resourceId==='reviews'?'eye':'camera'" /></span>
          <div><h2>{{resourceId==='reviews'&&filters.reviewStatus==='PENDING'?'조건에 맞는 판별 대기가 없습니다':'조건에 맞는 기록이 없습니다'}}</h2><p>담당 지역·지하차도·조회 기간을 확인하거나 검색 조건을 초기화해 주세요.</p></div>
          <button type="button" @click="resetRecordFilters">검색 조건 초기화</button>
        </section>
        <section v-else-if="resourceId==='cars'" class="customer-car-overview">
          <div class="customer-car-guide"><span aria-hidden="true"><UiIcon name="bell" /></span><p>등록한 차량의 안전 알림을 받을 수 있어요.<br /><small>차량 번호가 정확한지 확인해 주세요.</small></p></div>
          <ul class="customer-car-list" aria-label="등록 차량 목록">
            <li v-for="row in data.items" :key="row.id">
              <div class="customer-car-identity"><span class="customer-car-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m5 9 2-5h10l2 5M4 9h16v9H4zM7 18v3m10-3v3M7 13h2m6 0h2M4 9 2 8m18 1 2-1" stroke-linecap="round" stroke-linejoin="round" /></svg></span><div><small>등록 차량</small><strong>{{row.carNum}}</strong></div></div>
              <div class="customer-car-footer"><time :datetime="row.createdAt">{{displayDate(row.createdAt,false)}} 등록</time><div><button v-if="canEditRow(row)" type="button" :aria-label="row.carNum+' 수정'" @click="open('edit',row)">수정</button><button v-if="resource.remove&&canWrite" type="button" class="customer-car-delete" :aria-label="row.carNum+' 삭제'" @click="open('remove',row)">삭제</button></div></div>
            </li>
          </ul>
          <p v-if="!data.items.length" class="customer-car-empty">등록된 차량이 없습니다.<br />차량을 등록하고 안전 알림을 받아 보세요.</p>
        </section>
        <section v-else-if="resourceId==='my-inquiries'" class="customer-inquiry-overview">
          <div class="customer-inquiry-guide"><UiIcon name="chat" /><div><strong>궁금한 점을 남겨 주세요</strong><p>보내신 문의와 답변을 여기에서 확인할 수 있어요.</p></div></div>
          <ul class="customer-inquiry-list" aria-label="내 문의 목록">
            <li v-for="row in data.items" :key="row.id">
              <button type="button" class="customer-inquiry-open" :aria-label="row.title+' 상세 보기'" @click="open('detail',row)"><span class="customer-inquiry-meta"><span class="customer-inquiry-status" :class="{'is-done':['ANSWERED','RESOLVED','CLOSED','COMPLETED'].includes(String(row.status))}">{{displayField('status',row.status)}}</span><time :datetime="row.createdAt">{{displayDate(row.createdAt,false)}}</time></span><span class="customer-inquiry-title"><strong>{{row.title}}</strong><span aria-hidden="true">›</span></span><p v-if="row.content">{{row.content}}</p><small>문의 내용과 답변 확인</small></button>
              <div v-if="canEditRow(row)||resource.remove&&canWrite" class="customer-inquiry-actions"><button v-if="canEditRow(row)" type="button" :aria-label="row.title+' 수정'" @click="open('edit',row)">수정</button><button v-if="resource.remove&&canWrite" type="button" :aria-label="row.title+' 삭제'" @click="open('remove',row)">삭제</button></div>
            </li>
          </ul>
          <p v-if="!data.items.length" class="customer-car-empty">아직 남긴 문의가 없습니다.<br />문의 등록을 눌러 궁금한 내용을 남겨 주세요.</p>
        </section>
        <AdminAppFacilityRows v-else-if="appFacilityList" :items="facilityRows" />
        <FacilityConfiguration v-else-if="underpassSplit&&(resourceId==='thresholds'||resourceId==='cameras')" :kind="resourceId as 'thresholds'|'cameras'" :facility-id="String(parents.underpassId)" :facility-name="splitUnderpassName" :rows="data.items" :total="data.totalItems" :can-write="!!canWrite" @action="(kind,row)=>open(kind,row)" />
        <ul v-else-if="managerNotificationList" class="manager-notification-cards" aria-label="관리자 알림 목록">
          <li v-for="row in data.items" :key="row.id" :class="{'is-unread':!row.read}">
            <div class="manager-notification-meta"><span class="manager-notification-category">{{valueLabels[row.category]||'알림'}}</span><span v-if="!appPage&&!row.read" class="manager-notification-unread">● 안 읽음</span><time>{{display(row.createdAt)}}</time></div>
            <RouterLink :to="managerNotificationTarget(row)" custom v-slot="{href}"><a :href="href" class="manager-notification-content" @click="openManagerNotification($event,row)"><h2>{{row.title}}</h2><p>{{row.body}}</p></a></RouterLink>
            <template v-if="!appPage"><button v-if="!row.read" type="button" :disabled="saving" @click="markManagerNotificationRead(row)">읽음 처리</button><small v-else class="manager-notification-read">✓ 읽음</small></template>
          </li>
          <li v-if="!data.items.length" class="manager-notification-empty">표시할 알림이 없습니다.</li>
        </ul>
        <AdminFacilityList
          v-else-if="facilityList"
          :items="facilityRows"
          :total="data.totalItems"
          @detail="row=>open('detail',row)"
          @control="row=>open('action',row,resource.actions?.[row.currentStatus==='BLOCKED'?1:0])"
        />
        <AdminReviewCards
          v-else-if="restored&&resourceId==='reviews'&&filters.reviewStatus==='PENDING'"
          :items="data.items.filter(row=>row.reviewStatus==='PENDING')"
          :saving="saving"
          @review="review"
        />
        <FaqAccordion
          v-else-if="resourceId==='faqs'"
          :items="data.items"
          :manage="canWrite"
          :allow-reorder="false"
          :initial-open-id="String(route.query.id||'')"
          :saving="saving"
          @move="moveFaq"
          @edit="row=>open('edit',row)"
          @remove="row=>open('remove',row)"
        />
        <ul v-else-if="publicNotices&&appPage" class="compact-notice-list" aria-label="공지사항 목록">
          <li v-for="row in data.items" :key="row.id">
            <button type="button" class="compact-notice-card" :class="{'notice-unread':noticeUnread(row)}" @click="open('detail',row)">
              <span class="compact-notice-title"><span v-if="row.important" class="notice-important-badge">중요</span><strong :title="row.title">{{row.title}}</strong><span aria-hidden="true">›</span></span>
              <span class="compact-notice-meta"><span>{{row.categoryLabel||boardCategoryLabel(row.category)||'안내'}}</span><time :datetime="row.createdAt">{{displayDate(row.createdAt,false)}}</time></span>
            </button>
          </li>
          <li v-if="!data.items.length" class="compact-notice-empty">등록된 공지사항이 없습니다.</li>
        </ul>
        <div v-else class="service-table-wrap">
          <table class="service-table">
            <thead>
              <tr>
                <th v-for="[key,label] in visibleColumns" :key="key" :data-field="key">{{label}}</th>
                <th v-if="hasRowActions" class="resource-action-column">상세·처리</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row,index) in data.items"
                :key="row.id||index"
                :class="{'notification-arrival-glow':notificationGlow.has(resourceId==='manager-notifications'?'notification':resourceId==='notices'?'notice':resourceId==='inquiries'?'inquiry':'',row.id)}"
              >
                <td v-for="[key,label] in visibleColumns" :key="key" :data-label="label" :data-field="key">
                  <span v-if="resourceId==='presets'&&key==='category'||resourceId==='reasons'&&key==='type'" class="preset-category-badge" :data-category="row[key]">{{displayField(key,row[key])}}</span>
                  <template v-else-if="resourceId==='presets'&&key==='content'">{{presetMessage(row)}}</template>
                  <template v-else-if="resourceId==='notices'&&key==='title'">
                    <button
                      type="button"
                      class="notice-title-button"
                      :class="{'notice-unread':noticeUnread(row)}"
                      @click="open('detail',row)"
                    >
                      <span :class="row.important?'notice-important-badge':'notice-regular-label'">
                        {{row.important?'중요':'일반'}}
                      </span>
                      <span>{{row.title}}</span>
                    </button>
                  </template>
                  <template v-else-if="resourceId==='notices'&&key==='important'">
                    <span :class="row.important?'notice-important-badge':'notice-regular-label'">
                      {{row.important?'중요':'일반'}}
                    </span>
                  </template>
                  <img
                    v-else-if="key==='imagePath'&amp;&amp;imageUrl(row[key])&amp;&amp;!row.imageUnavailable"
                    :src="imageUrl(row[key])"
                    alt="번호판 인식 이미지"
                    loading="lazy"
                    @error="row.imageUnavailable=true"
                  />
                  <template
                    v-else-if="key==='reviewDeadline'&&row.reviewStatus==='PENDING'&&(row[key]||row.reviewExpiresAt)"
                  >
                    <DeadlineTimer :deadline="row.reviewExpiresAt??row[key]" />
                    <br />
                    <small>{{display(row[key])}}</small>
                  </template>
                  <template v-else-if="restored&&resourceId==='customers'&&key==='name'">
                    <button type="button" class="notice-title-button" @click="open('detail',row)">
                      {{row.name}}
                    </button>
                  </template>
                  <template v-else>
                    {{key==='imagePath'?'이미지 없음':displayField(key,row[key])}}
                  </template>
                </td>
                <td v-if="hasRowActions" class="resource-action-column">
                  <div class="service-actions">
                    <button v-if="resourceId==='transits'&&row.status==='REMAINING'&&canWrite" type="button" @click="remainingTransfer?.open(row)">소방 이관 PDF</button>
                    <button
                      v-if="resourceId==='cameras'&amp;&amp;row.streamUrl"
                      @click="open('video',row)"
                    >영상 보기</button>
                    <button v-if="resource.detail" @click="open('detail',row)">상세 보기</button>
                    <button v-if="canEditRow(row)" @click="open('edit',row)">수정</button>
                    <button v-if="resource.remove&&canWrite" @click="open('remove',row)">삭제</button>
                    <button
                      v-for="act in canWrite?resource.actions||[]:[]"
                      :key="act.label"
                      :disabled="!actionEnabled(row)"
                      @click="open('action',row,act)"
                    >
                      {{act.label}}
                    </button>
                    <RouterLink
                      v-if="resourceId==='facilities'"
                      :to="'/admin-data/cameras?underpassId='+row.id"
                    >{{adminResourceTitles.cameras}}</RouterLink>
                  </div>
                </td>
              </tr>
              <tr v-if="!data.items.length">
                <td :colspan="visibleColumns.length+(hasRowActions?1:0)">조회된 항목이 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- 지하차도별 화면은 한 페이지가 대부분이라, 표 아래 끝을 왼쪽 목록 끝과 맞추려고 한 페이지면 숨긴다 -->
        <AppPagination v-if="appPage&&resourceId!=='cars'&&(resourceId!=='my-inquiries'||data.totalPages>1)" :page="page" :pages="data.totalPages" :disabled="loading" @change="navigatePage" />
        <div v-else-if="resourceId!=='cars'&&(resourceId!=='my-inquiries'||data.totalPages>1)&&data.items.length&&(!underpassSplit||data.totalPages>1)" class="service-pagination">
          <button :disabled="page<=1" @click="navigatePage(page-1)">이전</button>
          <span>{{page}} / {{Math.max(1,data.totalPages)}} 페이지</span>
          <button :disabled="page>=data.totalPages" @click="navigatePage(page+1)">다음</button>
        </div>
      </template>
      </div>
      </div>
      <WorkflowPage
        ref="modal"
        class="service-modal"
        :class="{'service-app-modal':route.path.startsWith('/customer-app/')||route.path.startsWith('/admin-app/'),'restored-summary-drawer':restored&&mode==='detail'&&['facilities','customers'].includes(resourceId)}"
        @close="mode=''"
        @pointerdown="summaryBackdropDown = isSummaryBackdrop($event)"
        @click="closeSummaryBackdrop"
      >
        <form @submit.prevent="submit">
          <header>
            <h2>
              {{mode==='video'?'카메라 영상':mode==='detail'?(restored&&detail.name?detail.name:'상세 보기'):mode==='create'?(resourceId==='my-inquiries'?'문의 등록':'새로 등록'):mode==='edit'?'정보 수정':mode==='remove'?'삭제 확인':action?.label}}
            </h2>
            <button type="button" :class="{'facility-drawer-close':facilityList&&mode==='detail'}" aria-label="닫기" :disabled="saving" @click="modal?.close()"><UiIcon v-if="facilityList&&mode==='detail'" name="close" /><span v-else>닫기</span></button>
          </header>
          <TrafficVideo v-if="mode==='video'" :src="selected?.streamUrl" :hls="true" />
          <img
            v-if="resourceId==='reviews'&amp;&amp;imageUrl(selected?.imagePath)"
            :src="imageUrl(selected?.imagePath)"
            alt="확인할 번호판"
            style="max-width:100%;max-height:300px;object-fit:contain"
          />
          <div
            v-if="restored&&mode==='detail'&&resourceId==='facilities'"
            class="restored-summary-overview"
          >
            <div class="facility-risk-score"><span>현재 위험 점수</span><strong>{{detail.riskScore??detail.currentRiskScore??'미수신'}}<small v-if="detail.riskScore!=null||detail.currentRiskScore!=null">점</small></strong></div>
            <div class="facility-risk-state"><RiskLevelBadge :value="detail.currentRiskLevel" /><span>{{detail.currentStatus==='BLOCKED'?'통제 중':'정상 운영'}}</span></div>
          </div>
          <article v-if="mode==='detail'&&resourceId==='notices'" class="notice-detail">
            <div class="notice-detail-title">
              <span v-if="detail.important" class="notice-important-badge">중요</span>
              <h3>{{detail.title}}</h3>
            </div>
            <dl class="notice-detail-meta">
              <div>
                <dt>분류</dt>
                <dd>{{detail.categoryLabel||boardCategoryLabel(detail.category)||'안내'}}</dd>
              </div>
              <div>
                <dt>작성자</dt>
                <dd>{{detail.authorName||'—'}}</dd>
              </div>
              <div>
                <dt>작성일</dt>
                <dd>{{display(detail.createdAt)}}</dd>
              </div>
              <div>
                <dt>조회수</dt>
                <dd>{{detail.viewCount??0}}</dd>
              </div>
            </dl>
            <div class="notice-detail-content">{{detail.content}}</div>
          </article>
          <OcrRecordDetail
            v-if="mode==='detail'&&resourceId==='ocr'"
            :record="detail"
            :image="imageUrl(detail.imagePath)"
          />
          <div v-if="restored&&mode==='detail'&&resourceId==='facilities'" class="facility-summary-groups">
            <section v-for="group in facilitySummaryGroups" :key="group.title" class="facility-summary-group" :data-section="group.title">
              <h3>{{group.title}}</h3>
              <dl>
                <div v-for="[key,label,value] in group.fields" :key="key" :class="{'is-wide':key==='roadAddress'}">
                  <dt>{{label}}</dt><dd>{{displayField(key,value)}}<small v-if="facilityFieldUnits[key]">{{facilityFieldUnits[key]}}</small></dd>
                </div>
              </dl>
              <details v-if="group.title==='위치'&&(detail.latitude!=null||detail.longitude!=null)" class="facility-coordinates">
                <summary class="text-button">좌표 정보</summary>
                <dl><div v-if="detail.latitude!=null"><dt>위도</dt><dd>{{detail.latitude}}</dd></div><div v-if="detail.longitude!=null"><dt>경도</dt><dd>{{detail.longitude}}</dd></div></dl>
              </details>
            </section>
          </div>
          <dl
            v-else-if="mode==='detail'&&resourceId!=='notices'&&resourceId!=='ocr'"
            class="service-detail"
          >
            <template v-for="(label,key) in labels" :key="key">
              <template v-if="detail[key]!=null">
                <dt>{{label}}</dt>
                <dd>{{displayField(String(key),detail[key])}}</dd>
              </template>
            </template>
          </dl>
          <div v-if="mode==='detail'&&facilityList" class="facility-drawer-quick">
            <TunnelCctvDialog :facility-name="detail.name" :underpass-id="detail.id" />
            <RouterLink :to="{path:route.path.startsWith('/admin-app/')?'/admin-app/screen-5':'/fac-detail',query:{id:String(detail.id),underpassId:String(detail.id),tab:'cctv'}}">시설 CCTV 보기</RouterLink>
          </div>
          <component :is="facilityList?'details':'div'" v-if="mode==='detail'&&canWrite" :class="facilityList?'facility-drawer-more':'resource-body'">
            <summary v-if="facilityList"><strong>추가 작업</strong><span>시설 관리·통제·이관</span></summary>
            <div :class="facilityList?'facility-action-grid':'service-actions'">
            <button v-if="canEditRow(detail)" type="button" @click="open('edit',detail)">수정</button>
            <button v-if="resource.remove" class="danger" type="button" @click="open('remove',detail)">삭제</button>
            <RouterLink v-if="facilityList" :to="'/admin-data/cameras?underpassId='+detail.id">{{adminResourceTitles.cameras}}</RouterLink>
            <button
              v-for="act in resource.actions||[]"
              :key="act.label"
              type="button"
              :disabled="!actionEnabled(detail)"
              @click="open('action',detail,act)"
            >
              {{act.label}}
            </button>
            </div>
          </component>
          <template v-if="mode!=='detail'&amp;&amp;mode!=='video'">
            <p v-if="resourceId==='facilities'&&mode==='action'&&/\/(block|release)$/.test(action?.path||'')" class="service-message">경찰과 소방의 통제 안내 기록을 함께 만듭니다. 잔류차량 전달서는 차량 확인 후 ‘잔류차량 소방 이관’에서 별도로 작성하세요.</p>
            <p v-if="mode==='remove'">선택한 항목을 삭제하시겠습니까?</p>
            <p v-else-if="mode==='action'&&!formFields.length">선택한 항목에 대해 {{action?.label}} 작업을 진행하시겠습니까?</p>
            <div v-if="resourceId==='customers'&amp;&amp;mode==='edit'" class="service-message">
              <p>목록에는 기존 주소·비상 연락처가 제공되지 않습니다. 저장하면 해당 항목도 입력한 값으로 교체됩니다.</p>
              <label>
                <input v-model="acknowledge" type="checkbox" required /> 주소·비상 연락처 교체를 확인했습니다.</label>
            </div>
            <ServiceFields
              :fields="formFields"
              :values="values"
              :choices="choices"
              :disabled="saving"
            />
          </template>
          <p v-if="error" class="service-error" role="alert">{{error}}</p>
          <p v-if="lookupError" class="service-error" role="alert">{{lookupError}} <button type="button" @click="retryLookup">다시 시도</button></p>
          <footer v-if="facilityList&&mode==='detail'&&detail.id" class="facility-drawer-footer">
            <RouterLink :to="{path:'/fac-detail',query:{id:String(detail.id)}}" @click="modal?.close()">상세보기</RouterLink>
          </footer>
          <footer v-if="mode!=='detail'&amp;&amp;mode!=='video'">
            <button type="button" :disabled="saving" @click="modal?.close()">취소</button>
            <button type="submit" :disabled="saving">{{saving?'처리 중…':'확인'}}</button>
          </footer>
        </form>
      </WorkflowPage>
    </section>
    <p v-else role="alert">페이지를 찾을 수 없습니다.</p>
    <RemainingVehicleTransfer v-if="resourceId==='transits'" ref="remainingTransfer" />
  </component>
</template>

<style scoped src="../styles/pages/backend-resource.css"></style>

<style scoped src="../styles/pages/backend-resource-2.css"></style>

<style scoped src="../styles/pages/backend-resource-3.css"></style>

<style scoped src="../styles/pages/backend-resource-4.css"></style>

<style scoped src="../styles/pages/backend-resource-5.css"></style>

<style scoped src="../styles/pages/backend-resource-6.css"></style>
<style scoped>
.customer-car-guide{display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:16px;border-radius:10px;background:var(--r-selected);color:var(--r-ink);}
.customer-car-guide>span{color:var(--r-accent);flex:none;--ui-icon-size:20px;}
.customer-car-guide p{margin:0;font-size:13px;line-height:22px;word-break:keep-all;}
.customer-car-guide small{font-size:12px;color:var(--r-muted);}
.customer-car-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;padding:0;margin:0;list-style:none;}
.customer-car-list>li{padding:18px 16px;border:1px solid var(--r-line);border-radius:12px;background:var(--r-surface);}
.customer-car-identity{display:flex;align-items:center;gap:14px;margin-bottom:18px;}
.customer-car-symbol{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--r-soft);color:var(--r-accent);flex:none;}
.customer-car-symbol svg{width:26px;height:26px;}
.customer-car-identity small{display:block;margin-bottom:4px;color:var(--r-muted);font-size:11px;}
.customer-car-identity strong{display:block;color:var(--r-ink);font-size:21px;line-height:28px;font-weight:650;letter-spacing:.02em;}
.customer-car-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.customer-car-footer time{font-size:12px;color:var(--r-muted);}
.customer-car-footer>div{display:flex;gap:6px;}
.customer-car-footer button{min-height:36px;padding:6px 10px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:var(--r-ink);font-size:12px;}
.customer-car-footer button.customer-car-delete{color:var(--status-danger-ink,#a32446);}
.customer-car-empty{text-align:center;padding:24px 12px;font-size:13px;line-height:24px;color:var(--r-muted);}
.customer-inquiry-guide{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:16px;border-radius:12px;background:var(--r-selected);color:var(--r-ink);}
.customer-inquiry-guide>.ui-icon{flex:none;color:var(--r-accent);width:24px;height:24px;}
.customer-inquiry-guide strong{font-size:14px;line-height:22px;}
.customer-inquiry-guide p{margin:4px 0 0;font-size:12px;line-height:20px;color:var(--r-muted);word-break:keep-all;}
.customer-inquiry-list{display:grid;gap:12px;list-style:none;padding:0;margin:0;}
.customer-inquiry-list>li{border:1px solid var(--r-line);border-radius:12px;background:var(--r-surface);overflow:hidden;}
.customer-inquiry-open{display:block;width:100%;padding:18px 16px;border:0;border-radius:0;background:transparent;color:var(--r-ink);text-align:left;font:inherit;cursor:pointer;}
.customer-inquiry-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}
.customer-inquiry-meta time{font-size:12px;color:var(--r-muted);}
.customer-inquiry-status{padding:3px 8px;border-radius:5px;background:var(--status-caution-bg,#fff1d6);color:var(--status-caution-ink,#965000);font-size:12px;line-height:18px;}
.customer-inquiry-status.is-done{background:var(--status-safe-bg,#e1f3ea);color:var(--status-safe-ink,#1b7f5c);}
.customer-inquiry-title{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.customer-inquiry-title strong{font-size:17px;line-height:26px;font-weight:650;overflow-wrap:anywhere;}
.customer-inquiry-title>.ui-icon{width:18px;height:18px;flex:none;color:var(--r-muted);}
.customer-inquiry-open p{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:8px 0 0;font-size:13px;line-height:22px;color:var(--r-muted);}
.customer-inquiry-open>small{display:block;margin-top:12px;font-size:12px;color:var(--r-accent);}
.customer-inquiry-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 16px 14px;}
.customer-inquiry-actions button{min-height:34px;padding:5px 12px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-surface);color:var(--r-muted);font-size:12px;}
.customer-inquiry-open:focus-visible{outline:2px solid var(--r-accent);outline-offset:-3px;}
</style>

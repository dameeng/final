import { applyBrowserIcons } from '../utils/browser-icons'
applyBrowserIcons()
import { createApp, reactive, watch, type InjectionKey } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import RegionalMobileView from '../../staff-app/views/RegionalMobileView.vue'
import AuthView from './views/AuthView.vue'
import DashboardEntry from './views/DashboardEntry.vue'
import FacilitiesView from './views/FacilitiesView.vue'
import RecordsView from './views/RecordsView.vue'
import ExtraView from './views/ExtraView.vue'
import CctvView from './views/CctvView.vue'
import FacilityManageView from './views/FacilityManageView.vue'
import OperationsView from './views/OperationsView.vue'
import AlertEvidenceView from './views/AlertEvidenceView.vue'
import ManagerApprovalsView from '../../super-admin/views/ManagerApprovalsView.vue'
import { fetchUnderpasses, sendControl, type ControlLog, type Underpass, type Status } from './services/underpasses'
import { belongsToRegion, regionalRouteAllowed, type ManagerProfile } from './services/regional-access'
export interface AdminState {
  underpasses: Underpass[]
  logs: ControlLog[]
  error: string
  selectedId: string | null
  operator: string
  profile: ManagerProfile | null
  loaded: boolean
  loading: boolean
  authLoading: boolean
  authMessage: string
  lastUpdated: string | null
  controlBusy: boolean
  riskHistory: { time: number; score: number }[]
}
export interface AdminContext {
  state: AdminState
  control: (id: string, status: Status) => Promise<void>
  refresh: () => Promise<void>
}
export const adminKey: InjectionKey<AdminContext> = Symbol('admin')
const state = reactive<AdminState>({
  underpasses: [], logs: [], error: '', selectedId: null, operator: '관리자', profile: null,
  loaded: false, loading: false, authLoading: true, authMessage: '', lastUpdated: null,
  controlBusy: false, riskHistory: [],
})
let sessionVersion = 0
export function clearManagerSession(message = '') {
  sessionVersion++
  state.profile = null
  state.operator = '관리자'
  state.underpasses = []; state.logs = []; state.riskHistory = []
  state.selectedId = null; state.loaded = false; state.lastUpdated = null
  state.error = ''; state.authMessage = message; state.loading = false
}
let profileRequest: Promise<boolean> | null = null
export async function refreshManagerProfile(): Promise<boolean> {
  if (profileRequest) return profileRequest
  const version = sessionVersion
  state.authLoading = true
  profileRequest = (async () => {
    try {
      const response = await fetch('/api/managers/me', { credentials: 'include', cache: 'no-store' })
      if (version !== sessionVersion) return false
      if (!response.ok) {
        clearManagerSession(response.status === 401
          ? (state.profile ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : state.authMessage)
          : '관리자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
        return false
      }
      const body = await response.json()
      if (version !== sessionVersion) return false
      const profile = body.data as ManagerProfile | null
      if (!profile?.role) { clearManagerSession('관리자 정보를 확인할 수 없습니다.'); return false }
      if (state.profile && (state.profile.role !== profile.role || state.profile.regionId !== profile.regionId)) {
        sessionVersion++
        state.underpasses = []; state.selectedId = null; state.loaded = false; state.lastUpdated = null
        state.riskHistory = []; state.logs = []; state.error = ''; state.loading = false
      }
      state.profile = profile
      state.operator = profile.name || '관리자'
      state.authMessage = ''
      return true
    } catch {
      if (version === sessionVersion) clearManagerSession('서버 연결을 확인한 후 다시 로그인해 주세요.')
      return false
    } finally { state.authLoading = false; profileRequest = null }
  })()
  return profileRequest
}
let listRequest: Promise<void> | null = null
async function refresh(): Promise<void> {
  if (!state.profile) return
  if (state.profile.role === 'REGIONAL_ADMIN' && state.profile.regionId == null) {
    state.underpasses = []; state.selectedId = null; state.loaded = true
    state.error = '담당 지역 미지정: 지역 배정 후 시설을 조회할 수 있습니다.'
    return
  }
  if (listRequest) {
    await listRequest
    if (!state.loaded && state.profile) return refresh()
    return
  }
  const version = sessionVersion
  const profile = state.profile
  state.loading = true
  listRequest = (async () => {
    try {
      const rows = await fetchUnderpasses(profile.role === 'REGIONAL_ADMIN' ? profile.regionId : undefined)
      if (version !== sessionVersion || !state.profile) return
      state.underpasses = profile.role === 'REGIONAL_ADMIN' ? rows.filter(item => belongsToRegion(item, profile)) : rows
      if (!state.underpasses.some(item => item.id === state.selectedId)) state.selectedId = state.underpasses[0]?.id ?? null
      state.error = ''; state.lastUpdated = new Date().toISOString()
      if (!['REGIONAL_ADMIN', 'SUPER_ADMIN'].includes(profile.role)) void refreshRiskHistory()
    } catch (e) {
      if (version === sessionVersion) state.error = e instanceof Error ? `시설 정보를 갱신하지 못했습니다. (${e.message})` : '서버에 연결할 수 없습니다.'
    } finally {
      if (version === sessionVersion) { state.loaded = true; state.loading = false }
      listRequest = null
    }
  })()
  return listRequest
}
async function refreshRiskHistory() {
  const id = state.selectedId ?? state.underpasses[0]?.id
  if (!state.profile || ['REGIONAL_ADMIN', 'SUPER_ADMIN'].includes(state.profile.role) || state.error || !id) { state.riskHistory = []; return }
  try {
    const response = await fetch(`/api/underpasses/${encodeURIComponent(id)}/risk-scores?limit=30`, { credentials: 'include', cache: 'no-store' })
    if (response.status === 401) { expireSession(); return }
    if (!response.ok) return
    const body = await response.json()
    if (state.selectedId !== id || !state.profile) return
    state.riskHistory = (Array.isArray(body.data) ? body.data : []).flatMap((item: { riskScore?: number; predictedAt?: string }) => {
      const time = Date.parse(item.predictedAt || '')
      const score = Number(item.riskScore)
      return item.riskScore != null && Number.isFinite(time) && Number.isFinite(score) ? [{ time, score }] : []
    })
  } catch { /* 기존 데이터 유지 */ }
}
watch(() => state.selectedId, () => void refreshRiskHistory())
async function control(id: string, status: Status) {
  if (state.controlBusy) throw new Error('다른 제어 요청을 처리 중입니다.')
  if (!state.profile || state.error || state.loading) throw new Error('시설 정보를 새로고침한 후 다시 시도해 주세요.')
  const target = state.underpasses.find(item => item.id === id)
  if (!target || (state.profile.role === 'REGIONAL_ADMIN' && !belongsToRegion(target, state.profile))) throw new Error('담당 시설만 제어할 수 있습니다.')
  if (state.profile.role === 'REGIONAL_ADMIN' && (!target.controlState || target.controlState === 'UNKNOWN')) throw new Error('통제 상태가 미수신되어 제어할 수 없습니다.')
  const version = sessionVersion
  state.controlBusy = true
  try {
    await sendControl(id, status)
    if (version !== sessionVersion) throw new Error('로그인 상태를 다시 확인해 주세요.')
    await refresh()
    if (state.error) throw new Error('제어 요청은 접수되었으나 현재 상태 확인에 실패했습니다. 새로고침 후 확인해 주세요.')
    state.logs.unshift({ id: Date.now(), name: target.name, action: status === '통제' ? '통제' : '해제', operator: state.operator, time: new Date().toLocaleString('ko-KR'), reason: '' })
  } finally { state.controlBusy = false }
}
const routes = [
  {path:'/regional/notices/new',component:()=>import('./views/NoticeEditorView.vue'),meta:{regionalOnly:true}},
  {path:'/super/notices/new',component:()=>import('./views/NoticeEditorView.vue'),meta:{superOnly:true}},
  {path:'/notices/new',component:()=>import('./views/NoticeEditorView.vue')},
  {path:'/plate-logs',component:()=>import('./views/PlateLogsView.vue')},
  {path:'/regional/facilities',component:()=>import('../../regional-admin/views/FacilityWorkspace.vue'),meta:{regionalOnly:true}},
  {path:'/regional/facilities/:id',component:()=>import('../../regional-admin/views/FacilityWorkspace.vue'),meta:{regionalOnly:true}},
  {path:'/regional/customers/inquiries/:inquiryId',component:()=>import('./views/InquiryDetailView.vue'),meta:{regionalOnly:true}},
  {path:'/super/customers/inquiries/:inquiryId',component:()=>import('./views/InquiryDetailView.vue'),meta:{superOnly:true}},
  {path:'/inquiries/:inquiryId',component:()=>import('./views/InquiryDetailView.vue')},
  {path:'/regional/customers',component:()=>import('../../regional-admin/views/CustomerWorkspace.vue'),meta:{regionalOnly:true}},
  {path:'/regional/logs',component:()=>import('../../regional-admin/views/UnifiedLogsView.vue'),meta:{regionalOnly:true}},
  {path:'/super/facilities',component:()=>import('../../super-admin/views/FacilityWorkspace.vue'),meta:{superOnly:true}},
  {path:'/super/facilities/:id',component:()=>import('../../super-admin/views/FacilityWorkspace.vue'),meta:{superOnly:true}},
  {path:'/super/accounts',component:()=>import('../../super-admin/views/ManagementWorkspace.vue'),props:{section:'accounts'},meta:{superOnly:true}},
  {path:'/super/customers',component:()=>import('../../super-admin/views/ManagementWorkspace.vue'),props:{section:'customers'},meta:{superOnly:true}},
  {path:'/super/logs',component:()=>import('../../super-admin/views/UnifiedLogsView.vue'),meta:{superOnly:true}},
  ...['/mobile','/mobile/login','/mobile/access','/mobile/facilities','/mobile/facilities/:id','/mobile/history','/mobile/profile'].map(path=>({path,component:RegionalMobileView})),
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: AuthView, props: { mode: 'login' } },
  { path: '/signup', component: AuthView, props: { mode: 'signup' } },
  { path: '/dashboard', component: DashboardEntry },
  { path: '/facilities', component: FacilitiesView },
  { path: '/facility-manage', component: FacilityManageView },
  { path: '/facilities/:id/operations', component: OperationsView },
  { path: '/operations', component: OperationsView },
  { path: '/controls', redirect: '/facilities' },
  { path: '/facilities/:id', component: ExtraView, props: { section: 'detail' } },
  { path: '/facilities/:id/cctv', component: CctvView },
  { path: '/cctv', component: CctvView },
  { path: '/pump-risk', redirect: '/facilities' },
  { path: '/alert-evidence', component: AlertEvidenceView },
  { path: '/members', component: RecordsView, props: { section: 'members' } },
  { path: '/opinions', component: RecordsView, props: { section: 'opinions' } },
  { path: '/notices', component: RecordsView, props: { section: 'notices' } },
  { path: '/push-logs', component: RecordsView, props: { section: 'push' } },
  { path: '/logs', component: RecordsView, props: { section: 'logs' } },
  { path: '/profile', component: RecordsView, props: { section: 'profile' } },
  { path: '/thresholds', component: ExtraView, props: { section: 'thresholds' } },
  { path: '/manager-approvals', component: ManagerApprovalsView },
  { path: '/permissions', component: ExtraView, props: { section: 'permissions' } },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]
const regionalScroll = new Map<string,{left:number;top:number}>()
const router = createRouter({ history: createWebHashHistory(), routes,
  scrollBehavior(to,from,saved){
    if(to.path.startsWith('/regional/'))return saved || regionalScroll.get(to.fullPath) || {left:0,top:0}
  }
})
function expireSession() {
  if (!state.profile) return
  clearManagerSession('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  void router.replace(router.currentRoute.value.path.startsWith('/mobile')?'/mobile/login':'/login')
}
window.addEventListener('routel-manager-session-expired', expireSession)
router.beforeEach(async (to,from) => {
  if(from.path.startsWith('/regional/'))regionalScroll.set(from.fullPath,{left:window.scrollX,top:window.scrollY})
  const authenticated = await refreshManagerProfile()
  if(to.path==='/mobile'||to.path.startsWith('/mobile/')){
    if(!authenticated)return to.path==='/mobile/login'?true:'/mobile/login'
    if(to.path==='/mobile/login')return true
    if(!['REGIONAL_ADMIN','SUPER_ADMIN'].includes(state.profile?.role||''))return to.path==='/mobile/access'?true:'/mobile/access'
    if(to.path==='/mobile/access')return '/mobile'
    if(!state.loaded)await refresh()
    if(!state.profile)return '/mobile/login'
    if(to.params.id&&!state.underpasses.some(f=>f.id===String(to.params.id)))return '/mobile/facilities'
    return true
  }
  const publicPage = ['/login', '/signup'].includes(to.path)
  if (!authenticated) return publicPage ? true : '/login'
  if (publicPage) return to.path === '/login' ? true : '/dashboard'
  if(to.meta.regionalOnly && state.profile?.role!=='REGIONAL_ADMIN') return '/dashboard'
  if(to.meta.superOnly && state.profile?.role!=='SUPER_ADMIN') return '/dashboard'
  if(state.profile?.role==='SUPER_ADMIN'){
    if(to.path==='/cctv'||/^\/facilities\/[^/]+\/cctv$/.test(to.path))return '/super/facilities'
    const targets:Record<string,{path:string;query?:Record<string,string>}>={
      '/facilities':{path:'/super/facilities'},
      '/facility-manage':{path:'/super/facilities',query:{tab:'manage'}},
      '/manager-approvals':{path:'/super/accounts',query:{tab:'approvals'}},
      '/permissions':{path:'/super/accounts',query:{tab:'managers'}},
      '/members':{path:'/super/customers',query:{tab:'members'}},
      '/opinions':{path:'/super/customers',query:{tab:'opinions'}},
      '/notices':{path:'/super/customers',query:{tab:'notices'}},
      '/logs':{path:'/super/logs'},
      '/push-logs':{path:'/super/logs',query:{category:'ALERT'}},
      '/thresholds':{path:'/super/facilities',query:{tab:'thresholds'}}
    }
    if(targets[to.path])return {...targets[to.path],query:{...to.query,...targets[to.path].query}}
    const match=to.path.match(/^\/facilities\/([^/]+)(?:\/(cctv|operations))?$/)
    if(match)return {path:'/super/facilities/'+match[1],query:match[2]?{tab:'operations',panel:match[2]==='cctv'?'cctv':'vehicles'}:to.query}
  }

  if(state.profile?.role==='REGIONAL_ADMIN'){
    const aliases:Record<string,{path:string;query?:Record<string,string>}>={
      '/facilities':{path:'/regional/facilities'},
      '/logs':{path:'/regional/logs'},
      '/push-logs':{path:'/regional/logs',query:{category:'ALERT'}},
      '/members':{path:'/regional/customers',query:{tab:'members'}},
      '/opinions':{path:'/regional/customers',query:{tab:'opinions'}},
      '/notices':{path:'/regional/customers',query:{tab:'notices'}}
    }
    if(aliases[to.path])return {...aliases[to.path],query:{...to.query,...aliases[to.path].query}}
    const match=to.path.match(/^\/facilities\/([^/]+)$/)
    if(match)return {path:'/regional/facilities/'+match[1],query:to.query}
  }
  if (state.profile?.role === 'REGIONAL_ADMIN' && !regionalRouteAllowed(to.path)) return '/dashboard'
  if (!state.loaded) await refresh()
  if (!state.profile) return '/login'
  if (state.profile.role === 'REGIONAL_ADMIN' && to.params.id && !state.underpasses.some(item => item.id === String(to.params.id))) return '/dashboard'
  return true
})
async function updateSessionAndFacilities() {
  if (document.visibilityState==='hidden'||['/login', '/signup','/mobile/login','/mobile/access'].includes(router.currentRoute.value.path)) return
  if (await refreshManagerProfile()) {
    if(router.currentRoute.value.path.startsWith('/mobile')&&!['REGIONAL_ADMIN','SUPER_ADMIN'].includes(state.profile?.role||'')){await router.replace('/mobile/access');return}
    await refresh()
  }
  else await router.replace(router.currentRoute.value.path.startsWith('/mobile')?'/mobile/login':'/login')
}
window.addEventListener('focus', () => void updateSessionAndFacilities())
window.setInterval(() => void updateSessionAndFacilities(), 30000)
createApp(App).provide(adminKey, { state, control, refresh }).use(router).mount('#app')

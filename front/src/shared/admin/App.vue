<script setup lang="ts">
import PageBack from "../components/PageBack.vue"
import AdminBreadcrumb from './components/AdminBreadcrumb.vue'
import { computed, inject, ref, watch, nextTick } from 'vue'
import { superDashboardStatus } from '../../super-admin/services/super-dashboard'
import { adminKey, clearManagerSession } from './main'
import mascot from '../assets/images/routel-header-mascot.png'
import { useRoute, useRouter } from 'vue-router'
const { state, refresh } = inject(adminKey)!
const route = useRoute()
const router = useRouter()
const authPage = computed(() => ['/login', '/signup'].includes(route.path))
const isRegional = computed(() => state.profile?.role === 'REGIONAL_ADMIN')
const isSuper = computed(() => state.profile?.role === 'SUPER_ADMIN')
const modernShell = computed(() => isRegional.value || isSuper.value)
async function refreshHeader() { if (isSuper.value) superDashboardStatus.refreshVersion++; await refresh() }
const logoutError = ref('')
const loggingOut = ref(false)
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  logoutError.value = ''
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    if (!response.ok && response.status !== 401) throw new Error('로그아웃에 실패했습니다.')
    clearManagerSession()
    await router.replace('/login')
  } catch (e) { logoutError.value = (e as Error).message }
  finally { loggingOut.value = false }
}
const drawer = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const menuPanel = ref<HTMLElement | null>(null)
function savedTheme(key: string) {
  const saved = localStorage.getItem(key)
  const value = saved === 'light' || saved === 'dark' ? saved : saved === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'
  localStorage.setItem(key, value)
  return value
}
const themeKey = computed(() => isSuper.value ? 'routel-super-theme' : 'routel-regional-theme')
const mode = ref(savedTheme(themeKey.value))
const theme = computed(() => mode.value)
watch(themeKey, key => { mode.value = savedTheme(key) })
watch(mode, value => localStorage.setItem(themeKey.value, value))
async function closeMenu() { drawer.value = false; await nextTick(); menuButton.value?.focus() }
watch(() => route.fullPath, () => { if (drawer.value) void closeMenu() })
watch(drawer, async value => { if (value) { await nextTick(); menuPanel.value?.querySelector<HTMLElement>('button,a')?.focus() } })
function menuKeys(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); void closeMenu() }
  if (e.key !== 'Tab') return
  const nodes = Array.from(menuPanel.value?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') || [])
  const first = nodes[0], last = nodes.at(-1)
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
}

const menus = [
  { title: '메인페이지', items: [['/dashboard', '종합 현황']] },
  {
    title: '시설통제',
    items: [
      ['/facilities', '시설 현황·통제/해제'],
      ['/facility-manage', '지하차도·지역 관리'],
      ['/cctv', 'CCTV'],
      ['/operations', '차량·전광판'],
      ['/alert-evidence', '알림·번호판 스냅샷'],
    ],
  },
  {
    title: '회원관리',
    items: [
      ['/members', '회원관리'],
      ['/opinions', '접수의견 처리'],
      ['/notices', '공지·FAQ 관리'],
      ['/push-logs', '앱푸시 발송로그'],
    ],
  },
  { title: '로그확인', items: [['/logs', '제어이력 로그']] },
  {
    title: '총관리자',
    items: [
      ['/thresholds', '임계치 설정'],
      ['/permissions', '관리자 권한'],
      ['/manager-approvals', '관리자 가입 승인'],
    ],
  },
]
const superMenus = [{title:'업무 메뉴',items:[['/dashboard','종합 현황'],['/super/facilities','지하차도 관리'],['/super/accounts','지역·관리자'],['/super/customers','고객·게시물'],['/super/logs','통합 로그'],['/alert-evidence','수동 판별'],['/push-logs','알림 발송 로그']]}]
const regionalMenus = [{title:'업무 메뉴',items:[['/dashboard','종합 현황'],['/regional/facilities','지하차도 관리'],['/regional/customers','고객·게시물'],['/regional/logs','통합 로그'],['/alert-evidence','수동 판별'],['/push-logs','알림 발송 로그']]}]
const visibleMenus = computed(() => isSuper.value ? superMenus : isRegional.value ? regionalMenus : menus)
</script>

<template>
  <router-view v-if="route.path === '/mobile' || route.path.startsWith('/mobile/')" />
  <div v-else class="routel-manager-shell" :data-theme="theme" :class="{ 'admin-glass': isRegional || isSuper, 'routel-regional': isRegional, 'routel-super': isSuper, 'routel-regional-login': authPage }">
    <div v-if="isRegional || isSuper" class="admin-ambient" aria-hidden="true"></div>
    <router-view v-if="authPage" />
    <div v-else-if="!state.profile" class="regional-auth-loading" role="status">관리자 정보를 확인하는 중입니다.</div>
    <div v-else class="routel-admin-layout">
      <aside v-if="!modernShell" class="routel-admin-sidebar">
        <h2><router-link to="/dashboard"><img v-if="isRegional" class="regional-brand-mascot" :src="mascot" alt="" />ROUTEL</router-link></h2>
        <p class="routel-admin-caption">{{ isRegional ? '지역 관리자' : '관리자' }}</p>
        <p class="routel-admin-external"><a href="/">고객 웹</a><a href="/app/">고객 앱</a></p>
        <nav aria-label="관리자 메뉴">
          <section v-for="menu in visibleMenus" :key="menu.title">
            <h3>{{ menu.title }}</h3>
            <p v-for="item in menu.items" :key="item[0]"><router-link :to="item[0]">{{ item[1] }}</router-link></p>
          </section>
        </nav>
      </aside>
      <div class="routel-admin-workspace">
        <header v-if="modernShell" class="regional-header">
          <div class="regional-connection"><div><span class="connection-dot" :data-connected="!!state.lastUpdated && !state.error && !(isSuper && superDashboardStatus.errors.length)"></span> 데이터 연결 · {{ state.loading || (isSuper && superDashboardStatus.loading) ? '확인 중' : state.error ? '연결 오류' : isSuper && superDashboardStatus.errors.length ? '부분 오류' : state.lastUpdated ? '연결됨' : '확인 중' }}<small>{{ isSuper ? '시설 마지막 수신' : '마지막 수신' }} {{ state.lastUpdated ? new Date(state.lastUpdated).toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) : '—' }}{{ state.error && state.lastUpdated ? ' · 이전 자료' : '' }}</small></div><button :disabled="state.loading || state.controlBusy || (isSuper && superDashboardStatus.loading)" @click="refreshHeader">새로고침</button><select v-model="mode" aria-label="화면 모드"><option value="light">라이트</option><option value="dark">다크</option></select></div>
          <router-link to="/dashboard" class="regional-center-logo" aria-label="ROUTEL 종합 현황"><img :src="mascot" alt="" width="42" height="36" /><strong>ROUTEL</strong></router-link>
          <div class="regional-header-user"><button ref="menuButton" class="regional-hamburger" :class="{'is-open':drawer}" aria-label="관리자 메뉴" :aria-expanded="drawer" aria-controls="regional-menu" @click="drawer = !drawer"><svg class="regional-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6H21 M3 12H21 M3 18H21" /></svg></button><router-link to="/profile">{{ state.profile.name || '이름 미등록' }}님<template v-if="isSuper"> · 총관리자</template><template v-else> ({{ state.profile.regionName || '담당 지역 미지정' }})</template></router-link></div>
        </header>
        <div v-if="modernShell && drawer" class="regional-drawer-backdrop" @click.self.stop="closeMenu" @keydown="menuKeys">
          <aside id="regional-menu" ref="menuPanel" class="regional-drawer" role="dialog" aria-modal="true" :aria-label="isSuper ? '총관리자 메뉴' : '지역 관리자 메뉴'"><div class="regional-panel-heading"><h2>관리자 메뉴</h2><button @click="closeMenu">닫기</button></div><p>{{ state.profile.name }}님 · {{ isSuper ? '총관리자' : `${state.profile.regionName || '담당 지역 미지정'} 지역 관리자` }}</p><div class="regional-drawer-scroll"><nav><section v-for="menu in visibleMenus" :key="menu.title"><h3>{{ menu.title }}</h3><router-link v-for="item in menu.items" :key="item[0]" :to="item[0]" @click="closeMenu">{{ item[1] }}</router-link></section></nav><h3>서비스 이동</h3><nav aria-label="서비스 이동"><router-link to="/mobile" @click="closeMenu">관리자 앱</router-link><a href="/">고객 웹</a><a href="/app/">고객 앱</a></nav></div><footer class="regional-drawer-footer"><div class="regional-drawer-actions"><router-link to="/profile" @click="closeMenu">마이페이지</router-link><button :disabled="loggingOut" @click="logout">{{ loggingOut ? '로그아웃 중…' : '로그아웃' }}</button></div><p v-if="logoutError" role="alert">{{ logoutError }}</p></footer></aside>
        </div>
        <header v-if="!modernShell" class="routel-admin-topbar">
          <strong>지하차도 침수 관제 시스템</strong><select v-model="mode" aria-label="화면 모드"><option value="light">라이트</option><option value="dark">다크</option></select>
          <div class="routel-admin-account"><span v-if="state.profile" class="regional-account-identity"><router-link v-if="isRegional" to="/profile">{{ state.profile.name || '이름 미등록' }}님</router-link><template v-else>{{ state.profile.name }}님</template><span v-if="isRegional" class="regional-account-region">{{ state.profile.regionName || '담당 지역 미지정' }} · 지역 관리자</span></span><router-link to="/profile">마이페이지</router-link><button type="button" :disabled="loggingOut" @click="logout">{{ loggingOut ? '로그아웃 중…' : '로그아웃' }}</button></div>
        </header>
        <p v-if="isSuper && superDashboardStatus.errors.length" class="super-header-error" role="alert">일부 데이터 조회 실패: {{ superDashboardStatus.errors.join(', ') }}. 해당 패널의 갱신 상태를 확인해 주세요.</p>
        <p v-if="logoutError" role="alert">{{ logoutError }}</p>
        <p v-if="state.error" role="alert">{{ state.error }} <button type="button" @click="refresh">다시 시도</button></p>
        <main class="routel-admin-content" :inert="modernShell && drawer"><AdminBreadcrumb/><PageBack v-if="route.path !== '/dashboard'" area="admin" /><router-view /></main>
      </div>
    </div>
  </div>
</template>
<style src="./styles/admin-ui.css"></style>

<style src="../../regional-admin/styles/regional-dashboard.css"></style>

<style src="../../super-admin/styles/super-dashboard.css"></style>

<style src="./styles/revision-layout.css"></style>

<style src="./styles/auth-layout.css"></style>

<style src="../../super-admin/styles/workspace.css"></style>

<style src="../../regional-admin/styles/workspace.css"></style>

<style src="./styles/admin-polish.css"></style>

<style src="./styles/layout-consistency.css"></style>

<style src="./styles/admin-glass.css"></style>
<style src="../../regional-admin/styles/dashboard-compact.css"></style>

<style src="../../regional-admin/styles/workspace-frame.css"></style>

<style src="../../super-admin/styles/workspace-frame.css"></style>

<style src="./styles/review-oct04.css"></style>

<style src="./styles/qa-oct05.css"></style>
<style src="./styles/layout-feedback-oct05.css"></style>
<style src="./styles/record-feedback.css"></style>

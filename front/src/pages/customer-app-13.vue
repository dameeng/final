<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useApp } from '../stores/app'
import { logoutCustomer } from '../services/customerSession'
import CustomerAppPage from '../components/CustomerAppPage.vue'
import {openCustomerGuide} from '../services/customerOnboarding'
const app = useApp(),
  router = useRouter(),
  error = ref(''),
  member = computed(() => app.account?.role === 'customer')
const menus = [
  {label:'내 정보 관리',section:'profile',icon:'user'},
  {label:'알림 수신 설정',section:'alerts',icon:'bell'},
  {label:'내 문의',section:'inquiries',icon:'chat'},
  {label:'회원 탈퇴',section:'withdraw',icon:'logout'},
] as const
function target(section: string) {
  if (section === 'alerts') return '/customer-app/screen-12'
  const next = `/customer-app/account/${section}`
  return member.value ? next : { path: '/customer-app/screen-1', query: { next } }
}
function openChat(){window.dispatchEvent(new Event('routel-public-chat-open'))}
async function signout() {
  try {
    if (app.account) await logoutCustomer()
    else app.clearAccount()
    router.replace('/customer-app/screen-1')
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>
<template>
  <CustomerAppPage title="마이페이지">
    <section class="app-account-card app-account-profile">
      <div class="app-profile-heading"><span class="app-profile-avatar" aria-hidden="true">{{member?app.account?.name?.slice(0,1):'R'}}</span><div><small>{{member?'ROUTEL 회원':'안전한 이동의 시작'}}</small><h2>{{member?app.account?.name+'님':'ROUTEL과 함께'}}</h2></div></div>
      <p class="app-profile-description">
        {{member?'내 정보와 이용 설정을 관리하세요.':'공지사항과 FAQ는 로그인 없이 이용할 수 있습니다.'}}
      </p>
      <RouterLink v-if="!member" class="app-account-primary" to="/customer-app/screen-1">로그인</RouterLink>
    </section>
    <nav class="app-account-menu" aria-label="마이페이지 메뉴">
      <section class="app-account-group"><h2>이용 안내</h2><div class="app-account-menu-card">
      <RouterLink class="btn" to="/customer-app/notices"><span class="app-menu-icon"><UiIcon name="document" /></span><strong class="app-menu-label">공지사항</strong><span class="app-menu-chevron" aria-hidden="true">›</span>
      </RouterLink>
      <RouterLink class="btn" to="/customer-app/faq"><span class="app-menu-icon"><UiIcon name="help" /></span><strong class="app-menu-label">FAQ</strong><span class="app-menu-chevron" aria-hidden="true">›</span>
      </RouterLink>
      <button type="button" class="app-account-chat" @click="openChat">
        <span class="app-menu-icon"><UiIcon name="chat" /></span><strong class="app-menu-label">AI 도우미</strong><span class="app-menu-chevron" aria-hidden="true">›</span>
      </button>
      <button v-if="member" type="button" class="app-account-chat" @click="openCustomerGuide"><span class="app-menu-icon"><UiIcon name="map" /></span><strong class="app-menu-label">루와 사용법 보기</strong><span class="app-menu-chevron" aria-hidden="true">›</span></button>
      </div></section>
      <section class="app-account-group"><h2>계정 관리</h2><div class="app-account-menu-card">
      <RouterLink class="btn" v-for="item in menus" :key="item.section" :to="target(item.section)" :class="{'app-menu-withdraw':item.section==='withdraw'}">
        <span class="app-menu-icon"><UiIcon :name="item.icon" /></span><strong class="app-menu-label">{{item.label}}</strong><small v-if="!member">로그인 필요</small>
        <span class="app-menu-chevron" aria-hidden="true">›</span>
      </RouterLink>
      </div></section>
    </nav>
    <button v-if="member" type="button" class="btn app-account-primary app-account-logout" @click="signout"><UiIcon name="logout" />로그아웃</button>
    <p v-if="error" role="status">{{error}}</p>
  </CustomerAppPage>
</template>

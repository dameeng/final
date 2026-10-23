<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import NotificationBell from './NotificationBell.vue'
import CustomerLogout from './CustomerLogout.vue'
const app = useApp()
const customerSignedIn = computed(() => app.account?.role === 'customer')
const route = useRoute(),
  opened = ref(false),
  headerRoot = ref<HTMLElement>()
watch(
  () => route.fullPath,
  () => (opened.value = false),
)
function outside(event: PointerEvent) {
  if (!headerRoot.value?.contains(event.target as Node)) opened.value = false
}
let sizeObserver: ResizeObserver | undefined
function measureHeader() {
  if (headerRoot.value)
    document.documentElement.style.setProperty(
      '--customer-header-height',
      headerRoot.value.getBoundingClientRect().height + 'px',
    )
}
function resized() {
  opened.value = false
  measureHeader()
}
onMounted(() => {
  measureHeader()
  sizeObserver = new ResizeObserver(measureHeader)
  if (headerRoot.value) sizeObserver.observe(headerRoot.value)
  document.addEventListener('pointerdown', outside)
  window.addEventListener('resize', resized)
})
onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  document.removeEventListener('pointerdown', outside)
  window.removeEventListener('resize', resized)
})
const menus = [
  {
    label: 'About us',
    to: '/info/company',
    items: [
      ['회사 소개', '/info/company'],
      ['비전·로드맵', '/info/vision'],
      ['앱 소개', '/info/app-guide'],
    ],
  },
  { label: '지하차도 현황', to: '/c-map', items: [['지하차도 현황', '/c-map']] },
  {
    label: '알림마당',
    to: '/c-notice',
    items: [
      ['공지사항', '/c-notice'],
      ['FAQ', '/info/faq'],
    ],
  },
  {
    label: '연계 사이트',
    to: '/info/its',
    items: [
      ['ITS', '/info/its'],
      ['기상청', '/info/kma'],
      ['에스트래픽', '/info/straffic'],
    ],
  },
]
</script>
<template>
  <header
    ref="headerRoot"
    class="customer-header"
    @mouseleave="opened=false"
    @keydown.esc.prevent="opened=false"
    @focusout="event=>{if(!headerRoot?.contains(event.relatedTarget as Node))opened=false}"
  >
    <div class="customer-header-scroll">
      <div class="customer-header-inner">
        <RouterLink to="/" class="customer-logo">ROUTEL</RouterLink>
   <nav class="customer-main-nav" aria-label="고객 메뉴">
          <div v-for="menu in menus" :key="menu.label" class="customer-menu">
            <RouterLink
              class="customer-menu-link"
              :to="menu.to"
              :aria-expanded="opened"
              aria-controls="customer-header-dropdown"
              @mouseenter="opened=true"
              @focus="opened=true"
              @keydown.down.prevent="opened=true"
              @click="opened=false"
            >
              {{menu.label}}
            </RouterLink>
          </div>
        </nav>
   <nav class="customer-member-nav" aria-label="회원 메뉴">
          <RouterLink to="/info/app-guide#install" class="header-download">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
            </svg>앱 다운로드</RouterLink>
    <NotificationBell
            v-if="customerSignedIn&&!['/login','/signup','/c-auth','/password-reset','/find-id'].includes(route.path)"
            @opened="opened=false"
          />
    <template v-if="customerSignedIn">
            <RouterLink to="/my-home" class="header-mypage">마이페이지</RouterLink>
            <CustomerLogout />
          </template>
    <template v-else>
            <RouterLink to="/login">로그인</RouterLink>
            <RouterLink to="/signup">회원가입</RouterLink>
          </template>
    <button class="ui-icon-button" type="button" aria-label="라이트·다크 모드 전환" @click="app.themeToggle()">
          <UiIcon name="theme" />
        </button>
        </nav>
      </div>
    </div>
   <div v-show="opened" id="customer-header-dropdown" class="customer-header-dropdown">
      <div class="header-dropdown-columns">
        <nav
          v-for="menu in menus"
          :key="menu.label"
          class="header-dropdown-column"
          :aria-label="menu.label+' 하위 메뉴'"
        >
          <RouterLink v-for="[label,to] in menu.items" :key="to" :to="to!" @click="opened=false">
            {{label}}
          </RouterLink>
        </nav>
      </div>
    </div>
  </header>
</template>

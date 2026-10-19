<script setup lang="ts">
import {ref,watch,onMounted,onBeforeUnmount} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {useApp} from '../stores/app'
const app=useApp()
const route=useRoute(),opened=ref(false),headerRoot=ref<HTMLElement>()
watch(()=>route.fullPath,()=>opened.value=false)
function outside(event:PointerEvent){if(!headerRoot.value?.contains(event.target as Node))opened.value=false}
onMounted(()=>document.addEventListener('pointerdown',outside))
onBeforeUnmount(()=>document.removeEventListener('pointerdown',outside))
const menus=[
 {label:'About us',to:'/info/company',items:[['회사 소개','/info/company'],['비전·로드맵','/info/vision'],['앱 소개','/info/app-guide']]},
 {label:'지하차도 현황',to:'/c-map',items:[['지하차도 현황','/c-map']]},
 {label:'알림마당',to:'/c-notice',items:[['공지사항','/c-notice'],['FAQ','/info/faq']]},
 {label:'연계 사이트',to:'/info/its',items:[['ITS','/info/its'],['기상청','/info/kma'],['에스트래픽','/info/straffic']]}
]
</script>
<template>
 <header ref="headerRoot" class="customer-header" @mouseleave="opened=false" @keydown.esc.prevent="opened=false" @focusout="event=>{if(!headerRoot?.contains(event.relatedTarget as Node))opened=false}">
  <div class="customer-header-scroll">
  <div class="customer-header-inner">
   <RouterLink to="/" class="customer-logo">ROUTEL</RouterLink>
   <nav class="customer-main-nav" aria-label="고객 메뉴">
    <div v-for="menu in menus" :key="menu.label" class="customer-menu">
     <RouterLink class="customer-menu-link" :to="menu.to" :aria-expanded="opened" aria-controls="customer-header-dropdown" @mouseenter="opened=true" @focus="opened=true" @keydown.down.prevent="opened=true" @click="opened=false">{{menu.label}}</RouterLink>
    </div>
   </nav>
   <nav class="customer-member-nav" aria-label="회원 메뉴">
    <RouterLink to="/info/app-guide#install" class="header-download"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg>앱 다운로드</RouterLink>
    <RouterLink to="/admin-dashboard" class="header-admin-link">관리자 페이지</RouterLink>
    <RouterLink v-if="(app.account||app.memberPreview)&&!['/login','/signup','/c-auth','/password-reset','/find-id'].includes(route.path)" to="/my-alerts" class="header-alert-link" :aria-label="app.unread?'알림 '+app.unread+'건':'알림 내역'"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1"/></svg><span v-if="app.unread" class="header-alert-count" aria-hidden="true">{{app.unread>99?'99+':app.unread}}</span></RouterLink>
    <RouterLink to="/my-home" class="header-mypage">{{app.account||app.memberPreview?'마이페이지':'마이페이지 미리보기'}}</RouterLink>
    <template v-if="!app.account&&!app.memberPreview"><RouterLink to="/login">로그인</RouterLink><RouterLink to="/signup">회원가입</RouterLink></template>
    <button type="button" aria-label="라이트·다크 모드 전환" @click="app.themeToggle()">◐</button>
   </nav>
  </div>
  </div>
  <div v-show="opened" id="customer-header-dropdown" class="customer-header-dropdown"><div class="header-dropdown-columns"><nav v-for="menu in menus" :key="menu.label" class="header-dropdown-column" :aria-label="menu.label+' 하위 메뉴'"><RouterLink v-for="[label,to] in menu.items" :key="to" :to="to!" @click="opened=false">{{label}}</RouterLink></nav></div></div>
 </header>
</template>

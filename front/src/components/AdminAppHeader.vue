<script setup lang="ts">
import NotificationBell from './NotificationBell.vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import AdminBackButton from './AdminBackButton.vue'
const route = useRoute(),
  app = useApp(),
  menu = ref<HTMLDialogElement>()
const groups = [
  {
    title: '현황·시설',
    links: [
      ['종합 현황', '/admin-app/screen-3'],
      ['지하차도·통제', '/admin-app/screen-4'],
      ['관할 담당자 연락처', '/admin-app/contacts'],
    ],
  },
  {
    title: 'OCR·차량',
    links: [
      ['OCR 인식 기록', '/admin-app/ocr'],
      ['수동 판별', '/admin-app/reviews'],
      ['차량 통과 기록', '/admin-app/transits'],
    ],
  },
  {
    title: '예지보전',
    links: [
      ['설비 목록', '/admin-app/screen-9'],
      ['점검 대상·알림', '/admin-app/screen-11'],
      ['점검 이력', '/admin-app/history'],
    ],
  },
  {
    title: '알림·운영',
    links: [
      ['내 관리자 알림', '/admin-app/notifications'],
      ['알림 발송 기록', '/admin-app/screen-13'],
      ['더보기·내 정보', '/admin-app/screen-14'],
    ],
  },
]
const titles: Record<string, string> = {
  '2': '근무 시작',
  '3': '종합 현황',
  '4': '지하차도·통제',
  '5': '시설 상세',
  '6': '통제 시작',
  '7': '통제 현황',
  '8': '통제 해제',
  '9': '설비 목록',
  '10': '설비 상세',
  '11': '점검 대상·알림',
  '12': '점검 등록',
  '13': '알림 발송 기록',
  '14': '더보기·내 정보',
  history: '점검 이력',
  document: '통제 전달 문서',
  contacts: '관할 담당자 연락처',
  notifications: '내 관리자 알림',
  ocr: 'OCR 인식 기록',
  reviews: '수동 판별',
  transits: '차량 통과 기록',
}
const section = computed(() => route.path.split('/').at(-1)!.replace('screen-', '')),
  title = computed(() => titles[section.value] || '관리자 앱'),
  fallback = computed(() =>
    ['10', '11', 'history'].includes(section.value)
      ? '/admin-app/screen-9'
      : section.value === '12'
        ? '/admin-app/screen-11'
        : ['5', '6', '7', '8'].includes(section.value)
          ? '/admin-app/screen-4'
          : '/admin-app/screen-3',
  )
watch(
  () => route.fullPath,
  () => menu.value?.close(),
)
function outside(event: MouseEvent) {
  if (event.target !== menu.value) return
  const bounds = menu.value.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    menu.value.close()
}
</script>
<template>
  <header class="manager-app-header">
    <div class="manager-app-brandbar">
      <button type="button" aria-label="관리자 앱 메뉴 열기" @click="menu?.showModal()">
        <UiIcon name="menu" />
      </button>
      <RouterLink
        class="manager-app-logo"
        to="/admin-app/screen-3"
        aria-label="ROUTEL 관리자 앱 홈"
      >ROUTEL</RouterLink>
      <NotificationBell class="manager-app-bell-preview" />
    </div>
    <div class="manager-app-titlebar">
      <AdminBackButton :fallback="fallback" />
      <strong>{{title}}</strong>
      <button class="ui-icon-button" type="button" aria-label="라이트·다크 전환" @click="app.themeToggle()">
          <UiIcon name="theme" />
        </button>
    </div>
    <dialog
      ref="menu"
      class="manager-app-drawer"
      aria-label="관리자 앱 페이지 메뉴"
      @click="outside"
    >
      <div class="manager-app-drawer-head">
        <strong>ROUTEL 관리자 메뉴</strong>
        <button class="ui-icon-button" type="button" aria-label="메뉴 닫기" @click="menu?.close()">
          <UiIcon name="close" />
        </button>
      </div>
      <nav aria-label="관리자 앱 페이지 목록">
        <section v-for="group in groups" :key="group.title">
          <h2>{{group.title}}</h2>
          <RouterLink
            v-for="[label,path] in group.links"
            :key="path"
            :to="path!"
            :aria-current="route.path===path?'page':undefined"
            @click="menu?.close()"
          >
            {{label}}
          </RouterLink>
        </section>
      </nav>
    </dialog>
  </header>
</template>
<style scoped src="../styles/components/admin-app-header.css"></style>

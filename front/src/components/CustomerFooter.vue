<script setup lang="ts">
import { RouterLink } from 'vue-router'
import '../styles/customer-footer.css'
import { useApp } from '../stores/app'
const app = useApp()
const links = [
  { label: '회사 소개', to: '/info/company' },
  { label: '공지사항', to: '/c-notice' },
  { label: '자주 묻는 질문', to: '/info/faq' },
  { label: '문의하기', to: '/my-inquiries' },
  { label: '앱 소개', to: '/info/app-guide' },
]
</script>
<template>
  <footer class="customer-footer">
    <div class="customer-footer-inner">
      <div class="customer-footer-top">
        <div class="customer-footer-brand">
          <RouterLink to="/" aria-label="ROUTEL 홈">ROUTEL<span aria-hidden="true">.</span>
          </RouterLink>
          <p>이동 전 작은 확인, 더 안전한 일상.</p>
        </div>
          <RouterLink to="/info/app-guide#install" class="customer-footer-app">
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
      </div>
      <nav class="customer-footer-links" aria-label="하단 메뉴">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{link.label}}</RouterLink>
        <RouterLink :to="app.account?.role==='REGIONAL_ADMIN'?'/admin-dashboard':'/admin-login'">관리자 페이지</RouterLink>
      </nav>
      <div class="customer-footer-bottom">
        <p>© ROUTEL. All rights reserved.</p>
      </div>
    </div>
  </footer>
</template>

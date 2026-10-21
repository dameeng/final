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
        <RouterLink to="/customer-app/screen-1" class="customer-footer-app">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <rect x="6" y="2" width="12" height="20" rx="3" />
            <path d="M10 5h4m-3 14h2" />
          </svg>
          <span>고객 앱</span>
          <span aria-hidden="true">↗</span>
        </RouterLink>
      </div>
      <nav class="customer-footer-links" aria-label="하단 메뉴">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{link.label}}</RouterLink>
        <RouterLink :to="app.account?.role==='REGIONAL_ADMIN'?'/admin-dashboard':'/admin-login'">관리자 페이지</RouterLink>
      </nav>
      <div class="customer-footer-bottom">
        <p>© ROUTEL. All rights reserved.</p>
        <RouterLink to="/info/app-guide#install">Android · iPhone 설치 안내 <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>
  </footer>
</template>

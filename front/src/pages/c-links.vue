<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import '../styles/customer-information.css'
const route = useRoute()
const entry = computed(() =>
  route.path.endsWith('/its')
    ? { name: 'ITS', logo: '/brand/partners/its.png', logoAlt: 'ITS 국가교통정보센터', logoTone: 'light', url: 'https://www.its.go.kr/', category: '교통정보', description: '이동 전 확인할 교통정보를 공식 홈페이지에서 살펴보세요.' }
    : route.path.endsWith('/kma')
      ? { name: '기상청', logo: '/brand/partners/kma.png', logoAlt: '기상청', logoTone: 'light', url: 'https://www.weather.go.kr/', category: '날씨정보', description: '이동을 준비할 때 필요한 날씨정보를 공식 홈페이지에서 확인하세요.' }
      : { name: '에스트래픽', logo: '/brand/partners/straffic.svg', logoAlt: 'STraffic 에스트래픽', logoTone: 'dark', url: 'https://www.straffic.co.kr/', category: '교통 기술', description: '교통 기술과 서비스에 관한 정보를 공식 홈페이지에서 살펴보세요.' },
)
</script>
<template>
  <main class="wire-page customer-content page-c-information page-c-links">
    <header class="information-page-heading">
      <h1>{{ entry.name }}</h1>
      <p>안전한 이동에 도움이 되는 정보를 연결합니다.</p>
    </header>
    <section class="information-link-card" aria-labelledby="linked-service-title">
      <div class="information-link-visual" :class="`information-link-visual--${entry.logoTone}`">
        <img class="information-partner-logo" :src="entry.logo" :alt="entry.logoAlt" decoding="async" />
      </div>
      <div class="information-link-copy">
        <span class="information-link-category">{{ entry.category }}</span>
        <h2 id="linked-service-title">{{ entry.name }}</h2>
        <p>{{ entry.description }}</p>
        <a class="information-link-button" :href="entry.url" target="_blank" rel="noopener noreferrer">
          공식 홈페이지 열기
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6M20 4 9 15M10 4H4v16h16v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span class="information-screen-reader">(새 창)</span>
        </a>
        <small>{{ entry.url.replace(/^https:\/\//, '').replace(/\/$/, '') }} · 새 창으로 열립니다</small>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import '../styles/customer-home-premium.css'
const visionRoadmap = [
  { year: '2026', title: '안전 정보의 기반', description: '지하차도 통제 현황을 한곳에서 확인할 수 있는 기본 서비스를 구축하겠습니다.' },
  { year: '2027', title: '필요한 안내를 제때', description: '관심 지역과 시설의 통제 정보를 확인하고 알림을 받을 수 있도록 안내 기능을 고도화하겠습니다.' },
  { year: '2028', title: '더 세심한 위험 분석', description: '축적된 시설 데이터를 활용해 위험 분석의 정확도를 검증하고 개선하겠습니다.' },
  { year: '2030', title: '더 넓은 지역의 안전', description: '서비스 적용 지역을 단계적으로 확대하고, 이용자와 시설 관리자를 연결하겠습니다.' },
]
</script>
<template>
  <main class="wire-page customer-content page-c-home home-premium">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <p class="home-eyebrow"><span aria-hidden="true"></span> YOUR EVERYDAY SAFETY PARTNER</p>
        <h1 id="home-title">안전한 도로,<br />안심할 수 있는 일상.</h1>
        <p class="home-hero-lead">길 위의 작은 확인이<br />우리의 일상을 지킵니다.</p>
        <p class="home-description">지하차도의 통제 현황을 한곳에서.<br />출발 전부터 이동 중까지, ROUTEL과 함께<br class="home-desktop-break" /> 더 안전한 길을 확인하세요.</p>
        <div class="home-actions">
          <RouterLink to="/info/underpasses" class="home-button home-button-primary">지하차도 현황 확인 <span aria-hidden="true">↗</span></RouterLink>
          <RouterLink to="/info/business" class="home-button home-button-secondary">서비스 소개 <span aria-hidden="true">→</span></RouterLink>
        </div>
      </div>
      <figure class="home-hero-visual">
        <img src="/brand/routel-coastal-underpass.png" width="1774" height="887" fetchpriority="high" alt="해안 도시의 도로와 지하차도를 표현한 ROUTEL 브랜드 이미지" />
        <figcaption><span class="home-image-mark" aria-hidden="true"><UiIcon name="location" /></span><span><strong>일상의 길에, 안심을 더하다.</strong><small>지하차도 안전을 위한 기술, ROUTEL</small></span></figcaption>
      </figure>
    </section>

    <section class="home-services" aria-labelledby="home-services-title">
      <header class="home-section-heading">
        <div><p class="home-eyebrow">WHAT WE DO</p><h2 id="home-services-title">도로의 상황을 살피고,<br />안전한 이동을 돕습니다.</h2></div>
        <p>복잡한 정보는 덜고, 필요한 정보는 가까이.<br />이동 전에 꼭 필요한 안전 정보를 확인하세요.</p>
      </header>
      <div class="home-service-grid">
        <article class="home-service-card">
          <div class="home-card-top"><span class="home-service-icon"><UiIcon name="location" /></span><span class="home-card-number">01 / ROAD STATUS</span></div>
          <h3>내가 지날 길의 상태를 한눈에</h3>
          <p>지도에서 지하차도의 위치와 통제 여부를 확인하고,<br class="home-desktop-break" /> 이동할 구간의 상황을 살펴보세요.</p>
          <RouterLink to="/info/underpasses">지하차도 통제 현황 <span aria-hidden="true">↗</span></RouterLink>
        </article>
        <article class="home-service-card">
          <div class="home-card-top"><span class="home-service-icon"><UiIcon name="bell" /></span><span class="home-card-number">02 / SAFETY NOTICE</span></div>
          <h3>놓치지 말아야 할 안전 안내</h3>
          <p>공지사항과 이용 안내를 통해<br class="home-desktop-break" /> 서비스 이용에 필요한 정보를 확인하세요.</p>
          <RouterLink to="/info/notices">안전 안내 확인 <span aria-hidden="true">↗</span></RouterLink>
        </article>
      </div>
    </section>

    <section class="home-brand" aria-labelledby="home-brand-title">
      <div class="home-brand-copy"><p class="home-eyebrow">YOUR EVERYDAY, SAFELY CONNECTED</p><h2 id="home-brand-title">당신의 길에,<br />안심을 더하다.</h2><p>다시는 ‘아무도 몰랐다’는 말이 없도록.<br />위험의 변화를 살피고, 필요한 안내를 전하겠습니다.</p><RouterLink to="/info/company">ROUTEL 알아보기 <span aria-hidden="true">↗</span></RouterLink></div>
      <div class="home-brand-art" aria-hidden="true">
        <svg viewBox="0 0 480 260" fill="none"><path d="M-20 230H120C170 230 185 180 185 145S205 80 255 80H500" stroke="#47769e" stroke-width="42"/><path d="M-20 230H120C170 230 185 180 185 145S205 80 255 80H500" stroke="#122c46" stroke-width="32"/><path d="M-20 230H120C170 230 185 180 185 145S205 80 255 80H500" stroke="#83b3da" stroke-width="2" stroke-dasharray="9 10"/><circle cx="186" cy="144" r="38" fill="#397ab3" fill-opacity=".15"/><circle cx="186" cy="144" r="17" fill="#65a7dd"/><circle cx="186" cy="144" r="6" fill="white"/><circle cx="361" cy="80" r="24" fill="#397ab3" fill-opacity=".2"/><circle cx="361" cy="80" r="8" fill="#aad1f0"/></svg>
        <span class="home-art-label home-art-label-one">길의 상태를 확인하고</span><span class="home-art-label home-art-label-two">더 안전한 일상으로</span>
      </div>
    </section>

    <section class="home-vision" aria-labelledby="home-vision-title">
      <header class="home-section-heading"><div><p class="home-eyebrow">ROUTEL VISION 2030</p><h2 id="home-vision-title">더 촘촘하게 연결될<br />내일의 도로 안전.</h2></div><p>정보 확인부터 위험 변화 파악과 신속한 안내까지.<br />안전한 이동을 돕는 서비스를 단계적으로 발전시키겠습니다.</p></header>
      <ol class="home-roadmap" aria-label="연도별 추진 목표"><li v-for="goal in visionRoadmap" :key="goal.year"><span class="home-roadmap-year">{{goal.year}}</span><h3>{{goal.title}}</h3><p>{{goal.description}}</p></li></ol>
    </section>
    <section class="home-closing"><div><p class="home-eyebrow">WITH YOU ON THE ROAD</p><h2>출발하기 전, 한 번 더 확인하세요.</h2></div><RouterLink class="home-button home-button-primary" to="/info/underpasses">지하차도 현황 확인 <span aria-hidden="true">↗</span></RouterLink></section>
  </main>
</template>

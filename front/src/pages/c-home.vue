<script setup lang="ts">
import { RouterLink } from 'vue-router'
import '../styles/customer-home-premium.css'
const brandRoadPath = 'M-20 230H120C170 230 185 180 185 145S205 80 255 80H500'
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
      <img class="home-hero-background" src="/brand/routel-coastal-underpass.png" width="1774" height="887" alt="" aria-hidden="true" fetchpriority="high" />
      <div class="home-hero-copy">
        <p class="home-hero-eyebrow"><span aria-hidden="true"></span>ROUTEL · 도로 안전 안내</p>
        <h1 id="home-title"><span class="home-hero-title-line">안전한 도로</span><span class="home-hero-title-line">안심되는 일상</span></h1>
        <p class="home-hero-lead">출발 전, 작은 확인으로.</p>
        <p class="home-description">지하차도 통제 현황과 안전 안내를<br />한눈에 확인하세요.</p>
        <div class="home-actions">
          <RouterLink to="/info/underpasses" class="btn primary home-button home-button-primary">지하차도 현황 <span aria-hidden="true">↗</span></RouterLink>
          <RouterLink to="/info/business" class="btn home-button home-button-secondary">서비스 소개 <span aria-hidden="true">→</span></RouterLink>
        </div>
      </div>
    </section>

    <section class="home-services" aria-labelledby="home-services-title">
      <header class="home-section-heading">
        <div><span class="home-section-index">01 / 일상의 안전</span><h2 id="home-services-title">도로의 상황을 살피고,<br />안전한 이동을 돕습니다.</h2></div>
        <p>복잡한 정보는 덜고, 필요한 정보는 가까이.<br />이동 전에 꼭 필요한 안전 정보를 확인하세요.</p>
      </header>
      <div class="home-service-grid">
        <article class="home-service-card">
          <span class="home-service-number" aria-hidden="true">01</span>
          <svg class="home-service-drawing" viewBox="0 0 240 120" fill="none" aria-hidden="true">
            <path d="m35 35 48-15 48 15 48-15v70l-48 15-48-15-48 15Z" fill="currentColor" opacity=".04"/>
            <path d="m35 35 48-15 48 15 48-15v70l-48 15-48-15-48 15Z" stroke="currentColor" opacity=".2"/>
            <path d="M83 20v70m48-55v70" stroke="currentColor" stroke-dasharray="4 5" opacity=".2"/>
            <ellipse cx="132" cy="83" rx="19" ry="5" fill="currentColor" opacity=".08"/>
            <path d="M132 77s22-20 22-36a22 22 0 0 0-44 0c0 16 22 36 22 36Z" fill="var(--r-surface,white)" stroke="currentColor" opacity=".65"/>
            <circle cx="132" cy="41" r="7" fill="currentColor"/>
          </svg>
          <div class="home-card-top"><span class="home-service-icon home-service-icon-location"><UiIcon name="location" /></span></div>
          <h3>내가 지날 길의 상태를 한눈에</h3>
          <p>지도에서 지하차도의 위치와 통제 여부를 확인하고,<br class="home-desktop-break" /> 이동할 구간의 상황을 살펴보세요.</p>
          <RouterLink to="/info/underpasses">지하차도 통제 현황 <span aria-hidden="true">↗</span></RouterLink>
        </article>
        <article class="home-service-card">
          <span class="home-service-number" aria-hidden="true">02</span>
          <svg class="home-service-drawing" viewBox="0 0 240 120" fill="none" aria-hidden="true"><circle cx="172" cy="60" r="48" stroke="currentColor" opacity=".12"/><circle cx="172" cy="60" r="33" stroke="currentColor" opacity=".2"/><circle cx="172" cy="60" r="18" stroke="currentColor" opacity=".3"/><circle cx="172" cy="60" r="5" fill="currentColor"/><path d="M10 60H139" stroke="currentColor" stroke-dasharray="5 7" opacity=".3"/></svg>
          <div class="home-card-top"><span class="home-service-icon home-service-icon-bell"><UiIcon name="bell" /></span></div>
          <h3>놓치지 말아야 할 안전 안내</h3>
          <p>공지사항과 이용 안내를 통해<br class="home-desktop-break" /> 서비스 이용에 필요한 정보를 확인하세요.</p>
          <RouterLink to="/info/notices">안전 안내 확인 <span aria-hidden="true">↗</span></RouterLink>
        </article>
      </div>
    </section>

    <section class="home-brand" aria-labelledby="home-brand-title">
      <div class="home-brand-copy"><h2 id="home-brand-title">당신의 길에,<br />안심을 더하다.</h2><p>다시는 ‘아무도 몰랐다’는 말이 없도록.<br />위험의 변화를 살피고, 필요한 안내를 전하겠습니다.</p>
        <ol class="home-brand-steps" aria-label="안전한 이동을 준비하는 과정">
          <li><span class="home-brand-step-icon" aria-hidden="true"><UiIcon name="map" /></span><div><strong>지나갈 길을 확인하고</strong><p>지도에서 지하차도의 상태를 살펴보세요.</p></div></li>
          <li><span class="home-brand-step-icon" aria-hidden="true"><UiIcon name="bell" /></span><div><strong>필요한 안내를 받아</strong><p>통제와 위험 알림을 확인하세요.</p></div></li>
          <li><span class="home-brand-step-icon" aria-hidden="true"><UiIcon name="route" /></span><div><strong>더 안전한 이동으로</strong><p>통제된 구간을 피해 이동을 준비하세요.</p></div></li>
        </ol>
        <RouterLink to="/info/company">ROUTEL 알아보기 <span aria-hidden="true">↗</span></RouterLink>
      </div>
      <div class="home-brand-art" aria-hidden="true">
        <svg viewBox="0 0 480 260" fill="none">
          <path :d="brandRoadPath" stroke="var(--road-edge)" stroke-width="42"/>
          <path :d="brandRoadPath" stroke="var(--road-surface)" stroke-width="32"/>
          <path class="home-road-lane" :d="brandRoadPath" stroke="var(--road-lane)" stroke-width="2" stroke-dasharray="9 10"/>
          <path class="home-road-light" :d="brandRoadPath" pathLength="1000" stroke="var(--road-light)" stroke-width="3" stroke-linecap="round" stroke-dasharray="65 935"/>
          <circle class="home-road-halo" cx="186" cy="144" r="38" fill="var(--road-node)" fill-opacity=".18"/>
          <circle class="home-road-node" cx="186" cy="144" r="17" fill="var(--road-node)"/>
          <circle cx="186" cy="144" r="6" fill="white"/>
          <circle class="home-road-halo home-road-halo-secondary" cx="361" cy="80" r="24" fill="var(--road-node)" fill-opacity=".22"/>
          <circle class="home-road-node home-road-node-secondary" cx="361" cy="80" r="8" fill="var(--road-node-secondary)"/>
          <circle class="home-road-traveller" r="4" fill="white">
            <animateMotion :path="brandRoadPath" dur="8s" repeatCount="indefinite" calcMode="paced"/>
          </circle>
        </svg>
        <span class="home-art-label home-art-label-one">길의 상태를 확인하고</span><span class="home-art-label home-art-label-two">더 안전한 일상으로</span>
      </div>
    </section>

    <section class="home-vision" aria-labelledby="home-vision-title">
      <header class="home-section-heading"><div><span class="home-section-index">02 / 앞으로의 여정</span><h2 id="home-vision-title">더 촘촘하게 연결될<br />내일의 도로 안전.</h2></div><p>정보의 기반에서 더 넓은 연결까지.<br />ROUTEL이 차근차근 만들어갈 변화입니다.</p></header>
      <ol class="home-roadmap" aria-label="연도별 추진 목표"><li v-for="(goal,index) in visionRoadmap" :key="goal.year" :style="{'--roadmap-index':index}"><div class="home-roadmap-top"><span class="home-roadmap-step">STEP {{String(index+1).padStart(2,'0')}}</span><span class="home-roadmap-arrow" aria-hidden="true">{{index===visionRoadmap.length-1?'↗':'→'}}</span></div><span class="home-roadmap-year">{{goal.year}}</span><h3>{{goal.title}}</h3><p>{{goal.description}}</p></li></ol>
    </section>
    <section class="home-closing"><div><span class="home-closing-eyebrow">안전한 이동의 시작</span><h2>출발하기 전,<br class="home-closing-break" /> 한 번 더 확인하세요.</h2><p>지금 지날 지하차도의 통제 현황을 확인해 보세요.</p></div><RouterLink id="home-underpass-cta" class="btn primary home-button home-button-primary" to="/info/underpasses">지하차도 현황 확인 <span aria-hidden="true">↗</span></RouterLink></section>
  </main>
</template>

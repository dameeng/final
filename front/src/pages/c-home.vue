<script setup lang="ts">
import {RouterLink} from "vue-router"
const visionRoadmap=[
  {
    year: '2026',
    title: '안전 정보의 기반을 다지겠습니다',
    description: '지하차도 통제 현황을 한곳에서 확인할 수 있는 기본 서비스를 구축하겠습니다.',
  },
  {
    year: '2027',
    title: '필요한 안내를 제때 전달하겠습니다',
    description: '관심 지역과 시설의 통제 정보를 확인하고 알림을 받을 수 있도록, 이용자 중심의 안내 기능을 고도화하겠습니다.',
  },
  {
    year: '2028',
    title: '위험 변화를 더 세심하게 살피겠습니다',
    description: '축적된 시설 데이터를 활용해 위험 분석의 정확도를 검증하고 개선하겠습니다.',
  },
  {
    year: '2030',
    title: '더 넓은 지역의 안전한 이동을 돕겠습니다',
    description: '서비스 적용 지역을 단계적으로 확대하고, 이용자와 시설 관리자를 연결하는 안전 정보 체계를 발전시키겠습니다.',
  },
]
</script>
<template>
  <main class="wire-page customer-content page-c-home">
    <div class="routel-home-story">

    <section class="routel-hero" aria-label="ROUTEL 교통안전 서비스 소개">
      <div class="routel-hero-stage">

        <div class="routel-hero-intro">
          <div class="routel-hero-intro-inner">
            <p class="routel-hero-eyebrow">지하차도 안전을 위한 기술, ROUTEL</p>
            <h1>안전한 도로,<br />안심할 수 있는 일상</h1>

          </div>
        </div>
        <div class="routel-hero-content">
          <div class="routel-hero-copy">
            <div class="routel-hero-heading">
              <p class="routel-hero-eyebrow">지하차도 안전을 위한 기술, ROUTEL</p>
              <h2><span>다시는 ‘아무도 몰랐다’는 말이 없도록.</span><span class="routel-hero-promise">물이 차오르기 전에, 먼저 알려드리겠습니다.</span></h2>
            </div>
            <p class="routel-hero-description">지하차도 통제 현황을 한곳에서 확인하고, 이동 전부터 이동 중까지, 안전한 길을 함께 확인하세요.</p>
            <div class="routel-hero-actions">
              <RouterLink to="/info/underpasses" class="routel-hero-button routel-hero-button-primary">지하차도 통제 현황</RouterLink>
              <RouterLink to="/info/business" class="routel-hero-button">서비스 소개</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="routel-services" aria-labelledby="routel-services-title">
      <div class="routel-services-intro">
        <p class="routel-services-eyebrow">ROUTEL의 역할</p>
        <h2 id="routel-services-title">도로의 상황을 살피고,<br />안전한 이동을 돕습니다.</h2>
        <p class="routel-services-summary">지하차도 통제 현황을 바탕으로, 이동 전부터 이동 중까지 필요한 안전 정보를 안내합니다.</p>
      </div>
      <ol class="routel-services-list" role="list">
        <li class="routel-services-item">
          <span class="routel-services-number" aria-hidden="true">01</span>
          <div>
            <h3>지하차도 통제 현황 확인</h3>
            <p>지도에서 지하차도의 위치와 통제 여부를 확인하고, 이동할 구간의 상황을 살펴보세요.</p><RouterLink to="/info/underpasses">자세히 보기 ↗</RouterLink>
          </div>
        </li>
        <li class="routel-services-item">
          <span class="routel-services-number" aria-hidden="true">02</span>
          <div>
            <h3>필요한 안전 안내 확인</h3>
            <p>공지사항과 이용 안내를 통해 서비스 이용에 필요한 정보를 확인하세요.</p><RouterLink to="/info/notices">자세히 보기 ↗</RouterLink>
          </div>
        </li>
      </ol>
    </section>
    </div>
    <section class="customer-brand-copy"><div><p>YOUR EVERYDAY, SAFELY CONNECTED</p><h2>당신의 길에,<br />안심을 더하다.</h2><RouterLink to="/info/company">ROUTEL 알아보기 ↗</RouterLink></div></section>
    <section class="routel-vision" aria-labelledby="routel-vision-title">
      <div class="routel-vision-inner">
        <header class="routel-vision-heading">
          <p class="routel-vision-eyebrow">ROUTEL VISION 2030</p>
          <h2 id="routel-vision-title">2030년까지,<br />더 촘촘한 지하차도 안전 정보 서비스를 만들어가겠습니다.</h2>
          <p class="routel-vision-description">정보 확인부터 위험 변화 파악과 신속한 안내까지,<br class="routel-vision-break" /> 안전한 이동을 돕는 서비스를 단계적으로 발전시키겠습니다.</p>
        </header>
        <ol class="routel-vision-roadmap" role="list" aria-label="연도별 추진 목표">
          <li v-for="goal in visionRoadmap" :key="goal.year" class="routel-vision-row">
            <span class="routel-vision-year">{{ goal.year }}</span>
            <div class="routel-vision-goal">
              <h3>{{ goal.title }}</h3>
              <p>{{ goal.description }}</p>
            </div>
          </li>
        </ol>

      </div>
    </section>
    <section class="customer-closing"><p>WITH YOU ON THE ROAD</p><h2>이동하는 모든 순간, 당신의 길을 함께합니다.</h2><RouterLink class="routel-hero-button routel-hero-button-primary" to="/info/underpasses">지하차도 통제 현황 확인 ↗</RouterLink></section>
  </main>
</template>

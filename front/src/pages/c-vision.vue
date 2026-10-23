<script setup lang="ts">
import '../styles/customer-information.css'
const visionRoadmap = [
  {
    year: '2026',
    title: '안전 정보의 기반을 다지겠습니다',
    description: '지하차도 통제 현황을 한곳에서 확인할 수 있는 기본 서비스를 구축하겠습니다.',
  },
  {
    year: '2027',
    title: '필요한 안내를 제때 전달하겠습니다',
    description:
      '관심 지역과 시설의 통제 정보를 확인하고 알림을 받을 수 있도록, 이용자 중심의 안내 기능을 고도화하겠습니다.',
  },
  {
    year: '2028',
    title: '위험 변화를 더 세심하게 살피겠습니다',
    description: '축적된 시설 데이터를 활용해 위험 분석의 정확도를 검증하고 개선하겠습니다.',
  },
  {
    year: '2030',
    title: '더 넓은 지역의 안전한 이동을 돕겠습니다',
    description:
      '서비스 적용 지역을 단계적으로 확대하고, 이용자와 시설 관리자를 연결하는 안전 정보 체계를 발전시키겠습니다.',
  },
]
</script>
<template>
  <main class="wire-page customer-content page-c-information page-c-vision">
    <header class="information-page-heading">
      <p class="routel-company-eyebrow">OUR NEXT CHAPTER</p>
      <h1>비전·로드맵</h1>
      <p>안전한 이동을 위한 연결, 한 단계씩 더 촘촘하게.</p>
    </header>
    <div class="vision-roadmap-note">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" /><path d="M12 11v6m0-10v.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
      <span>서비스 추진 목표이며 완료된 성과가 아닙니다.</span>
    </div>
    <ol class="information-roadmap" aria-label="연도별 추진 목표">
      <li v-for="(goal, index) in visionRoadmap" :key="goal.year" class="information-roadmap-row">
        <div class="information-roadmap-year"><strong>{{ goal.year }}</strong><span>STEP 0{{ index + 1 }}</span></div>
        <div class="information-roadmap-card">
          <h2>{{ goal.title }}</h2>
          <p>{{ goal.description }}</p>
        </div>
      </li>
    </ol>
  </main>
</template>

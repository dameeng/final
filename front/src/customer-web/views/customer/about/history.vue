<script setup lang="ts">
const milestones = [
  { date: '2026.08', title: '프로젝트 준비', description: '도로 안전과 이동 편의 개선을 위한 아이디어를 검토하고, 지하차도 침수 대응을 중심으로 서비스 방향을 정했습니다.', planned: false },
  { date: '2026.09', title: '서비스 설계', description: '고객과 관리자에게 필요한 기능을 정리하고, 화면 구성과 데이터 연결 방식을 설계했습니다. 지도 기반 현황 조회와 시설 관리 화면의 기본 구조를 준비했습니다.', planned: false },
  { date: '2026.10', title: '서비스 시범 운영 계획', description: '고객 화면과 관리 기능을 연결하고, 주요 이용 흐름과 정보 표시를 점검하는 시범 운영을 계획하고 있습니다.', planned: true },
  { date: '2026.10~', title: '앞으로의 계획', description: '지역별 데이터 연계를 넓히고, 사용자 의견을 바탕으로 조회 기능과 안내 내용을 개선해 나갈 예정입니다.', planned: true },
];
</script>
<template>
  <main class="routel-history">
    <header class="routel-history-heading">
      <p class="routel-history-eyebrow">ROUTEL HISTORY</p>
      <h1>연혁</h1>
      <p>ROUTEL의 준비 과정과 앞으로의 계획을 소개합니다.</p>
    </header>
    <ol class="routel-history-timeline" role="list" aria-label="ROUTEL 연혁과 추진 계획">
      <li v-for="milestone in milestones" :key="milestone.date" class="routel-history-step" :class="{ 'is-planned': milestone.planned }">
        <span class="routel-history-date">{{ milestone.date }}</span>
        <div class="routel-history-copy">
          <span v-if="milestone.planned" class="routel-history-status">추진 계획</span>
          <h2>{{ milestone.title }}</h2>
          <p>{{ milestone.description }}</p>
        </div>
      </li>
    </ol>
  </main>
</template>
<style scoped src="../../../styles/views/customer/about/history.css"></style>

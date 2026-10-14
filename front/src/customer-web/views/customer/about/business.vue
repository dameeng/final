<script setup lang="ts">
const roadmap = [
  { stage: "plan", tag: "구상", title: "문제 인식", text: "운전자가 지하차도 침수 위험을 진입 전에 알기 어렵다는 문제에서 출발했습니다." },
  { stage: "plan", tag: "구상", title: "핵심 기능 정의", text: "예측 기반 메인 알림과 ROI 기반 최후 확인 알림으로 사전알림을 구성했습니다." },
  { stage: "plan", tag: "구상", title: "범위 설정", text: "도 단위 약 20개소로 좁히고, 번호판 인식으로 실제 접근 차량에만 알립니다." },
  { stage: "now", tag: "현재", title: "1차 개발", text: "침수 예측, 고객 서비스, 관리자 통제 화면을 구현했습니다.", chips: ["번호판 인식", "위험도 예측", "관리자 통제", "고객 알림"] },
  { stage: "next", tag: "예정", title: "2차 개발", text: "사고를 미리 줄이고, 발생 시 빠르게 알리는 기능을 더합니다.", chips: ["예지보전", "사고 시 문자 알림", "긴급 연락처"] },
  { stage: "future", tag: "방향 제시", title: "확장", text: "검증된 구조를 더 넓은 범위로 넓혀 갑니다.", chips: ["기상 실연동", "대상 지역 확대", "타 도로시설 적용"] },
];
</script>

<template>
  <main class="routel-content-page">
    <h1>사업 설명</h1>
    <div class="business-roadmap" aria-label="사업 추진 과정">
      <ol>
        <li v-for="(step, index) in roadmap" :key="step.title" :class="`is-${step.stage}`">
          <span class="business-roadmap-dot" aria-hidden="true">{{ index + 1 }}</span>
          <div class="business-roadmap-card">
            <div class="business-roadmap-head"><strong>{{ step.title }}</strong><span>{{ step.tag }}</span></div>
            <p>{{ step.text }}</p>
            <div v-if="step.chips" class="business-roadmap-chips"><span v-for="chip in step.chips" :key="chip">{{ chip }}</span></div>
          </div>
        </li>
      </ol>
    </div>
  </main>
</template>

<style scoped src="../../../styles/views/customer/about/business.css"></style>

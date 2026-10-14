<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
<template>
  <main class="routel-content-page">
    <h1>앱 상세 기능 설명</h1>
    <div class="app-features-div">
      <section>
        <h2>현황 조회</h2>
        <p>관심 지하차도의 상태와 통제 여부를 확인합니다.</p>
      </section>
      <section>
        <h2>알림 수신</h2>
        <p>관심 구간과 차량 관련 알림을 수신하고 알림함에서 확인합니다.</p>
      </section>
      <section>
        <h2>내 차량</h2>
        <p>본인 확인된 차량의 현황을 확인합니다.</p>
      </section>
      <section>
        <h2>설치 안내</h2>
        <p>설치 페이지에서 앱 배포 여부와 설치 방법을 확인할 수 있습니다.</p>
        <RouterLink to="/info/app-download">앱 설치 페이지로 이동</RouterLink>
      </section>
    </div>
  </main>
</template>

<style
  scoped
  src="../../../styles/views/customer/app/app-features.css"
></style>

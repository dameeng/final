<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
<template>
  <footer class="customer-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <RouterLink to="/" class="footer-logo">ROUTEL</RouterLink>
        <p>당신의 길에, 안심을 더하다.</p>
      </div>
      <nav aria-label="회사 안내" class="footer-links">
        <RouterLink to="/info/company">회사소개</RouterLink
        ><RouterLink to="/info/business">사업설명</RouterLink
        ><RouterLink to="/info/vision">우리의 비전</RouterLink
        ><RouterLink to="/info/directions">오시는 길</RouterLink
        ><RouterLink :to="{ name: 'customer-its' }">연계 사이트</RouterLink>
      </nav>
      <nav aria-label="고객 안내" class="footer-links">
        <a href="/app/">고객 앱</a>
        <a href="/manager/">관리자</a>
        <RouterLink to="/info/notices">공지사항</RouterLink
        ><RouterLink to="/info/faq">자주 묻는 질문</RouterLink
        ><RouterLink to="/info/underpasses">지하차도 통제 현황</RouterLink>
      </nav>
    </div>
    <div class="footer-bottom">
      <div>
        <p>ROUTEL 프로젝트팀 <span>운영 담당: 서비스 운영팀</span></p>
        <p>
          ROUTEL 스마트모빌리티센터 3층 프로젝트실 (가상 장소·프로젝트 예시) · 문의:
          contact@routel.example.com
        </p>
      </div>
      <p class="footer-copyright">
        © {{ new Date().getFullYear() }} ROUTEL PROJECT.
      </p>
    </div>
  </footer>
</template>
<style
  scoped
  src="../../styles/components/customer/customer-footer.css"
></style>

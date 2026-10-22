<script setup lang="ts">
import '../styles/index.css'
import { adminSections } from '../data/adminNavigation'
</script>
<template>
  <main class="wire-page page-index">
    <header class="index-head"
      ><div
        ><p>ROUTEL · 관리자</p><h1>관리자 페이지 바로가기</h1
        ><span>관리자 화면을 선택해 이동하세요.</span></div
      ><RouterLink class="dashboard-link" to="/admin-dashboard">대시보드 열기 →</RouterLink></header
    >
    <section class="admin-grid" aria-label="관리자 메뉴">
      <article v-for="section in adminSections" :key="section.title" class="admin-section"
        ><h2>{{ section.title }}</h2
        ><nav
          ><RouterLink v-for="link in section.links" :key="link[1]" :to="link[1]"
            >{{ link[0] }}<span aria-hidden="true">→</span></RouterLink
          ></nav
        ></article
      >
    </section>
  </main>
</template>
<style scoped src="../styles/pages/index.css"></style>

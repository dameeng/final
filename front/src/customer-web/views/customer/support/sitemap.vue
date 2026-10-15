<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
const router = useRouter();
const groups = [
  "About us",
  "지하차도 통제 현황",
  "알림마당",
  "연계 사이트",
].map((title) => ({
  title,
  links: router
    .getRoutes()
    .filter((r) => r.meta.headerTitle === title && !r.path.includes(":"))
    .sort(
      (a, b) => Number(a.meta.menuOrder || 0) - Number(b.meta.menuOrder || 0),
    ),
}));
</script>
<template>
  <main class="routel-content-page">
    <h1>사이트맵</h1>
    <div class="sitemap-grid">
      <section v-for="group in groups" :key="group.title">
        <h2>{{ group.title }}</h2>
        <ul>
          <li v-for="link in group.links" :key="link.path">
            <RouterLink :to="link.path">{{ link.meta.title }} </RouterLink>
          </li>
        </ul>
      </section>
      <section>
        <h2>회원 메뉴</h2>
        <ul>
          <li><RouterLink to="/login">로그인</RouterLink></li>
          <li><RouterLink to="/signup">회원가입</RouterLink></li>
        </ul>
      </section>
    </div>
  </main>
</template>
<style
  scoped
  src="../../../styles/views/customer/support/sitemap.css"
></style>

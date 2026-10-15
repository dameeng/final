<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import CustomerHeader from "../components/customer/customer-header.vue";
import CustomerFooter from "../components/customer/customer-footer.vue";
import WaterBackground from "../components/customer/water-background.vue";
import { waterMotionKey } from "../composables/use-water-motion";
import "../styles/customer-water.css";
import "../styles/customer-refinements.css";
import "../styles/review-oct04.css";
import "../styles/customer-readability.css";
const paused = ref(false);
try { paused.value = localStorage.getItem('routel-customer-water-paused') === 'true'; } catch { /* Storage may be unavailable. */ }
provide(waterMotionKey, paused);
watch(paused, value => { try { localStorage.setItem('routel-customer-water-paused', String(value)); } catch { /* Keep the current session setting. */ } });
const route = useRoute(),
  router = useRouter();
const title = computed(() =>
  typeof route.meta.headerTitle === "string" ? route.meta.headerTitle : "",
);
const isAccount = computed(() => ["customer-login", "customer-signup", "customer-mypage"].includes(String(route.name)));
const isHome = computed(() => route.name === "customer-home");
const links = computed(() =>
  title.value
    ? router
        .getRoutes()
        .filter(
          (r) => r.meta.headerTitle === title.value && !r.path.includes(":"),
        )
        .sort(
          (a, b) =>
            Number(a.meta.menuOrder || 0) - Number(b.meta.menuOrder || 0),
        )
    : [],
);
</script>
<template>
  <div class="customer-shell customer-water" :class="{ 'customer-account-layout': isAccount }">
    <WaterBackground :paused="paused" />
    <a class="skip-link" href="#customer-main-content">본문으로 건너뛰기</a>
    <CustomerHeader />
    <div class="customer-content" :class="{ 'is-home': isHome }">
      <nav v-if="!isHome" class="customer-breadcrumb" aria-label="현재 위치">
        <RouterLink to="/">홈</RouterLink><span aria-hidden="true">/</span>
        <span v-if="title">{{ title }}</span><span v-if="title" aria-hidden="true">/</span>
        <span aria-current="page">{{ route.meta.title }}</span>
      </nav>
      <div class="customer-follow-layout" :class="{ 'has-sidebar': links.length }">
      <aside v-if="links.length" class="customer-follow-sidebar">
      <h2>{{ title }}</h2>
      <nav aria-label="고객 세부 메뉴" class="customer-follow-links">
        <RouterLink v-for="link in links" :key="link.path" :to="link.path">{{ link.meta.title }}</RouterLink>
      </nav>
      </aside>
      <div :key="route.path" id="customer-main-content" class="customer-main" :class="{ 'customer-page': !isHome, 'customer-page-frame': !isHome && !isAccount }" :tabindex="!isHome ? 0 : undefined" :aria-label="!isHome ? String(route.meta.title) + ' 본문' : undefined">
        <RouterView />
      </div>
      </div>
    </div>
    <CustomerFooter />
  </div>
</template>
<style scoped src="../styles/layouts/customer-layout.css"></style>

<script setup lang="ts">
import AppIcon from "./app-icon.vue";
import ThemeSwitch from "../../shared/components/ThemeSwitch.vue";
import { ref, watch, nextTick, onBeforeUnmount } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useApp } from "../composables/use-app";
import { api } from "../services/api";

import mascot from '../../shared/assets/images/routel-header-mascot.png';
import AlertPreview from "./alert-preview.vue";
const { state } = useApp();
const route = useRoute(), router = useRouter();
const panel = ref<"menu" | "alerts" | null>(null);
const busy = ref(false), message = ref("");
const logoUrl = import.meta.env.VITE_APP_LOGO_URL || mascot;
const logoFailed = ref(false);
const dialog = ref<HTMLDialogElement | null>(null);
let previousOverflow = '';
watch(panel, async value => {
  await nextTick();
  if (value && dialog.value && !dialog.value.open) {
    previousOverflow = document.body.style.overflow;
    dialog.value.showModal();
    document.body.style.overflow = 'hidden';
  } else if (!value && dialog.value?.open) {
    dialog.value.close();
    document.body.style.overflow = previousOverflow;
  }
});
onBeforeUnmount(() => { if (dialog.value?.open) document.body.style.overflow = previousOverflow; });
function toggle(value: "menu" | "alerts") {
  panel.value = panel.value === value ? null : value;
}
watch(() => route.fullPath, () => { panel.value = null; message.value = ""; });
watch(() => [state.demo, state.user], () => { panel.value = null; });
async function logout() {
  busy.value = true;
  message.value = "";
  try {
    if (!state.demo) { await api.logout(); }
    state.user = null;
    state.favorites = [];
    state.readIds = [];
    panel.value = null;
    await router.push("/");
  } catch (e) { message.value = (e as Error).message; }
  finally { busy.value = false; }
}
</script>
<template>
  <header class="app-header">
    <button class="menu-toggle" type="button" aria-label="전체 메뉴 열기" :aria-expanded="panel === 'menu'" aria-controls="app-overlay" @click="toggle('menu')"><AppIcon name="menu" /></button>
    <RouterLink class="app-brand" to="/" aria-label="ROUTEL 홈"><img v-if="!logoFailed" class="app-logo" :src="logoUrl" alt="" @error="logoFailed = true" /><strong>ROUTEL</strong></RouterLink>
    <div class="header-actions">
      <RouterLink v-if="!state.user" to="/login">로그인</RouterLink>
      <button type="button" aria-label="알림함 열기" :aria-expanded="panel === 'alerts'" aria-controls="app-overlay" @click="toggle('alerts')"><AppIcon name="bell" /></button>
    </div>
  </header>
  <dialog ref="dialog" id="app-overlay" class="app-overlay" aria-labelledby="overlay-title" @cancel.prevent="panel = null" @click="($event.target === dialog) && (panel = null)">
    <div class="overlay-inner">
      <div class="overlay-heading"><div><span class="eyebrow">ROUTEL</span><h2 id="overlay-title">{{ panel === 'menu' ? '전체 메뉴' : '최근 알림' }}</h2></div><button autofocus type="button" aria-label="패널 닫기" @click="panel = null"><AppIcon name="close" /></button></div>
      <template v-if="panel === 'menu'">
        <div class="menu-account"><AppIcon name="user" /><div><strong>{{ state.user ? state.user.name + '님' : '안전한 이동의 시작' }}</strong><p>{{ state.user ? '오늘도 안전하게 이동하세요.' : '로그인하고 나의 알림을 확인하세요.' }}</p></div></div>
        <nav class="menu-grid" aria-label="앱 전체 메뉴">
          <RouterLink to="/"><AppIcon name="home" />홈</RouterLink>
          <RouterLink to="/underpasses"><AppIcon name="map" />지하차도 현황</RouterLink>
          <RouterLink to="/navigation"><AppIcon name="map" />목적지 검색</RouterLink>
          <RouterLink to="/weather"><AppIcon name="weather" />날씨</RouterLink>
          <RouterLink to="/notifications"><AppIcon name="bell" />알림마당</RouterLink>
          <RouterLink to="/mypage"><AppIcon name="user" />마이페이지</RouterLink>
        </nav>
        <nav class="menu-secondary" aria-label="이용 정보"><RouterLink to="/notices">공지사항</RouterLink><RouterLink to="/help">이용 안내</RouterLink><a href="/">고객 웹</a></nav>
        <div class="menu-preferences"><ThemeSwitch storage-key="routel-app-theme"/><button v-if="state.user" :disabled="busy" @click="logout">로그아웃</button><nav v-else class="menu-auth-links" aria-label="계정 메뉴"><RouterLink to="/login">로그인</RouterLink><RouterLink to="/signup">회원가입</RouterLink></nav></div>
      </template>
      <AlertPreview v-else />
      <p v-if="message" role="alert">{{ message }}</p>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import PageBack from "../shared/components/PageBack.vue"
import { provide, onMounted, onBeforeUnmount, ref } from "vue";
import { RouterView, RouterLink } from "vue-router";
import { appKey, createAppState } from "./composables/use-app";
import { useLive } from "./composables/use-live";
import {usePersonalAlerts} from './composables/use-personal-alerts';
import PersonalAlertDialog from './components/personal-alert-dialog.vue';
import './styles/notifications.css';
import LiveAlerts from "./components/live-alerts.vue";
import AppIcon from "./components/app-icon.vue";
import AppHeader from "./components/app-header.vue";
const app = createAppState();
provide(appKey, app);
const { demoEvent } = useLive(app);
usePersonalAlerts(app);
let clock: ReturnType<typeof setInterval>;

const installEvent = ref<any>(null);
const message = ref("");
function sessionExpired(){app.state.user=null;app.state.favorites=[];app.state.personalAlerts=[];app.state.personalBanners=[]}
function connection() {
  app.state.online = navigator.onLine;
}
function installAvailable(e: Event) {
  e.preventDefault();
  installEvent.value = e;
}
async function install() {
  if (!installEvent.value) return;
  await installEvent.value.prompt();
  const choice = await installEvent.value.userChoice;
  message.value =
    choice.outcome === "accepted"
      ? "설치 요청을 완료했습니다."
      : "설치를 취소했습니다.";
  installEvent.value = null;
}
function mode() {
  app.setDemo(!app.state.demo);
  void app.restore();
}
onMounted(() => {
  clock = setInterval(() => {
    app.state.now = Date.now();
  }, 30000);
  void app.restore();
  window.addEventListener('routel-app-session-expired',sessionExpired);
  window.addEventListener("online", connection);
  window.addEventListener("offline", connection);
  window.addEventListener("beforeinstallprompt", installAvailable);
});
onBeforeUnmount(() => {
  clearInterval(clock);
  window.removeEventListener('routel-app-session-expired',sessionExpired);
  window.removeEventListener("online", connection);
  window.removeEventListener("offline", connection);
  window.removeEventListener("beforeinstallprompt", installAvailable);
});
</script>
<template>
  <div class="app-shell">
    <AppHeader />
    <LiveAlerts />
    <PersonalAlertDialog />
    <p v-if="app.state.demo" class="app-status" role="status">
      시연 모드 · 시설 상태·날씨·알림은 예시입니다.
    </p>
    <p v-if="!app.state.online" class="app-status" role="alert">
      인터넷 연결이 끊겼습니다. 최신 통제 상태는 확인할 수 없습니다.
    </p>
    <PageBack v-if="$route.path !== '/'" area="app" class="routel-page-back--app" />
    <RouterView :key="String(app.state.demo) + $route.fullPath" />
    <nav class="app-bottom-nav" aria-label="주요 메뉴">
      <RouterLink to="/"><AppIcon name="home"/><span>홈</span></RouterLink>
      <RouterLink to="/underpasses"><AppIcon name="map"/><span>현황</span></RouterLink>
      <RouterLink to="/notifications"><AppIcon name="bell"/><span>알림</span></RouterLink>
      <RouterLink to="/mypage"><AppIcon name="user"/><span>마이</span></RouterLink>
    </nav>
    <footer class="app-footer">
      <details>
        <summary>앱 설정</summary>
        <p>{{ app.state.demo ? "시연 모드" : "서비스 연결 모드" }}</p>
        <button type="button" @click="mode">
          {{ app.state.demo ? "서비스 연결 모드로 전환" : "시연 모드로 둘러보기" }}
        </button>
        <template v-if="app.state.demo">
          <p>아래 버튼은 이 기기의 화면 알림만 확인합니다. 다른 휴대폰에 전송되지 않습니다.</p>
          <button type="button" @click="demoEvent(true)">침수 화면 알림 테스트</button>
          <button type="button" @click="demoEvent(false)">통제 해제 테스트</button>
        </template>
        <button v-if="installEvent" @click="install">앱 설치</button>
        <p v-if="message" role="status">{{ message }}</p>
      </details>
    </footer>
  </div>
</template>

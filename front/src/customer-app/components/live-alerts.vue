<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
import { enablePush, disablePush, pushAvailable } from "../services/push";
const { state } = useApp();
const busy = ref(false), message = ref("");
async function push(on: boolean) {
  busy.value = true; message.value = "";
  try {
    if (on) await enablePush(); else await disablePush();
    message.value = on ? "이 기기의 공용 위험 알림 구독을 등록했습니다." : "이 기기의 공용 위험 알림 구독을 해제했습니다.";
  } catch (e) { message.value = (e as Error).message; }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="live-alerts" aria-label="위험 알림">
    <p class="live-connection" role="status">{{ state.liveStatus }}</p>
    <details>
      <summary>알림 설정 · 연결 상태</summary>
      <p>이 페이지를 열어 두면 화면 안에서 위험 알림을 받습니다.</p>
      <p v-if="state.liveError" role="status">{{ state.liveError }}</p>
      <p v-if="state.liveUpdatedAt">마지막 수신: {{ new Date(state.liveUpdatedAt).toLocaleTimeString('ko-KR') }}</p>
      <p>휴대폰 알림창에서도 받으려면 아래 버튼으로 허용해 주세요. 아이폰은 Safari에서 홈 화면에 추가한 뒤 홈 화면 아이콘으로 실행해 주세요.</p>
      <button :disabled="busy || state.demo || !pushAvailable" @click="push(true)">휴대폰 알림 받기</button>
      <button :disabled="busy || state.demo || !pushAvailable" @click="push(false)">휴대폰 알림 해제</button>
      <p v-if="!pushAvailable">푸시 구독 API가 아직 없어 휴대폰 알림은 사용할 수 없습니다.</p>
      <p v-if="state.demo">시연 모드에서는 실제 푸시를 보내지 않습니다.</p>
      <p v-if="message" role="status">{{ message }}</p>
    </details>
    <div aria-live="assertive" aria-atomic="true">
      <article v-if="state.banners[0]" class="risk-banner">
        <strong>{{ state.banners[0].title }}</strong>
        <p>{{ state.banners[0].content }}</p>
        <RouterLink v-if="state.banners[0].underpassId"
          :to="'/underpasses/' + encodeURIComponent(state.banners[0].underpassId)">해당 지하차도 확인</RouterLink>
        <button @click="state.banners.shift()">확인 · 닫기</button>
        <span v-if="state.banners.length > 1">남은 알림 {{ state.banners.length - 1 }}개</span>
      </article>
    </div>
  </section>
</template>
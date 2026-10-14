<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import { facilities } from "../services/demo";
import { enablePush, disablePush, pushAvailable } from "../services/push";
import LoadState from "../components/load-state.vue";
const { state, favorite } = useApp(),
  router = useRouter(),
  message = ref(""),
  busy = ref(false);
const { data, loading, error, reload } = useLoad(async () =>
  state.demo ? facilities : state.user ? api.facilities() : [],
);
watch(() => state.user, reload);
const rows = computed(() =>
  (data.value || []).filter((x) => state.favorites.includes(x.id)),
);
async function action(task: () => Promise<void>, success: string) {
  busy.value = true;
  message.value = "";
  try {
    await task();
    message.value = success;
  } catch (e) {
    message.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function logout() {
  if (!state.demo) {
    
    await api.logout();
  }
  state.user = null;
  state.favorites = [];
  await router.push("/");
}
</script>
<template>
  <main>
    <h1>마이페이지</h1>
    <template v-if="state.user"
      ><p>{{ state.user.name }} · {{ state.user.email }}</p>
      <button :disabled="busy" @click="action(logout, '로그아웃했습니다.')">
        로그아웃
      </button></template
    >
    <p v-else>
      <RouterLink to="/login">로그인</RouterLink> 후 내 정보를 확인할 수
      있습니다.
    </p>
    <h2>관심 지하차도</h2>
    <p>관심 목록은 서버 API가 없어 이 기기에만 저장됩니다.</p>
    <LoadState :loading="loading" :error="error" @retry="reload" />
    <ul>
      <li v-for="f in rows" :key="f.id">
        <RouterLink :to="'/underpasses/' + encodeURIComponent(f.id)">{{
          f.name
        }}</RouterLink>
        <button
          :disabled="busy"
          @click="action(() => favorite(f.id), '관심 등록을 해제했습니다.')"
        >
          관심 해제
        </button>
      </li>
    </ul>
    <p v-if="!rows.length">등록한 관심 지하차도가 없습니다.</p>
    <RouterLink to="/underpasses">지하차도 찾아보기</RouterLink>
    <h2>휴대폰 푸시 알림</h2>
    <p v-if="state.demo">
      시연 모드의 알림함은 예시입니다. 실제 휴대폰 알림은 전송하지 않습니다.
    </p>
    <template v-else
      ><p>공용 위험 알림은 로그인 없이도 알림 서비스 연결 후 이용할 수 있습니다.</p>
      <p v-if="!pushAvailable">푸시 구독 API가 아직 없어 휴대폰 알림은 사용할 수 없습니다.</p>
      <button
        :disabled="busy || !pushAvailable"
        @click="action(enablePush, '푸시 알림 구독을 등록했습니다.')"
      >
        알림 받기</button
      ><button
        :disabled="busy || !pushAvailable"
        @click="action(disablePush, '푸시 알림 구독을 해제했습니다.')"
      >
        알림 해제
      </button></template
    >
    <p role="status">{{ message }}</p>
  </main>
</template>
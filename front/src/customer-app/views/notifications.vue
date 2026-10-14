<script setup lang="ts">
import { computed, ref } from "vue";
import { useApp } from "../composables/use-app";
import { alerts } from "../services/demo";
import NotificationContent from '../components/notification-content.vue';
const { state } = useApp();
const unread = ref(false),
  message = ref("");
const loading=computed(()=>state.personalLoading),error=computed(()=>state.personalError)
const data=computed(()=>state.demo?structuredClone(alerts).map(x=>({...x,read:state.readIds.includes(x.id)})):state.personalAlerts)
const rows = computed(() =>
  (data.value || []).filter((x) => !unread.value || !x.read),
);
async function read(id: string) {
  try {
    // 읽음 처리: api 없음 (읽음 PATCH 엔드포인트가 없고 MyAlertItem에 read 필드도 없음).
    // 실제 알림은 readSupported가 false라 버튼이 보이지 않으며, 시연 모드에서만 이 기기에 기록합니다.
    if (!state.demo) throw new Error("읽음 처리 API가 아직 없습니다.");
    state.readIds.push(id);
    const row = data.value?.find((x) => x.id === id);
    if (row) row.read = true;
  } catch (e) {
    message.value = (e as Error).message;
  }
}
</script>
<template>
  <main>
    <h1>알림함</h1>
    <h2>개인 알림</h2>
    <p v-if="!state.user && !state.demo">개인 알림은 로그인 후 확인할 수 있습니다.</p>
    <label v-if="rows.some(x=>x.readSupported)"><input v-model="unread" type="checkbox" />읽지 않은 알림만</label><p v-if="loading" role="status">알림 확인 중…</p><p v-if="error" role="alert">{{ error }} · 잠시 후 다시 확인합니다.<span v-if="rows.length"> 현재 목록은 이전 수신 자료입니다.</span></p>
    <p v-if="message" role="alert">{{ message }}</p>
    <p v-if="!loading && !error && !rows.length">표시할 알림이 없습니다.</p>
    <article v-for="row in rows" :key="row.id">
      <NotificationContent :alert="row" />
      <button v-if="row.readSupported && !row.read" @click="read(row.id)">읽음 처리</button>

    </article>
  </main>
</template>
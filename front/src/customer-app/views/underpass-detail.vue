<script setup lang="ts">
import { watch, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import { facilities } from "../services/demo";
import { status, time } from "../services/format";
import LoadState from "../components/load-state.vue";
const { state, favorite } = useApp(),
  route = useRoute(),
  message = ref("");
const id = String(route.params.id);
const { data, loading, error, reload } = useLoad(async () => {
  const live = state.liveFacilities?.find((x) => x.id === id);
  if (live) return live;
  if (!state.demo) return api.facility(id);
  const row = facilities.find((x) => x.id === id);
  if (!row) throw Error("지하차도를 찾을 수 없습니다.");
  return row;
});
async function toggle() {
  try {
    await favorite(id);
    message.value = state.favorites.includes(id)
      ? "관심 목록에 등록했습니다."
      : "관심 등록을 해제했습니다.";
  } catch (e) {
    message.value = (e as Error).message;
  }
}
watch(() => state.liveRevision, reload);
</script>
<template>
  <main>
    <h1>지하차도 상세</h1>
    <LoadState :loading="loading" :error="error" @retry="reload" />
    <section v-if="data">
      <h2>{{ data.name }}</h2>
      <dl>
        <dt>위치</dt>
        <dd>{{ data.address }}</dd>
        <dt>통제 상태</dt>
        <dd>{{ status(data, state.demo, state.now) }}</dd>
        <dt>관측 수위</dt>
        <dd>
          {{ data.waterLevel === null ? "미수신" : data.waterLevel + " cm" }}
        </dd>
        <dt>기준 시각</dt>
        <dd>{{ time(data.updatedAt) }}</dd>
      </dl>
      <button @click="toggle">
        {{ state.favorites.includes(id) ? "관심 해제" : "관심 등록" }}</button
      ><button @click="reload">새로고침</button>
    </section>
    <p role="status">{{ message }}</p>
    <RouterLink to="/underpasses">현황 목록으로</RouterLink>
  </main>
</template>

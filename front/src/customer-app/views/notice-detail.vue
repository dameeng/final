<script setup lang="ts">
import { useRoute, RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import { notices } from "../services/demo";
import { time } from "../services/format";
import LoadState from "../components/load-state.vue";
const { state } = useApp(),
  route = useRoute();
const { data, loading, error, reload } = useLoad(async () => {
  const list = state.demo ? notices : await api.notices();
  const row = list.find((x) => x.id === route.params.id);
  if (!row) throw Error("공지사항을 찾을 수 없습니다.");
  return row;
});
</script>
<template>
  <main>
    <h1>공지 상세</h1>
    <LoadState :loading="loading" :error="error" @retry="reload" />
    <article v-if="data">
      <h2>{{ data.title }}</h2>
      <p>{{ time(data.createdAt) }}</p>
      <p v-for="(line, i) in data.content.split('\n')" :key="i">{{ line }}</p>
    </article>
    <RouterLink to="/notices">공지 목록으로</RouterLink>
  </main>
</template>

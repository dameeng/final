<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import { notices } from "../services/demo";
import { time } from "../services/format";
import LoadState from "../components/load-state.vue";
const { state } = useApp();
const query = ref("");
const { data, loading, error, reload } = useLoad(async () =>
  state.demo ? notices : api.notices(),
);
// 공지 목록 응답에는 본문(content)이 없어서 제목으로만 검색됩니다.
const rows = computed(() =>
  (data.value || []).filter((x) =>
    x.title.includes(query.value),
  ).sort((a, b) => Number(b.important === true) - Number(a.important === true) || b.createdAt.localeCompare(a.createdAt)),
);
</script>
<template>
  <main>
    <h1>공지사항</h1>
    <label>공지 제목 검색 <input v-model="query" type="search" /></label
    ><LoadState :loading="loading" :error="error" @retry="reload" />
    <ul>
      <li v-for="n in rows" :key="n.id">
        <span v-if="n.important" aria-label="중요 공지">중요 · </span><RouterLink :to="'/notices/' + encodeURIComponent(n.id)">{{
          n.title
        }}</RouterLink>
        · {{ time(n.createdAt) }}
      </li>
    </ul>
    <p v-if="!loading && !error && !rows.length">조회 결과가 없습니다.</p>
  </main>
</template>
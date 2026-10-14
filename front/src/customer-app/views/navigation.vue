<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import { facilities } from "../services/demo";
import KakaoMap from "../components/kakao-map.vue";
import LoadState from "../components/load-state.vue";
const { state } = useApp();
const router = useRouter();
const { data, loading, error, reload } = useLoad(async () =>
  state.liveFacilities ?? (state.demo ? structuredClone(facilities) : await api.facilities()),
);
watch(() => state.liveRevision, reload);
</script>
<template>
  <main class="navigation-page">
    <p class="navigation-banner">현장 통제와 안내를 우선 확인하세요.</p>
    <section class="navigation-area" aria-label="네비게이션 영역">
      <h1>네비게이션</h1>
      <KakaoMap :facilities="data || []"
        @select="(id) => router.push('/underpasses/' + encodeURIComponent(id))" />
      <p>목적지 위치를 확인할 수 있습니다. 경로 안내는 아직 연결되지 않았습니다.</p>
    </section>
    <LoadState :loading="loading" :error="error" @retry="reload" />
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useApp } from "../composables/use-app";
const { state } = useApp();
</script>
<template>
  <section aria-label="최근 공용 알림">
    <RouterLink to="/notifications">알림함</RouterLink>
    <ul><li v-for="row in state.publicAlerts.slice(0, 3)" :key="row.id">
      <RouterLink :to="row.underpassId ? '/underpasses/' + encodeURIComponent(row.underpassId) : '/notifications'">{{ row.title }}</RouterLink>
    </li></ul>
    <p v-if="!state.publicAlerts.length">수신한 공용 알림이 없습니다.</p>
  </section>
</template>

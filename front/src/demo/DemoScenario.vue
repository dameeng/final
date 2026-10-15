<script setup lang="ts">
import { ref } from 'vue'
import AlertScenario from './AlertScenario.vue'
import TransitScenario from './TransitScenario.vue'

const tab = ref<'alert' | 'transit'>('alert')
</script>

<template>
  <div class="demo-shell">
    <nav class="demo-tabbar">
      <button type="button" :class="{ active: tab === 'alert' }" @click="tab = 'alert'">접근 → 차단 → ROI 알림</button>
      <button type="button" :class="{ active: tab === 'transit' }" @click="tab = 'transit'">입출구 통과기록</button>
    </nav>
    <AlertScenario v-if="tab === 'alert'" />
    <TransitScenario v-else />
  </div>
</template>

<style scoped>
.demo-shell { min-height: 100vh; background: #f5f7fa; }
.demo-tabbar {
  display: flex; gap: 8px; padding: 14px 32px 0; background: #f5f7fa;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
}
.demo-tabbar button {
  border: none; background: #e5e9f0; color: #6b7280; padding: 10px 18px; border-radius: 10px 10px 0 0;
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.demo-tabbar button.active { background: #ffffff; color: #1f2937; }
</style>
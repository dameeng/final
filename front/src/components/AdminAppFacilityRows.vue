<script setup lang="ts">
import RiskLevelBadge from './RiskLevelBadge.vue'
defineProps<{ items: Record<string, any>[] }>()
</script>
<template>
  <div class="app-facility-rows">
    <RouterLink v-for="row in items" :key="row.id" :to="'/admin-app/screen-5?id='+row.id">
      <div class="g">
        <b>{{row.name}}</b>
        <small>
          {{row.currentStatus==='BLOCKED'?'통제 중':'정상 운영'}} · 차량 {{row.remainingCount??'—'}}대</small>
      </div>
      <RiskLevelBadge :value="row.currentStatus==='BLOCKED'?'BLOCKED':row.currentRiskLevel" />
    </RouterLink>
    <p v-if="!items.length">조회 조건에 맞는 시설이 없습니다.</p>
  </div>
</template>
<style scoped>
.app-facility-rows :deep(.risk-level-badge) { min-width:38px; box-sizing:border-box; font-size:13px; }
</style>

<script setup lang="ts">
withDefaults(defineProps<{ count: number; unit?: string }>(), { unit: '건' })
</script>
<template>
  <div class="list-result-count" role="status">
    <span>총 <strong>{{ count.toLocaleString('ko-KR') }}</strong>{{ unit }}</span>
    <span v-if="$slots.default" class="list-result-context"><slot /></span>
  </div>
</template>
<style scoped>
#app .list-result-count {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;
  gap:6px 16px; width:100%; min-width:0; box-sizing:border-box;
  margin:0 0 12px; padding:0; color:var(--r-muted); font-size:12px; line-height:20px;
  text-align:left;
}
#app .list-result-count strong { color:var(--r-ink); font-size:12px; font-weight:650; font-variant-numeric:tabular-nums; }
.list-result-context { font-size:11px; }
</style>

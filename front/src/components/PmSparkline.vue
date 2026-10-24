<script setup lang="ts">
// 예지보전 점수 미니 그래프 (0~100 고정 눈금). 목록의 sparkline 등
import { computed } from 'vue'
const props = withDefaults(
  defineProps<{ values?: unknown[]; level?: string; width?: number; height?: number }>(),
  { values: () => [], level: '', width: 80, height: 26 },
)
const numbers = computed(() =>
  (props.values || []).map(Number).filter((v) => Number.isFinite(v)),
)
const points = computed(() => {
  const n = numbers.value
  if (!n.length) return ''
  const step = n.length > 1 ? props.width / (n.length - 1) : 0
  const y = (v: number) => (props.height - 2 - (Math.max(0, Math.min(100, v)) / 100) * (props.height - 4)).toFixed(1)
  return n.length === 1
    ? `0,${y(n[0]!)} ${props.width},${y(n[0]!)}`
    : n.map((v, i) => `${(i * step).toFixed(1)},${y(v)}`).join(' ')
})
</script>
<template>
  <svg
    v-if="points"
    class="pm-sparkline"
    :class="'pm-sparkline--'+(level||'none').toLowerCase()"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    aria-hidden="true"
  >
    <polyline :points="points" fill="none" stroke-width="1.6" />
  </svg>
  <span v-else class="pm-sparkline-empty">—</span>
</template>
<style scoped>
.pm-sparkline polyline { stroke: var(--ink-sub, #5b6573); }
.pm-sparkline--danger polyline { stroke: var(--danger, #c0392b); }
.pm-sparkline--caution polyline { stroke: var(--warn, #d97706); }
.pm-sparkline--safe polyline { stroke: #3b8c3e; }
.pm-sparkline-empty { color: var(--ink-sub, #5b6573); }
</style>

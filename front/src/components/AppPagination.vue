<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ page: number; pages: number; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ change: [page: number] }>()
const total = computed(() => Math.max(1, props.pages))
const start = computed(() => Math.max(1, Math.min(props.page - 2, total.value - 4)))
const numbers = computed(() => Array.from({ length: Math.min(5, total.value - start.value + 1) }, (_, i) => start.value + i))
function select(page: number) {
  if (props.disabled || page < 1 || page > total.value) return
  emit('change', page)
}
</script>
<template>
  <nav class="service-pagination app-number-pagination" aria-label="페이지 선택">
    <button type="button" :disabled="disabled||page<=1" aria-label="이전 페이지" @click="select(page-1)">‹</button>
    <button v-for="number in numbers" :key="number" type="button" :disabled="disabled" :aria-label="number+'페이지'" :aria-current="page===number?'page':undefined" @click="select(number)">{{number}}</button>
    <button type="button" :disabled="disabled||page>=total" aria-label="다음 페이지" @click="select(page+1)">›</button>
  </nav>
</template>
<style scoped>
.app-number-pagination { display:flex; justify-content:center; align-items:center; gap:4px; flex-wrap:wrap; padding:12px 4px; }
.app-number-pagination button { min-width:32px; min-height:36px; padding:5px 8px; border:1px solid var(--line,#c9ced6); border-radius:8px; background:var(--surface,#fff); color:inherit; font:inherit; font-size:12px; }
.app-number-pagination button[aria-current=page] { background:var(--r-selected,#e8f0fb); color:var(--r-accent,#225f9b); border-color:currentColor; font-weight:700; }
.app-number-pagination button:disabled { opacity:.4; }
</style>

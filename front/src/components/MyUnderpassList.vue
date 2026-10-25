<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RiskLevelBadge from './RiskLevelBadge.vue'
import { asPage, backend } from '../services/backend'
type Underpass = { id: number; name: string; regionName?: string; currentRiskLevel?: string; currentStatus?: string; roadAddress?: string }
const props = defineProps<{ selectedId?: string; keyword?: string; target?: string }>()
const emit = defineEmits<{ select: [id: string]; matches: [ids: string[]] }>()
const rows = ref<Underpass[]>([]), loading = ref(false), error = ref('')
let controller: AbortController | undefined
const filtered = computed(() => {
  const word = (props.keyword || '').trim().toLowerCase()
  if (!word) return rows.value
  return rows.value.filter((row) => [row.name, row.regionName, row.roadAddress].some((value) => value?.toLowerCase().includes(word)))
})
// 셀렉트 박스도 같은 검색 결과로 거르도록 부모에 알린다
watch(filtered, (list) => emit('matches', list.map((row) => String(row.id))), { immediate: true })
async function load() {
  controller?.abort()
  const request = new AbortController(); controller = request
  loading.value = true; error.value = ''
  try {
    const result = await backend('/api/underpasses?scope=MINE&sort=NAME&size=500', { signal: request.signal })
    if (!request.signal.aborted) rows.value = asPage<Underpass>(result).items
  } catch (e) { if (!request.signal.aborted) error.value = (e as Error).message }
  finally { if (!request.signal.aborted) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <aside class="my-underpass-list" aria-label="내 담당 지하차도">
    <header><h2>내 지하차도 {{rows.length}}곳</h2><p>누르면 오른쪽에 그 지하차도의 {{target||'관리'}} 화면이 나옵니다.</p></header>
    <p v-if="error" class="my-underpass-error" role="alert">{{error}}</p>
    <p v-else-if="loading&&!rows.length" class="my-underpass-empty" role="status">불러오는 중입니다.</p>
    <p v-else-if="!filtered.length" class="my-underpass-empty">{{props.keyword?'검색 결과가 없습니다.':'담당 지하차도가 없습니다.'}}</p>
    <ul v-else>
      <li v-for="row in filtered" :key="row.id">
        <button type="button" :aria-pressed="String(row.id)===props.selectedId" @click="emit('select',String(row.id))">
          <span class="my-underpass-name">{{row.name}}</span>
          <RiskLevelBadge :value="row.currentRiskLevel" />
          <small>{{row.regionName||'지역 미상'}}<template v-if="row.currentStatus==='BLOCKED'"> · 차단 중</template></small>
        </button>
      </li>
    </ul>
  </aside>
</template>
<style scoped src="../styles/components/my-underpass-list.css"></style>

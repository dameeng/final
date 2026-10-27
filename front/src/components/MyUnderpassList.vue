<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RiskLevelBadge from './RiskLevelBadge.vue'
import { matchesKoreanSearch } from '../utils/korean-search'
import { asPage, backend } from '../services/backend'
type Underpass = { id: number; name: string; regionName?: string; currentRiskLevel?: string; currentStatus?: string; roadAddress?: string }
const props = defineProps<{ selectedId?: string; target?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const keyword = ref('')
const listElement = ref<HTMLUListElement>()
const rows = ref<Underpass[]>([]), loading = ref(false), error = ref('')
let controller: AbortController | undefined
const filtered = computed(() => rows.value.filter(row => matchesKoreanSearch([row.name, row.regionName, row.roadAddress].filter(Boolean).join(' '), keyword.value)))
function searchList() { listElement.value?.scrollTo({ top: 0 }) }
watch(filtered, async () => { await nextTick(); searchList() })
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
    <form class="my-underpass-search-form" role="search" aria-label="담당 지하차도 목록 검색" @submit.prevent="searchList">
      <input v-model="keyword" class="my-underpass-search" type="search" placeholder="지하차도·지역·주소" aria-label="담당 지하차도 검색" />
      <button class="my-underpass-search-submit" type="submit">검색</button>
    </form>
    <p v-if="keyword.trim()&&!loading" class="my-underpass-search-count" role="status">검색 결과 {{filtered.length}}곳</p>
    <p v-if="error" class="my-underpass-error" role="alert">{{error}}</p>
    <p v-else-if="loading&&!rows.length" class="my-underpass-empty" role="status">불러오는 중입니다.</p>
    <p v-else-if="!filtered.length" class="my-underpass-empty">{{keyword.trim()?'검색 결과가 없습니다.':'담당 지하차도가 없습니다.'}}</p>
    <ul v-else ref="listElement">
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

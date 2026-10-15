<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { useApp } from '../composables/use-app';
import { useLoad } from '../composables/use-load';
import { api } from '../services/api';
import { facilities } from '../services/demo';
import { status } from '../services/format';
import { regionNames as regions, regionOf } from '../services/regions';
import type { Facility } from '../services/types';
import KakaoMap from './kakao-map.vue';
import LoadState from './load-state.vue';
import AppIcon from './app-icon.vue';
defineProps<{ title: string }>();
const { state } = useApp();
const { data, loading, error, reload } = useLoad(async () => state.liveFacilities ?? (state.demo ? structuredClone(facilities) : await api.facilities()));
watch(() => state.liveRevision, reload);
const selectionCard = ref<HTMLElement | null>(null);
const query = ref(''), region = ref(''), filter = ref('전체'), page = ref(1), selectedId = ref('');
const filters = ['전체', '통제', '주의', '정상', '미확인'];
const label = (f: Facility) => status(f, state.demo, state.now);
const category = (f: Facility) => label(f).includes('미확인') ? '미확인' : label(f);
const counts = computed(() => Object.fromEntries(filters.map(s => [s, (data.value || []).filter(f => s === '전체' || category(f) === s).length])));
const rows = computed(() => (data.value || []).filter(f => (!region.value || regionOf(f) === region.value) && (filter.value === '전체' || category(f) === filter.value) && `${f.name} ${f.address} ${f.region}`.includes(query.value.trim())));
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / 6)));
const visible = computed(() => rows.value.slice((page.value - 1) * 6, page.value * 6));
const selected = computed(() => rows.value.find(f => f.id === selectedId.value));
watch([query, region, filter], () => { page.value = 1; selectedId.value = ''; });
watch([pages, loading], ([n, busy]) => { if (!busy) page.value = Math.min(page.value, n); });
async function select(id: string) {
 selectedId.value = id;
 const index = rows.value.findIndex(f => f.id === id);
 if (index >= 0) page.value = Math.floor(index / 6) + 1;
 await nextTick();
 const rect = selectionCard.value?.getBoundingClientRect();
 if (rect && (rect.top < 80 || rect.bottom > window.innerHeight - 80)) selectionCard.value?.scrollIntoView({ block: 'center', behavior: 'auto' });
}
function reset() { query.value = ''; region.value = ''; filter.value = '전체'; }
</script>
<template>
  <main class="facility-page">
    <div class="page-heading"><div><span class="eyebrow">SAFE MOBILITY</span><h1>{{ title }}</h1><p>이동 전, 지하차도 상태를 확인하세요.</p></div><button type="button" :disabled="loading" aria-label="시설 현황 새로고침" @click="reload"><AppIcon name="refresh" /></button></div>
    <div class="facility-filters">
      <label class="facility-search"><span>시설 검색</span><input v-model="query" type="search" placeholder="지하차도 이름 또는 주소" /></label>
      <label class="facility-region"><span>지역</span><select v-model="region"><option value="">전국</option><option v-for="item in regions" :key="item">{{ item }}</option></select></label>
    </div>
    <div class="status-filters" aria-label="시설 상태 필터"><button v-for="item in filters" :key="item" type="button" :aria-pressed="filter === item" :data-status="item" @click="filter = item">{{ item }} <strong>{{ loading || error ? '—' : counts[item] }}</strong></button></div>
    <LoadState :loading="loading" :error="error" @retry="reload" />
    <div class="facility-workspace">
      <div class="facility-map-column">
        <KakaoMap :facilities="rows" :selected-id="selectedId" :show-controls="false" @select="select" />
        <div class="map-legend" aria-label="마커 범례"><span data-status="정상">정상</span><span data-status="주의">주의</span><span data-status="통제">통제</span><span data-status="미확인">미확인</span></div>
        <div v-if="selected" ref="selectionCard" class="selected-facility"><div><span class="status-badge" :data-status="category(selected)">{{ label(selected) }}</span><h2>{{ selected.name }}</h2><p>{{ selected.address || selected.region }}</p></div><RouterLink class="detail-link" :to="'/underpasses/' + encodeURIComponent(selected.id)">상세 보기 <AppIcon name="arrow" /></RouterLink></div>
        <p v-else class="map-hint">지도 마커나 목록을 누르면 시설 정보를 확인할 수 있어요.</p>
      </div>
      <section class="facility-list-panel" aria-label="조회 시설">
        <div class="list-heading"><h2>지하차도 목록</h2><span>{{ rows.length }}곳</span></div>
        <ul class="facility-rows"><li v-for="f in visible" :key="f.id"><button type="button" :class="{ 'is-selected': selectedId === f.id }" :aria-pressed="selectedId === f.id" @click="select(f.id)"><span class="facility-row-text"><strong>{{ f.name }}</strong><small>{{ f.region }} · {{ f.address || '주소 미제공' }}</small></span><span class="status-badge" :data-status="category(f)">{{ label(f) }}</span><AppIcon name="arrow" /></button></li></ul>
        <div v-if="!loading && !error && !rows.length" class="facility-empty"><p>조건에 맞는 지하차도가 없습니다.</p><button @click="reset">검색 조건 초기화</button></div>
        <nav v-if="rows.length" class="facility-pagination" aria-label="시설 목록 페이지 이동"><button :disabled="page <= 1" @click="page--">이전</button><span>{{ page }} / {{ pages }}</span><button :disabled="page >= pages" @click="page++">다음</button></nav>
      </section>
    </div>
    <div class="home-shortcuts"><RouterLink to="/weather"><AppIcon name="weather"/><span>지역별 날씨</span><AppIcon name="arrow"/></RouterLink><RouterLink to="/navigation"><AppIcon name="map"/><span>목적지 검색</span><AppIcon name="arrow"/></RouterLink></div>
    <p class="facility-footnote">현장 통제와 안내를 우선 확인하세요. 오래된 관측값은 미확인으로 표시됩니다.</p>
  </main>
</template>

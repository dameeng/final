<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { adminKey } from '../main'
import { belongsToRegion } from '../services/regional-access'
import type { Status } from '../services/underpasses'
import MapPanel from '../components/MapPanel.vue'
const { state, control } = inject(adminKey)!
const query = ref('')
const region = ref('전체')
const feedback = ref('')
const allowed = computed(() => state.profile?.role === 'REGIONAL_ADMIN'
  ? state.underpasses.filter((item) => belongsToRegion(item, state.profile))
  : state.underpasses)
const regions = computed(() => ['전체', ...new Set(allowed.value.map((i) => i.region))])
const filtered = computed(() =>
  allowed.value.filter(
    (i) =>
      (region.value === '전체' || region.value === i.region) && i.name.includes(query.value.trim()),
  ),
)
const selected = computed(() => allowed.value.find((i) => i.id === state.selectedId))
watch(allowed, (rows) => {
  if (!rows.some((item) => item.id === state.selectedId)) state.selectedId = rows[0]?.id ?? null
}, { immediate: true })

// 목록 응답엔 강수량이 없어서, 선택된 시설의 최신 위험도 기록(risk-scores)에서 끌어온다.
const rainfallMm = ref<number | null>(null)
async function loadRainfall() {
  if (state.controlBusy) return
  if (!selected.value) { rainfallMm.value = null; return }
  try {
    const response = await fetch(`/api/underpasses/${encodeURIComponent(selected.value.id)}/risk-scores?limit=1`, { credentials: 'include', cache: 'no-store' })
    const body = await response.json()
    const latest = Array.isArray(body?.data) ? body.data.at(-1) : null
    rainfallMm.value = latest && Number.isFinite(Number(latest.rainfallMm)) ? Number(latest.rainfallMm) : null
  } catch { rainfallMm.value = null }
}
watch(() => state.selectedId, () => void loadRainfall(), { immediate: true })
async function submit(status: Status) {
  if (state.controlBusy) return
  if (!selected.value) {
    feedback.value = '시설을 선택해 주세요.'
    return
  }
  if (
    !window.confirm(
      `${selected.value.name}을(를) ${status === '통제' ? '통제' : '해제'}하시겠습니까?`,
    )
  )
    return
  try {
    await control(selected.value.id, status)
    feedback.value = '상태가 변경되었습니다.'
  } catch (e) {
    feedback.value = e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.'
  }
}
</script>

<template>
<div class="routel-admin-page">
  <h1>시설 현황·통제/해제</h1>
  <div class="routel-admin-split">
    
      <section class="routel-admin-panel">
        <h2>{{ state.profile?.role === 'REGIONAL_ADMIN' ? `${state.profile.regionName} 지하차도 지도` : '전국 지하차도 지도' }}</h2>
        <MapPanel :items="allowed" />
        <p>
          <label>시설명 <input v-model="query" type="search" placeholder="지하차도 검색" /> </label>
          <label
            >지역
            <select v-model="region">
              <option v-for="r in regions" :key="r">{{ r }}</option>
            </select>
          </label>
        </p>
        <div class="routel-admin-table-scroll" tabindex="0" role="region" aria-label="데이터 표"><table class="routel-admin-table">
    <tbody>
          <tr>
            <th>시설</th>
            <th>지역</th>
            <th>상태</th>
            <th>선택</th>
          </tr>
          <tr v-for="item in filtered" :key="item.id">
            <td>{{ item.name }}</td>
            <td>{{ item.region }}</td>
            <td><span class="routel-admin-state" :data-state="item.status">{{ item.status }}</span></td>
            <td><button type="button" @click="state.selectedId = item.id">{{ state.selectedId === item.id ? '선택됨' : '선택하여 통제/해제' }}</button></td>
          </tr>
            </tbody>
</table></div>
        <p v-if="!filtered.length">검색 결과가 없습니다.</p>
      </section>
      <section class="routel-admin-panel">
        <h2>시설 상세 및 제어</h2>
        <template v-if="selected">
          <h3>{{ selected.name }}</h3>
          <dl>
            <dt>시설 ID</dt>
            <dd>{{ selected.id }}</dd>
            <dt>지역</dt>
            <dd>{{ selected.region }}</dd>
            <dt>상태</dt>
            <dd>{{ selected.status }}</dd>
            <dt>강수량</dt>
            <dd>{{ rainfallMm ?? "—" }} mm</dd>
            <dt>갱신</dt>
            <dd>{{ selected.updatedAt }}</dd>
          </dl>
          <p>
            <router-link :to="`/facilities/${selected.id}`">상세정보 보기</router-link>
            · <router-link :to="`/facilities/${selected.id}/cctv`">CCTV 보기</router-link>
            · <router-link :to="`/facilities/${selected.id}/operations`">차량·전광판</router-link>
          </p>
          <p>
            <button class="routel-danger-action" :disabled="state.controlBusy || (state.profile?.role === 'REGIONAL_ADMIN' ? state.loading || !!state.error || selected.controlState !== 'OPEN' : selected.status === '통제')" @click="submit('통제')">통제</button>
            <button :disabled="state.controlBusy || (state.profile?.role === 'REGIONAL_ADMIN' ? state.loading || !!state.error || selected.controlState !== 'BLOCKED' : selected.status !== '통제')" @click="submit('정상')">
              통제 해제
            </button>
          </p>
          <p role="status">{{ feedback }}</p>
        </template>
        <p v-else>지도 마커 또는 목록에서 시설을 선택해 주세요.</p>
      </section>
</div>
</div>
</template>
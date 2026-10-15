<script setup lang="ts">
import ZoomableMap from "../../components/ZoomableMap.vue";
import { computed, ref, watch } from 'vue'
import type { Underpass } from '../services/underpasses'
import { koreaRegions } from '../data/korea-regions'
import { aggregateRegions, type RegionRisk } from '../utils/region-risk'
import '../styles/dashboard-risk.css'

const props = defineProps<{ items: Underpass[]; demo: boolean }>()
const rows = computed(() => aggregateRegions(props.items))
const byName = computed(() => new Map(rows.value.map(row => [row.name, row])))
const selected = ref<string | null>(null)
const hovered = ref<string | null>(null)
const focused = ref<string | null>(null)
const active = computed(() => hovered.value ?? focused.value ?? selected.value)
const detail = computed(() => active.value ? byName.value.get(active.value) : undefined)
const mappedNames = new Set<string>(koreaRegions.map(region => region.name))
const unmapped = computed(() => rows.value.filter(row => !mappedNames.has(row.name)).map(row => row.name))
const groups = [
  { key: 'safe', label: '안전' }, { key: 'warning', label: '주의' },
  { key: 'danger', label: '위험·통제' }, { key: 'unknown', label: '정보 없음' },
] as const
function select(name: string) { selected.value = selected.value === name ? null : name }
function summary(row: RegionRisk) {
  return `${row.name}, 전체 ${row.total}곳, 안전 ${row.safe}, 주의 ${row.warning}, 위험·통제 ${row.danger}, 정보 없음 ${row.unknown}, 위험·통제 비율 ${row.ratio.toFixed(1)}%`
}
function mapLabel(name: string) {
  const row = byName.value.get(name)
  return row ? summary(row) : `${name}, 표시 대상 시설 없음`
}
function fill(name: string) {
  const row = byName.value.get(name)
  if (!row || row.unknown === row.total) return '#e7ebef'
  if (row.ratio === 0) return '#fceaea'
  if (row.ratio < 5) return '#f6c6c4'
  if (row.ratio < 10) return '#e99996'
  if (row.ratio < 20) return '#d76360'
  return '#a93236'
}
watch(byName, (map) => {
  if (selected.value && !map.has(selected.value)) selected.value = null
})
</script>

<template>
  <section class="manager-region-risk" aria-labelledby="manager-region-risk-title">
    <div class="manager-region-risk-heading">
      <h2 id="manager-region-risk-title">지역별 위험도</h2>
      <p>지역별 위험·통제 비율과 시설 분포</p>
    </div>
    <p v-if="demo" class="manager-region-risk-demo">데모 데이터입니다. 실제 운영 현황이 아닙니다.</p>
    <div class="manager-region-risk-layout">
      <div class="manager-region-risk-map-panel">
        <ZoomableMap :height="460"><svg class="manager-region-risk-map" viewBox="0 0 360 460" role="group" aria-label="시도별 위험·통제 비율 지도">
          <path v-for="region in koreaRegions" :key="region.name" :d="region.path"
            :fill="fill(region.name)" fill-rule="evenodd"
            :class="{ 'is-active': active === region.name }"
            role="button" tabindex="0" :aria-label="mapLabel(region.name)" :aria-pressed="selected === region.name"
            @mouseenter="hovered = region.name" @mouseleave="hovered = null"
            @focus="focused = region.name" @blur="focused = null"
            @click="select(region.name)" @keydown.enter.prevent="select(region.name)" @keydown.space.prevent="select(region.name)">
            <title>{{ mapLabel(region.name) }}</title>
          </path>
        </svg></ZoomableMap>
        <div class="manager-region-risk-scale" aria-label="위험·통제 비율 색상 범례">
          <span><i class="risk-map-zero"></i>0%</span><span><i class="risk-map-low"></i>5% 미만</span>
          <span><i class="risk-map-mid"></i>10% 미만</span><span><i class="risk-map-high"></i>20% 미만</span>
          <span><i class="risk-map-max"></i>20% 이상</span><span><i class="risk-map-none"></i>대상 없음·전체 정보 없음</span>
        </div>
        <div class="manager-region-risk-readout" aria-live="polite" aria-atomic="true">
          <template v-if="detail"><strong>{{ detail.name }}</strong><p>안전 {{ detail.safe }} · 주의 {{ detail.warning }} · 위험·통제 {{ detail.danger }} · 정보 없음 {{ detail.unknown }}</p><p>전체 {{ detail.total }}곳 · 위험·통제 비율 {{ detail.ratio.toFixed(1) }}%</p></template>
          <template v-else-if="active"><strong>{{ active }}</strong><p>현재 조회 범위에 표시할 시설이 없습니다.</p></template>
          <p v-else>지도나 목록의 지역에 마우스를 올리거나 선택하면 현황을 확인할 수 있습니다.</p>
        </div>
      </div>
      <div class="manager-region-risk-distribution">
        <div class="manager-region-risk-legend"><span v-for="group in groups" :key="group.key"><i :class="`risk-${group.key}`"></i>{{ group.label }}</span></div>
        <p class="manager-region-risk-sort">위험·통제 비율 높은 순 · 막대는 지역별 전체 시설의 100%</p>
        <ul v-if="rows.length" class="manager-region-risk-list">
          <li v-for="row in rows" :key="row.name">
            <button type="button" class="manager-region-risk-row" :class="{ 'is-active': active === row.name }"
              :aria-label="summary(row)" :aria-pressed="selected === row.name"
              @mouseenter="hovered = row.name" @mouseleave="hovered = null"
              @focus="focused = row.name" @blur="focused = null" @click="select(row.name)">
              <span class="manager-region-risk-name">{{ row.name }}</span>
              <span class="manager-region-risk-bar" aria-hidden="true"><span v-for="group in groups" :key="group.key" :class="`risk-${group.key}`" :style="{ width: `${row[group.key] / row.total * 100}%` }"></span></span>
              <span class="manager-region-risk-percent">{{ row.ratio.toFixed(1) }}%</span>
              <span class="manager-region-risk-counts">안전 {{ row.safe }} · 주의 {{ row.warning }} · 위험·통제 {{ row.danger }} · 정보 없음 {{ row.unknown }} / {{ row.total }}곳</span>
            </button>
          </li>
        </ul>
        <p v-else class="manager-region-risk-empty">표시할 시설이 없습니다.</p>
      </div>
    </div>
    
    <p v-if="unmapped.length" class="manager-region-risk-note">지도에 연결되지 않은 지역: {{ unmapped.join(', ') }}. 해당 시설은 목록 집계에 포함됩니다.</p>
    
  </section>
</template>

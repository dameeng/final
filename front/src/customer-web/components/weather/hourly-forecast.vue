<script setup lang="ts">
import { dateParts } from '../../utils/display-date'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Hour = { time: string; temperature?: number | null; rainfall?: number | null; precipitationProbability?: number | null }
type Metric = 'temperature' | 'precipitationProbability' | 'rainfall'
const props = defineProps<{ hours: Hour[] }>()
const metrics: { key: Metric; label: string; unit: string }[] = [
  { key: 'temperature', label: '기온', unit: '°C' },
  { key: 'precipitationProbability', label: '강수 확률', unit: '%' },
  { key: 'rainfall', label: '강우량', unit: ' mm' },
]
const hourLabel = (value: string) => dateParts(value)?.time || value
const selected = ref<Metric>('temperature')
const metric = computed(() => metrics.find(item => item.key === selected.value)!)
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const display = (value: unknown, unit: string) => valid(value) ? `${value}${unit}` : '—'
const chart = computed(() => {
  const values = props.hours.map(hour => hour[selected.value])
  const received = values.filter(valid)
  let low = 0, high = 1
  if (selected.value === 'precipitationProbability') high = 100
  else if (selected.value === 'temperature' && received.length) {
    low = Math.floor((Math.min(...received) - 2) / 5) * 5
    high = Math.ceil((Math.max(...received) + 2) / 5) * 5
  } else if (received.length) high = Math.max(1, Math.ceil(Math.max(...received) * 1.2))
  // Keep invalid/out-of-range received values visible rather than clipping them.
  if (received.length) { low = Math.min(low, ...received); high = Math.max(high, ...received) }
  // 가로 스크롤 없이 그래프 영역 폭에 맞춥니다.
  const width = Math.max(280, chartWidth.value)
  const y = (value: number) => 44 + (high - value) / (high - low) * 176
  const points = props.hours.map((hour, index) => ({
    time: hour.time, value: values[index],
    x: props.hours.length === 1 ? width / 2 : 60 + index / Math.max(1, props.hours.length - 1) * (width - 100),
    y: valid(values[index]) ? y(values[index]) : null,
  }))
  let connected = false
  const path = points.map(point => {
    if (point.y === null) { connected = false; return '' }
    const command = connected ? 'L' : 'M'
    connected = true
    return `${command} ${point.x} ${point.y}`
  }).join(' ')
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = low + (high - low) * index / 4
    return { y: y(value), label: Number(value.toFixed(2)) }
  })
  // 점 간격이 좁으면 값 라벨은 숨기고(점에 마우스를 올리면 표시) 시각 라벨은 하나 걸러 표시합니다.
  const gap = (width - 100) / Math.max(1, props.hours.length - 1)
  return { width, points, path, ticks, received: received.length, showValues: gap >= 44, timeStep: gap >= 36 ? 1 : 2 }
})
const chartEl = ref<HTMLElement | null>(null)
const chartWidth = ref(680)
let chartResize: ResizeObserver | undefined
onMounted(() => {
  if (!chartEl.value) return
  chartWidth.value = chartEl.value.clientWidth || chartWidth.value
  chartResize = new ResizeObserver(([entry]) => { if (entry) chartWidth.value = Math.round(entry.contentRect.width) })
  chartResize.observe(chartEl.value)
})
onBeforeUnmount(() => chartResize?.disconnect())
</script>

<template>
  <div class="hourly-line-chart">
    <div class="hourly-line-chart__controls" role="group" aria-label="시간별 예보 항목">
      <button v-for="item in metrics" :key="item.key" type="button"
        :aria-pressed="selected === item.key" @click="selected = item.key">{{ item.label }}</button>
    </div>
    <p class="hourly-line-chart__caption" aria-live="polite">{{ metric.label }} ({{ metric.unit.trim() }}) · 시간별 예보</p>
    <div ref="chartEl" class="hourly-line-chart__area">
    <div v-if="chart.received" class="hourly-line-chart__scroll">
      <svg class="hourly-line-chart__svg" :width="chart.width" height="292" :viewBox="`0 0 ${chart.width} 292`" role="img" :aria-label="`시간별 ${metric.label} 꺾은선 그래프. 점에 마우스를 올리면 정확한 값을 확인할 수 있습니다.`">
        <g v-for="(tick, index) in chart.ticks" :key="index" class="hourly-line-chart__grid">
          <line x1="52" :x2="chart.width - 24" :y1="tick.y" :y2="tick.y" />
          <text x="42" :y="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
        </g>
        <path class="hourly-line-chart__line" :d="chart.path" />
        <g v-for="(point, index) in chart.points" :key="index">
          <template v-if="point.y !== null">
            <circle class="hourly-line-chart__dot" :cx="point.x" :cy="point.y" r="4"><title>{{ point.time }} · {{ display(point.value, metric.unit) }}</title></circle>
            <text v-if="chart.showValues" class="hourly-line-chart__value" :x="point.x" :y="point.y - 13" text-anchor="middle">{{ display(point.value, metric.unit) }}</text>
          </template>
          <text v-else class="hourly-line-chart__missing" :x="point.x" y="244" text-anchor="middle">—</text>
          <text v-if="index % chart.timeStep === 0" class="hourly-line-chart__time" :x="point.x" y="275" text-anchor="middle">{{ hourLabel(point.time) }}</text>
        </g>
      </svg>
    </div>
    <p v-else class="hourly-line-chart__empty" role="status">{{ metric.label }} 예보 없음</p>
    </div>
  </div>
</template>

<style scoped src="../../styles/components/hourly-forecast.css"></style>

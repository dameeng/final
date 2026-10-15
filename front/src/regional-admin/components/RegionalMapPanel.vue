<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { adminKey } from '../../shared/admin/main'
import type { Underpass } from '../../shared/admin/services/underpasses'
import { loadRegionalKakaoSdk } from '../../shared/admin/services/kakao-loader'
const props = defineProps<{ items: Underpass[] }>()
const emit = defineEmits<{select:[id:string]}>()
const { state } = inject(adminKey)!
const container = ref<HTMLElement | null>(null)
const message = ref('지도를 불러오는 중입니다.')
const failed = ref(false)
const mapReady=ref(false)
function zoomMap(delta:number){if(mapReady.value&&map)map.setLevel(Math.max(1,Math.min(14,map.getLevel()+delta)))}
let map: any
let markers: any[] = []
let observer: ResizeObserver | undefined
let disposed = false
let previousCoordinates = ''
const points = new Map<string, any>()
function draw() {
  if (!map || disposed || !window.kakao?.maps) return
  const maps = window.kakao.maps
  markers.forEach(marker => marker.setMap(null)); markers = []; points.clear()
  const bounds = new maps.LatLngBounds()
  for (const item of props.items) {
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || Math.abs(item.latitude!) > 90 || Math.abs(item.longitude!) > 180 || (item.latitude === 0 && item.longitude === 0)) continue
    const point = new maps.LatLng(item.latitude, item.longitude)
    points.set(item.id, point)
    const color = item.controlState === 'BLOCKED' ? '#ef4444' : ({ SAFE: '#34d399', WARNING: '#facc15', DANGER: '#fb923c', UNKNOWN: '#94a3b8' }[item.observedRiskLevel || 'UNKNOWN'])
    const selected = state.selectedId === item.id
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 2C8 2 2 8 2 16c0 10 14 24 14 24s14-14 14-24C30 8 24 2 16 2Z" fill="${color}" stroke="${selected ? '#497caa' : '#dbe8f2'}" stroke-width="${selected ? 4 : 2}"/><circle cx="16" cy="16" r="5" fill="white"/></svg>`
    const marker = new maps.Marker({ map, position: point, title: item.name, zIndex: selected ? 10 : 1, image: new maps.MarkerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), new maps.Size(32, 42), { offset: new maps.Point(16, 40) }) })
    maps.event.addListener(marker, 'click', () => { state.selectedId = item.id; emit('select', item.id) })
    markers.push(marker); bounds.extend(point)
  }
  const coordinates = props.items.map(item => `${item.id}:${item.latitude}:${item.longitude}`).join('|')
  if (points.size && coordinates !== previousCoordinates) { map.setBounds(bounds); previousCoordinates = coordinates }
  message.value = points.size ? '' : '표시할 담당 시설의 위치 정보가 없습니다.'
}
async function initialize() {
  mapReady.value=false; failed.value = false; message.value = '지도를 불러오는 중입니다.'
  try {
    // 기존 관리자 지도와 동일한 JavaScript 키 설정을 사용한다.
    const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || '5e63dfabf16ffc6cde7a3831d301be65'
    await loadRegionalKakaoSdk(key)
    if (disposed || !container.value) return
    map = new window.kakao.maps.Map(container.value, { center: new window.kakao.maps.LatLng(36.4, 127.9), level: 13, scrollwheel: false })
    mapReady.value=true
    observer?.disconnect()
    observer = new ResizeObserver(() => { const center = map.getCenter(); map.relayout(); map.setCenter(center) })
    observer.observe(container.value)
    draw()
  } catch { failed.value = true; message.value = '지도 연결 확인 필요. 시설 목록에서도 시설을 선택할 수 있습니다.' }
}
watch(() => props.items, draw, { deep: true })
watch(() => state.selectedId, (id, previousId) => {
  draw()
  if (!map || !id || id === previousId) return
  const point = points.get(id)
  if (point) map.setCenter(point)
})

onMounted(initialize)
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); markers.forEach(marker => marker.setMap(null)) })
</script>
<template>
  <div class="regional-map-wrap">
    <div ref="container" class="regional-map-canvas" role="region" aria-label="담당 지역 지하차도 지도. 시설 목록에서도 선택할 수 있습니다."></div>
    <div v-if="message" class="regional-map-message" role="status">{{ message }}<button v-if="failed" type="button" @click="initialize">다시 시도</button></div>
    <div class="regional-map-zoom" role="group" aria-label="지도 확대 축소" @click.stop @pointerdown.stop>
      <button type="button" :disabled="!mapReady" aria-label="지도 확대" @click="zoomMap(-1)">+ 확대</button>
      <button type="button" :disabled="!mapReady" aria-label="지도 축소" @click="zoomMap(1)">− 축소</button>
    </div>
  </div>
</template>

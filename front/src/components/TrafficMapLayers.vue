<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getBusanCameras } from '../services/busanCctv'
import TrafficVideo from './TrafficVideo.vue'
type Point = { id: string; name: string; address: string; lat: number; lng: number; kind: 'cctv' | 'vms'; url?: string; content?: string; updatedAt?: string }
const props = defineProps<{ map: any; maps: any }>()
const showCctv = ref(false), showVms = ref(false), loading = ref(false), error = ref('')
const points = ref<Point[]>([]), active = ref<Point>(), dialog = ref<HTMLDialogElement>()
let overlays: any[] = [], disposed = false, generation = 0
const icon = (kind: 'cctv' | 'vms') => kind === 'cctv'
  ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h13v9H3zM16 8l5-2v8l-5-2M7 14v5m-3 0h10"/></svg>'
  : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="13" rx="2"/><path d="M6 8h3m3 0h6M6 12h12M7 16v5m10-5v5"/></svg>'
function clear() { overlays.forEach(overlay => overlay.setMap(null)); overlays = [] }
function draw() {
  clear()
  if (!props.map || !props.maps) return
  const bounds = props.map.getBounds()
  for (const point of points.value) {
    if (!(point.kind === 'cctv' ? showCctv.value : showVms.value)) continue
    const position = new props.maps.LatLng(point.lat, point.lng)
    if (!bounds.contain(position)) continue
    const button = document.createElement('button')
    button.type = 'button'; button.className = `traffic-device-marker ${point.kind}`
    button.title = point.name; button.setAttribute('aria-label', `${point.kind === 'cctv' ? 'CCTV' : 'VMS 전광판'} · ${point.name}`)
    button.innerHTML = icon(point.kind)
    button.onclick = event => { event.stopPropagation(); active.value = point }
    button.onmousedown = () => props.maps.event.preventMap()
    overlays.push(new props.maps.CustomOverlay({ map: props.map, position, content: button, yAnchor: 1, zIndex: 6 }))
  }
}
async function load() {
  const ticket = ++generation
  error.value = ''
  if (!showCctv.value && !showVms.value) { loading.value = false; draw(); return }
  loading.value = true
  const results = await Promise.allSettled([
    showCctv.value ? getBusanCameras() : Promise.resolve([]),
    showVms.value ? fetch('/map-vms.json', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error('VMS 목록을 불러오지 못했습니다.')
      const rows = await response.json()
      if (!Array.isArray(rows)) throw Error('VMS 목록 형식이 올바르지 않습니다.')
      return rows
    }) : Promise.resolve([]),
  ])
  if (disposed || ticket !== generation) return
  const rows: Point[] = [], messages: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') { messages.push(result.reason?.message || '교통 정보를 불러오지 못했습니다.'); return }
    for (const row of result.value) {
      if (row.lat == null || row.lng == null || !Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng)) || Math.abs(Number(row.lat)) > 90 || Math.abs(Number(row.lng)) > 180) continue
      rows.push({ ...row, id: String(row.id), lat: Number(row.lat), lng: Number(row.lng), kind: index === 0 ? 'cctv' : 'vms' })
    }
  })
  if (showVms.value && !rows.some(row => row.kind === 'vms') && results[1]?.status === 'fulfilled') messages.push('등록된 VMS 전광판이 없습니다.')
  points.value = rows; error.value = messages.join(' '); loading.value = false; draw()
}
watch([showCctv, showVms], () => { if (active.value && !(active.value.kind === 'cctv' ? showCctv.value : showVms.value)) active.value = undefined; void load() })
watch(() => props.map, (map, previous) => {
  if (previous && props.maps) props.maps.event.removeListener(previous, 'idle', draw)
  if (map && props.maps) props.maps.event.addListener(map, 'idle', draw)
  draw()
})
watch(active, async value => {
  await nextTick()
  if (value && !dialog.value?.open) dialog.value?.showModal()
  if (!value) dialog.value?.close()
})
onBeforeUnmount(() => { disposed = true; generation++; clear(); if (props.map && props.maps) props.maps.event.removeListener(props.map, 'idle', draw); dialog.value?.close() })
</script>
<template>
  <div class="traffic-map-layers" aria-label="교통 시설 표시">
    <div class="traffic-layer-switches">
      <button type="button" :aria-pressed="showCctv" @click="showCctv=!showCctv"><span v-html="icon('cctv')"></span>CCTV</button>
      <button type="button" :aria-pressed="showVms" @click="showVms=!showVms"><span v-html="icon('vms')"></span>VMS 전광판</button>
    </div>
    <p v-if="loading" role="status">교통 시설을 불러오는 중…</p>
    <p v-if="error" role="status">{{error}} <button type="button" @click="load">다시 조회</button></p>
  </div>
  <dialog ref="dialog" class="traffic-device-dialog" aria-label="교통 시설 정보" @cancel.prevent="active=undefined" @close="active=undefined">
    <template v-if="active">
      <header><span class="traffic-device-type">{{active.kind==='cctv'?'도로 CCTV':'VMS 전광판'}}</span><button type="button" aria-label="닫기" @click="active=undefined">✕</button></header>
      <h2>{{active.name}}</h2><p v-if="active.address">{{active.address}}</p>
      <TrafficVideo v-if="active.kind==='cctv' && active.url" :key="active.id" :src="active.url" hls />
      <template v-else-if="active.kind==='vms'"><div class="vms-display">{{active.content || '현재 표출 문구가 제공되지 않았습니다.'}}</div><p v-if="active.updatedAt">갱신 시각: {{active.updatedAt}}</p></template>
      <small v-if="active.kind==='cctv'">부산광역시 교통정보 제공 · 제공처 사정에 따라 영상이 지연되거나 중단될 수 있습니다.</small>
    </template>
  </dialog>
</template>
<style>
.traffic-map-layers { position:absolute; top:64px; left:12px; z-index:15; max-width:min(340px,calc(100% - 24px)); color:#243447; }
.traffic-layer-switches { display:flex; gap:6px; }
.traffic-layer-switches button { display:flex; align-items:center; gap:6px; min-height:42px; border:1px solid #c8d1dc; border-radius:22px; background:#fff; padding:8px 14px; box-shadow:0 2px 8px #20304022; font-weight:700; color:#405165; cursor:pointer; }
.traffic-layer-switches button[aria-pressed=true] { color:#135fba; background:#edf5ff; border-color:#327ac8; }
.traffic-layer-switches span { display:flex; }
.traffic-map-layers p { background:#fff; border-radius:8px; padding:8px 10px; font-size:12px; margin:8px 0; box-shadow:0 2px 8px #20304022; }
button.traffic-device-marker { box-sizing:border-box; width:40px; height:40px; min-width:40px; min-height:40px; padding:4px; display:flex; align-items:center; justify-content:center; border:0; border-radius:0; box-shadow:none; background:transparent; color:#315a78; cursor:pointer; transition:transform .15s ease; }
button.traffic-device-marker svg { display:block; width:30px; height:30px; overflow:visible; filter:drop-shadow(0 1px 1px #ffffffee); }
button.traffic-device-marker.vms { background:transparent; color:#806017; }
button.traffic-device-marker:hover { background:transparent; box-shadow:none; transform:translateY(-2px); }
button.traffic-device-marker:focus-visible { outline:2px solid #287ed2; outline-offset:2px; border-radius:5px; }
.traffic-device-dialog { border:0; border-radius:16px; padding:20px; width:min(640px,92vw); max-height:85dvh; overflow:auto; color:#243447; background:#fff; box-shadow:0 16px 60px #172b4d44; }
.traffic-device-dialog::backdrop { background:#10203388; }
.traffic-device-dialog header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.traffic-device-dialog header button { min-width:40px; min-height:40px; border:0; background:#f0f4f8; border-radius:50%; cursor:pointer; }
.traffic-device-dialog h2 { font-size:20px; margin:12px 0; }.traffic-device-type { color:#2468a4; font-weight:700; font-size:13px; }
.traffic-device-dialog video { width:100%; aspect-ratio:16/9; background:#17212b; }.traffic-device-dialog small { display:block; margin-top:12px; line-height:1.6; color:#63758a; }
.vms-display { padding:30px 20px; background:#102019; color:#ffdc67; border:5px solid #34423b; border-radius:8px; font-size:24px; font-weight:700; white-space:pre-wrap; text-align:center; line-height:1.7; }
</style>

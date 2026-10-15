<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Camera } from '../services/admin-api'
const props = defineProps<{ cameras: Camera[]; facilityId: string; loading?: boolean; error?: string }>()
const mode = ref<1 | 4>(1), role = ref('ALL'), selected = ref<number | null>(null)
const root = ref<HTMLElement | null>(null), failed = ref<Record<number, boolean>>({})
const playing = ref(false), busy = ref(false), feedback = ref(''), startedAt = ref(0)
const labels = { CCTV: '일반 CCTV', APPROACH_LPR: '접근 · APPROACH', ROI_LPR: '진입 직전 · ROI' }
const choices = computed(() => props.cameras.filter(c => role.value === 'ALL' || c.cameraRole === role.value))
const visible = computed(() => mode.value === 4 ? choices.value.slice(0, 4) : choices.value.filter(c => c.id === selected.value))
const isAi = (url?: string | null) => !!url && url.startsWith('/ai/stream/')
const hasAi = computed(() => props.cameras.some(c => isAi(c.streamUrl)))
const stream = (url: string) => url + (url.includes('?') ? '&' : '?') + 't=' + startedAt.value
let disposed = false, version = 0, attempted = '', queue = Promise.resolve()
watch(choices, rows => { if (!rows.some(c => c.id === selected.value)) selected.value = rows[0]?.id ?? null }, { immediate: true })
async function requestRunning(run: boolean, token: number) {
  const response = await fetch(`/ai/control/plate/${run ? 'start' : 'stop'}`, { method: 'POST', keepalive: !run })
  if (!response.ok) throw new Error('번호판 인식 서비스에 연결하지 못했습니다.')
  const result = await response.json()
  if (disposed || token !== version) {
    if (run && result.running) await fetch('/ai/control/plate/stop', { method: 'POST', keepalive: true })
    return
  }
  playing.value = result.running === true
  if (run && !playing.value) throw new Error('인식 서비스가 시작되지 않았습니다. 다시 재생해 주세요.')
  startedAt.value = Date.now(); failed.value = {}
}
function setRunning(run: boolean) {
  if (busy.value || disposed) return
  busy.value = true; feedback.value = ''
  const token = version
  queue = queue.then(() => disposed || token !== version ? undefined : requestRunning(run, token))
    .catch(e => { if (!disposed && token === version) feedback.value = e instanceof Error ? e.message : '인식 서비스 연결 실패' })
    .finally(() => { if (!disposed && token === version) busy.value = false })
}
watch(() => props.facilityId, () => {
  version++; attempted = ''; playing.value = false; busy.value = false; failed.value = {}; role.value = 'ALL'
  queue = queue.then(async () => { await fetch('/ai/control/plate/stop', { method: 'POST', keepalive: true }).catch(() => {}) })
})
watch(() => [props.facilityId, hasAi.value] as const, ([id, available]) => {
  if (id && available && attempted !== id) { attempted = id; setRunning(true) }
}, { immediate: true, flush: 'post' })
async function playback(run: boolean) {
  failed.value = {}
  await nextTick()
  const videos = Array.from(root.value?.querySelectorAll('video') ?? [])
  if (run) {
    const result = await Promise.allSettled(videos.map(video => video.play()))
    if (result.some(r => r.status === 'rejected')) feedback.value = '자동 재생이 제한되었습니다. 영상의 재생 버튼을 눌러 주세요.'
  } else videos.forEach(video => video.pause())
  if (hasAi.value) setRunning(run)
}
function stopOnLeave() {
  if (playing.value) void fetch('/ai/control/plate/stop', { method: 'POST', keepalive: true }).catch(() => {})
  playing.value = false
}
window.addEventListener('pagehide', stopOnLeave)
onBeforeUnmount(() => { disposed = true; version++; stopOnLeave(); root.value?.querySelectorAll('video').forEach(v => v.pause()); window.removeEventListener('pagehide', stopOnLeave) })
</script>
<template>
<section ref="root" class="qa-camera-monitor" aria-label="CCTV 재생 및 번호판 인식">
  <div class="qa-camera-toolbar">
    <div class="qa-camera-modes" aria-label="영상 배치"><button type="button" :aria-pressed="mode===1" @click="mode=1">1화면</button><button type="button" :aria-pressed="mode===4" @click="mode=4">4화면</button></div>
    <label>인식 구간<select v-model="role" aria-label="인식 구간"><option value="ALL">전체 카메라</option><option value="APPROACH_LPR">접근 · APPROACH</option><option value="ROI_LPR">진입 직전 · ROI</option><option value="CCTV">일반 CCTV</option></select></label>
    <label v-if="mode===1">카메라<select v-model="selected" aria-label="카메라"><option v-if="!choices.length" :value="null">등록된 카메라 없음</option><option v-for="c in choices" :key="c.id" :value="c.id">#{{ c.id }} · {{ labels[c.cameraRole] }}</option></select></label>
    <button type="button" :disabled="busy || !visible.length" @click="playback(true)">재생{{ hasAi ? ' · 인식 시작' : '' }}</button><button type="button" :disabled="busy || !visible.length" @click="playback(false)">정지</button>
  </div>
  <p v-if="feedback" role="status">{{ feedback }}</p>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-if="hasAi" class="regional-caption" role="status">{{ busy ? '인식 서비스 연결 중…' : playing ? '번호판 인식 중' : '번호판 인식 정지' }}</p>
  <div class="qa-camera-grid" :class="{'is-four':mode===4}">
    <article v-for="c in visible" :key="c.id"><h3>#{{ c.id }} · {{ labels[c.cameraRole] }}</h3><div class="qa-camera-screen">
      <template v-if="isAi(c.streamUrl)"><img v-if="playing && !failed[c.id]" :key="startedAt" :src="stream(c.streamUrl!)" alt="실시간 번호판 인식 영상" @error="failed[c.id]=true"/><p v-else>{{ failed[c.id] ? '영상 연결 확인 필요 · 재생 버튼으로 다시 시도하세요.' : busy ? '인식 영상 연결 중…' : '번호판 인식 대기 중' }}</p></template>
      <video v-else-if="c.streamUrl && !failed[c.id]" :src="c.streamUrl" controls autoplay muted playsinline preload="metadata" @error="failed[c.id]=true" />
      <p v-else>{{ failed[c.id] ? '영상 연결 확인 필요' : '등록된 영상 주소 없음' }}</p>
    </div></article>
  </div>
  <p v-if="!visible.length" class="qa-camera-empty">{{ loading ? '카메라를 불러오는 중…' : '선택한 구간에 등록된 카메라가 없습니다.' }}</p>
  <p v-if="mode===4 && choices.length>4" class="regional-caption">앞의 4개 카메라를 표시합니다. 다른 카메라는 1화면에서 선택해 주세요.</p>
</section>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import type { Underpass } from '../services/underpasses'
const props = defineProps<{ items?: Underpass[] }>()
import { adminKey } from '../main'
const ctx = inject(adminKey)!,
  mapEl = ref<HTMLElement | null>(null),
  message = ref('지도 불러오는 중')
declare global {
  interface Window {
    kakao?: any
  }
}
const facilities = computed(() => props.items ?? ctx.state.underpasses)
let sdkPromise: Promise<void> | undefined
function loadSdk(key: string) {
  if (window.kakao?.maps) return Promise.resolve()
  if (!sdkPromise)
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('지도 로드 실패'))
      document.head.appendChild(script)
    })
  return sdkPromise
}
async function render() {
  if (!mapEl.value || !ctx.state.loaded) return
  const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || '5e63dfabf16ffc6cde7a3831d301be65'
  if (!key) {
    message.value = '지도를 표시할 수 없습니다.'
    return
  }
  try {
    await loadSdk(key)
    window.kakao.maps.load(() => {
      if (!mapEl.value) return
      const map = new window.kakao.maps.Map(mapEl.value, {
          center: new window.kakao.maps.LatLng(36.4, 127.9),
          level: 13,
        }),
        bounds = new window.kakao.maps.LatLngBounds()
      map.addControl(new window.kakao.maps.ZoomControl(),window.kakao.maps.ControlPosition.TOPRIGHT)
      let count = 0
      for (const item of facilities.value) {
        if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue
        const point = new window.kakao.maps.LatLng(item.latitude, item.longitude),
          style = item.status === '통제' ? { color: '#8b1e2d', rank: 6 }
            : item.status === '주의' ? { color: '#e8b923', rank: 3 }
            : item.status === '정상' ? { color: '#2eaa6b', rank: 2 }
            : { color: '#98a4b3', rank: 1 },
          svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38"><path d="M14 1C6.8 1 1 6.8 1 14c0 9.6 13 23 13 23s13-13.4 13-23C27 6.8 21.2 1 14 1z" fill="${style.color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
          marker = new window.kakao.maps.Marker({
            map,
            position: point,
            title: `${item.name} · ${item.status}`,
            image: new window.kakao.maps.MarkerImage(
              'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
              new window.kakao.maps.Size(28, 38),
              { offset: new window.kakao.maps.Point(14, 37) },
            ),
            zIndex: style.rank,
          })
        window.kakao.maps.event.addListener(marker, 'click', () => (ctx.state.selectedId = item.id))
        bounds.extend(point)
        count++
      }
      if (count) {
        map.setBounds(bounds)
        message.value = ''
      } else message.value = '표시할 위치가 없습니다.'
    })
  } catch {
    message.value = '지도를 불러오지 못했습니다.'
    sdkPromise = undefined
  }
}
onMounted(render)
watch(() => ctx.state.loaded, render)
// id/좌표뿐 아니라 상태(정상/주의/통제)도 감시해야 통제·해제 후 마커 색이 다시 그려진다.
// (기존엔 status가 빠져 있어서, refresh()로 state.underpasses가 갱신돼도 지도는 그대로였다.)
watch(
  () => facilities.value.map((i) => `${i.id}:${i.latitude}:${i.longitude}:${i.status}:${i.riskLevel}`).join('|'),
  render,
)
</script>

<template>
  <div ref="mapEl" class="routel-admin-map" role="img" aria-label="전국 지하차도 지도">
    <p v-if="message">{{ message }}</p>
  </div>
</template>

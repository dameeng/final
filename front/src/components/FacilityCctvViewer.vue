<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TrafficVideo from './TrafficVideo.vue'
import { valueLabels } from '../data/backendResources'
const props = defineProps<{ cameras: Record<string, any>[]; underpassId: string }>()
const route = useRoute(),
  selected = ref('')
const current = computed(() => props.cameras.find((camera) => String(camera.id) === selected.value))
watch(
  () => [props.underpassId, props.cameras] as const,
  () => {
    if (!props.cameras.some((camera) => String(camera.id) === selected.value))
      selected.value = String(props.cameras[0]?.id ?? '')
  },
  { immediate: true },
)
function label(camera: Record<string, any>) {
  return `${camera.name || valueLabels[camera.cameraRole] || camera.cameraRole || 'CCTV'} · ${camera.id}`
}
const app = computed(() => route.path.startsWith('/admin-app/'))
</script>
<template>
  <section class="facility-cctv-viewer" aria-label="시설 CCTV">
    <template v-if="current">
      <label class="facility-camera-select">CCTV 선택<select v-model="selected">
          <option v-for="camera in cameras" :key="camera.id" :value="String(camera.id)">
            {{label(camera)}}
          </option>
        </select>
      </label>
      <h2>{{label(current)}}</h2>
      <div class="facility-camera-stage">
        <TrafficVideo
          v-if="current.streamUrl"
          :key="underpassId+':'+current.id+':'+current.streamUrl"
          :src="current.streamUrl"
          hls
        />
        <p v-else>영상 주소가 등록되지 않았습니다.</p>
      </div>
      <nav class="facility-camera-links" aria-label="CCTV 관련 기록">
        <RouterLink
          v-if="current.cameraRole!=='CCTV'"
          :to="{path:app?'/admin-app/ocr':'/admin-data/ocr',query:{underpassId}}"
        >이 시설의 OCR 인식 기록 보기 →</RouterLink>
        <RouterLink
          :to="{path:app?'/admin-app/transits':'/admin-data/transits',query:{underpassId}}"
        >차량 통과 기록 보기 →</RouterLink>
      </nav>
    </template>
    <p v-else>등록된 CCTV가 없습니다.</p>
  </section>
</template>
<style scoped>
.facility-cctv-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.facility-camera-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}
.facility-camera-select select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line,#c9ced6);
  border-radius: 8px;
  background: var(--surface,#fff);
  color: inherit;
  font: inherit;
}
.facility-cctv-viewer h2 {
  margin: 0;
  font-size: 16px;
}
.facility-camera-stage {
  overflow: hidden;
  border-radius: 10px;
  background: #17212b;
}
.facility-camera-stage :deep(video) {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
  max-height: 65dvh;
  object-fit: contain;
  background: #17212b;
}
.facility-camera-stage :deep(p) {
  padding: 16px;
  margin: 0;
  color: #fff;
  font-size: 13px;
  line-height: 1.6;
}
.facility-camera-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}
.facility-camera-links a {
  font-size: 12px;
  color: #225f9b;
  line-height: 1.6;
}
</style>

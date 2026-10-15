<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import demoVideo from '../../../customer-web/assets/images/KakaoTalk_20261002_140817269.mp4'
import '../styles/demo-cctv.css'
withDefaults(defineProps<{ count?: 1 | 4 }>(), { count: 1 })
const root = ref<HTMLElement | null>(null)
const failed = ref<Record<number, boolean>>({})
const retries = ref<Record<number, number>>({})
function retry(index: number) { failed.value[index] = false; retries.value[index] = (retries.value[index] ?? 0) + 1 }
onBeforeUnmount(() => root.value?.querySelectorAll('video').forEach(video => {
  video.pause()
  video.removeAttribute('src')
  video.load()
}))
</script>
<template>
  <section ref="root" class="routel-demo-cctv" aria-label="CCTV 시연 영상">
    <p class="routel-demo-cctv-notice">시연 영상 · 실시간 CCTV 아님 · {{ count === 4 ? '네 화면에 같은 영상을 표시합니다. ' : '' }}재생 버튼을 눌러 시작하세요.</p>
    <div class="routel-demo-cctv-grid" :class="{ 'is-four': count === 4 }">
      <div v-for="index in count" :key="index">
        <h3 v-if="count === 4" class="routel-demo-cctv-title">카메라 {{ index }} · 시연</h3>
        <video v-if="!failed[index]" :key="`${index}-${retries[index] ?? 0}`" :src="demoVideo" :aria-label="`시연 영상 ${index}`" controls muted playsinline preload="metadata" @error="failed[index] = true"></video>
        <div v-else class="routel-demo-cctv-error" role="status">
          <p>시연 영상 {{ index }}을 불러오지 못했습니다.</p>
          <button type="button" @click="retry(index)">영상 {{ index }} 다시 시도</button>
        </div>
      </div>
    </div>
  </section>
</template>

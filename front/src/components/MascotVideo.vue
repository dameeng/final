<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
defineProps<{ src: string; poster: string }>()
const root = ref<HTMLElement>(), video = ref<HTMLVideoElement>(), reduced = ref(false), failed = ref(false)
let observer: IntersectionObserver | undefined, media: MediaQueryList | undefined, visible = false
function sync() {
  if (media) reduced.value = media.matches
  if (!visible || reduced.value || failed.value) video.value?.pause()
  else void video.value?.play().catch(() => {})
}
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', sync)
  sync()
  observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting || false; sync() })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => { observer?.disconnect(); media?.removeEventListener('change', sync); video.value?.pause() })
</script>
<template>
  <div ref="root" class="routel-mascot-media">
    <video v-show="!reduced&&!failed" ref="video" :src="src" :poster="poster" muted loop playsinline preload="metadata" aria-hidden="true" @error="failed=true;sync()"></video>
    <img v-show="reduced||failed" :src="poster" width="384" height="384" alt="" loading="lazy" />
  </div>
</template>
<style scoped>
.routel-mascot-media { width:100%; aspect-ratio:1; background:transparent; }
.routel-mascot-media :is(video,img) { display:block; width:100%; height:100%; object-fit:contain; background:transparent; }
</style>

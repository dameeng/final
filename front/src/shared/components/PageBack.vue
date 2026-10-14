<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fallbackTarget, isUsablePrevious, type NavigationArea } from '../navigation/back-target'
const props = defineProps<{ area: NavigationArea }>()
const route = useRoute(), router = useRouter()
const leaving = ref(false)
async function goBack() {
  if (leaving.value) return
  const previous = router.options.history.state.back
  // Only return to an internal route known by this application's router.
  if (isUsablePrevious(previous, route.fullPath)) {
    const resolved = router.resolve(previous)
    const known = resolved.matched.length > 0 && !resolved.matched.some(record => record.path.includes(':pathMatch'))
    if (known) { router.back(); return }
  }
  leaving.value = true
  try { await router.replace(fallbackTarget(props.area, route.path, route.query.kind)) }
  finally { leaving.value = false }
}
</script>
<template>
  <nav class="routel-page-back" aria-label="이전 화면 이동">
    <button type="button" :disabled="leaving" @click="goBack">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6M8 12h12" /></svg>
      <span>뒤로 가기</span>
    </button>
  </nav>
</template>
<style scoped src="../styles/page-back.css"></style>

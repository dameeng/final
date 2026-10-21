<script setup lang="ts">
import { useRouter } from 'vue-router'
const props = withDefaults(defineProps<{ fallback?: string }>(), {
    fallback: '/admin-app/screen-3',
  }),
  router = useRouter()
function back() {
  const previous = router.options.history.state.back
  if (typeof previous === 'string' && previous.startsWith('/admin-app/')) router.back()
  else void router.replace(props.fallback)
}
</script>
<template>
  <button type="button" class="admin-back-button" aria-label="이전 화면으로" @click="back">
    <UiIcon name="back" />
  </button>
</template>
<style scoped>
.admin-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--ui-control-size, 40px);
  width: var(--ui-control-size, 40px);
  height: var(--ui-control-size, 40px);
  min-width: var(--ui-control-size, 40px);
  min-height: var(--ui-control-size, 40px);
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  line-height: 1;
  vertical-align: middle;
  cursor: pointer;
}
.admin-back-button svg {
  display: block;
  position: static;
  width: var(--ui-icon-size, 24px);
  height: var(--ui-icon-size, 24px);
  flex: none;
}
</style>

<script setup lang="ts">
import { uiIconPaths, type UiIconName } from '../utils/ui-icons'
defineProps<{ name: UiIconName }>()
</script>
<template>
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="uiIconPaths[name]" />
    <path v-if="name === 'theme'" d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
  </svg>
</template>

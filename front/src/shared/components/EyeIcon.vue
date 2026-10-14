<script setup lang="ts">
defineProps<{ hidden?: boolean }>()
</script>
<template><svg class="routel-eye-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="hidden" d="m3 3 18 18"/></svg></template>
<style src="../styles/eye-icon.css"></style>
